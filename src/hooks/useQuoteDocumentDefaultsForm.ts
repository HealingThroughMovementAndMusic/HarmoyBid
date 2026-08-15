import { useEffect, useState } from 'react';
import { z } from 'zod';
import { fetchQuoteDocumentDefaultsRow, updateQuoteDocumentDefaultsRow, type QuoteDocumentDefaultsRow } from '@/lib/business/businessSettingsApi';
import { hydrateQuoteDocumentDefaults, DEFAULT_QUOTE_DOCUMENT_TEXT } from '@/lib/quotes/quoteDocumentDefaults';

const QuoteDocumentDefaultsFormSchema = z.object({
  quote_payment_terms_text: z.string().trim().min(1, 'שדה חובה').max(300, 'הטקסט ארוך מדי — יש לקצר כדי לשמור על הצעת המחיר בעמוד אחד'),
  quote_fixed_note_text: z.string().trim().min(1, 'שדה חובה').max(300, 'הטקסט ארוך מדי — יש לקצר כדי לשמור על הצעת המחיר בעמוד אחד'),
});

type FormValues = z.infer<typeof QuoteDocumentDefaultsFormSchema>;

type LoadState = 'loading' | 'error' | 'ready';

function rowToForm(row: QuoteDocumentDefaultsRow): FormValues {
  return {
    quote_payment_terms_text: row.quote_payment_terms_text ?? DEFAULT_QUOTE_DOCUMENT_TEXT.paymentTerms,
    quote_fixed_note_text: row.quote_fixed_note_text ?? DEFAULT_QUOTE_DOCUMENT_TEXT.fixedNote,
  };
}

// Same load/edit/save/error/retry shape as the other 2 Settings forms.
// The 300-char cap is a deliberate, conservative guard against a user
// unintentionally pushing a real quote to a second page — not an
// arbitrary UI limit.
export function useQuoteDocumentDefaultsForm() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [values, setValues] = useState<FormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function load() {
    setLoadState('loading');
    const row = await fetchQuoteDocumentDefaultsRow();
    if (!row) {
      setLoadState('error');
      return;
    }
    setValues(rowToForm(row));
    setLoadState('ready');
  }

  useEffect(() => {
    void load();
  }, []);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveSuccess(false);
  }

  async function save(): Promise<boolean> {
    if (!values) return false;
    const parsed = QuoteDocumentDefaultsFormSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateQuoteDocumentDefaultsRow(parsed.data);
      await hydrateQuoteDocumentDefaults();
      setSaveSuccess(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת ההגדרות נכשלה.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry: load };
}
