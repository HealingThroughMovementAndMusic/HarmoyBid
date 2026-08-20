// Supabase Edge Function (Deno). The ONLY way the public signing page
// (src/pages/SignQuote.tsx) writes a signature — see get-public-quote for
// why this is a scoped Edge Function rather than a direct client write.
// This one is even narrower than a generic "update this quote" would be:
// it can only ever set client_signature_data_url + status='signed' on the
// single row identified by quoteId, nothing else on the row, and nothing
// on any other row. Rejects if the quote is already signed (409) — a
// re-opened signing link shouldn't silently overwrite an existing
// signature.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';
import { createCalendarEvent, CalendarNotConfiguredError } from '../_shared/googleCalendar.ts';

interface SignQuoteBody {
  quoteId: string;
  signatureDataUrl: string;
  turnstileToken?: string;
}

// Cloudflare Turnstile bot-protection for the public /sign/:quoteId page —
// inert until TURNSTILE_SECRET_KEY is set as a Supabase secret (same
// Dashboard-only pattern as GOOGLE_SERVICE_ACCOUNT_KEY/RESEND_API_KEY).
// Skips verification entirely (logs + continues) if the secret isn't
// configured yet, matching this project's established "build inert,
// activate later" pattern for not-yet-connected integrations.
async function verifyTurnstile(token: string | undefined): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secretKey) {
    console.log('verifyTurnstile: TURNSTILE_SECRET_KEY not set, skipping verification.');
    return { ok: true };
  }
  if (!token) return { ok: false, reason: 'missing_turnstile_token' };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const result = (await res.json()) as { success: boolean };
    return result.success ? { ok: true } : { ok: false, reason: 'turnstile_failed' };
  } catch (err) {
    console.error('verifyTurnstile: request to Cloudflare failed:', err);
    return { ok: false, reason: 'turnstile_verification_error' };
  }
}

const QUOTE_TYPE_LABELS: Record<string, string> = {
  clinic_treatment: 'טיפול בקליניקה',
  private_event: 'אירוע פרטי',
  company_event: 'אירוע חברה',
};

// Writes to `activity_log` (see supabase/migrations,
// "add_signed_at_and_activity_log") — duplicated here rather than
// imported from src/ (Edge Functions can't import from there, same
// reason other constants are already duplicated in this project's
// functions). `quote_signed` is one of the two "terminal" action types
// with a DB-level unique index on (entity_type, entity_id, action_type)
// — upsert+ignoreDuplicates makes a retried/duplicate call a harmless
// no-op instead of an error. Never awaited by the main request path for
// calendar_synced/calendar_sync_failed (those run inside the background
// waitUntil already used for Calendar sync); quote_signed itself IS
// awaited before the response is sent, since it must be logged exactly
// once per real signing regardless of whether the background Calendar
// job ever runs at all (a clinic_treatment quote has no Calendar step).
async function logActivity(
  serviceClient: ReturnType<typeof createClient>,
  input: { actionType: string; entityId: string; title: string; terminal?: boolean }
) {
  const row = { action_type: input.actionType, entity_type: 'quote', entity_id: input.entityId, title: input.title };
  const query = input.terminal
    ? serviceClient.from('activity_log').upsert(row, { onConflict: 'entity_type,entity_id,action_type', ignoreDuplicates: true })
    : serviceClient.from('activity_log').insert(row);
  const { error } = await query;
  if (error) console.error(`logActivity: failed to log ${input.actionType} for ${input.entityId}:`, error.message);
}

// Israel-only business — same fixed IANA zone as googleCalendar.ts, but
// here we need an actual UTC instant (Postgres `timestamptz` has no
// concept of "local time in a zone"), not just a zone name to hand to an
// API. Computes the real UTC offset for Asia/Jerusalem *on the given
// date* (via Intl, no native tz library available in Deno beyond ICU),
// so this is correct across the DST boundary without hardcoding +2/+3 —
// verified against both a summer (UTC+3) and winter (UTC+2) date before
// this was wired in.
const EVENT_TIME_ZONE = 'Asia/Jerusalem';

function timeZoneOffsetMinutes(timeZone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(atUtc)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - atUtc.getTime()) / 60000;
}

/** 'YYYY-MM-DD' + 'HH:MM' local Asia/Jerusalem wall-clock time -> the
 *  correct UTC Date instant. */
function israelLocalToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offsetMinutes = timeZoneOffsetMinutes(EVENT_TIME_ZONE, new Date(naiveUtc));
  return new Date(naiveUtc - offsetMinutes * 60000);
}

