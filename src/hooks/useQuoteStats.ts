import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getQuoteStats, type QuoteStats } from '@/lib/quotes/quoteStats';

// Real Dashboard KPI data, live: `null` while first loading (renders as
// the honest "—" placeholder DashboardOverview already used before any
// data existed at all), then kept in sync via Realtime — any insert/
// update/delete on `quotes`, from any tab or session, triggers a refetch,
// so deleting a saved quote elsewhere really does update the open-quotes
// count here without a manual refresh.
export function useQuoteStats() {
  const [stats, setStats] = useState<QuoteStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      getQuoteStats()
        .then((s) => {
          if (!cancelled) setStats(s);
        })
        .catch((err) => console.error('useQuoteStats: refetch failed', err));
    };

    refetch();

    const channel = supabase
      .channel('quotes_stats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, refetch)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
