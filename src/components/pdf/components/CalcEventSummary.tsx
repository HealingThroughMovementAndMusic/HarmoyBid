import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';
import type { CalcParams } from '@/lib/calcEngine';
import type { Niche } from '@/components/calculator/NicheSelector';

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: 700, color: documentTheme.colors.brandDark, marginBottom: 6, marginTop: 16, textAlign: 'right' },
  box: { backgroundColor: documentTheme.colors.brandLight, borderRadius: documentTheme.radius.box, padding: 10 },
  fieldRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 3 },
  fieldLabel: { fontSize: 9, color: documentTheme.colors.muted },
  fieldValue: { fontSize: 9, color: documentTheme.colors.text },
});

interface CalcEventSummaryProps {
  params: CalcParams;
  niche: Niche | undefined;
}

// Shared by both the client-facing and internal PDF — descriptive event
// details only, never financial internals (those belong to
// CalcInternalBreakdown, not this component).
//
// Label and value are always separate Text siblings positioned by the
// row's flex layout, never one interpolated "label: value" string — a
// single Text node mixing Hebrew letters with a number is unreliable in
// @react-pdf/renderer's bidi reordering (verified against real generated
// PDF output, not assumed: "מספר מטפלים: 3" rendered as "ספר מטפלים: 3מ").
// A Text node containing only one script (all-Hebrew label, or a
// digits/Latin value) renders correctly every time this was tested.
export function CalcEventSummary({ params, niche }: CalcEventSummaryProps) {
  const fields: { label: string; value: string }[] = [
    niche ? { label: 'סוג פעילות', value: niche.label } : null,
    params.clientName ? { label: 'לקוח', value: params.clientName } : null,
    { label: 'מספר מטפלים', value: String(params.therapists) },
    { label: 'שעות פעילות', value: String(params.hours) },
    { label: 'כמות משתתפים כוללת', value: String(params.participants) },
    { label: 'תעריף שעתי', value: `₪${params.ratePerHour}` },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <>
      <Text style={styles.sectionTitle}>פרטי האירוע</Text>
      <View style={styles.box}>
        {fields.map((field, i) => (
          <View key={i} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldValue}>{field.value}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
