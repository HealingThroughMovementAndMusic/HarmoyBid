import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

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
  // No top border/padding here anymore — this used to separate the grand
  // total from the subtotal/VAT rows above it; now it's the box's only
  // row, so a divider line with nothing above it would be a stray leftover.
  grandTotalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
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
  /** Final amount the client pays — the business is VAT-exempt, so this
   *  is never marked up. See CLAUDE.md → "VAT-exempt business" for why
   *  this box has no subtotal/VAT rows anymore. */
  total: number;
  hasUnpricedRows: boolean;
}

export function PdfTotals({ total, hasUnpricedRows }: PdfTotalsProps) {
  return (
    <View style={styles.totalsBox}>
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalText}>סה&quot;כ לתשלום</Text>
        <Text style={styles.grandTotalText}>{formatMoney(total)}</Text>
      </View>
      {hasUnpricedRows && <Text style={styles.unpricedNote}>* חלק מהשורות טרם תומחרו — הסכום אינו סופי</Text>}
    </View>
  );
}
