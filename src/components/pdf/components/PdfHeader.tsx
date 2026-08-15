import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { BUSINESS_PROFILE, getBusinessProfile } from '@/lib/business/businessProfile';
import { documentTheme } from '../documentTheme';

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: documentTheme.colors.brandLight,
    borderRadius: documentTheme.radius.card,
    borderWidth: 1,
    borderColor: documentTheme.colors.brandBorder,
    padding: documentTheme.spacing.card,
    alignItems: 'flex-end',
  },
  titleBlock: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  logo: { width: 34, height: 34, borderRadius: 6 },
  title: { fontSize: 16, fontWeight: 700, color: documentTheme.colors.brandDark, textAlign: 'right' },
  businessMetaText: { fontSize: 8, color: documentTheme.colors.muted, textAlign: 'right', marginTop: 6, lineHeight: 1.3 },
});

// Business identity only — client details have their own dedicated
// "פרטי לקוח"/"פרטי חברה" section (PdfPartyDetails) below the title
// banner, so showing them here too was pure duplication. A single
// block under headerCard's own alignItems:'flex-end' (no row/columns
// to balance) so nothing stretches to fill freed width.
export function PdfHeader() {
  return (
    <View style={styles.headerCard}>
      <View style={styles.titleBlock}>
        <Image src={BUSINESS_PROFILE.logo} style={styles.logo} />
        <Text style={styles.title}>{getBusinessProfile().nameHe}</Text>
      </View>
      <Text style={styles.businessMetaText}>{getBusinessProfile().idNumber}</Text>
      <Text style={styles.businessMetaText}>{getBusinessProfile().phone}</Text>
      <Text style={styles.businessMetaText}>{getBusinessProfile().email}</Text>
    </View>
  );
}
