-- Free-text event/treatment location, carried onto the created Booking and
-- shown on the client-facing PDF/sign page. Same text/not-null/default ''
-- convention as event_start_time/event_end_time (see
-- 20260811192110_quote_event_structured_times.sql).
alter table public.quotes add column event_location text not null default '';
