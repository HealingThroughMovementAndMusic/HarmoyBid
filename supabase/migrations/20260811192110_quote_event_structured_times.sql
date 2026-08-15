-- Replace free-text event_hours_text with structured start/end times so
-- create-calendar-event can build a real ISO datetime instead of parsing
-- arbitrary text like "10:00-14:00". See CLAUDE.md "Google Calendar setup"
-- for why this was needed (Calendar sync had no caller and no structured
-- time data to build an event from).

alter table public.quotes add column event_start_time text not null default '';
alter table public.quotes add column event_end_time text not null default '';
alter table public.quotes drop column event_hours_text;
