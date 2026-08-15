import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';
import { lineItemTotal, type Quote, type QuoteLineItem } from '@/lib/quotes/quote';

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark, marginBottom: 5, marginTop: 10, textAlign: 'right' },
  table: { marginTop: 6, borderWidth: 1, borderColor: documentTheme.colors.brandBorder, borderRadius: 4, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderRow: { backgroundColor: documentTheme.colors.brandLight },
  tableHeaderText: { fontSize: 9, fontWeight: 700, color: documentTheme.colors.brandDark },
  // flex: 4 lives here (not just on the data row's wrapping View below) so
  // the header row's "שירות" cell claims the same column width as the data
  // row's description column — without it, the header cell (a bare Text
  // with no flex) only takes its own short text width, so the qty/price
  // columns end up in different x-positions between the header row and
  // every data row (confirmed via a real rasterized PDF: the "כמות" header
  // and a row's quantity value landed far apart). The data row still puts
  // this same flex on the *wrapping View*, not the inner Text — putting it
  // on both nested levels is the separate, already-documented overlap bug.
  tableCellDescBox: { flex: 4 },
  tableCellDesc: { fontSize: 9, textAlign: 'right' },
  tableCellSubGroup: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginTop: 2 },
  tableCellSub: { fontSize: 8, textAlign: 'right', color: documentTheme.colors.muted },
  tableCellQty: { flex: 1, fontSize: 9, textAlign: 'center' },
  tableCellPrice: { flex: 1.5, fontSize: 9, textAlign: 'left' },
});

// See PdfTotals.tsx's formatMoney for why the symbol goes first, tight
// against the digits, with no space.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

interface PdfItemsTableProps {
  sortedItems: QuoteLineItem[];
  isClinic: boolean;
}

export function PdfItemsTable({ sortedItems, isClinic }: PdfItemsTableProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>פירוט הצעת המחיר</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCellDescBox, styles.tableCellDesc, styles.tableHeaderText]}>שירות</Text>
          <Text style={[styles.tableCellQty, styles.tableHeaderText]}>כמות</Text>
          <Text style={[styles.tableCellPrice, styles.tableHeaderText]}>סה&quot;כ</Text>
        </View>
        {sortedItems.map((row) => {
          const description = isClinic && row.treatmentName ? row.treatmentName : row.description;
          const showSub = isClinic && row.durationMinutes;
          // Sub-text pieces in normal reading order (first = rightmost,
          // matching row-reverse + RTL) — each piece is either pure
          // Hebrew/punctuation or a pure number, never mixed in one Text
          // node. See CLAUDE.md → RTL: a single Text node mixing Hebrew
          // letters with a digit is unreliable in this renderer, both
          // for visual bidi order and for correct width measurement
          // (mismatched measurement is what let this row's text overflow
          // past the table cell's border).
          const subPieces: string[] = showSub
            ? [
                `${row.durationMinutes} `,
                `דק' · ${row.purchaseType === 'series' ? 'סדרה' : 'טיפול בודד'}`,
                ...(row.description ? [` · ${row.description}`] : []),
              ]
            : [];
          return (
            <View key={row.id} style={styles.tableRow}>
              <View style={styles.tableCellDescBox}>
                <Text style={styles.tableCellDesc}>{description || '—'}</Text>
                {showSub && (
                  <View style={styles.tableCellSubGroup}>
                    {subPieces.map((piece, i) => (
                      <Text key={i} style={styles.tableCellSub}>
                        {piece}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <Text style={styles.tableCellQty}>{row.quantity}</Text>
              <Text style={styles.tableCellPrice}>
                {row.unitPrice === null ? 'טרם תומחר' : formatMoney(lineItemTotal(row))}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

export type { Quote };
