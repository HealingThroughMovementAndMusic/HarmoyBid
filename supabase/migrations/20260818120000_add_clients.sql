-- Client Management / CRM becomes a real, persisted, realtime-syncable
-- table — previously in-memory-only (src/lib/clients.ts's DEFAULT_CLIENTS
-- seed array, lost on every refresh). Column choices mirror
-- src/lib/clients.ts's ClientSchema exactly, same shape as the
-- event_packages/bookings migration this one is modeled on.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'לקוח חדש',
  email text not null default '',
  phone text not null default '',
  treatment text not null default '',
  status text not null default 'new' check (status in ('active', 'dormant', 'new')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Matches the authenticated-only policy already used for
-- quotes/event_packages/bookings — this is a single-fixed-user internal
-- tool with a real login gate, no anon access needed.
create policy "authenticated app access" on public.clients for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.clients to authenticated;

-- Cross-tab live sync, same as quotes/event_packages/bookings.
alter publication supabase_realtime add table public.clients;
