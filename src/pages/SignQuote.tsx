import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel, SolidCard } from '@/components/shared/GlassPanel';
import SignaturePad from '@/components/shared/SignaturePad';
import { TurnstileWidget } from '@/components/shared/TurnstileWidget';
import { getPublicQuote, signQuote, QuoteAlreadySignedError } from '@/lib/quotes/publicQuoteApi';
import { BUSINESS_PROFILE, getBusinessProfile } from '@/lib/business/businessProfile';
import { VAT_EXEMPT_NOTICE } from '@/lib/quotes/quoteDocumentDefaults';
import { cn } from '@/lib/utils';
import {
  QUOTE_TYPE_LABELS,
  quoteGrandTotal,
  lineItemTotal,
  eventHoursDisplay,
  formatDateHe,
  effectiveLineItems,
  type Quote,
} from '@/lib/quotes/quote';

// Public, unauthenticated route (/sign/:quoteId) — the client-facing
// counterpart to QuoteDocumentScreen.tsx's internal editable builder.
// Deliberately NOT rendered inside Home.tsx's DashboardLayout/sidebar —
// no CRM chrome should ever be reachable from a link handed to an
// external client. Reads/writes go through publicQuoteApi.ts (scoped
// Edge Functions), never quoteApi.ts's direct table access — see
// CLAUDE.md's "Quote module" section for why.

type PageState = 'loading' | 'not-found' | 'error' | 'already-signed' | 'ready' | 'signing' | 'signed';

// Symbol immediately before the digits, no space — matches the quote PDF
// (PdfTotals.tsx) so a client sees the same money formatting on both.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

