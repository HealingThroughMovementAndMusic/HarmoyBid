// Client autocomplete data source — the real, persisted `clients` table
// (src/lib/clients.ts), the same one ClientsList.tsx/ClientProfile.tsx
// and findOrCreateClient.ts already read from/write to. A client that
// exists there (created via the Clients module, or previously
// find-or-created off a signed quote) is suggested here by name/phone/
// email, so re-quoting an existing client never requires retyping their
// details.

import { supabase } from '@/lib/supabaseClient';

export interface ClientDirectoryEntry {
  name: string;
  phone: string;
  email: string;
}

export async function listClientDirectory(): Promise<ClientDirectoryEntry[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('name, phone, email')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ name: row.name, phone: row.phone, email: row.email }));
}
