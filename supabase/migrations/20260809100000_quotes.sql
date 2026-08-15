-- Quote module (clinic treatment / private event / company event).
-- No pricing engine, no price lists — unit_price is always a plain,
-- optionally-empty number the user types in. See CLAUDE.md for the
-- domain model this belongs to.
--
-- RLS: enabled with a single permissive "anon full access" policy on
-- both tables. This app has no authentication system (confirmed: no
-- login flow anywhere in src/) and is an internal single-business tool,
-- not a public consumer app — the permissive policy is what makes the
-- feature work at all against the anon key the client ships with. If
-- this app is ever deployed to a public URL, revisit this before that
-- happens; a leaked anon key currently means full read/write access to
-- quotes data. (Contrast with google_calendar_tokens, which stays
-- default-deny because it's only ever touched by Edge Functions.)

create type public.quote_type as enum ('clinic_treatment', 'private_event', 'company_event');

create table public.quotes (
  id                          uuid primary key default gen_random_uuid(),
  quote_number                text not null unique,
  quote_type                  public.quote_type not null,
  status                      text not null default 'draft'
                                check (status in ('draft', 'sent', 'signed', 'rejected')),

  client_name                 text not null default '',
  client_phone                text not null default '',
  client_email                text not null default '',

  company_name                text not null default '',
  company_tax_id               text not null default '',
  contact_person_phone        text not null default '',
  contact_person_email        text not null default '',

  event_date                  date,
  event_hours_text            text not null default '',
  event_therapist_count       integer,

  notes_text                  text not null default '',
  client_signature_data_url   text,

  drive_file_id                text,
  drive_folder_id               text default '1XWXWMyXfmXNLmQiOMasV0wG2cGxO7dAN',

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index quotes_type_idx on public.quotes (quote_type, created_at desc);

create table public.quote_line_items (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references public.quotes (id) on delete cascade,
  sort_order        integer not null default 0,
  treatment_name    text not null default '',
  duration_minutes  integer,
  purchase_type     text,
  description       text not null default '',
  unit_price        numeric(12,2) check (unit_price is null or unit_price >= 0),
  quantity          numeric(10,2) not null default 1 check (quantity > 0),
  created_at        timestamptz not null default now()
);
create index quote_line_items_quote_idx on public.quote_line_items (quote_id, sort_order);

-- Quote numbering: HW-<year>-<seq>, race-free via a row-locked upsert,
-- resets yearly by keying on a new scope string. Not a bare SEQUENCE
-- (non-transactional, needs manual yearly reset) and not
-- select max(...)+1 (a textbook race under concurrent saves).
create table public.quote_number_counters (
  scope       text primary key,
  last_value  integer not null default 0
);

create or replace function public.assign_quote_number() returns trigger
language plpgsql as $$
declare
  v_year text := to_char(coalesce(new.created_at, now()), 'YYYY');
  v_seq  integer;
begin
  if new.quote_number is not null and new.quote_number <> '' then
    return new;
  end if;
  insert into public.quote_number_counters (scope, last_value) values (v_year, 1)
  on conflict (scope) do update set last_value = public.quote_number_counters.last_value + 1
  returning last_value into v_seq;
  new.quote_number := 'HW-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end $$;

create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function public.assign_quote_number();

alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

create policy "app access" on public.quotes for all using (true) with check (true);
create policy "app access" on public.quote_line_items for all using (true) with check (true);

-- This Supabase project auto-enables RLS on every new public-schema table
-- (confirmed via pg_class.relrowsecurity — not something this migration
-- requested), including quote_number_counters even though it holds no
-- per-user data. The numbering trigger inserts into it as whatever role
-- issued the original INSERT (SECURITY INVOKER, Postgres's default for
-- trigger functions), so anon needs the same permissive access here too,
-- or every quote save fails with "new row violates row-level security
-- policy for table quote_number_counters".
alter table public.quote_number_counters enable row level security;
create policy "app access" on public.quote_number_counters for all using (true) with check (true);

-- RLS policies alone aren't enough — Postgres still checks base table
-- GRANTs first. Supabase Studio applies these automatically for
-- Studio-created tables; tables created via raw DDL (as this migration
-- was, over the Management API) need it explicitly or every anon
-- request 401s with "permission denied for table" despite RLS allowing it.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.quotes to anon, authenticated;
grant select, insert, update, delete on public.quote_line_items to anon, authenticated;
grant select, insert, update on public.quote_number_counters to anon, authenticated;

-- Same gap, this time for service_role: it bypasses RLS but not base-table
-- GRANTs, so the get-public-quote/sign-quote/archive-quote-to-drive/
-- create-calendar-event Edge Functions (all service-role-authenticated)
-- 500'd with "permission denied for table quotes" until this was added.
grant select, insert, update, delete on public.quotes to service_role;
grant select, insert, update, delete on public.quote_line_items to service_role;
grant select, insert, update on public.quote_number_counters to service_role;

-- Free-tier storage optimization: quotes that never left draft/rejected
-- state are noise, not records worth keeping. quote_line_items cascades
-- via the FK above, so nothing needs cleaning there separately.
create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_stale_quotes() returns void
language sql as $$
  delete from public.quotes
  where status in ('draft', 'rejected')
    and created_at < now() - interval '30 days';
$$;

select cron.schedule('cleanup-stale-quotes', '0 3 * * *', 'select public.cleanup_stale_quotes();');
