import { z } from 'zod';

// Client Management / CRM data model (Design Spec Phase 2, C6). Local state
// for now — see CLAUDE.md's Event Library / Calendar precedent (no Supabase
// table wired yet). A client is referenced from scheduling.ts bookings only
// by matching `clientName` today (no formal foreign key) — that's a known
// v1 limitation, not an oversight; formalize it once bookings/quotes are
// actually persisted somewhere queryable.

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
