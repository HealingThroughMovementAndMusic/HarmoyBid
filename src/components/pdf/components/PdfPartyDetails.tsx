import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark, marginBottom: 5, marginTop: 10, textAlign: 'right' },
  partyBox: { backgroundColor: documentTheme.colors.brandLight, borderRadius: documentTheme.radius.box, padding: 8 },
  partyText: { fontSize: 9, textAlign: 'right', marginBottom: 2 },
  fieldRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 1 },
  fieldLabel: { fontSize: 9, color: documentTheme.colors.muted },
  fieldValue: { fontSize: 9, color: documentTheme.colors.text },
});

/** A plain string (rendered as-is — only safe when it contains no Hebrew
 *  letters mixed with a digit, e.g. a name, phone, or email on its own)
 *  or a {label, value} pair rendered as separate Text siblings via a
 *  row-reverse View, never one interpolated "label: value" string — see
 *  CLAUDE.md → RTL for why a single Text node mixing Hebrew letters with
 *  a digit is unreliable in this renderer. */
type PartyLine = string | { label: string; value: string };

interface PdfPartyDetailsProps {
  title: string;
  lines: (PartyLine | null | undefined)[];
}

// Reused for both "פרטי לקוח" / "פרטי חברה" and "פרטי האירוע" — same box
// styling, just a different title and line set.
export function PdfPartyDetails({ title, lines }: PdfPartyDetailsProps) {
  const visibleLines = lines.filter((l): l is PartyLine => Boolean(l));
  if (visibleLines.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.partyBox}>
        {visibleLines.map((line, i) =>
          typeof line === 'string' ? (
            <Text key={i} style={styles.partyText}>
              {line}
            </Text>
          ) : (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{line.label}</Text>
              <Text style={styles.fieldValue}>{line.value}</Text>
            </View>
          )
        )}
      </View>
    </>
  );
}
