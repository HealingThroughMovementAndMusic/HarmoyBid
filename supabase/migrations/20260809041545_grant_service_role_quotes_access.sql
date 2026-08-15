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