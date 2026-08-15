import { listQuotes } from './quoteApi';
import { quoteGrandTotal, effectiveLineItems } from './quote';

export interface QuoteStats {
  /** Quotes not yet signed or rejected — draft or sent. */
  openCount: number;
  /** Sum of grand totals (before VAT) for quotes signed this calendar month. */
  monthlyRevenue: number;
}

export async function getQuoteStats(): Promise<QuoteStats> {
  const quotes = await listQuotes();
  const openCount = quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length;

  const now = new Date();
  const monthlyRevenue = quotes
    .filter((q) => {
      if (q.status !== 'signed') return false;
      const updated = q.updatedAt ?? q.createdAt;
      if (!updated) return false;
      return updated.getFullYear() === now.getFullYear() && updated.getMonth() === now.getMonth();
    })
    .reduce((sum, q) => sum + quoteGrandTotal(effectiveLineItems(q)), 0);

  return { openCount, monthlyRevenue };
}
