-- Event Library packages and Calendar bookings become real, persisted,
-- realtime-syncable tables — previously in-memory-only (see CLAUDE.md).
-- Column choices mirror src/lib/eventCatalog.ts's EventPackageSchema and
-- src/lib/scheduling.ts's BookedEventSchema exactly.

create table public.event_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'חבילה חדשה',
  description text not null default '',
  niche_id text not null default 'b2c',
  therapists_required integer not null default 2 check (therapists_required >= 1),
  duration_hours numeric not null default 4 check (duration_hours >= 0.25),
  equipment_provider text not null default 'therapist' check (equipment_provider in ('therapist', 'client', 'venue')),
  equipment_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'אירוע חדש',
  package_id uuid references public.event_packages(id) on delete set null,
  client_name text not null default '',
  location text not null default '',
  therapist_names text[] not null default '{}',
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'tentative' check (status in ('tentative', 'confirmed', 'cancelled')),
  source text not null default 'internal' check (source in ('internal', 'google')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_start_idx on public.bookings (start_time);
create index bookings_package_idx on public.bookings (package_id);

alter table public.event_packages enable row level security;
alter table public.bookings enable row level security;

-- A real login now exists (single fixed internal user), so unlike the
-- original "no-auth internal tool" tradeoff documented for quotes, these
-- new tables go straight to authenticated-only from day one.
create policy "authenticated app access" on public.event_packages for all to authenticated using (true) with check (true);
create policy "authenticated app access" on public.bookings for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.event_packages to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;

-- Tighten quotes/quote_line_items/quote_number_counters to match: the
-- permissive anon-inclusive policy was an explicit, documented tradeoff
-- for a no-auth tool (see CLAUDE.md's "Quote module" section) — that
-- premise no longer holds now that a real login gate exists. The public
-- /sign/:quoteId flow is unaffected: it never used the anon key directly,
-- only the two service-role Edge Functions (get-public-quote, sign-quote),
-- which bypass RLS entirely regardless of this change.
drop policy "app access" on public.quotes;
drop policy "app access" on public.quote_line_items;
drop policy "app access" on public.quote_number_counters;

create policy "authenticated app access" on public.quotes for all to authenticated using (true) with check (true);
create policy "authenticated app access" on public.quote_line_items for all to authenticated using (true) with check (true);
create policy "authenticated app access" on public.quote_number_counters for all to authenticated using (true) with check (true);

revoke select, insert, update, delete on public.quotes from anon;
revoke select, insert, update, delete on public.quote_line_items from anon;
revoke select, insert, update on public.quote_number_counters from anon;

-- Realtime: dashboard KPIs and cross-tab sync for quotes/packages/bookings
-- subscribe to postgres_changes, so all three need to be in the publication.
alter publication supabase_realtime add table public.quotes;
alter publication supabase_realtime add table public.event_packages;
alter publication supabase_realtime add table public.bookings;
