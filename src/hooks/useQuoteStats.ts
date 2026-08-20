import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listQuotes } from '@/lib/quotes/quoteApi';
import { computeQuoteStats, type QuoteStats } from '@/lib/quotes/quoteStats';
import type { Quote } from '@/lib/quotes/quote';
import type { BookedEvent } from '@/lib/scheduling';

// Real Dashboard KPI data, live: `null` while first loading (renders as
// the honest "—" placeholder DashboardOverview already used before any
// data existed at all), then kept in sync via Realtime — any insert/
// update/delete on `quotes`, from any tab or session, triggers a refetch,
// so deleting a saved quote elsewhere really does update the open-quotes
// count here without a manual refresh.
//
// `bookings` comes from the caller (Home.tsx's usePersistedBookings(),
// which already has its own Realtime subscription) rather than being
// fetched again here — computeQuoteStats() needs it to exclude a signed
// quote whose booking was cancelled from monthlyRevenue. Recomputes via
// useMemo whenever either `quotes` (this hook's own state) or `bookings`
// (the caller's live array) changes — no extra Supabase query needed for
// the bookings side of a recompute.
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

  return stats;
}
