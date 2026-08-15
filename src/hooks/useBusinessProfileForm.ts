import { useEffect, useState } from 'react';
import { z } from 'zod';
import { fetchBusinessProfileRow, updateBusinessProfileRow, type BusinessProfileRow } from '@/lib/business/businessSettingsApi';
import { hydrateBusinessProfile } from '@/lib/business/businessProfile';

// Same 6 fields as business_settings' profile columns — matches the DB's
// own NOT NULL/nullable split from supabase/migrations/20260815061813_add_business_settings.sql.
const BusinessProfileFormSchema = z.object({
  business_name: z.string().trim().min(1, 'שדה חובה'),
  business_tax_id: z.string().trim(),
  business_phone: z.string().trim(),
  business_email: z.string().trim().min(1, 'שדה חובה').email('אימייל לא תקין'),
  business_website_url: z.string().trim(),
  business_booking_url: z.string().trim(),
});

type FormValues = z.infer<typeof BusinessProfileFormSchema>;

type LoadState = 'loading' | 'error' | 'ready';

function rowToForm(row: BusinessProfileRow): FormValues {
  return {
    business_name: row.business_name,
    business_tax_id: row.business_tax_id ?? '',
    business_phone: row.business_phone ?? '',
    business_email: row.business_email,
    business_website_url: row.business_website_url ?? '',
    business_booking_url: row.business_booking_url ?? '',
  };
}

function formToRow(values: FormValues): BusinessProfileRow {
  return {
    business_name: values.business_name,
    business_tax_id: values.business_tax_id || null,
    business_phone: values.business_phone || null,
    business_email: values.business_email,
    business_website_url: values.business_website_url || null,
    business_booking_url: values.business_booking_url || null,
  };
}

// Load + edit + save lifecycle for the "העסק שלי" form. Deliberately does
// NOT fall back to blank/default values on a load failure the way
// getBusinessProfile() does for read-only display — an editable form that
// silently rendered defaults would let a user overwrite real DB data with
// them on save. Instead: loadState stays 'error' and the caller must not
// render an editable form (only a retry action) until a real row loads.
export function useBusinessProfileForm() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [values, setValues] = useState<FormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function load() {
    setLoadState('loading');
    const row = await fetchBusinessProfileRow();
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
    const parsed = BusinessProfileFormSchema.safeParse(values);
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
      await updateBusinessProfileRow(formToRow(parsed.data));
      // Immediately propagate the change to every existing PDF/WhatsApp/
      // Email consumer via getBusinessProfile() — no reload needed.
      await hydrateBusinessProfile();
      setSaveSuccess(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת פרטי העסק נכשלה.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry: load };
}
