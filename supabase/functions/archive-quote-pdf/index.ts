// Supabase Edge Function (Deno). Invoked from the client
// (src/lib/storage/archiveQuotePdf.tsx) as a fire-and-forget call once a
// quote is signed+saved. The client renders the PDF itself (the same
// QuotesPdfDocument used for manual export) and sends the bytes here —
// re-implementing react-pdf's layout in Deno would just duplicate the one
// real source of truth for what the PDF looks like.
//
// Storage: Supabase Storage bucket "quote-pdfs" (private — no anon/public
// read policy; only this function, via the service-role key, ever writes
// or reads it). Replaced an earlier Google Drive design after a live test
// proved a real Google API limitation: bare service accounts have no
// storage quota and cannot own files outside a paid-Workspace-only Shared
// Drive. Supabase Storage needs no external credential at all.
//
// Business-signing notification email: moved here from sign-quote (see
// that function's own comments for why) — this is the first point in the
// flow where the PDF is actually in Storage, so it's the only place that
// can include a real signed link to it. Gated behind `notify: true`,
// which only src/pages/SignQuote.tsx's public-signing call sets —
// QuoteDocumentScreen.tsx's internal re-save archival never sets it, so
// staff re-saving an already-signed quote never re-sends the "quote
// signed" email.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import BigNumber from 'npm:bignumber.js@9';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';

const BUCKET = 'quote-pdfs';
// Long enough that a business owner who doesn't open the email same-day
// still has a working link; short enough not to be a de-facto public URL.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

// Duplicated from src/lib/business/businessProfile.ts and src/lib/quotes/quote.ts —
// Edge Functions can't import from src/, only from within supabase/functions/. Keep
// these two in sync if either source changes.
const BUSINESS_NOTIFICATION_EMAIL = 'healingthroughmovementandmusic@gmail.com';
const VAT_RATE_PCT = 18;
const QUOTE_TYPE_LABELS: Record<string, string> = {
  clinic_treatment: 'טיפול בקליניקה',
  private_event: 'אירוע פרטי',
  company_event: 'אירוע חברה',
};

function formatMoney(value: BigNumber): string {
  return `${value.integerValue(BigNumber.ROUND_HALF_UP).toNumber().toLocaleString('he-IL')} ₪`;
}

interface ArchiveQuoteBody {
  quoteId: string;
  quoteNumber?: string;
  pdfBase64: string;
  notify?: boolean;
}

// Fire-and-forget notification to the business that a client just signed —
// must never block or fail the archive response. Uses EdgeRuntime.waitUntil
// (the documented Supabase pattern for background work in an Edge Function).
async function notifyBusinessOfSignature(
  quote: {
    quoteNumber: string | null;
    quoteType: string;
    clientName: string | null;
    companyName: string | null;
    lineItems: { unitPrice: number | null; quantity: number }[];
  },
  pdfLink: string | null
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('notifyBusinessOfSignature: RESEND_API_KEY not set, skipping.');
    return;
  }

  const subtotal = quote.lineItems.reduce(
    (sum, item) => (item.unitPrice === null ? sum : sum.plus(new BigNumber(item.unitPrice).times(item.quantity))),
    new BigNumber(0)
  );
  const total = subtotal.plus(subtotal.times(VAT_RATE_PCT).dividedBy(100));
  const partyName = quote.companyName || quote.clientName || 'לקוח ללא שם';
  const typeLabel = QUOTE_TYPE_LABELS[quote.quoteType] ?? quote.quoteType;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Harmony WS <onboarding@resend.dev>',
        to: BUSINESS_NOTIFICATION_EMAIL,
        subject: `הצעת מחיר ${quote.quoteNumber ?? ''} נחתמה — ${partyName}`,
        html: `<div dir="rtl" style="font-family: sans-serif; font-size: 14px;">
          <p>הצעת מחיר <strong>${quote.quoteNumber ?? ''}</strong> נחתמה על ידי ${partyName}.</p>
          <p>סוג הצעה: ${typeLabel}</p>
          <p>סה"כ לתשלום: ${formatMoney(total)}</p>
          <p>פתח את "הצעות שמורות" באפליקציה${
            pdfLink ? `, או פתח את ההצעה החתומה ישירות בלינק הבא: <a href="${pdfLink}">${pdfLink}</a>` : ''
          }.</p>
        </div>`,
      }),
    });
    if (!res.ok) {
      console.error(`notifyBusinessOfSignature: Resend API returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('notifyBusinessOfSignature: failed to send email:', err);
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body: ArchiveQuoteBody;
  try {
    body = (await req.json()) as ArchiveQuoteBody;
  } catch {
    return new Response('Invalid JSON body.', { status: 400, headers: corsHeaders() });
  }
  if (!body.quoteId || !body.pdfBase64) {
    return new Response('Missing required fields: quoteId, pdfBase64.', { status: 400, headers: corsHeaders() });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: quote, error: fetchError } = await serviceClient
    .from('quotes')
    .select('id')
    .eq('id', body.quoteId)
    .maybeSingle();
  if (fetchError || !quote) {
    return new Response('Quote not found.', { status: 404, headers: corsHeaders() });
  }

  const pdfBytes = Uint8Array.from(atob(body.pdfBase64), (c) => c.charCodeAt(0));
  const path = `${body.quoteNumber || body.quoteId}.pdf`;

  const { error: uploadError } = await serviceClient.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) {
    return new Response(`Storage upload failed: ${uploadError.message}`, { status: 502, headers: corsHeaders() });
  }

  const { error: updateError } = await serviceClient.from('quotes').update({ storage_path: path }).eq('id', body.quoteId);
  if (updateError) {
    // The upload itself succeeded — don't report failure for a write-back
    // that's cosmetic (storage_path is informational, nothing reads it
    // yet), but do surface it in the response for visibility in logs.
    return new Response(JSON.stringify({ path, warning: updateError.message }), {
      status: 200,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  if (body.notify) {
    const { data: signedUrlData } = await serviceClient.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    const { data: row } = await serviceClient
      .from('quotes')
      .select('quote_number, quote_type, client_name, company_name, quote_line_items(unit_price, quantity)')
      .eq('id', body.quoteId)
      .maybeSingle();

    if (row) {
      EdgeRuntime.waitUntil(
        notifyBusinessOfSignature(
          {
            quoteNumber: row.quote_number,
            quoteType: row.quote_type,
            clientName: row.client_name,
            companyName: row.company_name,
            lineItems: (row.quote_line_items ?? []).map((item: { unit_price: number | null; quantity: number }) => ({
              unitPrice: item.unit_price,
              quantity: item.quantity,
            })),
          },
          signedUrlData?.signedUrl ?? null
        )
      );
    }
  }

  return new Response(JSON.stringify({ path }), {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
});
