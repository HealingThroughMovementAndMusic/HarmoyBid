-- Stores the Google Calendar event id created by sign-quote's
-- syncQuoteToCalendar(), so a later delete (of the booking, or of the
-- quote that created it) can also remove the corresponding Google
-- Calendar event. Nullable — existing rows and any booking created
-- before Calendar sync succeeded simply have no id to delete later, and
-- deletion code treats that as "nothing to do on the Google side."
alter table public.bookings add column google_event_id text;
