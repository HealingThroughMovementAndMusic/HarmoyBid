import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';
import { VAT_RATE_PCT } from '@/lib/quotes/quote';

const styles = StyleSheet.create({
  totalsBox: {
    marginTop: 5,
    alignSelf: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: documentTheme.colors.brandLight,
    borderWidth: 1,
    borderColor: documentTheme.colors.brandBorder,
    borderRadius: documentTheme.radius.box,
    padding: 10,
    width: 220,
  },
  totalsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  totalsLabel: { fontSize: 9, color: documentTheme.colors.muted },
  totalsValue: { fontSize: 9, color: documentTheme.colors.text },
  grandTotalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: documentTheme.colors.brandBorder,
  },
  grandTotalText: { fontSize: 13, fontWeight: 700, color: documentTheme.colors.brandDark },
  unpricedNote: { fontSize: 8, color: documentTheme.colors.warning, marginTop: 6, textAlign: 'right' },
});

// Symbol immediately before the digits, no space — not just style: a
// right-aligned "250 ₪" string (number, space, symbol) puts the ₪ at the
// string's own trailing edge, which in this renderer's bidi handling
// lands it far from the number with a visible gap (confirmed against a
// real generated PDF). "₪250" keeps them tight together as one unit.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

interface PdfTotalsProps {
  subtotal: number;
  vat: number;
  total: number;
  hasUnpricedRows: boolean;
}

export function PdfTotals({ subtotal, vat, total, hasUnpricedRows }: PdfTotalsProps) {
  return (
    <View style={styles.totalsBox}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>סה&quot;כ לפני מע&quot;מ</Text>
        <Text style={styles.totalsValue}>{formatMoney(subtotal)}</Text>
      </View>
      <View style={styles.totalsRow}>
        {/* "(18%)" moved into the value cell, not the label — a Text node
            mixing Hebrew letters with an embedded number is unreliable in
            @react-pdf/renderer's bidi reordering (verified via real
            generated-PDF text extraction, not assumed); a value cell with
            only digits/symbols/parentheses (no Hebrew letters) renders
            correctly every time this was tested. */}
        <Text style={styles.totalsLabel}>מע&quot;מ</Text>
        <Text style={styles.totalsValue}>{`${formatMoney(vat)} (${VAT_RATE_PCT}%)`}</Text>
      </View>
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalText}>סה&quot;כ לתשלום</Text>
        <Text style={styles.grandTotalText}>{formatMoney(total)}</Text>
      </View>
      {hasUnpricedRows && <Text style={styles.unpricedNote}>* חלק מהשורות טרם תומחרו — הסכום אינו סופי</Text>}
    </View>
  );
}
