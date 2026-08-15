-- Settings "הצעות ומסמכים" — payment terms + a fixed quote note, exactly
-- the 2 fields approved (no cancellation policy, no PDF footer, no VAT).
-- Additive only: 2 new nullable columns on the existing business_settings
-- singleton row. src/lib/quotes/quoteDocumentDefaults.ts falls back to
-- the exact literal default text when NULL, same pattern as
-- msg_*_template — a user who never opens Settings sees the same text
-- that would have appeared before this migration.
alter table public.business_settings
  add column quote_payment_terms_text text,
  add column quote_fixed_note_text text;
