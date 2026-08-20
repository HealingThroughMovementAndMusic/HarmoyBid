import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listQuotes } from '@/lib/quotes/quoteApi';
import { computeQuoteStats, computeRevenueTrend, type QuoteStats, type RevenueTrendPoint } from '@/lib/quotes/quoteStats';
import type { Quote } from '@/lib/quotes/quote';
import type { BookedEvent } from '@/lib/scheduling';

// Real Dashboard KPI + revenue-trend data, live: `stats` is `null` only
// during the very first fetch (renders as the honest "—" placeholder),
// then kept in sync via Realtime — any insert/update/delete on `quotes`,
// from any tab or session, triggers a refetch, so deleting a saved quote
// elsewhere updates both the KPI tiles and the trend chart without a
// manual refresh.
//
// `bookings` comes from the caller (Home.tsx's usePersistedBookings(),
// which already has its own Realtime subscription) rather than being
// fetched again here — both computeQuoteStats() and computeRevenueTrend()
// need it to exclude a signed quote whose booking was cancelled.
// `revenueTrend` is derived from the exact same `quotes` fetch and the
// exact same Realtime channel as `stats` — no second subscription.
export function useQuoteStats(bookings: BookedEvent[]) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      listQuotes()
        .then((q) => {
          if (!cancelled) setQuotes(q);
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

  const stats: QuoteStats | null = useMemo(() => (quotes ? computeQuoteStats(quotes, bookings) : null), [quotes, bookings]);
  const revenueTrend: RevenueTrendPoint[] | null = useMemo(
    () => (quotes ? computeRevenueTrend(quotes, bookings) : null),
    [quotes, bookings]
  );

  return { stats, revenueTrend };
}
