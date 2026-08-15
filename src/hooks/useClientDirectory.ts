import { useCallback, useEffect, useState } from 'react';
import { listClientDirectory, type ClientDirectoryEntry } from '@/lib/quotes/clientDirectory';

// Plain useEffect/useState fetch — matches this codebase's actual
// established data-fetching pattern (e.g. QuoteDocumentScreen's own
// getQuote() load), not @tanstack/react-query. react-query is wired up
// at the Provider level in App.tsx but was never actually exercised by
// any component before this — doing so surfaced a hooks crash in this
// exact React 19.2.8 + react-query 5.101.4 combination (`Cannot read
// properties of null (reading 'useState')`), so this hook deliberately
// avoids it rather than debug a dependency nothing else in the app relies
// on. `refetch` lets a caller (e.g. after a quote save) pull in a
// newly-added client without waiting for a natural remount.
export function useClientDirectory() {
  const [clients, setClients] = useState<ClientDirectoryEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listClientDirectory()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch(() => {
        // Autocomplete is a convenience layer on top of the real form —
        // a fetch failure here just means no suggestions, never a blocking
        // error for the person filling out the quote.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { clients, refetch };
}
