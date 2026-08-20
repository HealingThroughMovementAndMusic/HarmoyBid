-- 1. quotes.signed_at — a stable, set-once timestamp for "when this quote
-- was actually signed", set exactly once by sign-quote/index.ts's UPDATE
-- that flips status to 'signed', never touched again by any later edit
-- (saveQuote() never writes this column). Fixes a real bug in the
-- existing single-month revenue tile: it previously used `updated_at`,
-- which a later, unrelated edit to a signed quote (e.g. an internal note)
-- would silently bump — moving that quote's revenue into whatever month
-- it happened to be edited in. Nullable: a quote that isn't signed (or
-- was signed before this migration existed) simply has no value here.
alter table public.quotes add column signed_at timestamptz;

-- 2. activity_log — append-only event feed for "פעילות אחרונה". Rows are
-- only ever INSERTed, from specific, explicit call sites in application
-- code (sign-quote's post-signing step, the quote-delete confirm handler,
-- the booking create/cancel/delete handlers) — never from a generic
-- trigger or from inside a shared/reusable function like saveQuote() or
-- updateBooking(), so an autosave tick or a trivial field edit can never
-- produce a row here. `title` is a human-readable snapshot captured at
-- the moment of the action, not derived via a live join to quotes/
-- bookings, so a row stays fully readable after its source entity is
-- deleted. `entity_id` has no FK — it's informational only, never
-- required for rendering.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in (
    'quote_signed',
    'calendar_synced',
    'calendar_sync_failed',
    'quote_deleted',
    'booking_created',
    'booking_cancelled',
    'booking_deleted'
  )),
  entity_type text not null check (entity_type in ('quote', 'booking')),
  entity_id uuid,
  title text not null,
  description text,
  occurred_at timestamptz not null default now()
);

create index activity_log_occurred_idx on public.activity_log (occurred_at desc);

-- Defensive backstop (not the primary guard — call sites are already
-- structured to only log once) for the two actions that are inherently
-- one-time-per-entity: a quote can only ever be signed once, and only
-- ever deleted once. booking_created/cancelled/deleted are deliberately
-- NOT covered here — a booking's status can toggle back and forth, so
-- "cancelled" isn't a strictly one-time event the way signing/deleting a
-- quote is.
create unique index activity_log_terminal_action_idx
  on public.activity_log (entity_type, entity_id, action_type)
  where action_type in ('quote_signed', 'quote_deleted');

alter table public.activity_log enable row level security;

-- Same authenticated-only shape as every other app table, but INSERT/
-- SELECT only — no UPDATE/DELETE grant at all, since the table is
-- append-only by design and nothing in the app should ever modify or
-- remove a historical entry.
create policy "authenticated read and insert" on public.activity_log for select to authenticated using (true);
create policy "authenticated insert" on public.activity_log for insert to authenticated with check (true);

grant usage on schema public to authenticated;
grant select, insert on public.activity_log to authenticated;
-- sign-quote runs as service_role (no user session) and needs to write
-- quote_signed/calendar_synced/calendar_sync_failed rows — service_role
-- bypasses RLS but still needs an explicit table-level GRANT, the same
-- lesson already hit once for `bookings` in this project.
grant select, insert on public.activity_log to service_role;

alter publication supabase_realtime add table public.activity_log;
