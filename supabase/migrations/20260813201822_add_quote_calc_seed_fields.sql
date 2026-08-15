-- Two more event-detail fields, seeded from the Events Calculator's
-- "הכן הצעת מחיר" action alongside the existing event_therapist_count.
-- Deliberately just these two — the calculator's internal-only figures
-- (wage, travel distance, commission) are never persisted onto a quote.
alter table public.quotes
  add column event_participants_count integer,
  add column event_hourly_rate numeric;
