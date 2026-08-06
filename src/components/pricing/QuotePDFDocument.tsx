import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { PricingSelection } from './PricingCalculator';

// Hebrew glyphs require a font that actually ships them — the built-in PDF
// base fonts (Helvetica etc.) do not. Heebo matches the app's on-screen
// font. If this fails to fetch (offline / blocked network) react-pdf falls
// back silently to Helvetica and Hebrew text will not render correctly —
// worth a manual check once deployed with real network access.
Font.register({
  family: 'Heebo',
  fonts: [
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Regular.ttf', fontWeight: 400 },
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    direction: 'rtl',
    fontSize: 10,
    padding: 36,
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#6b7280' },
  metaBox: { alignItems: 'flex-end' },
  metaLine: { fontSize: 9, color: '#374151', marginBottom: 2 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, marginTop: 18 },
  clientBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  table: { marginTop: 6, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderRow: { backgroundColor: '#f3f4f6' },
  tableCellLabel: { flex: 3, fontSize: 9, textAlign: 'right' },
  tableCellValue: { flex: 1, fontSize: 9, textAlign: 'left' },
  totalsBox: { marginTop: 10, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: 220, marginBottom: 3 },
  grandTotalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: 220,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  grandTotalText: { fontSize: 13, fontWeight: 700 },
  terms: { marginTop: 24, fontSize: 8, color: '#6b7280', lineHeight: 1.5 },
  stamp: {
    position: 'absolute',
    top: 90,
    left: 60,
    fontSize: 22,
    fontWeight: 700,
    padding: 8,
    borderWidth: 2,
    borderRadius: 4,
    transform: 'rotate(-14deg)',
    opacity: 0.7,
  },
});

export interface QuotePDFDocumentProps {
  quoteId: string;
  issueDate: string;
  expiryDate: string;
  status: 'draft' | 'approved';
  clientName: string;
  clientEmail?: string;
  selection: PricingSelection;
  currency?: string;
}

function money(value: number, currency = '₪') {
  return `${Math.round(value).toLocaleString('he-IL')} ${currency}`;
}

export default function QuotePDFDocument({
  quoteId,
  issueDate,
  expiryDate,
  status,
  clientName,
  clientEmail,
  selection,
  currency = '₪',
}: QuotePDFDocumentProps) {
  const { plan, breakdown, quantity, billingCycle } = selection;
  const cycleLabel = billingCycle === 'annual' ? 'שנתי' : 'חודשי';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.stamp,
            { borderColor: status === 'approved' ? '#059669' : '#dc2626', color: status === 'approved' ? '#059669' : '#dc2626' },
          ]}
        >
          <Text>{status === 'approved' ? 'מאושר' : 'טיוטה'}</Text>
        </View>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ריפוי הרמוני — Harmony Healing</Text>
            <Text style={styles.subtitle}>הצעת מחיר</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLine}>מס&apos; הצעה: {quoteId}</Text>
            <Text style={styles.metaLine}>תאריך הפקה: {issueDate}</Text>
            <Text style={styles.metaLine}>בתוקף עד: {expiryDate}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>פרטי לקוח</Text>
        <View style={styles.clientBox}>
          <Text>{clientName || 'לקוח ללא שם'}</Text>
          {clientEmail ? <Text>{clientEmail}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>פירוט ההצעה</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={styles.tableCellLabel}>תיאור</Text>
            <Text style={styles.tableCellValue}>סכום</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              {plan.name} — {money(breakdown.unitPrice, currency)} × {quantity} יח&apos; ({cycleLabel})
            </Text>
            <Text style={styles.tableCellValue}>{money(breakdown.subtotal, currency)}</Text>
          </View>
          {breakdown.volumeDiscountAmount > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>הנחת נפח ({breakdown.volumeDiscountPct}%)</Text>
              <Text style={styles.tableCellValue}>-{money(breakdown.volumeDiscountAmount, currency)}</Text>
            </View>
          )}
          {breakdown.annualDiscountAmount > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>הנחת תשלום שנתי ({breakdown.annualDiscountPct}%)</Text>
              <Text style={styles.tableCellValue}>-{money(breakdown.annualDiscountAmount, currency)}</Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>מע&quot;מ ({breakdown.vatPct}%)</Text>
            <Text style={styles.tableCellValue}>{money(breakdown.vatAmount, currency)}</Text>
          </View>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>לפני מע&quot;מ</Text>
            <Text>{money(breakdown.afterBillingDiscount, currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>מע&quot;מ</Text>
            <Text>{money(breakdown.vatAmount, currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalText}>סה&quot;כ לתשלום</Text>
            <Text style={styles.grandTotalText}>{money(breakdown.grandTotal, currency)}</Text>
          </View>
        </View>

        <Text style={styles.terms}>
          תנאים והערות: ההצעה תקפה עד לתאריך שצוין לעיל. המחירים כוללים מע&quot;מ כחוק. התשלום יבוצע לפי לוח
          התשלומים שיסוכם מול נציג ריפוי הרמוני. הצעה זו אינה מהווה חשבונית מס.
        </Text>
      </Page>
    </Document>
  );
}
