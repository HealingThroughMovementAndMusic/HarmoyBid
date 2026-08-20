-- Links quotes to the real, persisted `clients` table (see
-- supabase/migrations, "add_clients") — previously the two were entirely
-- disconnected: clients.ts/usePersistedClients.ts/ClientsList.tsx were
-- already a fully working manual client CRM, but nothing ever wrote a row
-- there from the quote-creation flow, and quotes carried no reference
-- back to clients at all.
--
-- `on delete set null`, not `cascade` — deleting a client must never
-- delete their quote history. A quote whose client was deleted simply
-- loses the link (client_id -> null); the quote itself, and its own
-- client_name/client_phone/client_email snapshot fields, are untouched.
--
-- No new unique constraint on clients.phone/email — deliberately, per
-- explicit product decision: neither field is treated as an absolute
-- business identifier (a phone/email can legitimately be shared or
-- absent), so duplicate-prevention is an application-level find-before-
-- create check (src/lib/quotes/findOrCreateClient.ts), not a DB-level
-- constraint that would reject legitimate data.
alter table public.quotes add column client_id uuid references public.clients(id) on delete set null;

create index quotes_client_id_idx on public.quotes (client_id);
