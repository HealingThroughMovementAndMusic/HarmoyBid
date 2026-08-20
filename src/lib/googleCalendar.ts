import { supabase } from '@/lib/supabaseClient';

// Client-side Google Calendar helper. Calendar sync runs entirely through
// the shared Google service account (GOOGLE_SERVICE_ACCOUNT_KEY +
// GOOGLE_CALENDAR_ID, set as Supabase secrets — see CLAUDE.md's "Google
// Calendar setup") — there's no per-user OAuth connect step anymore, so
// nothing here needs a client ID or a consent-screen redirect.
// The client never sees the service account credential; it only ever
// calls the create-calendar-event Edge Function.

export interface CreateCalendarEventInput {
  quoteId: string;
  clientName: string;
  planName: string;
  therapistNames?: string[];
  location?: string;
  start: string;
  end: string;
}

/** Invokes the create-calendar-event Edge Function — the service-account
 *  credential never leaves the server. Throws if Calendar sync isn't
 *  configured yet or the Google API call fails; callers should treat this
 *  as a non-blocking background step. */
export async function createGoogleCalendarEvent(input: CreateCalendarEventInput) {
  const { data, error } = await supabase.functions.invoke('create-calendar-event', { body: input });
  if (error) throw error;
  return data as { eventId: string; htmlLink: string };
}

/** Invokes the delete-calendar-event Edge Function. Same non-blocking
 *  treatment as create — callers (scheduling.ts's
 *  deleteBookingAndCalendarEvent) catch failures themselves so a Google
 *  API hiccup never blocks the local delete the user actually asked for. */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-calendar-event', { body: { eventId } });
  if (error) throw error;
}
