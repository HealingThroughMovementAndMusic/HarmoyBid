import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from '../fonts';
import { documentTheme } from '../documentTheme';
import { PdfHeader } from '../components/PdfHeader';
import { CalcEventSummary } from '../components/CalcEventSummary';
import { PdfTotals } from '../components/PdfTotals';
import { NICHES } from '@/components/calculator/NicheSelector';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

registerPdfFonts();

const styles = StyleSheet.create({
  page: { fontFamily: documentTheme.fontFamily, direction: 'rtl', fontSize: 10, padding: documentTheme.spacing.page, color: documentTheme.colors.text },
});

interface CalcClientDocumentProps {
  params: CalcParams;
  results: CalculationResult;
}

// Client-facing export from the Events Calculator — event details + final
// price ONLY. Deliberately does not render commissionCost, totalWage,
// totalTravel, guaranteeSupplement, netProfit, margin, hourlyWage, or
// paidTherapists — none of this component's props are ever read for
// those fields. No VAT added: the business is VAT-exempt, so grossRevenue
// (already the calculator's own final client price — calcEngine.ts never
// computes VAT either) is shown exactly as-is, matching every other
// client-facing document. Reuses the shared PdfTotals component (same one
// QuoteDocument.tsx uses) rather than duplicating the totals box — one
// source of truth for that layout.
export default function CalcClientDocument({ params, results }: CalcClientDocumentProps) {
  const niche = NICHES.find((n) => n.id === params.niche);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader />

        <CalcEventSummary params={params} niche={niche} />

        <PdfTotals total={results.grossRevenue} hasUnpricedRows={false} />
      </Page>
    </Document>
  );
}
