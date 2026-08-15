import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Plus, Loader2, MessageCircle, Mail, Download, Save, Link2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlassPanel, SolidCard } from '@/components/shared/GlassPanel';
import SignaturePad from '@/components/shared/SignaturePad';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import MotionButton from '@/components/shared/MotionButton';
import QuoteLineItemRow from './QuoteLineItemRow';
import { ClientAutocompleteField } from './ClientAutocompleteField';
import QuoteDocument from '@/components/pdf/documents/QuoteDocument';
import { useQuoteForm } from '@/hooks/useQuoteForm';
import { useClientDirectory } from '@/hooks/useClientDirectory';
import { getQuote } from '@/lib/quotes/quoteApi';
import type { ClientDirectoryEntry } from '@/lib/quotes/clientDirectory';
import { BUSINESS_PROFILE, getBusinessProfile } from '@/lib/business/businessProfile';
import { getMessageTemplates, renderTemplate } from '@/lib/business/messageTemplates';
import { archiveQuotePdf } from '@/lib/storage/archiveQuotePdf';
import { cn, coerceValidatedNumber, coerceValidatedText } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  QUOTE_TYPE_LABELS,
  QuoteClientNameSchema,
  QuoteCompanyNameSchema,
  QuoteEmailSchema,
  QuoteEventTimeSchema,
  QuoteEventTherapistCountSchema,
  QuoteEventParticipantsCountSchema,
  QuoteEventHourlyRateSchema,
  QuoteNotesTextSchema,
  QuotePhoneSchema,
  QuoteTaxIdSchema,
  quoteGrandTotal,
  quoteVatAmount,
  quoteTotalWithVat,
  toWhatsAppDigits,
  eventDurationHours,
  formatHoursHe,
  formatDateHe,
  computeEventEndTime,
  effectiveLineItems,
  calcSeededBasePrice,
  VAT_RATE_PCT,
  type Quote,
  type QuoteLineItem,
  type QuoteType,
} from '@/lib/quotes/quote';

interface QuoteDocumentScreenProps {
  quoteType: QuoteType;
  quoteId: string | null;
  /** Pre-fills the first line item of a brand-new quote (e.g. from an
   *  Event Library package). Ignored once `quoteId` resolves to an
   *  existing quote — only applies to a fresh draft. */
  seedLineItem?: Partial<QuoteLineItem>;
  /** Pre-fills quote-level fields (e.g. eventTherapistCount) alongside
   *  seedLineItem — same fresh-draft-only rule. */
  seedFields?: Partial<Quote>;
  onBack: () => void;
}

// Full or half hours only — a 10:37–12:22 event window reads as a typo,
// not a real schedule, so the time fields are a constrained picker rather
// than a free-typed native time input. 48 slots, '00:00'..'23:30'.
const HALF_HOUR_TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

/** The option list to render for a time Select — includes `current` even
 *  when it's not a half-hour value (e.g. an older quote saved before this
 *  restriction existed), so opening it still shows what's actually stored
 *  instead of silently blanking it; picking any other option replaces it. */
function timeSelectOptions(current: string): string[] {
  if (!current || HALF_HOUR_TIME_OPTIONS.includes(current)) return HALF_HOUR_TIME_OPTIONS;
  return [current, ...HALF_HOUR_TIME_OPTIONS].sort();
}

/** End-time options for a manually-editable (non calc-linked) event quote
 *  — restricted to times strictly after `startTime`, so picking an end
 *  time earlier than the start time is not even selectable (a same-day
 *  event window that goes backward, e.g. 09:00–02:30, isn't a real
 *  schedule). Falls back to the full list once no start time is set yet. */
function endTimeSelectOptions(startTime: string, current: string): string[] {
  const base = !startTime ? HALF_HOUR_TIME_OPTIONS : HALF_HOUR_TIME_OPTIONS.filter((t) => t > startTime);
  if (!current || base.includes(current)) return base;
  return [current, ...base].sort();
}

