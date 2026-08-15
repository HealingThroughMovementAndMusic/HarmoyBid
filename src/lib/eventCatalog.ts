import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

// Event Library — product/package catalog. Distinct from scheduling.ts
// (the Calendar's booked-event data): this file models sellable package
// *templates* (pricing template, capacity, duration, equipment), not
// specific booked instances. Per CLAUDE.md conventions: Zod-validated,
// no free-floating numbers.

export const EquipmentProviderSchema = z.enum(['therapist', 'client', 'venue']);
export type EquipmentProvider = z.infer<typeof EquipmentProviderSchema>;

export const EQUIPMENT_PROVIDER_LABELS: Record<EquipmentProvider, string> = {
  therapist: 'המטפל מביא ציוד',
  client: 'הלקוח מביא ציוד',
  venue: 'המתחם מביא ציוד',
};

export const EventPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).default('חבילה חדשה'),
  description: z.string().default(''),
  /** References NicheSelector's niches — single source of truth for rate/comm/wage. */
  nicheId: z.string().default('b2c'),
  therapistsRequired: z.number().int().min(1).default(2),
  durationHours: z.number().min(0.25).default(4),
  equipmentProvider: EquipmentProviderSchema.default('therapist'),
  equipmentNotes: z.string().default(''),
});
export type EventPackage = z.infer<typeof EventPackageSchema>;

export const DEFAULT_PACKAGES: EventPackage[] = [
  EventPackageSchema.parse({
    id: 'pkg-b2c-standard',
    name: 'אירוע וולנס פרטי',
    description: 'חבילת טיפולים סטנדרטית לאירוע לקוח קצה, גבייה ישירה.',
    nicheId: 'b2c',
    therapistsRequired: 2,
    durationHours: 4,
    equipmentProvider: 'therapist',
  }),
  EventPackageSchema.parse({
    id: 'pkg-b2b-venue',
    name: 'שיתוף פעולה עם מתחם',
    description: 'אספקת מטפלים למתחם/מקום קבוע, תחת עמלת שותפות.',
    nicheId: 'b2b',
    therapistsRequired: 4,
    durationHours: 6,
    equipmentProvider: 'venue',
  }),
  EventPackageSchema.parse({
    id: 'pkg-clinic-launch',
    name: 'הקמת קליניקה',
    description: 'ליווי הקמה וחלוקת רווחים למתחם חדש.',
    nicheId: 'clinic',
    therapistsRequired: 1,
    durationHours: 8,
    equipmentProvider: 'client',
  }),
];

export function createEmptyPackage(): EventPackage {
  return EventPackageSchema.parse({ id: crypto.randomUUID() });
}

// Supabase persistence — `event_packages` table (see
// supabase/migrations, "add_packages_bookings_and_tighten_auth"). Every
// row is Zod-parsed via EventPackageSchema before it reaches React state,
// matching quoteApi.ts's established pattern.

interface EventPackageRow {
  id: string;
  name: string;
  description: string;
  niche_id: string;
  therapists_required: number;
  duration_hours: number;
  equipment_provider: string;
  equipment_notes: string;
}

function fromRow(row: EventPackageRow): EventPackage {
  return EventPackageSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    nicheId: row.niche_id,
    therapistsRequired: row.therapists_required,
    durationHours: row.duration_hours,
    equipmentProvider: row.equipment_provider,
    equipmentNotes: row.equipment_notes,
  });
}

function toRow(pkg: EventPackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    niche_id: pkg.nicheId,
    therapists_required: pkg.therapistsRequired,
    duration_hours: pkg.durationHours,
    equipment_provider: pkg.equipmentProvider,
    equipment_notes: pkg.equipmentNotes,
    updated_at: new Date().toISOString(),
  };
}

export async function listPackages(): Promise<EventPackage[]> {
  const { data, error } = await supabase.from('event_packages').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data as EventPackageRow[]).map(fromRow);
}

export async function upsertPackage(pkg: EventPackage): Promise<void> {
  const { error } = await supabase.from('event_packages').upsert(toRow(pkg));
  if (error) throw error;
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from('event_packages').delete().eq('id', id);
  if (error) throw error;
}