// The "quote signed" business-notification email used to live here, but
// moved to archive-quote-pdf: this function runs before the PDF is
// archived to Storage, so it had no way to link to the archived file. See
// that function's own comments for the full rationale.
//
// Fire-and-forget Calendar sync for private_event/company_event quotes —
// non-blocking. clinic_treatment quotes have no event date/time concept
// at all (a walk-in treatment, not a scheduled event), so this never
// fires for them. Silently skips (logs only) when the quote is missing a
// full date+start+end — that's the normal case for a quote that was
// never given event scheduling info, not an error condition worth
// surfacing to the client. Returns the created event's id (or null on
// any failure/skip) so the caller can store it on the booking row for
// later deletion — see createBookingForSignedQuote below.
async function syncQuoteToCalendar(
  serviceClient: ReturnType<typeof createClient>,
  quote: {
    id: string;
    quoteType: string;
    clientName: string | null;
    companyName: string | null;
    eventDate: string | null;
    eventStartTime: string | null;
    eventEndTime: string | null;
    eventTherapistCount: number | null;
  }
): Promise<string | null> {
  if (quote.quoteType !== 'private_event' && quote.quoteType !== 'company_event') return null;
  if (!quote.eventDate || !quote.eventStartTime || !quote.eventEndTime) {
    console.log(`syncQuoteToCalendar: quote ${quote.id} missing full event date/time, skipping.`);
    return null;
  }

  const partyName = quote.companyName || quote.clientName || 'לקוח ללא שם';
  const typeLabel = QUOTE_TYPE_LABELS[quote.quoteType] ?? quote.quoteType;

  try {
    const result = await createCalendarEvent({
      quoteId: quote.id,
      clientName: partyName,
      planName: typeLabel,
      therapistCount: quote.eventTherapistCount,
      start: `${quote.eventDate}T${quote.eventStartTime}:00`,
      end: `${quote.eventDate}T${quote.eventEndTime}:00`,
    });
    console.log(`syncQuoteToCalendar: created event ${result.eventId} for quote ${quote.id}`);
    await logActivity(serviceClient, {
      actionType: 'calendar_synced',
      entityId: quote.id,
      title: `אירוע סונכרן ליומן Google — ${partyName}`,
    });
    return result.eventId;
  } catch (err) {
    if (err instanceof CalendarNotConfiguredError) {
      // Not yet activated (missing secrets) — an expected, inert state
      // for a project that hasn't connected Calendar yet, not a real
      // failure worth surfacing as an activity a user needs to act on.
      console.error('syncQuoteToCalendar: Calendar sync not configured, skipping.', err.message);
      return null;
    }
    console.error('syncQuoteToCalendar: failed to create Calendar event:', err);
    await logActivity(serviceClient, {
      actionType: 'calendar_sync_failed',
      entityId: quote.id,
      title: `סנכרון ליומן Google נכשל — ${partyName}`,
    });
    return null;
  }
}

