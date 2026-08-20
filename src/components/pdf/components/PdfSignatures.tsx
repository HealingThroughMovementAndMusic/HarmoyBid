import { Text, View, Image, Link, StyleSheet } from '@react-pdf/renderer';
import { documentTheme } from '../documentTheme';
import { getBusinessProfile } from '@/lib/business/businessProfile';

// Both signature blocks are pinned to a shared fixed height with content
// bottom-aligned, so the underline sits at the same y-position on both
// sides regardless of whether a drawn signature image (50pt tall) or just
// one line of static business-name text sits above it.
const styles = StyleSheet.create({
  signaturesRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  signatureBlock: { alignItems: 'center', width: 170, height: 52, justifyContent: 'flex-end' },
  signatureImage: { width: 150, height: 50, objectFit: 'contain' },
  signatureLine: { width: 150, borderTopWidth: 1, borderTopColor: documentTheme.colors.brandBorder, marginTop: 2, paddingTop: 3 },
  signatureLabel: { fontSize: 8, color: documentTheme.colors.muted, textAlign: 'center' },
  businessSignatureName: { fontSize: 12, fontWeight: 700, color: documentTheme.colors.brandDark, textAlign: 'center' },
});

interface PdfSignaturesProps {
  clientSignatureDataUrl: string | null;
  /** The public /sign/:id link. When set and the quote isn't signed yet,
   *  the client's signature block itself becomes a real PDF link
   *  annotation (react-pdf's `Link` — the same primitive PdfActionLinks.tsx
   *  already uses for its footer pills) pointing straight to the existing
   *  signing page — replacing the old separate box that showed the raw
   *  URL as plain text. No new signing system/URL: same /sign/:id route,
   *  same SignaturePad, same status/Calendar/notification flow on that
   *  page — only how a client *reaches* it from the PDF changed. */
  signingUrl?: string;
}

export function PdfSignatures({ clientSignatureDataUrl, signingUrl }: PdfSignaturesProps) {
  // Once signed, a signature image already occupies the block — clicking
  // through to sign again wouldn't make sense, so only offer the link
  // while there's genuinely nothing to click "into" yet.
  const isClientBlockClickable = Boolean(signingUrl) && !clientSignatureDataUrl;

  return (
    // wrap={false}: keep both signature blocks together as one unit — the
    // row was otherwise splitting mid-row across a page boundary (one
    // signature landing on the current page, the other pushed alone to the
    // next), which looked broken. Now the whole row moves together.
    <View style={styles.signaturesRow} wrap={false}>
      {isClientBlockClickable ? (
        // textDecoration: 'none' — react-pdf's Link defaults to the
        // anchor-style blue underline; overridden here so a clickable
        // signature line still reads as a plain signature line, matching
        // the non-clickable/business block right next to it.
        <Link src={signingUrl} style={[styles.signatureBlock, { textDecoration: 'none' }]}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>חתימת לקוח</Text>
          </View>
        </Link>
      ) : (
        <View style={styles.signatureBlock}>
          {clientSignatureDataUrl && <Image src={clientSignatureDataUrl} style={styles.signatureImage} />}
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>חתימת לקוח</Text>
          </View>
        </View>
      )}
      <View style={styles.signatureBlock}>
        <Text style={styles.businessSignatureName}>{getBusinessProfile().nameHe}</Text>
        <View style={styles.signatureLine}>
          <Text style={styles.signatureLabel}>חתימת הקליניקה</Text>
        </View>
      </View>
    </View>
  );
}
