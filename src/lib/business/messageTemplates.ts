// Central WhatsApp/Email quote-message templates — one template PER
// MESSAGE TYPE (not per quote-creation source). Every quote-creation path
// (regular chooser, Events Calculator seed, Event Library/package seed,
// or re-opening a saved quote) converges on the exact same Quote entity
// and the exact same QuoteDocumentScreen.tsx consumer — confirmed by the
// two audits preceding this implementation — so wiring these templates in
// exactly one place (QuoteDocumentScreen.tsx) covers all of them with no
// per-source branching.
//
// DEFAULT_TEMPLATES are the literal strings QuoteDocumentScreen.tsx used
// to build inline, byte-for-byte — a user who never opens Settings must
// see zero behavioral change.

import { fetchMessageTemplatesRow, type MessageTemplatesRow } from '@/lib/business/businessSettingsApi';

export interface MessageTemplates {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
}

export const DEFAULT_TEMPLATES: MessageTemplates = {
  whatsapp:
    'הצעת מחיר עבור {{שם_לקוח}}\nמספר הצעה: {{מספר_הצעה}}\nסוג הצעה: {{סוג_הצעה}}\n\nלצפייה ואישור החתימה על ההצעה:\n{{קישור_חתימה}}\n\nתודה,\n{{שם_עסק}}',
  emailSubject: 'הצעת מחיר {{מספר_הצעה}} — {{שם_לקוח}}',
  emailBody: 'מצורפת הצעת המחיר עבור {{שם_לקוח}}.\n\nלצפייה ואישור החתימה על ההצעה:\n{{קישור_חתימה}}\n\nתודה,\n{{שם_עסק}}',
};

// The 5 variables approved for use across these 3 templates — never
// extend this without explicit approval (see the two audits this was
// built from, plus the explicit request that added שם_לקוח). Per-field
// whitelists live in useMessageTemplatesForm.ts, which validates against
// this same set. שם_עסק = the business's own name (issuer, e.g. in a
// closing sign-off); שם_לקוח = the client/company the quote is FOR —
// never the same value, sourced from two different places (see
// QuoteDocumentScreen.tsx's templateVars).
export const TEMPLATE_VARIABLE_LABELS: Record<string, string> = {
  שם_לקוח: 'שם הלקוח/חברה (מקבל ההצעה)',
  שם_עסק: 'שם העסק שלך (השולח)',
  מספר_הצעה: 'מספר הצעה',
  סוג_הצעה: 'סוג הצעה',
  קישור_חתימה: 'קישור לחתימה',
};

// Unknown {{token}} occurrences are left untouched (visible), never
// silently dropped — makes a stale/invalid token obvious in the rendered
// output rather than disappearing.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const key = String(rawKey).trim();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}

let current: MessageTemplates = DEFAULT_TEMPLATES;

export function getMessageTemplates(): MessageTemplates {
  return current;
}

function rowToTemplates(row: MessageTemplatesRow): MessageTemplates {
  return {
    whatsapp: row.msg_whatsapp_template || DEFAULT_TEMPLATES.whatsapp,
    emailSubject: row.msg_email_subject_template || DEFAULT_TEMPLATES.emailSubject,
    emailBody: row.msg_email_body_template || DEFAULT_TEMPLATES.emailBody,
  };
}

// Fire-and-forget, safe to call multiple times. Never throws — any
// failure (network, RLS, missing row) leaves `current` at
// DEFAULT_TEMPLATES, so every consumer keeps working exactly as before
// this module ever existed.
export async function hydrateMessageTemplates(): Promise<void> {
  const row = await fetchMessageTemplatesRow();
  if (!row) return;
  current = rowToTemplates(row);
}
