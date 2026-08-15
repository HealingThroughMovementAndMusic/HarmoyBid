import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/lib/supabaseClient';
import QuoteDocument from '@/components/pdf/documents/QuoteDocument';
import type { Quote } from '@/lib/quotes/quote';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the "data:application/pdf;base64," prefix — the Edge
      // Function only wants the raw base64 payload.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Fire-and-forget: archival must never block Save/PDF/WhatsApp/Email,
// which are the parts of this flow the user directly waits on. Renders
// the exact same PDF the "Export PDF" button produces (one source of
// truth for layout) and sends the bytes to the Edge Function, which
// uploads it to a private Supabase Storage bucket ("quote-pdfs").
//
// `notify` gates the business "quote signed" email (moved here from
// sign-quote — see that Edge Function's comments) — only the public
// signing page (SignQuote.tsx) should ever pass true. The internal
// re-save path (QuoteDocumentScreen.tsx) never does, so staff editing
// an already-signed quote doesn't re-trigger the notification.
export async function archiveQuotePdf(quote: Quote, options?: { notify?: boolean }): Promise<void> {
  try {
    const signingUrl = `${window.location.origin}/sign/${quote.id}`;
    const blob = await pdf(<QuoteDocument quote={quote} signingUrl={signingUrl} />).toBlob();
    const pdfBase64 = await blobToBase64(blob);
    await supabase.functions.invoke('archive-quote-pdf', {
      body: { quoteId: quote.id, quoteNumber: quote.quoteNumber, pdfBase64, notify: options?.notify ?? false },
    });
  } catch {
    // Non-fatal — nothing to surface to the user for a background archival step.
  }
}