export default function QuoteDocumentScreen({ quoteType, quoteId, seedLineItem, seedFields, onBack }: QuoteDocumentScreenProps) {
  const [existing, setExisting] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(Boolean(quoteId));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    setLoading(true);
    getQuote(quoteId)
      .then((q) => {
        if (!cancelled) setExisting(q);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'טעינת ההצעה נכשלה.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2" dir="rtl">
        <Loader2 className="h-5 w-5 animate-spin" />
        טוען הצעה...
      </div>
    );
  }

  if (loadError) {
    return (
      <div dir="rtl" className="py-12 text-center text-destructive">
        {loadError}
      </div>
    );
  }

  return (
    <QuoteDocumentForm quoteType={quoteType} existing={existing} seedLineItem={seedLineItem} seedFields={seedFields} onBack={onBack} />
  );
}

function QuoteDocumentForm({
  quoteType,
  existing,
  seedLineItem,
  seedFields,
  onBack,
}: {
  quoteType: QuoteType;
  existing: Quote | null;
  seedLineItem?: Partial<QuoteLineItem>;
  seedFields?: Partial<Quote>;
  onBack: () => void;
}) {
  const { quote, updateField, addLineItem, updateLineItem, removeLineItem, save, saving, saveError } = useQuoteForm(
    quoteType,
    existing,
    seedLineItem,
    seedFields
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const { toast } = useToast();
  // Client autocomplete source: no persisted `clients` table exists yet
  // (see CLAUDE.md) — this reads distinct client name/phone/email triples
  // out of the `quotes` table itself, the only place that data actually
  // persists.
  const { clients: clientDirectory, refetch: refetchClientDirectory } = useClientDirectory();

  // Selecting a suggestion fills all three client fields at once. The
  // values come from previously-saved, already-schema-valid quote rows,
  // but still routed through each field's own schema here (never a raw
  // assignment) to keep the "validate before it reaches state" rule
  // uniform regardless of where a value originates.
  const handleSelectClient = (entry: ClientDirectoryEntry) => {
    updateField('clientName', QuoteClientNameSchema.parse(entry.name));
    updateField('clientPhone', QuotePhoneSchema.parse(entry.phone));
    updateField('clientEmail', QuoteEmailSchema.parse(entry.email));
  };

  const isCompany = quoteType === 'company_event';
  const hasEventFields = quoteType === 'private_event' || quoteType === 'company_event';
  const isClinic = quoteType === 'clinic_treatment';
  // eventExpectedHours is only ever set by Home.tsx's calcToQuoteSeed (the
  // Events Calculator's "שעות פעילות" at the moment "הכן הצעת מחיר" was
  // clicked) — compares it against whatever start/end time is actually
  // filled in here. Now more than informational: calcSeededBasePrice
  // (quote.ts) actually prices off the actual start/end duration once
  // both times are set, in preference to this frozen calculator estimate
  // — so a mismatch here means the total below has already moved off the
  // original calculator figure, not just a discrepancy to flag.
  const actualEventHours = eventDurationHours(quote);
  const eventHoursMismatch =
    quote.eventExpectedHours !== null && actualEventHours !== null && Math.abs(actualEventHours - quote.eventExpectedHours) > 0.01;
  // Clinic quotes must have a treatment selected on every line item —
  // an unselected Select has no invalid-keystroke state to reject
  // on-change (per CLAUDE.md's coerceValidatedText pattern), only an
  // "unselected" state, which can only be caught before save/export.
  const missingTreatmentIds = isClinic
    ? new Set(quote.lineItems.filter((item) => !item.treatmentName).map((item) => item.id))
    : new Set<string>();

  const validateTreatments = (): boolean => {
    if (missingTreatmentIds.size === 0) {
      setTreatmentError(null);
      return true;
    }
    setTreatmentError('יש לבחור טיפול עבור כל שורה לפני שמירה או ייצוא — לא ניתן להשאיר שורה ללא טיפול נבחר.');
    return false;
  };

  // Event-type quotes must have a date before save/export — no "not yet
  // scheduled" state allowed here, unlike start/end time (which stays
  // optional; see the existing Calendar-sync nudge below).
  const validateEventDate = (): boolean => {
    if (!hasEventFields || quote.eventDate) {
      setDateError(null);
      return true;
    }
    setDateError('יש לבחור תאריך אירוע לפני שמירה או ייצוא.');
    return false;
  };

  // A signature is the only real signal we have that a quote moved from
  // "draft" to "signed" — there's no separate confirmation step, so the
  // status flips automatically the first time it's saved with a signature
  // rather than needing a manual control (removed per feedback: status is
  // a read-only label surfaced in the Saved Quotes table, not something to
  // edit here).
  const statusOverride = () =>
    quote.clientSignatureDataUrl && quote.status === 'draft' ? ({ status: 'signed' } as const) : undefined;

  const handleSave = async () => {
    if (!validateTreatments() || !validateEventDate()) return;
    const saved = await save(statusOverride());
    // A new or edited client's name/phone/email should be selectable from
    // autocomplete right away, not only after the page is reopened.
    if (saved) refetchClientDirectory();
    if (saved) toast({ title: 'ההצעה נשמרה בהצלחה' });
    // Non-blocking: a signed quote gets archived to Storage (see
    // archiveQuotePdf) — failure here must never affect the save the
    // user just asked for.
    if (saved && saved.clientSignatureDataUrl) {
      archiveQuotePdf(saved);
    }
  };

  const handleDownloadPdf = async () => {
    if (!validateTreatments() || !validateEventDate()) return;
    setPdfBusy(true);
    try {
      const saved = (await save(statusOverride())) ?? quote;
      refetchClientDirectory();
      const signingUrl = `${window.location.origin}/sign/${saved.id}`;
      const blob = await pdf(<QuoteDocument quote={saved} signingUrl={signingUrl} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${saved.quoteNumber || 'quote'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'קובץ ה-PDF יוצא בהצלחה' });
    } finally {
      setPdfBusy(false);
    }
  };

  const recipientPhone = isCompany ? quote.contactPersonPhone : quote.clientPhone;
  const recipientEmail = isCompany ? quote.contactPersonEmail : quote.clientEmail;
  // Only meaningful once the quote has a real id worth pointing at — a
  // client-generated draft id still resolves (rows are addressable by id
  // from creation), but the link is the whole point of this message, so
  // build it unconditionally rather than only after an explicit save.
  const signingLink = `${window.location.origin}/sign/${quote.id}`;
  // Central template system — one template per message TYPE (not per
  // quote-creation source), covering every quote regardless of how it was
  // created (see the two audits this was built from). Per-channel
  // fallback text for a not-yet-saved quote number is preserved exactly
  // as it was before this change: WhatsApp shows "(טרם נשמר)", the email
  // subject shows an empty string — computed here, not inside the
  // template, so both channels keep their pre-existing distinct behavior.
  // שם_לקוח: the client/company the quote is FOR — same fallback chain
  // already used for this exact distinction elsewhere in this codebase
  // (sign-quote/index.ts's syncQuoteToCalendar `partyName`). Never the
  // same value as שם_עסק (the business's own name, the issuer).
  const templateVars = {
    שם_לקוח: quote.companyName || quote.clientName || 'לקוח ללא שם',
    שם_עסק: getBusinessProfile().nameHe,
    סוג_הצעה: QUOTE_TYPE_LABELS[quoteType],
    קישור_חתימה: signingLink,
  };
  const whatsappHref = recipientPhone
    ? `https://wa.me/${toWhatsAppDigits(recipientPhone)}?text=${encodeURIComponent(
        renderTemplate(getMessageTemplates().whatsapp, { ...templateVars, מספר_הצעה: quote.quoteNumber || '(טרם נשמר)' })
      )}`
    : null;
  const mailtoHref = recipientEmail
    ? `mailto:${recipientEmail}?subject=${encodeURIComponent(
        renderTemplate(getMessageTemplates().emailSubject, { ...templateVars, מספר_הצעה: quote.quoteNumber || '' })
      )}&body=${encodeURIComponent(
        renderTemplate(getMessageTemplates().emailBody, { ...templateVars, מספר_הצעה: quote.quoteNumber || '' })
      )}`
    : null;

  // Direct link copy — independent of the WhatsApp/email flows, for
  // sending the signing link through any other channel.
  const handleCopySigningLink = async () => {
    try {
      await navigator.clipboard.writeText(signingLink);
      toast({ title: 'הקישור הועתק', description: signingLink });
    } catch {
      toast({ title: 'העתקת הקישור נכשלה', variant: 'destructive' });
    }
  };

  return (
    <div dir="rtl" className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="חזרה"
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold text-foreground">{QUOTE_TYPE_LABELS[quoteType]}</h2>
      </div>

      <GlassPanel className="p-6 space-y-4">
        {/* Business identity only — client details have their own dedicated
            "Party fields" section below; showing them here too was pure
            duplication (same fix already applied to the PDF's PdfHeader.tsx
            this session). */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="text-right space-y-1.5">
            <h3 className="text-base font-extrabold text-foreground">{getBusinessProfile().nameHe}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().idNumber}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().phone}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().email}</p>
          </div>
          <img src={BUSINESS_PROFILE.logo} alt={getBusinessProfile().nameHe} className="h-12 w-12 rounded-lg object-contain bg-white p-0.5" />
        </div>

        {/* Document identity — its own banner, not mixed into either
            party's info block. */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-2.5 dark:bg-primary/20">
          <p className="text-sm font-bold text-background dark:text-foreground">
            <span>הצעת מחיר מספר </span>
            <span>{quote.quoteNumber || 'טרם נשמר'}</span>
          </p>
          <span className="rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium text-background dark:bg-primary/20 dark:text-foreground">
            סוג הטיפול: {QUOTE_TYPE_LABELS[quoteType]}
          </span>
        </div>

        {/* Party fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isCompany ? (
            <>
              <Field label="שם החברה">
                <Input
                  value={quote.companyName}
                  onChange={(e) => updateField('companyName', coerceValidatedText(QuoteCompanyNameSchema, e.target.value, quote.companyName))}
                  className="bg-secondary border-border"
                />
              </Field>
              <Field label='ח.פ / ע.מ'>
                <Input
                  value={quote.companyTaxId}
                  onChange={(e) => updateField('companyTaxId', coerceValidatedText(QuoteTaxIdSchema, e.target.value, quote.companyTaxId))}
                  className="bg-secondary border-border"
                />
              </Field>
              <Field label="טלפון איש קשר">
                <Input
                  value={quote.contactPersonPhone}
                  onChange={(e) => updateField('contactPersonPhone', coerceValidatedText(QuotePhoneSchema, e.target.value, quote.contactPersonPhone))}
                  className="bg-secondary border-border"
                />
              </Field>
              <Field label="אימייל איש קשר">
                <Input
                  type="email"
                  value={quote.contactPersonEmail}
                  onChange={(e) => updateField('contactPersonEmail', coerceValidatedText(QuoteEmailSchema, e.target.value, quote.contactPersonEmail))}
                  className="bg-secondary border-border"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="שם הלקוח">
                <ClientAutocompleteField
                  value={quote.clientName}
                  onChange={(v) => updateField('clientName', coerceValidatedText(QuoteClientNameSchema, v, quote.clientName))}
                  onSelectClient={handleSelectClient}
                  clients={clientDirectory}
                  matchField="name"
                />
              </Field>
              <Field label="טלפון">
                <ClientAutocompleteField
                  value={quote.clientPhone}
                  onChange={(v) => updateField('clientPhone', coerceValidatedText(QuotePhoneSchema, v, quote.clientPhone))}
                  onSelectClient={handleSelectClient}
                  clients={clientDirectory}
                  matchField="phone"
                />
              </Field>
              <Field label="כתובת מייל">
                <ClientAutocompleteField
                  type="email"
                  value={quote.clientEmail}
                  onChange={(v) => updateField('clientEmail', coerceValidatedText(QuoteEmailSchema, v, quote.clientEmail))}
                  onSelectClient={handleSelectClient}
                  clients={clientDirectory}
                  matchField="email"
                />
              </Field>
            </>
          )}

          {hasEventFields && (
            <>
              <Field label="תאריך האירוע">
                <Input
                  type="date"
                  value={quote.eventDate ?? ''}
                  onChange={(e) => {
                    updateField('eventDate', e.target.value || null);
                    if (e.target.value) setDateError(null);
                  }}
                  className={cn('bg-secondary border-border', dateError && !quote.eventDate && 'border-destructive')}
                />
                {/* Native <input type="date"> renders its value in the
                    browser/OS locale format (often MM/DD/YYYY), which
                    doesn't respect this page's RTL/Hebrew convention and
                    can visually contradict the PDF's own DD/MM/YYYY
                    display (formatDateHe). A explicit read-out under the
                    field is the only reliable cross-browser way to show
                    the correct format, since a native date input's own
                    internal text isn't restylable. */}
                {quote.eventDate && (
                  <p className="text-xs text-muted-foreground mt-1">מוצג בהצעת המחיר כ: {formatDateHe(quote.eventDate)}</p>
                )}
              </Field>
              <Field label="שעת התחלה">
                <Select
                  value={quote.eventStartTime}
                  disabled={!quote.eventDate}
                  onValueChange={(v) => {
                    const validated = coerceValidatedText(QuoteEventTimeSchema, v, quote.eventStartTime);
                    updateField('eventStartTime', validated);
                    // Calc-linked quote: lock the end time to start + the
                    // calculator's own duration the instant start time is
                    // picked, per explicit request — the two can no longer
                    // drift apart through this screen (see calcSeededBasePrice
                    // in quote.ts for why a mismatch here used to silently
                    // change the total).
                    if (quote.eventExpectedHours !== null && validated) {
                      updateField('eventEndTime', computeEventEndTime(validated, quote.eventExpectedHours));
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={quote.eventDate ? 'בחרי שעה' : 'בחרי תאריך קודם'} />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSelectOptions(quote.eventStartTime).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="שעת סיום">
                <Select
                  value={quote.eventEndTime}
                  disabled={!quote.eventDate || quote.eventExpectedHours !== null}
                  onValueChange={(v) => updateField('eventEndTime', coerceValidatedText(QuoteEventTimeSchema, v, quote.eventEndTime))}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={quote.eventDate ? 'בחרי שעה' : 'בחרי תאריך קודם'} />
                  </SelectTrigger>
                  <SelectContent>
                    {endTimeSelectOptions(quote.eventStartTime, quote.eventEndTime).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {quote.eventExpectedHours !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    מחושב אוטומטית לפי {formatHoursHe(quote.eventExpectedHours)} שהוגדרו במחשבון האירועים
                  </p>
                )}
              </Field>
              {/* Both date + start + end are required for Calendar sync to
                  fire on signing (see supabase/functions/sign-quote) — a
                  quiet nudge rather than a hard validation block, since a
                  quote without event scheduling is still a valid quote. */}
              {quote.eventDate && (!quote.eventStartTime || !quote.eventEndTime) && (
                <p className="text-xs text-warning sm:col-span-2">
                  הוסיפי גם שעת התחלה וגם שעת סיום כדי שהאירוע יתווסף אוטומטית ליומן Google לאחר החתימה.
                </p>
              )}
              {actualEventHours !== null && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  שעות פעילות: {formatHoursHe(actualEventHours)}
                  {eventHoursMismatch && (
                    <span className="text-warning font-medium">
                      {' '}
                      — לא תואם למחשבון האירועים (שם חושבו {formatHoursHe(quote.eventExpectedHours as number)})
                    </span>
                  )}
                </p>
              )}
              <Field label="כמות מטפלים">
                <Input
                  type="number"
                  value={quote.eventTherapistCount ?? ''}
                  onChange={(e) =>
                    updateField(
                      'eventTherapistCount',
                      e.target.value.trim() === '' ? null : coerceValidatedNumber(QuoteEventTherapistCountSchema, e.target.value, quote.eventTherapistCount ?? 0)
                    )
                  }
                  className="bg-secondary border-border"
                />
              </Field>
              {/* Seeded from the Events Calculator's "הכן הצעת מחיר" action
                  (still editable afterward, like every other field here).
                  Deliberately just these two alongside eventTherapistCount —
                  the calculator's internal-only figures (therapist wage,
                  travel distance, venue commission) never reach a quote. */}
              <Field label="כמות משתתפים כוללת">
                <Input
                  type="number"
                  value={quote.eventParticipantsCount ?? ''}
                  onChange={(e) =>
                    updateField(
                      'eventParticipantsCount',
                      e.target.value.trim() === ''
                        ? null
                        : coerceValidatedNumber(QuoteEventParticipantsCountSchema, e.target.value, quote.eventParticipantsCount ?? 0)
                    )
                  }
                  className="bg-secondary border-border"
                />
              </Field>
              <Field label="תעריף שעתי (₪)">
                <Input
                  type="number"
                  value={quote.eventHourlyRate ?? ''}
                  onChange={(e) =>
                    updateField(
                      'eventHourlyRate',
                      e.target.value.trim() === ''
                        ? null
                        : coerceValidatedNumber(QuoteEventHourlyRateSchema, e.target.value, quote.eventHourlyRate ?? 0)
                    )
                  }
                  className="bg-secondary border-border"
                />
              </Field>
            </>
          )}
        </div>

        {/* Line items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">פירוט הצעת המחיר</h3>
            <Button type="button" size="sm" variant="outline" onClick={addLineItem} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              הוסף שורה
            </Button>
          </div>
          {quote.lineItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {calcSeededBasePrice(quote) !== null
                ? 'אין שורות ידניות — המחיר למטה כבר מחושב אוטומטית לפי פרטי האירוע. הוסיפי שורה רק לחיוב נוסף מעבר לכך.'
                : 'אין עדיין שורות — לחצי על "הוסף שורה" כדי להתחיל.'}
            </p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {quote.lineItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <QuoteLineItemRow
                      item={item}
                      index={index}
                      quoteType={quoteType}
                      onUpdate={(updates) => updateLineItem(item.id, updates)}
                      onRemove={() => removeLineItem(item.id)}
                      invalid={missingTreatmentIds.has(item.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Notes */}
        <Field label="הערות">
          <Textarea
            rows={3}
            value={quote.notesText}
            onChange={(e) => updateField('notesText', coerceValidatedText(QuoteNotesTextSchema, e.target.value, quote.notesText))}
            className="bg-secondary border-border"
          />
        </Field>

        {/* Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="order-1 sm:order-2 space-y-1.5">
            <SignaturePad value={quote.clientSignatureDataUrl} onChange={(dataUrl) => updateField('clientSignatureDataUrl', dataUrl)} />
            {quote.clientSignatureDataUrl && (
              <p className="text-[11px] text-muted-foreground text-center">הקובץ יאוחסן אוטומטית עם השמירה</p>
            )}
          </div>
          <div className="order-2 sm:order-1 flex items-end">
            <SolidCard className="w-full text-center py-4">
              <p className="text-xs text-muted-foreground mb-1">חתימת הקליניקה</p>
              <p className="text-lg font-extrabold text-foreground">{getBusinessProfile().nameHe}</p>
            </SolidCard>
          </div>
        </div>

        {/* Totals — computed via effectiveLineItems(quote), not
            quote.lineItems directly, so a calc-linked event quote's total
            stays live-derived from its own eventTherapistCount/
            eventHourlyRate/event times even with zero real stored rows. */}
        <div className="flex justify-start">
          <div className="w-full sm:w-64 space-y-1.5 rounded-xl border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>סה&quot;כ לפני מע&quot;מ</span>
              <AnimatedNumber value={quoteGrandTotal(effectiveLineItems(quote))} formatter={formatMoney} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>מע&quot;מ ({VAT_RATE_PCT}%)</span>
              <AnimatedNumber value={quoteVatAmount(effectiveLineItems(quote))} formatter={formatMoney} />
            </div>
            <div className="flex items-center justify-between text-sm font-extrabold text-foreground pt-1.5 border-t border-border/60">
              <span>סה&quot;כ לתשלום</span>
              <AnimatedNumber value={quoteTotalWithVat(effectiveLineItems(quote))} formatter={formatMoney} />
            </div>
          </div>
        </div>

        {treatmentError && <p className="text-xs text-destructive">{treatmentError}</p>}
        {dateError && <p className="text-xs text-destructive">{dateError}</p>}
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
          <MotionButton whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} className="gap-1.5 w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמור
          </MotionButton>
          <MotionButton whileTap={{ scale: 0.97 }} variant="outline" onClick={handleDownloadPdf} disabled={pdfBusy} className="gap-1.5 w-full sm:w-auto">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ייצוא ל-PDF
          </MotionButton>
          <Button variant="outline" asChild disabled={!whatsappHref} className="gap-1.5 w-full sm:w-auto">
            <a href={whatsappHref ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!whatsappHref}>
              <MessageCircle className="h-4 w-4" />
              שליחה ב-WhatsApp
            </a>
          </Button>
          <Button variant="outline" asChild disabled={!mailtoHref} className="gap-1.5 w-full sm:w-auto">
            <a href={mailtoHref ?? undefined} aria-disabled={!mailtoHref}>
              <Mail className="h-4 w-4" />
              שליחה במייל
            </a>
          </Button>
          <Button variant="outline" onClick={handleCopySigningLink} className="gap-1.5 w-full sm:w-auto">
            <Link2 className="h-4 w-4" />
            העתק קישור לחתימה
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}

// Symbol immediately before the digits, no space — matches the quote PDF's
// money formatting (PdfTotals.tsx) for consistency across the app.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
