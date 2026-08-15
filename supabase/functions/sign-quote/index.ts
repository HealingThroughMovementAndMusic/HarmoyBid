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

// The "quote signed" business-notification email used to live here, but
// moved to archive-quote-pdf: this function runs before the PDF is
// archived to Storage, so it had no way to link to the archived file. See
// that function's own comments for the full rationale.
//
// Fire-and-forget Calendar sync for private_event/company_event quotes —
// same non-blocking treatment. clinic_treatment quotes have no event
// date/time concept at all (a walk-in treatment, not a scheduled event),
// so this never fires for them. Silently skips (logs only) when the quote
// is missing a full date+start+end — that's the normal case for a quote
// that was never given event scheduling info, not an error condition
// worth surfacing to the client.
async function syncQuoteToCalendar(quote: {
  id: string;
  quoteType: string;
  clientName: string | null;
  companyName: string | null;
  eventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  eventTherapistCount: number | null;
}) {
  if (quote.quoteType !== 'private_event' && quote.quoteType !== 'company_event') return;
  if (!quote.eventDate || !quote.eventStartTime || !quote.eventEndTime) {
    console.log(`syncQuoteToCalendar: quote ${quote.id} missing full event date/time, skipping.`);
    return;
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
  } catch (err) {
    if (err instanceof CalendarNotConfiguredError) {
      console.error('syncQuoteToCalendar: Calendar sync not configured, skipping.', err.message);
      return;
    }
    console.error('syncQuoteToCalendar: failed to create Calendar event:', err);
  }
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

  const { data: row, error: updateError } = await serviceClient
    .from('quotes')
    .update({
      client_signature_data_url: body.signatureDataUrl,
      status: 'signed',
      updated_at: new Date().toISOString(),
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
  };

  // Won't block this response — runs in the background after it's sent.
  EdgeRuntime.waitUntil(
    syncQuoteToCalendar({
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
