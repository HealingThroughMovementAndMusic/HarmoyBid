// Supabase Edge Function (Deno). Standalone callable endpoint wrapping the
// shared createCalendarEvent() logic (../_shared/googleCalendar.ts) — the
// same function sign-quote calls directly (no HTTP hop) when a
// private_event/company_event quote is signed. Kept as its own endpoint
// too in case something else ever needs to trigger a Calendar sync
// on-demand outside the signing flow.
//
// Required secrets: GOOGLE_SERVICE_ACCOUNT_KEY (shared with Drive
// archival's old setup, still used for Calendar), GOOGLE_CALENDAR_ID (the
// calendar ID the service account was given "Make changes to events"
// access to — usually the owner's own Google account email, since sharing
// your primary calendar exposes it under that address, not "primary").

import { createCalendarEvent, CalendarNotConfiguredError } from '../_shared/googleCalendar.ts';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';

interface CreateEventBody {
  quoteId: string;
  clientName: string;
  planName: string;
  therapistCount?: number | null;
  location?: string;
  start: string;
  end: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body: CreateEventBody;
  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return new Response('Invalid JSON body.', { status: 400, headers: corsHeaders() });
  }
  if (!body.quoteId || !body.start || !body.end) {
    return new Response('Missing required fields (quoteId, start, end)', { status: 400, headers: corsHeaders() });
  }

  try {
    const result = await createCalendarEvent(body);
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
  } catch (err) {
    if (err instanceof CalendarNotConfiguredError) {
      return new Response(JSON.stringify({ error: 'not_configured', message: err.message }), {
        status: 501,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Google Calendar sync failed: ${message}`, { status: 502, headers: corsHeaders() });
  }
});
