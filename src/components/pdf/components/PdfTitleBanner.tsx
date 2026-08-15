import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

const styles = StyleSheet.create({
  titleBanner: {
    marginTop: 14,
    backgroundColor: documentTheme.colors.brandDark,
    borderRadius: documentTheme.radius.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBannerMainGroup: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  titleBannerMain: { fontSize: 14, fontWeight: 700, color: documentTheme.colors.white },
  // marginLeft, not a trailing space in the string — a space character
  // at a Text-box boundary gets silently trimmed by this renderer
  // regardless of which side/direction it's on (confirmed on both the
  // Hebrew-leading and number-leading side), so any gap between sibling
  // Text pieces must come from layout, never from whitespace content.
  titleBannerMainLabel: { marginLeft: 4 },
  titleBannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: documentTheme.radius.badge,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 9,
    color: documentTheme.colors.white,
  },
});

interface PdfTitleBannerProps {
  quoteNumber: string | null;
  quoteTypeLabel: string;
}

// Split at the Hebrew↔alphanumeric-code boundary into sibling Text
// elements inside a row-reverse View — see CLAUDE.md → RTL for why a
// single Text node mixing Hebrew letters with a digit-bearing quote
// number is unreliable in this renderer (bidi-js's inline reordering is
// only reliable for block-level View/row-reverse-positioned siblings,
// not content inside one shared Text node). Pieces listed in normal
// reading order (first piece = rightmost, matching row-reverse + RTL).
export function PdfTitleBanner({ quoteNumber, quoteTypeLabel }: PdfTitleBannerProps) {
  return (
    <View style={styles.titleBanner}>
      <View style={styles.titleBannerMainGroup}>
        <Text style={[styles.titleBannerMain, styles.titleBannerMainLabel]}>{'הצעת מחיר מספר'}</Text>
        <Text style={styles.titleBannerMain}>{quoteNumber || 'טרם נשמר'}</Text>
      </View>
      <Text style={styles.titleBannerBadge}>{`סוג הטיפול: ${quoteTypeLabel}`}</Text>
    </View>
  );
}
