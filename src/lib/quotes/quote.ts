// Domain model for the Quote module (clinic treatment / private event /
// company event). One flat line-item shape covers all three types —
// clinic rows use treatmentName/durationMinutes/purchaseType, event rows
// use only `description` — rather than a discriminated union, since at
// this scope the extra structure isn't earning its complexity. No
// pricing engine: unitPrice is always optionally-empty, never invented,
// never defaulted to 0 (see CLAUDE.md's money-math rule — a null price
// contributes 0 to totals but is never confused with an actual ₪0 price).

import { z } from 'zod';
import BigNumber from 'bignumber.js';
import { PurchaseTypeSchema } from './treatmentOptions';

export const QuoteTypeSchema = z.enum(['clinic_treatment', 'private_event', 'company_event']);
export type QuoteType = z.infer<typeof QuoteTypeSchema>;

export const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  clinic_treatment: 'טיפול בקליניקה',
  private_event: 'אירוע פרטי',
  company_event: 'אירוע חברה',
};

export const QuoteStatusSchema = z.enum(['draft', 'sent', 'signed', 'rejected']);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'טיוטה',
  sent: 'נשלח',
  signed: 'נחתם',
  rejected: 'נדחה',
};

// Field-level schemas — reused both by coerceValidatedText/Number at the
// input layer and by the row/quote schemas below, so there's one source
// of truth for each constraint (CLAUDE.md's input-validation rule).
export const QuoteLineItemTreatmentNameSchema = z.string().max(200);
export const QuoteLineItemDescriptionSchema = z.string().max(500);
export const QuoteLineItemUnitPriceSchema = z.number().finite().min(0).max(1_000_000);
export const QuoteLineItemQuantitySchema = z.number().finite().gt(0).max(999);
export const QuoteClientNameSchema = z.string().max(200);
export const QuotePhoneSchema = z.string().max(50);
export const QuoteEmailSchema = z.string().max(200);
export const QuoteCompanyNameSchema = z.string().max(200);
export const QuoteTaxIdSchema = z.string().max(50);
// 'HH:MM', 24h, or '' (not yet set) — structured so create-calendar-event
// can build a real ISO datetime instead of parsing free text like
// "10:00-14:00" (the previous eventHoursText field).
export const QuoteEventTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .or(z.literal(''));
export const QuoteEventTherapistCountSchema = z.number().int().min(0).max(50);
// Seeded from the Events Calculator's "הכן הצעת מחיר" action (and
// editable afterward) — see packageToQuoteSeed-style calcToQuoteSeed in
// Home.tsx. Deliberately just these two on top of eventTherapistCount:
// the calculator's internal-only figures (therapist wage, travel
// distance, venue commission) are never carried into a quote — see
// CLAUDE.md → "Events Calculator quote seeding".
export const QuoteEventParticipantsCountSchema = z.number().int().min(0).max(10_000);
export const QuoteEventHourlyRateSchema = z.number().nonnegative().max(1_000_000);
// The calculator's "שעות פעילות" duration at the moment "הכן הצעת מחיר" was
// clicked (Home.tsx's calcToQuoteSeed) — kept only so the builder screen
// can flag it if the start/end time typed in afterward no longer matches
// (see eventDurationHours/QuoteDocumentScreen.tsx). Not itself displayed
// as a standalone field; never set for quotes not seeded from the
// calculator.
export const QuoteEventExpectedHoursSchema = z.number().positive().max(1000);
export const QuoteNotesTextSchema = z.string().max(2000);

export const QuoteLineItemSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  treatmentName: QuoteLineItemTreatmentNameSchema.default(''),
  durationMinutes: z.number().int().positive().nullable().default(null),
  purchaseType: PurchaseTypeSchema.nullable().default(null),
  description: QuoteLineItemDescriptionSchema.default(''),
  /** null = not priced yet. Never 0-as-placeholder. */
  unitPrice: QuoteLineItemUnitPriceSchema.nullable().default(null),
  quantity: QuoteLineItemQuantitySchema.default(1),
});
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

export function createEmptyLineItem(order: number): QuoteLineItem {
  return QuoteLineItemSchema.parse({ id: crypto.randomUUID(), order });
}

export function lineItemTotal(row: QuoteLineItem): number {
  if (row.unitPrice === null) return 0;
  return new BigNumber(row.unitPrice).times(row.quantity).toNumber();
}