// Creates the internal-calendar counterpart of the Calendar sync above —
// a row in `bookings`, the same table src/lib/scheduling.ts's
// upsertBooking() writes to from the internal app's own "קבע אירוע"
// dialog. EventsCalendar.tsx and DashboardOverview.tsx already render
// straight off this table via Realtime (usePersistedBookings.ts), so
// nothing on the client needs to change for a booking created here to
// show up in both places. Always runs, even when `googleEventId` is null
// (Calendar sync failed or isn't configured) — a booking with no synced
// Google event still needs to exist locally; it just can't later be
// deleted on the Google side too (deleteBookingAndCalendarEvent skips
// that step when googleEventId is null).
//
// Idempotency: uses the quote's own id as the booking's id (both are
// uuid, no FK or format assumption ties bookings.id to a particular
// generator — confirmed by reading scheduling.ts, EventsCalendar.tsx, and
// the bookings table's migration before relying on this) and upserts, so
// a retried/duplicate call updates the same row instead of creating a
// second one.
async function createBookingForSignedQuote(
  serviceClient: ReturnType<typeof createClient>,
  quote: {
    id: string;
    quoteType: string;
    clientName: string | null;
    companyName: string | null;
    eventDate: string | null;
    eventStartTime: string | null;
    eventEndTime: string | null;
  },
  googleEventId: string | null
) {
  if (quote.quoteType !== 'private_event' && quote.quoteType !== 'company_event') return;
  if (!quote.eventDate || !quote.eventStartTime || !quote.eventEndTime) {
    console.log(`createBookingForSignedQuote: quote ${quote.id} missing full event date/time, skipping.`);
    return;
  }

  const start = israelLocalToUtc(quote.eventDate, quote.eventStartTime);
  const end = israelLocalToUtc(quote.eventDate, quote.eventEndTime);
  if (end.getTime() <= start.getTime()) {
    // Same known limitation as quote.ts's eventDurationHours() — an event
    // whose end time is not after its start time on the same calendar day
    // (e.g. one crossing midnight) isn't modeled anywhere in this app yet.
    // Skip rather than guess at a next-day rollover.
    console.log(`createBookingForSignedQuote: quote ${quote.id} has end time not after start time, skipping.`);
    return;
  }

  const partyName = quote.companyName || quote.clientName || 'לקוח ללא שם';
  const typeLabel = QUOTE_TYPE_LABELS[quote.quoteType] ?? quote.quoteType;

  const { error } = await serviceClient.from('bookings').upsert({
    id: quote.id,
    title: `${typeLabel} — ${partyName}`,
    client_name: partyName,
    location: '',
    therapist_names: [],
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: 'confirmed',
    source: 'internal',
    google_event_id: googleEventId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('createBookingForSignedQuote: failed to upsert booking:', error.message);
    return;
  }
  console.log(`createBookingForSignedQuote: booking ${quote.id} upserted for quote ${quote.id} (google_event_id=${googleEventId ?? 'none'})`);
}

// Runs Calendar sync first, then always creates the booking with whatever
// eventId resulted (or null) — a single sequential flow so the booking
// row can store the Google event id, but Calendar failure still never
// prevents the booking itself from being created (see the two functions'
// own comments for why each step is structured the way it is).
async function syncQuoteToCalendarAndBooking(
  serviceClient: ReturnType<typeof createClient>,
  quote: {
    id: string;
    quoteType: string;
    clientName: string | null;
    companyName: string | null;
    eventDate: string | null;
    eventStartTime: string | null;
    eventEndTime: string | null;
    eventTherapistCount: number | null;
  }
) {
  const googleEventId = await syncQuoteToCalendar(serviceClient, quote);
  await createBookingForSignedQuote(serviceClient, quote, googleEventId);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body: SignQuoteBody;
  try {
    body = (await req.json()) as SignQuoteBody;
  } catch {
    return new Response('Invalid JSON body.', { status: 400, headers: corsHeaders() });
  }
  if (!body.quoteId || !body.signatureDataUrl) {
    return new Response('Missing required fields: quoteId, signatureDataUrl.', { status: 400, headers: corsHeaders() });
  }

  const turnstileResult = await verifyTurnstile(body.turnstileToken);
  if (!turnstileResult.ok) {
    return new Response(JSON.stringify({ error: turnstileResult.reason }), {
      status: 403,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: fetchError } = await serviceClient
    .from('quotes')
    .select('id, status')
    .eq('id', body.quoteId)
    .maybeSingle();

  if (fetchError) {
    return new Response(`Lookup failed: ${fetchError.message}`, { status: 500, headers: corsHeaders() });
  }
  if (!existing) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  if (existing.status === 'signed') {
    return new Response(JSON.stringify({ error: 'already_signed' }), {
      status: 409,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  const signedAt = new Date().toISOString();
  const { data: row, error: updateError } = await serviceClient
    .from('quotes')
    .update({
      client_signature_data_url: body.signatureDataUrl,
      status: 'signed',
      signed_at: signedAt,
      updated_at: signedAt,
    })
    .eq('id', body.quoteId)
    .select('*, quote_line_items(*)')
    .single();

  if (updateError || !row) {
    return new Response(`Sign failed: ${updateError?.message ?? 'unknown error'}`, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  const lineItems = (row.quote_line_items ?? [])
    .slice()
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((r: Record<string, unknown>) => ({
      id: r.id,
      order: r.sort_order,
      treatmentName: r.treatment_name,
      durationMinutes: r.duration_minutes,
      purchaseType: r.purchase_type,
      description: r.description,
      unitPrice: r.unit_price,
      quantity: r.quantity,
    }));

  const quote = {
    id: row.id,
    quoteNumber: row.quote_number,
    quoteType: row.quote_type,
    status: row.status,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    companyName: row.company_name,
    companyTaxId: row.company_tax_id,
    contactPersonPhone: row.contact_person_phone,
    contactPersonEmail: row.contact_person_email,
    eventDate: row.event_date,
    eventStartTime: row.event_start_time,
    eventEndTime: row.event_end_time,
    eventTherapistCount: row.event_therapist_count,
    eventParticipantsCount: row.event_participants_count,
    eventHourlyRate: row.event_hourly_rate,
    eventExpectedHours: row.event_expected_hours,
    notesText: row.notes_text,
    clientSignatureDataUrl: row.client_signature_data_url,
    storagePath: row.storage_path,
    lineItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedAt: row.signed_at,
  };

  // Logged synchronously (awaited before the response) rather than inside
  // the background waitUntil below — this must be recorded exactly once
  // per real signing regardless of whether the Calendar step ever runs
  // (clinic_treatment quotes have no Calendar step at all, and the
  // waitUntil work happens after the response is already sent).
  const partyName = quote.companyName || quote.clientName || 'לקוח ללא שם';
  await logActivity(serviceClient, {
    actionType: 'quote_signed',
    entityId: quote.id,
    title: `הצעה ${quote.quoteNumber || quote.id} — ${partyName} נחתמה`,
    terminal: true,
  });

  // Won't block this response — runs in the background after it's sent.
  EdgeRuntime.waitUntil(
    syncQuoteToCalendarAndBooking(serviceClient, {
      id: quote.id,
      quoteType: quote.quoteType,
      clientName: quote.clientName,
      companyName: quote.companyName,
      eventDate: quote.eventDate,
      eventStartTime: quote.eventStartTime,
      eventEndTime: quote.eventEndTime,
      eventTherapistCount: quote.eventTherapistCount,
    })
  );

  return new Response(JSON.stringify({ quote }), {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
});
