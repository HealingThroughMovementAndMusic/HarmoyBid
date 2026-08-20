import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listRecentActivity, type ActivityLogEntry } from '@/lib/activity/activityLog';

// Live-updating "recent activity" feed for the Dashboard. `activity_log`
// is append-only (rows are never updated or deleted — see the migration),
// so this only needs to listen for INSERTs and prepend, unlike the
// `event: '*'` subscriptions used elsewhere in the app for tables whose
// rows do change in place.
export function useActivityLog(limit = 8) {
  const [items, setItems] = useState<ActivityLogEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    listRecentActivity(limit)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => console.error('useActivityLog: initial fetch failed', err));

    const channel = supabase
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const row = payload.new as {
            id: string;
            action_type: string;
            entity_type: string;
            entity_id: string | null;
            title: string;
            description: string | null;
            occurred_at: string;
          };
          setItems((prev) => {
            const next = [
              {
                id: row.id,
                actionType: row.action_type,
                entityType: row.entity_type,
                entityId: row.entity_id,
                title: row.title,
                description: row.description,
                occurredAt: new Date(row.occurred_at),
              } as ActivityLogEntry,
              ...(prev ?? []),
            ];
            return next.slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return items;
}
