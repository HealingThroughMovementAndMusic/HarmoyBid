import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

// Client Management / CRM data model (Design Spec Phase 2, C6). Persisted
// via the `clients` table (see supabase/migrations, "add_clients") —
// same authenticated-only RLS + Realtime shape as event_packages/bookings.
// A client is still referenced from scheduling.ts bookings only by
// matching `clientName` (no formal foreign key) — that's a known v1
// limitation, not an oversight; formalize it once bookings carry a real
// client_id.

export const ClientStatusSchema = z.enum(['active', 'dormant', 'new']);
export type ClientStatus = z.infer<typeof ClientStatusSchema>;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'פעיל',
  dormant: 'לא פעיל',
  new: 'חדש',
};

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string().min(1).default('לקוח חדש'),
  email: z.string().default(''),
  phone: z.string().default(''),
  treatment: z.string().default(''),
  status: ClientStatusSchema.default('new'),
  notes: z.string().max(2000).default(''),
  createdAt: z.coerce.date(),
});
export type Client = z.infer<typeof ClientSchema>;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export const DEFAULT_CLIENTS: Client[] = [
  ClientSchema.parse({
    id: 'client-seed-1',
    name: 'TechCo בע"מ',
    email: 'office@techco.example',
    phone: '03-1234567',
    status: 'active',
    createdAt: daysAgo(40),
  }),
  ClientSchema.parse({
    id: 'client-seed-2',
    name: 'סטודיו הרמוניה',
    email: 'studio@harmonia.example',
    phone: '054-9876543',
    status: 'active',
    createdAt: daysAgo(90),
  }),
  ClientSchema.parse({
    id: 'client-seed-3',
    name: 'מלון הים הכחול',
    email: '',
    phone: '09-5551234',
    status: 'dormant',
    createdAt: daysAgo(200),
  }),
];

export function createEmptyClient(): Client {
  return ClientSchema.parse({ id: crypto.randomUUID(), createdAt: new Date() });
}

// Supabase persistence — `clients` table (see supabase/migrations,
// "add_clients"). Every row is Zod-parsed via ClientSchema before it
// reaches React state, matching eventCatalog.ts's established pattern.

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  treatment: string;
  status: string;
  notes: string;
  created_at: string;
}

function fromRow(row: ClientRow): Client {
  return ClientSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    treatment: row.treatment,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  });
}

function toRow(client: Client) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    treatment: client.treatment,
    status: client.status,
    notes: client.notes,
    updated_at: new Date().toISOString(),
  };
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ClientRow[]).map(fromRow);
}

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase.from('clients').upsert(toRow(client));
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}
