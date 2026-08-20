import { listQuotes } from './quoteApi';
import { quoteGrandTotal, effectiveLineItems, type Quote } from './quote';
import type { BookedEvent } from '@/lib/scheduling';

export interface QuoteStats {
  /** Quotes not yet signed or rejected — draft or sent. */
  openCount: number;
  /** Sum of grand totals for quotes signed this calendar month, excluding
   *  any whose matching booking was cancelled (see computeQuoteStats). */
  monthlyRevenue: number;
}

// Pure — no I/O — so useQuoteStats.ts can recompute this on every render
// where either `quotes` or `bookings` changed, without a new Supabase
// round-trip. A signed quote's booking shares its id (see
// sign-quote/index.ts's createBookingForSignedQuote), so cross-checking
// bookings here doesn't need a join — just a Map lookup by the same id.
// A quote whose booking was cancelled (the event won't actually happen)
// is excluded from revenue; a quote with no matching booking at all
// (clinic_treatment quotes never get one, or Calendar/booking creation
// failed) still counts — "no booking" isn't the same as "cancelled."
export function computeQuoteStats(quotes: Quote[], bookings: BookedEvent[]): QuoteStats {
  const openCount = quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length;

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const now = new Date();
  const monthlyRevenue = quotes
    .filter((q) => {
      if (q.status !== 'signed') return false;
      const updated = q.updatedAt ?? q.createdAt;
      if (!updated) return false;
      if (updated.getFullYear() !== now.getFullYear() || updated.getMonth() !== now.getMonth()) return false;
      const booking = bookingById.get(q.id);
      return booking?.status !== 'cancelled';
    })
    .reduce((sum, q) => sum + quoteGrandTotal(effectiveLineItems(q)), 0);

  return { openCount, monthlyRevenue };
}

/** One-shot fetch + compute, for a caller with no already-loaded bookings
 *  array of its own. useQuoteStats.ts doesn't use this — it fetches
 *  quotes itself and recomputes via computeQuoteStats() whenever the
 *  bookings prop it's given changes, avoiding a duplicate query. */
export async function getQuoteStats(bookings: BookedEvent[] = []): Promise<QuoteStats> {
  const quotes = await listQuotes();
  return computeQuoteStats(quotes, bookings);
}
