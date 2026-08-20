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

export interface RevenueTrendPoint {
  /** 'YYYY-MM', for stable keys/sorting — not itself displayed. */
  monthKey: string;
  /** Short Hebrew month label, e.g. "אוג׳" — what's actually shown on the chart. */
  label: string;
  total: number;
}

// A quote's booking shares its id (see sign-quote/index.ts's
// createBookingForSignedQuote) — a plain Map lookup by that shared id,
// no join needed. A quote whose booking was cancelled (the event won't
// actually happen) is excluded from revenue; a quote with no matching
// booking at all (clinic_treatment quotes never get one) still counts —
// "no booking" isn't the same as "cancelled."
function isRevenueEligible(quote: Quote, bookingById: Map<string, BookedEvent>): boolean {
  if (quote.status !== 'signed' || !quote.signedAt) return false;
  const booking = bookingById.get(quote.id);
  return booking?.status !== 'cancelled';
}

// Pure — no I/O — so useQuoteStats.ts can recompute this on every render
// where either `quotes` or `bookings` changed, without a new Supabase
// round-trip.
//
// Uses `signedAt` (set once, server-side, at the moment a quote is
// signed — never overwritten by a later edit), NOT `updatedAt`, to
// determine which month a quote's revenue belongs to. `updatedAt` bumps
// on any later edit to an already-signed quote (e.g. an internal note),
// which would otherwise silently move that revenue into whatever month
// it happened to be edited in.
export function computeQuoteStats(quotes: Quote[], bookings: BookedEvent[]): QuoteStats {
  const openCount = quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length;

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const now = new Date();
  const monthlyRevenue = quotes
    .filter((q) => {
      if (!isRevenueEligible(q, bookingById)) return false;
      const signedAt = q.signedAt as Date;
      return signedAt.getFullYear() === now.getFullYear() && signedAt.getMonth() === now.getMonth();
    })
    .reduce((sum, q) => sum + quoteGrandTotal(effectiveLineItems(q)), 0);

  return { openCount, monthlyRevenue };
}

// Same eligibility rule as computeQuoteStats, bucketed by signed month
// across the last `monthsBack` calendar months (oldest first). Money math
// goes through quoteGrandTotal(effectiveLineItems(q)) — never a raw SQL
// SUM — because a calc-linked event quote's price (therapists × hours ×
// hourlyRate) isn't a stored column at all; it only exists as this JS
// computation, so any server-side aggregate would silently give ₪0 for
// those quotes (the exact bug already fixed once in
// archive-quote-pdf/index.ts's notification email).
//
// A signed quote that's later deleted disappears from every past month's
// total too, not just the current one — a deliberate, explicit trade-off
// of computing this live from `quotes` rather than keeping a separate
// ledger (see CLAUDE.md/the approved plan for the reasoning).
export function computeRevenueTrend(quotes: Quote[], bookings: BookedEvent[], monthsBack = 6): RevenueTrendPoint[] {
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const eligible = quotes.filter((q) => isRevenueEligible(q, bookingById));
  const now = new Date();

  const points: RevenueTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const total = eligible
      .filter((q) => {
        const signedAt = q.signedAt as Date;
        return signedAt.getFullYear() === monthDate.getFullYear() && signedAt.getMonth() === monthDate.getMonth();
      })
      .reduce((sum, q) => sum + quoteGrandTotal(effectiveLineItems(q)), 0);
    points.push({
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      label: monthDate.toLocaleDateString('he-IL', { month: 'short' }),
      total,
    });
  }
  return points;
}

/** One-shot fetch + compute, for a caller with no already-loaded bookings
 *  array of its own. useQuoteStats.ts doesn't use this — it fetches
 *  quotes itself and recomputes via computeQuoteStats() whenever the
 *  bookings prop it's given changes, avoiding a duplicate query. */
export async function getQuoteStats(bookings: BookedEvent[] = []): Promise<QuoteStats> {
  const quotes = await listQuotes();
  return computeQuoteStats(quotes, bookings);
}
