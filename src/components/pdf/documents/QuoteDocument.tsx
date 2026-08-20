import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from '../fonts';
import { documentTheme } from '../documentTheme';
import { PdfHeader } from '../components/PdfHeader';
import { PdfTitleBanner } from '../components/PdfTitleBanner';
import { PdfPartyDetails } from '../components/PdfPartyDetails';
import { PdfItemsTable } from '../components/PdfItemsTable';
import { PdfTotals } from '../components/PdfTotals';
import { PdfSignatures } from '../components/PdfSignatures';
import { PdfIncludedServices } from '../components/PdfIncludedServices';
import { PdfActionLinks } from '../components/PdfActionLinks';
import { getBusinessProfile } from '@/lib/business/businessProfile';
import { getQuoteDocumentDefaults } from '@/lib/quotes/quoteDocumentDefaults';
import {
  quoteGrandTotal,
  quoteVatAmount,
  quoteTotalWithVat,
  eventHoursDisplay,
  formatDateHe,
  effectiveLineItems,
  QUOTE_TYPE_LABELS,
  type Quote,
} from '@/lib/quotes/quote';

registerPdfFonts();

const styles = StyleSheet.create({
  page: { fontFamily: documentTheme.fontFamily, direction: 'rtl', fontSize: 10, padding: documentTheme.spacing.page, color: documentTheme.colors.text },
  // Each terms line is its own Text node (see the render below) — a single
  // Text node joining multiple sentences via '\n' put trailing periods at
  // the wrong visual edge (CLAUDE.md → RTL: textkit's inline bidi
  // reordering isn't reliable across multiple logical lines sharing one
  // Text node, only across sibling Text elements).
  terms: { fontSize: 8, color: documentTheme.colors.muted, lineHeight: 1.3, textAlign: 'right' },
});

interface QuoteDocumentProps {
  quote: Quote;
  /** The public /sign/:id link — shown as plain text so a client who only
   *  has the PDF file (not the WhatsApp/email message) can still get to
   *  the real signing page. Optional: omitted when rendering in a context
   *  where the app's origin isn't known (e.g. no window). */
  signingUrl?: string;
}

// Thin composing root — the replacement for the old QuotesPdfDocument.tsx
// monolith. Each visual section is its own component under ../components/.
export default function QuoteDocument({ quote, signingUrl }: QuoteDocumentProps) {
  // effectiveLineItems(quote), not quote.lineItems — a calc-linked event
  // quote prices live off eventTherapistCount/eventHourlyRate/event times,
  // not a stored row (see quote.ts's effectiveLineItems for why).
  const sortedItems = [...effectiveLineItems(quote)].sort((a, b) => a.order - b.order);
  const hasUnpricedRows = sortedItems.some((row) => row.unitPrice === null);
  const subtotal = quoteGrandTotal(sortedItems);
  const vat = quoteVatAmount(sortedItems);
  const total = quoteTotalWithVat(sortedItems);
  const isCompany = quote.quoteType === 'company_event';
  const isClinic = quote.quoteType === 'clinic_treatment';

  const partyLines = isCompany
    ? [quote.companyName, quote.companyTaxId ? `ח.פ / ע.מ: ${quote.companyTaxId}` : null, quote.contactPersonPhone, quote.contactPersonEmail]
    : [quote.clientName, quote.clientPhone, quote.clientEmail];
  // {label, value} pairs, not interpolated "label: value" strings — a
  // single Text node mixing Hebrew letters with a digit is unreliable in
  // this renderer (CLAUDE.md → RTL); PdfPartyDetails renders each pair as
  // separate Text siblings via a row-reverse View instead.
  const eventLines =
    quote.quoteType !== 'clinic_treatment'
      ? [
          quote.eventDate ? { label: 'תאריך', value: formatDateHe(quote.eventDate) } : null,
          eventHoursDisplay(quote) ? { label: 'שעות פעילות', value: eventHoursDisplay(quote) } : null,
          quote.eventTherapistCount ? { label: 'כמות מטפלים', value: String(quote.eventTherapistCount) } : null,
          quote.eventParticipantsCount ? { label: 'כמות משתתפים כוללת', value: String(quote.eventParticipantsCount) } : null,
          quote.eventHourlyRate ? { label: 'תעריף שעתי', value: String(quote.eventHourlyRate) } : null,
        ]
      : [];
  const isEventQuote = quote.quoteType !== 'clinic_treatment';

  const termsLines = [getQuoteDocumentDefaults().paymentTerms, getQuoteDocumentDefaults().fixedNote, quote.notesText].filter(
    (line): line is string => Boolean(line)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader />

        <PdfTitleBanner quoteNumber={quote.quoteNumber} quoteTypeLabel={QUOTE_TYPE_LABELS[quote.quoteType]} />

        <PdfPartyDetails title={isCompany ? 'פרטי חברה' : 'פרטי לקוח'} lines={partyLines} />

        <PdfPartyDetails title="פרטי האירוע/הצעת המחיר" lines={eventLines} />

        {isEventQuote && <PdfIncludedServices />}

        {/* Event-type quotes (private_event/company_event) skip the
            line-item table entirely — the pricing rationale is already
            fully covered by "פרטי האירוע/הצעת המחיר" above and the actual
            total below, so a table repeating just one unlabeled row was
            pure redundancy (and was the direct cause of the whole
            document tipping over to a second page). Clinic quotes keep
            the table — often several differently-priced treatments with
            no equivalent "event details" box to summarize them. */}
        {isClinic && <PdfItemsTable sortedItems={sortedItems} isClinic={isClinic} />}

        <PdfTotals subtotal={subtotal} vat={vat} total={total} hasUnpricedRows={hasUnpricedRows} />

        {/* Business-wide defaults (payment terms + fixed note) folded into
            the same compact slot as the per-quote notesText below — one
            marginTop for all of them, not three separate blocks, to keep
            the vertical-space cost minimal (see the page-fit verification
            this feature was built and checked against). */}
        {termsLines.length > 0 && (
          <View style={{ marginTop: 18 }}>
            {termsLines.map((line, i) => (
              <Text key={i} style={styles.terms}>
                {line}
              </Text>
            ))}
          </View>
        )}

        <PdfSignatures clientSignatureDataUrl={quote.clientSignatureDataUrl} signingUrl={signingUrl} />

        {/* Clinic-only — a client walking in for a treatment benefits from
            a quick way to the website/booking page; event-type quotes stay
            untouched (their page budget has no spare margin, see the
            PdfItemsTable comment above). */}
        {isClinic && <PdfActionLinks websiteUrl={getBusinessProfile().websiteUrl} bookingUrl={getBusinessProfile().bookingUrl} />}
      </Page>
    </Document>
  );
}
