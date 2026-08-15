import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

const styles = StyleSheet.create({
  banner: {
    marginTop: 10,
    backgroundColor: documentTheme.colors.brandDark,
    borderRadius: documentTheme.radius.card,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bannerText: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.white, textAlign: 'right' },
  list: { marginTop: 6 },
  item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 3 },
  check: { fontSize: 14, color: documentTheme.colors.brandDark, fontWeight: 700 },
  itemText: { fontSize: 9, color: documentTheme.colors.text },
});

const INCLUDED_SERVICES = [
  'צוות מטפלים מוסמכים ומבוטחים',
  'הקמה ופירוק מתחם טיפול מלא',
  'שמנים ארומתרפיים מקצועיים',
  'מוזיקת רקע',
  "ניהול לו\"ז וזרימת משתתפים",
];

// Standard "included services" checklist shown on event-type client
// quotes (private_event / company_event) — not per-package data, a fixed
// set of what every event booking includes. Each item is pure Hebrew (no
// embedded digits), safe as a single Text node per the project's
// verified bidi rule (CLAUDE.md → RTL). Uses "•" as the marker, not "✓"
// — verified via fontkit that the bundled Heebo font has no glyph for
// U+2713 (would render as a blank box); "•" (U+2022) is present.
export function PdfIncludedServices() {
  return (
    <View>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>שירותים כלולים</Text>
      </View>
      <View style={styles.list}>
        {INCLUDED_SERVICES.map((item, i) => (
          <View key={i} style={styles.item}>
            <Text style={styles.check}>{'•'}</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