// The business is a VAT-exempt dealer ("עוסק פטור") — no VAT is ever
// added to a quote. This is the final amount the client pays; there used
// to be a VAT_RATE/VAT_RATE_PCT/quoteVatAmount/quoteTotalWithVat layer on
// top of this that added 18%, removed per explicit business decision
// (confirmed via full-repo search that nothing else depended on those
// exports before removing them).
export function quoteGrandTotal(lineItems: QuoteLineItem[]): number {
  return lineItems
    .reduce((sum, row) => sum.plus(lineItemTotal(row)), new BigNumber(0))
    .toNumber();
}

export const QuoteSchema = z.object({
  id: z.string(),
  quoteNumber: z.string().default(''), // assigned server-side on first insert
  quoteType: QuoteTypeSchema,
  status: QuoteStatusSchema.default('draft'),

  clientName: QuoteClientNameSchema.default(''),
  clientPhone: QuotePhoneSchema.default(''),
  clientEmail: QuoteEmailSchema.default(''),

  companyName: QuoteCompanyNameSchema.default(''),
  companyTaxId: QuoteTaxIdSchema.default(''),
  contactPersonPhone: QuotePhoneSchema.default(''),
  contactPersonEmail: QuoteEmailSchema.default(''),

  eventDate: z.string().nullable().default(null), // 'YYYY-MM-DD'
  eventStartTime: QuoteEventTimeSchema.default(''),
  eventEndTime: QuoteEventTimeSchema.default(''),
  eventTherapistCount: QuoteEventTherapistCountSchema.nullable().default(null),
  eventParticipantsCount: QuoteEventParticipantsCountSchema.nullable().default(null),
  eventHourlyRate: QuoteEventHourlyRateSchema.nullable().default(null),
  eventExpectedHours: QuoteEventExpectedHoursSchema.nullable().default(null),

  notesText: QuoteNotesTextSchema.default(''),
  clientSignatureDataUrl: z.string().nullable().default(null),

  storagePath: z.string().nullable().default(null),

  lineItems: z.array(QuoteLineItemSchema).default([]),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  /** Set exactly once, server-side, by sign-quote's UPDATE when status
   *  first flips to 'signed' — never overwritten by any later edit
   *  (saveQuote() never writes this field). This is the correct anchor
   *  for "which month's revenue does this quote belong to" — unlike
   *  `updatedAt`, it can't be silently bumped by an unrelated later edit
   *  to an already-signed quote. Null for any quote that isn't signed. */
  signedAt: z.coerce.date().nullable().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export function createEmptyQuote(quoteType: QuoteType): Quote {
  return QuoteSchema.parse({ id: crypto.randomUUID(), quoteType });
}

/** Human-readable "10:00–14:00" (or just one side, or '' if neither set) —
 *  the one place this formatting happens, so the WhatsApp message, PDF,
 *  and sign page can't drift out of sync with each other. */
export function eventHoursDisplay(quote: Pick<Quote, 'eventStartTime' | 'eventEndTime'>): string {
  if (quote.eventStartTime && quote.eventEndTime) return `${quote.eventStartTime}–${quote.eventEndTime}`;
  return quote.eventStartTime || quote.eventEndTime || '';
}

/** Duration in hours computed from eventStartTime/eventEndTime — null if
 *  either is unset or the range doesn't make sense (end not after start).
 *  Plain arithmetic, not BigNumber: this is a schedule duration for
 *  display/validation, not a financial figure (CLAUDE.md's money-math
 *  rule doesn't apply here). */
export function eventDurationHours(quote: Pick<Quote, 'eventStartTime' | 'eventEndTime'>): number | null {
  if (!quote.eventStartTime || !quote.eventEndTime) return null;
  const [startH, startM] = quote.eventStartTime.split(':').map(Number);
  const [endH, endM] = quote.eventEndTime.split(':').map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return null;
  const diffMinutes = endH * 60 + endM - (startH * 60 + startM);
  return diffMinutes > 0 ? diffMinutes / 60 : null;
}

/** "4 שעות" / "2.5 שעות" — the one place this formatting happens. */
export function formatHoursHe(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} שעות`;
}

/** start-time + a duration in hours, snapped to the nearest half-hour slot
 *  and clamped to 23:30 — used to auto-lock a calc-linked quote's end time
 *  to its own eventExpectedHours the moment start time is picked, so the
 *  two can never drift apart through the UI (see QuoteDocumentScreen.tsx). */
export function computeEventEndTime(startTime: string, hours: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const endMinutesRaw = startMinutes + hours * 60;
  const snapped = Math.round(endMinutesRaw / 30) * 30;
  const clamped = Math.min(snapped, 23 * 60 + 30);
  const endH = Math.floor(clamped / 60);
  const endM = clamped % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/** Live client price for a quote seeded from the Events Calculator
 *  ("הכן הצעת מחיר"): therapists × hours × hourly rate — exactly
 *  calcEngine.ts's `calculateEvent()` grossRevenue formula (see its
 *  comment: grossRevenue only ever depends on these three inputs, never
 *  on wage/travel/commission/income-guarantee, since those only affect
 *  the business's own internal margin, not what the client is charged).
 *  Recomputed from the quote's own stored fields rather than a frozen
 *  number carried over once at seed time, so editing eventTherapistCount/
 *  eventHourlyRate on the builder screen — already possible — updates the
 *  total immediately, and changing eventStartTime/eventEndTime (which
 *  changes the actual scheduled duration) does too: `eventDurationHours`
 *  wins over the calculator's original `eventExpectedHours` snapshot
 *  whenever both event times are set, since the actually-scheduled
 *  duration is more authoritative than the estimate used when the quote
 *  was first created. Returns null — meaning "not a calc-linked quote, do
 *  not apply this" — when eventExpectedHours was never seeded at all (the
 *  signal Home.tsx's calcToQuoteSeed sets), or when therapist count/hourly
 *  rate aren't both present. This is deliberately narrow, not a general
 *  pricing engine: every other quote type/origin still prices purely off
 *  manually entered line items, per CLAUDE.md's money-math rule. */
export function calcSeededBasePrice(
  quote: Pick<Quote, 'eventExpectedHours' | 'eventTherapistCount' | 'eventHourlyRate' | 'eventStartTime' | 'eventEndTime'>
): number | null {
  if (quote.eventExpectedHours === null) return null;
  if (!quote.eventTherapistCount || !quote.eventHourlyRate) return null;
  const hours = eventDurationHours(quote) ?? quote.eventExpectedHours;
  return new BigNumber(quote.eventTherapistCount).times(hours).times(quote.eventHourlyRate).toNumber();
}

/** The line items actually used for pricing — use this everywhere a
 *  quote's total is computed or rendered, never `quote.lineItems`
 *  directly. For a calc-linked quote (see calcSeededBasePrice), prepends
 *  a synthetic row holding the live calc-derived base price ahead of any
 *  manually added rows (e.g. an extra ad-hoc charge on top); for every
 *  other quote, `quote.lineItems` unchanged. The synthetic row is never
 *  persisted — id `__calc_base__` marks it as computed-only so nothing
 *  mistakes it for a real stored row (e.g. line-item edit/remove
 *  handlers, which only ever operate on `quote.lineItems`). */
export function effectiveLineItems(quote: Quote): QuoteLineItem[] {
  const basePrice = calcSeededBasePrice(quote);
  if (basePrice === null) return quote.lineItems;
  const baseRow: QuoteLineItem = {
    id: '__calc_base__',
    order: -1,
    treatmentName: '',
    durationMinutes: null,
    purchaseType: null,
    description: '',
    unitPrice: Math.round(basePrice),
    quantity: 1,
  };
  return [baseRow, ...quote.lineItems];
}

/** 'YYYY-MM-DD' (the stored form) -> 'DD/MM/YYYY' for display. Plain
 *  digits render left-to-right regardless of the RTL page direction, so a
 *  right-aligned 'YYYY-MM-DD' string visually put the day first (nearest
 *  the right edge) and the year last (furthest left) — backwards from the
 *  standard Israeli day/month/year reading order. Reordering the string
 *  itself to day-month-year fixes this: right-aligned, the year (now the
 *  last part of the string) lands at the right edge and the day (now the
 *  first part) lands at the left — confirmed against a real generated PDF. */
export function formatDateHe(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

/** Local (Asia/Jerusalem) ISO datetimes for the Google Calendar API, built
 *  from eventDate + start/end time — null if any piece is missing, which
 *  callers treat as "not enough info to sync this quote to Calendar yet."
 *  No UTC offset is appended; the Calendar API call supplies `timeZone`
 *  separately rather than computing DST offsets here. */
export function eventDateTimeRange(
  quote: Pick<Quote, 'eventDate' | 'eventStartTime' | 'eventEndTime'>
): { start: string; end: string } | null {
  if (!quote.eventDate || !quote.eventStartTime || !quote.eventEndTime) return null;
  return {
    start: `${quote.eventDate}T${quote.eventStartTime}:00`,
    end: `${quote.eventDate}T${quote.eventEndTime}:00`,
  };
}

/** Normalizes a phone string to digits-only international form for wa.me,
 *  e.g. "053-370-9919" -> "972533709919". Assumes an Israeli local number
 *  (leading 0) when no country code is present. */
export function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}
