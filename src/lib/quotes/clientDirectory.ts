// Client autocomplete data source. There is no persisted `clients` table
// (Clients module is still local-state-only, see CLAUDE.md) — the real,
// persisted history of who's been quoted lives in `quotes` itself, so
// that's the source of truth here: distinct (name, phone, email) triples
// pulled from every saved quote's client fields, most-recently-updated
// first, deduplicated client-side.

import { supabase } from '@/lib/supabaseClient';

export interface ClientDirectoryEntry {
  name: string;
  phone: string;
  email: string;
}

export async function listClientDirectory(): Promise<ClientDirectoryEntry[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('client_name, client_phone, client_email')
    .neq('client_name', '')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const seen = new Map<string, ClientDirectoryEntry>();
  for (const row of data ?? []) {
    const name = (row.client_name ?? '').trim();
    if (!name) continue;
    const phone = row.client_phone ?? '';
    const email = row.client_email ?? '';
    const key = `${name}|${phone}|${email}`;
    // First occurrence wins — rows are already ordered most-recent-first,
    // so this naturally keeps the freshest phone/email for a repeated name.
    if (!seen.has(key)) seen.set(key, { name, phone, email });
  }
  return Array.from(seen.values());
}
