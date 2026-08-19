-- Renamed from 20260809041545_... to 20260809100001_... (was originally
-- timestamped BEFORE 20260809100000_quotes.sql despite granting privileges
-- on the tables that migration creates — replaying migrations from scratch,
-- e.g. a fresh Supabase branch or `db reset`, would fail on this file with
-- "relation does not exist"). Filename-only change: no SQL below was
-- altered, and the already-applied live database is unaffected by this
-- rename — Supabase's remote migration history still tracks this content
-- as applied under its original version; this only fixes the file's
-- position for anyone replaying migrations into a fresh environment.
--
-- service_role bypasses RLS but Postgres still checks base-table GRANTs
-- first, same root cause as the earlier anon/authenticated fix: tables
-- created via raw DDL over the Management API don't get Supabase's usual
-- auto-provisioned default privileges. Edge Functions using the service
-- role key (get-public-quote, sign-quote, archive-quote-to-drive,
-- create-calendar-event) were failing with "permission denied for table
-- quotes" until this.
grant select, insert, update, delete on public.quotes to service_role;
grant select, insert, update, delete on public.quote_line_items to service_role;
grant select, insert, update on public.quote_number_counters to service_role;