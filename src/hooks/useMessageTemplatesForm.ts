import { useEffect, useState } from 'react';
import { z } from 'zod';
import { fetchMessageTemplatesRow, updateMessageTemplatesRow, type MessageTemplatesRow } from '@/lib/business/businessSettingsApi';
import { hydrateMessageTemplates, DEFAULT_TEMPLATES } from '@/lib/business/messageTemplates';

// Per-field variable whitelists — matches exactly what QuoteDocumentScreen.tsx
// actually injects per channel today (see the two audits this was built
// from). A template referencing anything outside its own whitelist fails
// validation and is never saved.
const WHATSAPP_ALLOWED = ['שם_לקוח', 'שם_עסק', 'מספר_הצעה', 'סוג_הצעה', 'קישור_חתימה'];
const EMAIL_SUBJECT_ALLOWED = ['שם_לקוח', 'שם_עסק', 'מספר_הצעה'];
const EMAIL_BODY_ALLOWED = ['שם_לקוח', 'שם_עסק', 'מספר_הצעה', 'קישור_חתימה'];

function extractTokens(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
  return Array.from(matches, (m) => m[1].trim());
}

function validateTemplate(template: string, allowed: string[]): string | null {
  const unknown = extractTokens(template).filter((t) => !allowed.includes(t));
  if (unknown.length > 0) {
    return `משתנה לא נתמך: {{${unknown[0]}}}`;
  }
  return null;
}

const MessageTemplatesFormSchema = z
  .object({
    msg_whatsapp_template: z.string().trim().min(1, 'שדה חובה'),
    msg_email_subject_template: z.string().trim().min(1, 'שדה חובה'),
    msg_email_body_template: z.string().trim().min(1, 'שדה חובה'),
  })
  .superRefine((values, ctx) => {
    const whatsappErr = validateTemplate(values.msg_whatsapp_template, WHATSAPP_ALLOWED);
    if (whatsappErr) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['msg_whatsapp_template'], message: whatsappErr });
    const subjectErr = validateTemplate(values.msg_email_subject_template, EMAIL_SUBJECT_ALLOWED);
    if (subjectErr) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['msg_email_subject_template'], message: subjectErr });
    const bodyErr = validateTemplate(values.msg_email_body_template, EMAIL_BODY_ALLOWED);
    if (bodyErr) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['msg_email_body_template'], message: bodyErr });
  });

type FormValues = z.infer<typeof MessageTemplatesFormSchema>;

type LoadState = 'loading' | 'error' | 'ready';

function rowToForm(row: MessageTemplatesRow): FormValues {
  return {
    msg_whatsapp_template: row.msg_whatsapp_template ?? DEFAULT_TEMPLATES.whatsapp,
    msg_email_subject_template: row.msg_email_subject_template ?? DEFAULT_TEMPLATES.emailSubject,
    msg_email_body_template: row.msg_email_body_template ?? DEFAULT_TEMPLATES.emailBody,
  };
}

// Load + edit + save lifecycle for "תבניות הודעות", mirroring
// useBusinessProfileForm.ts's shape exactly — same never-fall-back-to-blank
// discipline for the edit surface (only getMessageTemplates() falls back
// silently for display consumers; this form shows a real error+retry
// state instead of ever rendering an empty editable template).
export function useMessageTemplatesForm() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [values, setValues] = useState<FormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function load() {
    setLoadState('loading');
    const row = await fetchMessageTemplatesRow();
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
    const parsed = MessageTemplatesFormSchema.safeParse(values);
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
      await updateMessageTemplatesRow(parsed.data);
      // Immediately propagate to every existing WhatsApp/Email consumer
      // via getMessageTemplates() — no reload needed.
      await hydrateMessageTemplates();
      setSaveSuccess(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת תבניות ההודעות נכשלה.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry: load };
}
