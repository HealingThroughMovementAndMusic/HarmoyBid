-- Settings screen redesign, Phase 1 (see the approved planning artifact —
-- single-user, single-business, ILS/Hebrew-only). This table is
-- intentionally isolated: nothing in the app reads or writes it yet.
-- src/lib/business/businessProfile.ts, src/lib/whatsapp.ts, and
-- quote.ts's VAT_RATE_PCT remain the live sources of truth for the
-- existing quote system until a separate, explicitly-approved Phase 2
-- change wires them to read from here instead. This migration must not
-- touch quotes/quote_line_items/quote_number_counters/event_packages/
-- bookings in any way.
--
-- Singleton pattern: one business, one row, id fixed to 1 (mirrors the
-- plan's explicit "no multi-tenant, no business_id" decision — a real
-- surrogate key would imply a cardinality this app doesn't have).
create table public.business_settings (
  id integer primary key default 1 check (id = 1),

  business_name text not null default '',
  business_tax_id text,
  business_phone text,
  business_email text not null default '',
  business_website_url text,
  business_booking_url text,
  business_whatsapp_number text not null default '',

  quote_vat_pct numeric not null default 18 check (quote_vat_pct >= 0 and quote_vat_pct <= 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

-- Same authenticated-only pattern confirmed live for quotes/event_packages/
-- bookings as of the Phase 0 migration sync (add_packages_bookings_and_tighten_auth) —
-- not the older anon-inclusive pattern the very first quotes migration used.
create policy "authenticated app access" on public.business_settings for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.business_settings to authenticated;

-- Seed the single row with the real values already live in the app today
-- (src/lib/business/businessProfile.ts, src/lib/whatsapp.ts, quote.ts's
-- VAT_RATE_PCT) — so Phase 2 has real data to switch consumers onto
-- rather than requiring the business owner to re-type anything already on
-- file. This INSERT does not affect any existing table or app behavior.
insert into public.business_settings (
  id,
  business_name,
  business_tax_id,
  business_phone,
  business_email,
  business_website_url,
  business_booking_url,
  business_whatsapp_number,
  quote_vat_pct
) values (
  1,
  'ריפוי הרמוני',
  '308914217',
  '0533709919',
  'healingthroughmovementandmusic@gmail.com',
  'https://harmonyhealing.co.il/',
  'https://form.harmonyhealing.co.il/',
  '972533709919',
  18
);
