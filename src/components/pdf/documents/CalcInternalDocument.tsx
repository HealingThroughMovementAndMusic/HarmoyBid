import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from '../fonts';
import { documentTheme } from '../documentTheme';
import { PdfHeader } from '../components/PdfHeader';
import { CalcEventSummary } from '../components/CalcEventSummary';
import { NICHES } from '@/components/calculator/NicheSelector';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

registerPdfFonts();

const styles = StyleSheet.create({
  page: { fontFamily: documentTheme.fontFamily, direction: 'rtl', fontSize: 10, padding: documentTheme.spacing.page, color: documentTheme.colors.text },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark, marginBottom: 6, marginTop: 16, textAlign: 'right' },
  table: { borderWidth: 1, borderColor: documentTheme.colors.brandBorder, borderRadius: 4, overflow: 'hidden' },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  labelGroup: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  label: { fontSize: 9, color: documentTheme.colors.muted },
  value: { fontSize: 9, color: documentTheme.colors.text },
  grandRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: documentTheme.colors.brandLight },
  grandLabelGroup: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  grandLabel: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark },
  grandValue: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark },
});

// See PdfTotals.tsx's formatMoney for why the symbol goes first, tight
// against the digits, with no space.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

// A row's "label" is a sequence of pieces, each EITHER pure Hebrew text
// (letters/punctuation, no digits) OR a pure number/symbol chunk (no
// Hebrew letters) — never both mixed in one piece. Rendered as sibling
// Text nodes inside a row-reverse View (Yoga-positioned, deterministic),
// never nested inside one shared parent Text (textkit's inline bidi
// reordering of nested Text children is unreliable — verified against
// real generated PDF output: a single Text node mixing Hebrew letters
// with an embedded number scrambles, e.g. "עלות שכר (2 מטפלים...)"
// rendered as "...מטפלים( )2 עלות שכ"). List pieces in normal reading
// order (first piece = rightmost, matching row-reverse + RTL).
type LabelPiece = string;

interface RowSpec {
  pieces: LabelPiece[];
  value: number;
  negative?: boolean;
}

interface CalcInternalDocumentProps {
  params: CalcParams;
  results: CalculationResult;
}

// Internal-only export from the Events Calculator — the full cost/
// profitability breakdown. Wage is shown in ONLY the currently-selected
// unit (params.wageMode), never both, per explicit request. Never
// distributed to a client — this is the counterpart to CalcClientDocument.
export default function CalcInternalDocument({ params, results }: CalcInternalDocumentProps) {
  const niche = NICHES.find((n) => n.id === params.niche);

  const wagePieces: LabelPiece[] =
    params.wageMode === 'hr'
      ? ['עלות שכר (', String(results.paidTherapists), ' מטפלים בתשלום × ', formatMoney(results.hourlyWage), '/שעה)']
      : ['עלות שכר (', String(results.paidTherapists), ' מטפלים בתשלום × ', String(params.wagePerMinute), ' ₪/דקה)'];

  const rows: RowSpec[] = [
    { pieces: ['מחזור הכנסות (ברוטו)'], value: results.grossRevenue },
    { pieces: ['עמלת מתחם (', String(params.commissionPct), '%)'], value: results.commissionCost, negative: true },
    { pieces: wagePieces, value: results.totalWage, negative: true },
    { pieces: ['נסיעות (', String(results.vehicleCount), ' רכבים × ', String(params.travelKm), ' ק"מ)'], value: results.totalTravel, negative: true },
    ...(params.incomeGuarantee && results.guaranteeSupplement > 0
      ? [{ pieces: ['השלמת שכר (הבטחת הכנסה)'], value: results.guaranteeSupplement, negative: true }]
      : []),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader />

        <CalcEventSummary params={params} niche={niche} />

        <Text style={styles.sectionTitle}>דוח רווחיות מלא</Text>
        <View style={styles.table}>
          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.labelGroup}>
                {row.pieces.map((piece, j) => (
                  <Text key={j} style={styles.label}>
                    {piece}
                  </Text>
                ))}
              </View>
              <Text style={styles.value}>{row.negative ? `-${formatMoney(Math.abs(row.value))}` : formatMoney(row.value)}</Text>
            </View>
          ))}
          <View style={styles.grandRow}>
            <View style={styles.grandLabelGroup}>
              <Text style={styles.grandLabel}>{"רווח נקי (מרג'ין "}</Text>
              <Text style={styles.grandLabel}>{results.margin.toFixed(1)}</Text>
              <Text style={styles.grandLabel}>{'%)'}</Text>
            </View>
            <Text style={styles.grandValue}>{formatMoney(results.netProfit)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
