// Read-only access to the `business_settings` singleton row (see
// supabase/migrations/20260815061813_add_business_settings.sql). Scoped
// deliberately to just the non-calculation profile columns for this step —
// `quote_vat_pct` is NOT selected here on purpose: VAT wiring is a
// separate, not-yet-approved step, kept completely out of this file so it
// can't accidentally leak into a getter here.

import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const BusinessProfileRowSchema = z.object({
  business_name: z.string(),
  business_tax_id: z.string().nullable(),
  business_phone: z.string().nullable(),
  business_email: z.string(),
  business_website_url: z.string().nullable(),
  business_booking_url: z.string().nullable(),
});

export type BusinessProfileRow = z.infer<typeof BusinessProfileRowSchema>;

// Returns null on any failure (row not found, network error, schema
// mismatch) rather than throwing — callers fall back to the existing
// static constant, never break on a missing/unreachable row.
export async function fetchBusinessProfileRow(): Promise<BusinessProfileRow | null> {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('business_name, business_tax_id, business_phone, business_email, business_website_url, business_booking_url')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    return BusinessProfileRowSchema.parse(data);
  } catch {
    return null;
  }
}

// Write counterpart, used only by the Settings screen's own save flow —
// same 6-column scope as the read above, `quote_vat_pct` and
// `business_whatsapp_number` are never part of this update. Throws on
// failure (unlike the fetch above) so the Settings form's own save
// handler can show a real error instead of silently doing nothing —
// unlike a read-only display fallback, a failed *write* must be visible
// to the user, not swallowed.
export async function updateBusinessProfileRow(patch: BusinessProfileRow): Promise<void> {
  const { error } = await supabase
    .from('business_settings')
    .update({
      business_name: patch.business_name,
      business_tax_id: patch.business_tax_id,
      business_phone: patch.business_phone,
      business_email: patch.business_email,
      business_website_url: patch.business_website_url,
      business_booking_url: patch.business_booking_url,
    })
    .eq('id', 1);
  if (error) throw error;
}

// Message-templates columns — same singleton row, kept as its own scoped
// query (not folded into the profile row above) so this file's discipline
// stays consistent: every concern selects/updates only its own columns,
// `quote_vat_pct` and `business_whatsapp_number` never touched by either.
const MessageTemplatesRowSchema = z.object({
  msg_whatsapp_template: z.string().nullable(),
  msg_email_subject_template: z.string().nullable(),
  msg_email_body_template: z.string().nullable(),
});

export type MessageTemplatesRow = z.infer<typeof MessageTemplatesRowSchema>;

export async function fetchMessageTemplatesRow(): Promise<MessageTemplatesRow | null> {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('msg_whatsapp_template, msg_email_subject_template, msg_email_body_template')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    return MessageTemplatesRowSchema.parse(data);
  } catch {
    return null;
  }
}

export async function updateMessageTemplatesRow(patch: MessageTemplatesRow): Promise<void> {
  const { error } = await supabase
    .from('business_settings')
    .update({
      msg_whatsapp_template: patch.msg_whatsapp_template,
      msg_email_subject_template: patch.msg_email_subject_template,
      msg_email_body_template: patch.msg_email_body_template,
    })
    .eq('id', 1);
  if (error) throw error;
}

// Quote-document defaults (payment terms + a fixed quote note) — same
// singleton row, own scoped query, same discipline: `quote_vat_pct` never
// touched here either.
const QuoteDocumentDefaultsRowSchema = z.object({
  quote_payment_terms_text: z.string().nullable(),
  quote_fixed_note_text: z.string().nullable(),
});

export type QuoteDocumentDefaultsRow = z.infer<typeof QuoteDocumentDefaultsRowSchema>;

export async function fetchQuoteDocumentDefaultsRow(): Promise<QuoteDocumentDefaultsRow | null> {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('quote_payment_terms_text, quote_fixed_note_text')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    return QuoteDocumentDefaultsRowSchema.parse(data);
  } catch {
    return null;
  }
}

export async function updateQuoteDocumentDefaultsRow(patch: QuoteDocumentDefaultsRow): Promise<void> {
  const { error } = await supabase
    .from('business_settings')
    .update({
      quote_payment_terms_text: patch.quote_payment_terms_text,
      quote_fixed_note_text: patch.quote_fixed_note_text,
    })
    .eq('id', 1);
  if (error) throw error;
}
