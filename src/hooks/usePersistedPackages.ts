import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listPackages, upsertPackage, deletePackage, type EventPackage } from '@/lib/eventCatalog';

// Makes the Event Library's local `packages` state real and cross-tab
// live, WITHOUT changing EventsLibrary.tsx or DashboardOverview.tsx at
// all — both already consume `packages`/`setPackages` as a plain
// `[EventPackage[], Dispatch<SetStateAction<EventPackage[]>>]` pair (the
// exact shape a raw `useState` gives you), and every mutation they make
// goes through `setPackages(prev => ...)`. This hook keeps that identical
// public shape: local state stays the fast, optimistic source of truth
// for rendering, and `setPackages` additionally diffs old vs. new array
// by id and pushes the resulting insert/update/delete to Supabase in the
// background. A Realtime subscription refetches on any change (including
// ones made from another tab/session) so deletes/edits made elsewhere
// really do show up here without a manual refresh, per the "sync online"
// requirement this was built for.
export function usePersistedPackages() {
  const [packages, setPackagesState] = useState<EventPackage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const packagesRef = useRef<EventPackage[]>([]);
  packagesRef.current = packages;

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      listPackages()
        .then((data) => {
          if (!cancelled) setPackagesState(data);
        })
        .catch((err) => console.error('usePersistedPackages: refetch failed', err));
    };

    refetch();
    setLoaded(true);

    const channel = supabase
      .channel('event_packages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_packages' }, refetch)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const setPackages: Dispatch<SetStateAction<EventPackage[]>> = (update) => {
    const prev = packagesRef.current;
    const next = typeof update === 'function' ? (update as (p: EventPackage[]) => EventPackage[])(prev) : update;
    setPackagesState(next);

    const prevById = new Map(prev.map((p) => [p.id, p]));
    const nextById = new Map(next.map((p) => [p.id, p]));

    for (const pkg of next) {
      const before = prevById.get(pkg.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(pkg)) {
        upsertPackage(pkg).catch((err) => console.error('usePersistedPackages: save failed', err));
      }
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) {
        deletePackage(id).catch((err) => console.error('usePersistedPackages: delete failed', err));
      }
    }
  };

  return { packages, setPackages, loaded };
}
