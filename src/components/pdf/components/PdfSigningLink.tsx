import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

const styles = StyleSheet.create({
  signingLinkBox: {
    marginTop: 14,
    backgroundColor: documentTheme.colors.brandLight,
    borderWidth: 1,
    borderColor: documentTheme.colors.brandBorder,
    borderRadius: documentTheme.radius.box,
    padding: 10,
  },
  signingLinkLabel: { fontSize: 8, fontWeight: 700, color: documentTheme.colors.brandDark, textAlign: 'right', marginBottom: 3 },
  signingLinkUrl: { fontSize: 9, color: documentTheme.colors.text, textAlign: 'right' },
});

interface PdfSigningLinkProps {
  signingUrl: string;
}

export function PdfSigningLink({ signingUrl }: PdfSigningLinkProps) {
  return (
    <View style={styles.signingLinkBox}>
      <Text style={styles.signingLinkLabel}>לחתימה דיגיטלית על ההצעה, היכנסי לקישור:</Text>
      <Text style={styles.signingLinkUrl}>{signingUrl}</Text>
    </View>
  );
}
