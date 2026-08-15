-- Settings screen redesign, Message Templates step (see the two audits
-- preceding this migration — every quote-creation path converges on the
-- same QuoteDocumentScreen.tsx WhatsApp/Email builders, so one central
-- template per message TYPE, not per quote-creation source, is correct).
-- Additive only: 3 new nullable columns on the existing business_settings
-- singleton row. No other table, column, or existing business_settings
-- field (including quote_vat_pct) is touched. NULL is the intended
-- default state — src/lib/business/messageTemplates.ts falls back to the
-- literal current hardcoded strings whenever these are NULL, so a user
-- who never edits Settings sees zero behavior change.
alter table public.business_settings
  add column msg_whatsapp_template text,
  add column msg_email_subject_template text,
  add column msg_email_body_template text;
