import { Text, View, Link, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

// Clinic-quote-only footer buttons ("מידע נוסף" / "קביעת תור") — react-pdf's
// `Link` component, same primitive PdfSignatures.tsx's clickable client
// signature block uses. Deliberately a single slim row of small pills —
// this project's quote PDFs are tuned to fit exactly one page with
// near-zero spare margin, so a compact footprint here matters.
// `alignSelf: 'flex-end'` puts the row on the page's right side, directly
// under "חתימת לקוח" (PdfSignatures.tsx's first — thus rightmost, per its
// own row-reverse layout — signature block), per explicit user placement
// request; PdfTotals.tsx's totalsBox uses the opposite (`flex-start`, left
// side) for its own unrelated reason.
const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignSelf: 'flex-end', marginTop: 8, gap: 6 },
  pill: {
    backgroundColor: documentTheme.colors.brandLight,
    borderWidth: 1,
    borderColor: documentTheme.colors.brandBorder,
    borderRadius: documentTheme.radius.badge,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillText: { fontSize: 8, fontWeight: 700, color: documentTheme.colors.brandDark },
});

interface PdfActionLinksProps {
  websiteUrl: string | null;
  bookingUrl: string | null;
}

export function PdfActionLinks({ websiteUrl, bookingUrl }: PdfActionLinksProps) {
  if (!websiteUrl && !bookingUrl) return null;
  return (
    <View style={styles.row}>
      {bookingUrl && (
        <Link src={bookingUrl} style={styles.pill}>
          <Text style={styles.pillText}>קביעת תור</Text>
        </Link>
      )}
      {websiteUrl && (
        <Link src={websiteUrl} style={styles.pill}>
          <Text style={styles.pillText}>מידע נוסף</Text>
        </Link>
      )}
    </View>
  );
}
