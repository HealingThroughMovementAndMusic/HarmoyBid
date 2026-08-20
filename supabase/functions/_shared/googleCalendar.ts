// Shared Calendar-event-creation logic — used by both create-calendar-event
// (the original standalone endpoint, still callable directly) and sign-quote
// (which fires this automatically when a private_event/company_event quote
// gets signed). One place for the actual Google Calendar API call so the
// two callers can't drift out of sync with each other.

import { getGoogleAccessToken } from './googleServiceAccount.ts';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// Israel-only business — a fixed IANA zone name lets the Calendar API
// resolve DST correctly on its own, instead of us computing a UTC offset
// for "start"/"end" (which change across the year).
const TIME_ZONE = 'Asia/Jerusalem';

export interface CreateCalendarEventInput {
  quoteId: string;
  clientName: string;
  planName: string;
  therapistCount?: number | null;
  location?: string;
  /** Local (Asia/Jerusalem) datetime, no UTC offset — e.g. "2026-09-01T10:00:00". */
  start: string;
  end: string;
}

export class CalendarNotConfiguredError extends Error {}

export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<{ eventId: string; htmlLink: string }> {
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');
  if (!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || !calendarId) {
    throw new CalendarNotConfiguredError(
      'Google Calendar sync is not fully set up. Requires GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_CALENDAR_ID Supabase secrets.'
    );
  }

  const accessToken = await getGoogleAccessToken(CALENDAR_SCOPE);

  const description = [
    `הצעת מחיר: ${input.quoteId}`,
    `חבילה: ${input.planName}`,
    input.therapistCount ? `כמות מטפלים: ${input.therapistCount}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `${input.planName} — ${input.clientName}`,
      description,
      location: input.location ?? '',
      start: { dateTime: input.start, timeZone: TIME_ZONE },
      end: { dateTime: input.end, timeZone: TIME_ZONE },
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar event creation failed (${res.status}): ${await res.text()}`);
  }
  const created = (await res.json()) as { id: string; htmlLink: string };
  return { eventId: created.id, htmlLink: created.htmlLink };
}

/** Deletes a single event by id. A 404 (already deleted, or never
 *  existed) is treated as success, not an error — makes retrying a
 *  delete always safe, and covers the case where a client/staff member
 *  already removed the event by hand in Google Calendar. */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');
  if (!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || !calendarId) {
    throw new CalendarNotConfiguredError(
      'Google Calendar sync is not fully set up. Requires GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_CALENDAR_ID Supabase secrets.'
    );
  }

  const accessToken = await getGoogleAccessToken(CALENDAR_SCOPE);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar event deletion failed (${res.status}): ${await res.text()}`);
  }
}
