// Supabase Edge Function (Deno). Standalone endpoint wrapping the shared
// deleteCalendarEvent() logic (../_shared/googleCalendar.ts) — called by
// the internal app (src/lib/googleCalendar.ts's deleteGoogleCalendarEvent)
// whenever a booking, or the signed quote that created it, is deleted.
// verify_jwt is left at its default (true) — only the authenticated
// internal app should be able to trigger a Calendar deletion, unlike the
// public sign-quote/get-public-quote functions.
//
// Required secrets: same GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_CALENDAR_ID as
// create-calendar-event.

import { deleteCalendarEvent, CalendarNotConfiguredError } from '../_shared/googleCalendar.ts';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';

interface DeleteEventBody {
  eventId: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body: DeleteEventBody;
  try {
    body = (await req.json()) as DeleteEventBody;
  } catch {
    return new Response('Invalid JSON body.', { status: 400, headers: corsHeaders() });
  }
  if (!body.eventId) {
    return new Response('Missing required field: eventId', { status: 400, headers: corsHeaders() });
  }

  try {
    await deleteCalendarEvent(body.eventId);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
  } catch (err) {
    if (err instanceof CalendarNotConfiguredError) {
      return new Response(JSON.stringify({ error: 'not_configured', message: err.message }), {
        status: 501,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Google Calendar deletion failed: ${message}`, { status: 502, headers: corsHeaders() });
  }
});
