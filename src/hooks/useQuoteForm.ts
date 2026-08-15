import { useState } from 'react';
import {
  QuoteLineItemSchema,
  createEmptyLineItem,
  createEmptyQuote,
  type Quote,
  type QuoteLineItem,
  type QuoteType,
} from '@/lib/quotes/quote';
import { saveQuote } from '@/lib/quotes/quoteApi';

// Local editing state + persistence for a single quote of any type. One
// hook shared by the three type-specific screens — they differ only in
// which top-level fields they render, not in how state is managed.
export function useQuoteForm(
  quoteType: QuoteType,
  existing: Quote | null,
  seedLineItem?: Partial<QuoteLineItem>,
  seedFields?: Partial<Quote>
) {
  const [quote, setQuote] = useState<Quote>(() => {
    if (existing) return existing;
    const empty = createEmptyQuote(quoteType);
    if (!seedLineItem && !seedFields) return empty;
    // Only applies to a brand-new quote (never overrides an existing one's
    // line items) — one seeded row from the package, same schema pass
    // every line item goes through so a stray field can't skip validation.
    const lineItems = seedLineItem ? [QuoteLineItemSchema.parse({ ...createEmptyLineItem(0), ...seedLineItem })] : empty.lineItems;
    return { ...empty, ...seedFields, lineItems };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateField<K extends keyof Quote>(key: K, value: Quote[K]) {
    setQuote((prev) => ({ ...prev, [key]: value }));
  }

  function addLineItem() {
    setQuote((prev) => ({ ...prev, lineItems: [...prev.lineItems, createEmptyLineItem(prev.lineItems.length)] }));
  }

  function updateLineItem(id: string, updates: Partial<QuoteLineItem>) {
    setQuote((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((row) => (row.id === id ? QuoteLineItemSchema.parse({ ...row, ...updates }) : row)),
    }));
  }

  function removeLineItem(id: string) {
    setQuote((prev) => ({ ...prev, lineItems: prev.lineItems.filter((row) => row.id !== id) }));
  }

  async function save(overrides?: Partial<Quote>): Promise<Quote | null> {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveQuote(overrides ? { ...quote, ...overrides } : quote);
      setQuote(saved);
      return saved;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת ההצעה נכשלה.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { quote, setQuote, updateField, addLineItem, updateLineItem, removeLineItem, save, saving, saveError };
}
