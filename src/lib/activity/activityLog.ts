import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

// Append-only activity feed backing "פעילות אחרונה" (see
// supabase/migrations, "add_signed_at_and_activity_log"). Rows are
// written only from specific, explicit call sites — sign-quote's
// post-signing step, QuotesListScreen's delete-confirm handler, and
// EventsCalendar's create/cancel/delete handlers — never from a shared,
// reusable function like saveQuote() or updateBooking(), so an autosave
// tick or a trivial field edit can never produce a row here.

export const ActivityActionTypeSchema = z.enum([
  'quote_signed',
  'calendar_synced',
  'calendar_sync_failed',
  'quote_deleted',
  'booking_created',
  'booking_cancelled',
  'booking_deleted',
]);
export type ActivityActionType = z.infer<typeof ActivityActionTypeSchema>;

export const ActivityEntityTypeSchema = z.enum(['quote', 'booking']);
export type ActivityEntityType = z.infer<typeof ActivityEntityTypeSchema>;

export const ActivityLogEntrySchema = z.object({
  id: z.string(),
  actionType: ActivityActionTypeSchema,
  entityType: ActivityEntityTypeSchema,
  entityId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  occurredAt: z.coerce.date(),
});
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;

interface ActivityLogRow {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  occurred_at: string;
}

function fromRow(row: ActivityLogRow): ActivityLogEntry {
  return ActivityLogEntrySchema.parse({
    id: row.id,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
  });
}

export async function listRecentActivity(limit: number): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ActivityLogRow[]).map(fromRow);
}

interface LogActivityInput {
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  title: string;
  description?: string | null;
}

// `quote_signed`/`quote_deleted` are inherently one-time-per-entity — a
// DB-level unique index (entity_type, entity_id, action_type) backstops
// the call-site guards already in place, so a duplicate insert is a
// harmless no-op rather than an error the caller needs to handle.
const TERMINAL_ACTIONS: ActivityActionType[] = ['quote_signed', 'quote_deleted'];

export async function logActivity(input: LogActivityInput): Promise<void> {
  const row = {
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    title: input.title,
    description: input.description ?? null,
  };

  if (TERMINAL_ACTIONS.includes(input.actionType)) {
    const { error } = await supabase
      .from('activity_log')
      .upsert(row, { onConflict: 'entity_type,entity_id,action_type', ignoreDuplicates: true });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('activity_log').insert(row);
  if (error) throw error;
}
