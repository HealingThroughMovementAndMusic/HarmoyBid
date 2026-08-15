// Settings "הצעות ומסמכים" — exactly 2 fields: payment terms + a fixed
// quote note. Rendered into the existing "terms" slot in QuoteDocument.tsx
// (the same spot quote.notesText already occupies), not a new PDF
// section/footer — deliberately, to keep the page-budget impact minimal.
// DEFAULT_QUOTE_DOCUMENT_TEXT is the literal approved default text — a
// user who never opens Settings sees exactly this, unchanged.

import { fetchQuoteDocumentDefaultsRow, type QuoteDocumentDefaultsRow } from '@/lib/business/businessSettingsApi';

export interface QuoteDocumentDefaults {
  paymentTerms: string;
  fixedNote: string;
}

export const DEFAULT_QUOTE_DOCUMENT_TEXT: QuoteDocumentDefaults = {
  paymentTerms: 'התשלום יתבצע בהתאם לתנאים שסוכמו בין הצדדים.',
  fixedNote: 'המחיר המוצג בהצעה מתייחס לשירותים המפורטים בלבד.',
};

let current: QuoteDocumentDefaults = DEFAULT_QUOTE_DOCUMENT_TEXT;

export function getQuoteDocumentDefaults(): QuoteDocumentDefaults {
  return current;
}

function rowToDefaults(row: QuoteDocumentDefaultsRow): QuoteDocumentDefaults {
  return {
    paymentTerms: row.quote_payment_terms_text || DEFAULT_QUOTE_DOCUMENT_TEXT.paymentTerms,
    fixedNote: row.quote_fixed_note_text || DEFAULT_QUOTE_DOCUMENT_TEXT.fixedNote,
  };
}

// Fire-and-forget, safe to call multiple times. Never throws — any
// failure leaves `current` at DEFAULT_QUOTE_DOCUMENT_TEXT.
export async function hydrateQuoteDocumentDefaults(): Promise<void> {
  const row = await fetchQuoteDocumentDefaultsRow();
  if (!row) return;
  current = rowToDefaults(row);
}
