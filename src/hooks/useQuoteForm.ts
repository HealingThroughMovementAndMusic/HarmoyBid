import { useEffect, useRef, useState } from 'react';
import {
  QuoteLineItemSchema,
  createEmptyLineItem,
  createEmptyQuote,
  type Quote,
  type QuoteLineItem,
  type QuoteType,
} from '@/lib/quotes/quote';
import { saveQuote } from '@/lib/quotes/quoteApi';
import { findOrCreateClient } from '@/lib/quotes/findOrCreateClient';

// Only these two quote types get an automatic clients-table link — a
// company_event's real "customer" identity is the company (name + tax
// id), a shape `clients` doesn't model at all yet; extending it is an
// explicit future decision, not something to guess at here.
const AUTO_LINK_CLIENT_TYPES: QuoteType[] = ['clinic_treatment', 'private_event'];

// Autosave debounce — waits for this much inactivity before persisting a
// draft in the background. Deliberately separate from the explicit Save
// button's own `saving`/`saveError` state below, so a background autosave
// never flashes the Save button's spinner or disabled state.
const AUTOSAVE_DEBOUNCE_MS = 1500;

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

  // Reads the latest `quote` at async-callback time without re-running the
  // autosave effect on every render — see the in-flight-race guard below.
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  // Content snapshot of what's already persisted (or, on mount, of the
  // initial value) — skips redundant network calls when nothing actually
  // changed, and prevents the effect from re-triggering itself after its
  // own `setQuote(saved)` call below (a new object reference, same content).
  const lastAutosavedSnapshotRef = useRef(JSON.stringify(quote));

  // Background draft autosave — never touches a quote that isn't (or is no
  // longer) a draft, never applies the signed-transition (`statusOverride`
  // is a QuoteDocumentScreen-only concept, never passed here), and never
  // runs the explicit Save button's validation gates, so an incomplete
  // draft is still saved as-is. Debounced: the timer restarts on every
  // `quote` change, so it only ever fires after real inactivity.
  useEffect(() => {
    if (quote.status !== 'draft') return;
    const snapshot = JSON.stringify(quote);
    if (snapshot === lastAutosavedSnapshotRef.current) return;

    const startedFrom = quote;
    const timer = setTimeout(() => {
      saveQuote(startedFrom)
        .then((saved) => {
          lastAutosavedSnapshotRef.current = JSON.stringify(saved);
          // Only apply the server's response if nothing changed locally
          // while the request was in flight — avoids reverting a fresher
          // edit the user made mid-save.
          if (quoteRef.current === startedFrom) setQuote(saved);
        })
        .catch((err) => console.error('Quote autosave failed:', err));
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [quote]);

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

  // The ONLY call site that may trigger findOrCreateClient — an explicit
  // save (the "שמור" button, or the save-before-export/send flows that
  // also call this), never the autosave effect above. clinic_treatment/
  // private_event quotes get matched-or-created against the real
  // `clients` table by phone, then email (never by name); company_event
  // quotes are left untouched in this phase (see AUTO_LINK_CLIENT_TYPES).
  async function save(overrides?: Partial<Quote>): Promise<Quote | null> {
    setSaving(true);
    setSaveError(null);
    try {
      let toSave = overrides ? { ...quote, ...overrides } : quote;
      if (AUTO_LINK_CLIENT_TYPES.includes(toSave.quoteType)) {
        const clientId = await findOrCreateClient({
          name: toSave.clientName,
          phone: toSave.clientPhone,
          email: toSave.clientEmail,
        });
        if (clientId) toSave = { ...toSave, clientId };
      }
      const saved = await saveQuote(toSave);
      lastAutosavedSnapshotRef.current = JSON.stringify(saved);
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
