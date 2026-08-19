import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listClients, upsertClient, deleteClient, type Client } from '@/lib/clients';

// Makes ClientsList.tsx's local `clients` state real and cross-tab live,
// WITHOUT changing ClientsList.tsx/ClientProfile.tsx at all — both already
// consume `clients`/`setClients` as a plain
// `[Client[], Dispatch<SetStateAction<Client[]>>]` pair (the exact shape a
// raw `useState` gives you), and every mutation goes through
// `setClients(prev => ...)`. This hook keeps that identical public shape:
// local state stays the fast, optimistic source of truth for rendering,
// and `setClients` additionally diffs old vs. new array by id and pushes
// the resulting insert/update/delete to Supabase in the background. A
// Realtime subscription refetches on any change (including ones made from
// another tab/session), matching usePersistedPackages.ts exactly.
export function usePersistedClients() {
  const [clients, setClientsState] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const clientsRef = useRef<Client[]>([]);
  clientsRef.current = clients;

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      listClients()
        .then((data) => {
          if (!cancelled) setClientsState(data);
        })
        .catch((err) => console.error('usePersistedClients: refetch failed', err));
    };

    refetch();
    setLoaded(true);

    const channel = supabase
      .channel('clients_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, refetch)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const setClients: Dispatch<SetStateAction<Client[]>> = (update) => {
    const prev = clientsRef.current;
    const next = typeof update === 'function' ? (update as (c: Client[]) => Client[])(prev) : update;
    setClientsState(next);

    const prevById = new Map(prev.map((c) => [c.id, c]));
    const nextById = new Map(next.map((c) => [c.id, c]));

    for (const client of next) {
      const before = prevById.get(client.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(client)) {
        upsertClient(client).catch((err) => console.error('usePersistedClients: save failed', err));
      }
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) {
        deleteClient(id).catch((err) => console.error('usePersistedClients: delete failed', err));
      }
    }
  };

  return { clients, setClients, loaded };
}
