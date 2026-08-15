import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

// Calendar — time & resource scheduling engine. Distinct from
// eventCatalog.ts (the Event Library's sellable package templates): this
// models specific booked instances (date/time, assigned therapists,
// location, status). `source` distinguishes internally-created bookings
// from ones that will eventually come from a synced Google Calendar (see
// src/lib/googleCalendar.ts) — present now so the Calendar UI has a stable
// place to render both once that sync is actually connected.

export const BookingSourceSchema = z.enum(['internal', 'google']);
export type BookingSource = z.infer<typeof BookingSourceSchema>;

export const BookingStatusSchema = z.enum(['tentative', 'confirmed', 'cancelled']);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookedEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1).default('אירוע חדש'),
  /** Optional link back to an Event Library package template. */
  packageId: z.string().optional(),
  clientName: z.string().default(''),
  location: z.string().default(''),
  therapistNames: z.array(z.string()).default([]),
  start: z.coerce.date(),
  end: z.coerce.date(),
  status: BookingStatusSchema.default('tentative'),
  source: BookingSourceSchema.default('internal'),
});
export type BookedEvent = z.infer<typeof BookedEventSchema>;

function atHour(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export const DEFAULT_BOOKINGS: BookedEvent[] = [
  BookedEventSchema.parse({
    id: 'evt-seed-1',
    title: 'אירוע וולנס — חברת הייטק',
    clientName: 'TechCo בע"מ',
    location: 'תל אביב',
    therapistNames: ['דנה', 'יוסי'],
    start: atHour(1, 10),
    end: atHour(1, 14),
    status: 'confirmed',
  }),
  BookedEventSchema.parse({
    id: 'evt-seed-2',
    title: 'משמרת מתחם קבועה',
    clientName: 'סטודיו הרמוניה',
    location: 'רמת גן',
    therapistNames: ['מאיה'],
    start: atHour(3, 16),
    end: atHour(3, 20),
    status: 'tentative',
  }),
];

export function createEmptyBooking(): BookedEvent {
  const start = atHour(1, 12);
  const end = atHour(1, 16);
  return BookedEventSchema.parse({ id: crypto.randomUUID(), start, end });
}

// Supabase persistence — `bookings` table (see supabase/migrations,
// "add_packages_bookings_and_tighten_auth"). Every row is Zod-parsed via
// BookedEventSchema before it reaches React state, matching quoteApi.ts's
// established pattern. `source` is deliberately never written back here —
// it's always 'internal' for anything created through this app's own UI;
// a future real Google Calendar sync would set 'google' itself.

interface BookingRow {
  id: string;
  title: string;
  package_id: string | null;
  client_name: string;
  location: string;
  therapist_names: string[];
  start_time: string;
  end_time: string;
  status: string;
  source: string;
}

function fromRow(row: BookingRow): BookedEvent {
  return BookedEventSchema.parse({
    id: row.id,
    title: row.title,
    packageId: row.package_id ?? undefined,
    clientName: row.client_name,
    location: row.location,
    therapistNames: row.therapist_names,
    start: row.start_time,
    end: row.end_time,
    status: row.status,
    source: row.source,
  });
}

function toRow(booking: BookedEvent) {
  return {
    id: booking.id,
    title: booking.title,
    package_id: booking.packageId ?? null,
    client_name: booking.clientName,
    location: booking.location,
    therapist_names: booking.therapistNames,
    start_time: booking.start.toISOString(),
    end_time: booking.end.toISOString(),
    status: booking.status,
    source: booking.source,
    updated_at: new Date().toISOString(),
  };
}

export async function listBookings(): Promise<BookedEvent[]> {
  const { data, error } = await supabase.from('bookings').select('*').order('start_time', { ascending: true });
  if (error) throw error;
  return (data as BookingRow[]).map(fromRow);
}

export async function upsertBooking(booking: BookedEvent): Promise<void> {
  const { error } = await supabase.from('bookings').upsert(toRow(booking));
  if (error) throw error;
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
}