export default function SignQuote() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Only required if the widget is actually configured — see
  // TurnstileWidget.tsx and CLAUDE.md -> "Cloudflare Turnstile".
  const turnstileConfigured = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (!quoteId) {
      setState('not-found');
      return;
    }
    let cancelled = false;
    getPublicQuote(quoteId)
      .then((q) => {
        if (cancelled) return;
        if (!q) {
          setState('not-found');
          return;
        }
        setQuote(q);
        setState(q.status === 'signed' ? 'already-signed' : 'ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'טעינת ההצעה נכשלה.');
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const handleSign = async () => {
    if (!quoteId || !signature) return;
    if (turnstileConfigured && !turnstileToken) return;
    setState('signing');
    setErrorMessage(null);
    try {
      const signed = await signQuote(quoteId, signature, turnstileToken ?? undefined);
      setQuote(signed);
      setState('signed');
      // Dynamic import — @react-pdf/renderer + QuoteDocument (and every
      // Pdf* component) are only needed once a client has actually signed,
      // never to render this page in the first place. Loading them here
      // instead of as a top-level import keeps them out of the chunk this
      // page needs before the user can even see the "sign" button.
      import('@/lib/storage/archiveQuotePdf').then(({ archiveQuotePdf }) => {
        archiveQuotePdf(signed, { notify: true });
      });
    } catch (err) {
      if (err instanceof QuoteAlreadySignedError) {
        setState('already-signed');
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : 'החתימה נכשלה. נסי שוב.');
      setState('ready');
    }
  };

  if (state === 'loading') {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          טוען הצעה...
        </div>
      </PageShell>
    );
  }

  if (state === 'not-found') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
          <FileWarning className="h-10 w-10" />
          <p>ההצעה לא נמצאה. ייתכן שהקישור שגוי או שההצעה נמחקה.</p>
        </div>
      </PageShell>
    );
  }

  if (state === 'error' || !quote) {
    return (
      <PageShell>
        <div className="py-24 text-center text-destructive">{errorMessage ?? 'שגיאה בטעינת ההצעה.'}</div>
      </PageShell>
    );
  }

  if (state === 'signed') {
    return (
      <PageShell>
        <GlassPanel className="p-10 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <h2 className="text-xl font-extrabold text-foreground">תודה! ההצעה נחתמה בהצלחה</h2>
          <p className="text-sm text-muted-foreground">
            מס&apos; הצעה <span>{quote.quoteNumber}</span> נחתמה. נציג מטעם {getBusinessProfile().nameHe} ייצור עמך קשר בהמשך.
          </p>
        </GlassPanel>
      </PageShell>
    );
  }

  const isCompany = quote.quoteType === 'company_event';
  const isClinic = quote.quoteType === 'clinic_treatment';
  const hasEventFields = quote.quoteType === 'private_event' || quote.quoteType === 'company_event';
  const sortedItems = [...quote.lineItems].sort((a, b) => a.order - b.order);

  return (
    <PageShell>
      <GlassPanel className="p-6 space-y-4">
        {/* Business identity only — client details have their own dedicated
            "Party" section below; showing them here too was pure
            duplication (same fix already applied to the PDF's PdfHeader.tsx
            this session). */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="text-right space-y-1.5">
            <h3 className="text-base font-extrabold text-foreground">{getBusinessProfile().nameHe}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().idNumber}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().email}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{getBusinessProfile().phone}</p>
          </div>
          <img src={BUSINESS_PROFILE.logo} alt={getBusinessProfile().nameHe} className="h-12 w-12 rounded-lg object-contain bg-white p-0.5" />
        </div>

        {/* Document identity — its own banner, not mixed into either
            party's info block. */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-2.5 dark:bg-primary/20">
          <p className="text-sm font-bold text-background dark:text-foreground">
            <span>הצעת מחיר מספר </span>
            <span>{quote.quoteNumber || '—'}</span>
          </p>
          <span className="rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium text-background dark:bg-primary/20 dark:text-foreground">
            סוג הטיפול: {QUOTE_TYPE_LABELS[quote.quoteType]}
          </span>
        </div>

        {/* Party */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label={isCompany ? 'שם החברה' : 'שם הלקוח'} value={isCompany ? quote.companyName : quote.clientName} />
          {isCompany && <ReadOnlyField label='ח.פ / ע.מ' value={quote.companyTaxId} />}
          <ReadOnlyField label={isCompany ? 'טלפון איש קשר' : 'טלפון'} value={isCompany ? quote.contactPersonPhone : quote.clientPhone} />
          <ReadOnlyField label={isCompany ? 'אימייל איש קשר' : 'כתובת מייל'} value={isCompany ? quote.contactPersonEmail : quote.clientEmail} />
          {hasEventFields && (
            <>
              <ReadOnlyField label="תאריך האירוע" value={quote.eventDate ? formatDateHe(quote.eventDate) : ''} />
              <ReadOnlyField label="שעות פעילות" value={eventHoursDisplay(quote)} />
              <ReadOnlyField label="כמות מטפלים" value={quote.eventTherapistCount?.toString() ?? ''} />
              <ReadOnlyField label="מיקום" value={quote.eventLocation} />
            </>
          )}
        </div>

        {/* Line items — clinic quotes only. Event-type quotes (private/
            company) skip this: the pricing rationale is already fully
            covered by "פרטי האירוע/הצעת המחיר" above and the actual total
            below, so a list repeating one unlabeled row was pure
            redundancy — matches QuoteDocument.tsx's PDF, kept in sync
            deliberately (a client shouldn't see different information on
            the sign page vs. the PDF of the same quote). */}
        {isClinic && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">פירוט הצעת המחיר</h3>
            <div className="space-y-2">
              {sortedItems.map((item) => {
                const description = item.treatmentName || item.description;
                const sub = item.durationMinutes
                  ? `${item.durationMinutes} דק' · ${item.purchaseType === 'series' ? 'סדרה' : 'טיפול בודד'}`
                  : null;
                return (
                  <SolidCard key={item.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{description || '—'}</p>
                      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className="text-sm font-bold text-foreground shrink-0">
                      {item.unitPrice === null ? (
                        <span className="text-muted-foreground italic font-normal text-xs">טרם תומחר</span>
                      ) : (
                        formatMoney(lineItemTotal(item))
                      )}
                    </div>
                  </SolidCard>
                );
              })}
            </div>
          </div>
        )}

        {quote.notesText && <ReadOnlyField label="הערות" value={quote.notesText} multiline />}

        {/* Totals — effectiveLineItems(quote), matching QuoteDocument.tsx's
            PDF and the internal builder, so a calc-linked event quote's
            price is consistent everywhere the client might see it. The
            business is VAT-exempt — quoteGrandTotal() is already the
            final amount, no VAT row/addition. */}
        <div className="flex justify-start">
          <div className="w-full sm:w-64 space-y-1.5 rounded-xl border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between text-sm font-extrabold text-foreground">
              <span>סה&quot;כ לתשלום</span>
              <span>{formatMoney(quoteGrandTotal(effectiveLineItems(quote)))}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{VAT_EXEMPT_NOTICE}</p>

        {state === 'already-signed' ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm font-bold text-foreground">
            הצעה זו כבר נחתמה.
          </div>
        ) : (
          <>
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <p className="text-sm font-bold text-foreground">חתימה לאישור ההצעה</p>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
            <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
            {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
            <Button
              onClick={handleSign}
              disabled={!signature || state === 'signing' || (turnstileConfigured && !turnstileToken)}
              className="w-full gap-1.5"
            >
              {state === 'signing' && <Loader2 className="h-4 w-4 animate-spin" />}
              אישור וחתימה על ההצעה
            </Button>
          </>
        )}
      </GlassPanel>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

function ReadOnlyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-sm text-foreground', multiline && 'whitespace-pre-wrap')}>{value || '—'}</p>
    </div>
  );
}
