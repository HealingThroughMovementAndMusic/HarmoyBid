// Data access for the public signing page (src/pages/SignQuote.tsx) only.
// Deliberately never calls `supabase.from('quotes')` directly — routes
// through the get-public-quote/sign-quote Edge Functions instead, which
// use the service role key server-side and can only ever touch one quote
// by ID. quoteApi.ts (direct table access) stays exactly as-is for the
// internal, staff-only app; this file exists so the anon key that ships
// in this specific public page's bundle is never actually used to read
// or write the quotes table.

import { supabase } from '@/lib/supabaseClient';
import { QuoteSchema, type Quote } from './quote';

interface FunctionErrorBody {
  error?: string;
}

// supabase-js only puts the parsed body on `data` for a 2xx response — on
// a non-2xx status (our 404/409 cases) `data` is null and the response
// lands on the third `response` field instead (a raw Response), per
// FunctionsClient's invoke() implementation. Read the structured error
// code from there rather than assuming `data` has it.
async function readErrorBody(response: Response | undefined): Promise<FunctionErrorBody> {
  if (!response) return {};
  try {
    return (await response.json()) as FunctionErrorBody;
  } catch {
    return {};
  }
}

export async function getPublicQuote(quoteId: string): Promise<Quote | null> {
  const { data, error, response } = await supabase.functions.invoke('get-public-quote', { body: { quoteId } });
  if (error) {
    const body = await readErrorBody(response);
    if (body.error === 'not_found') return null;
    throw error;
  }
  return QuoteSchema.parse((data as { quote: unknown }).quote);
}

export class QuoteAlreadySignedError extends Error {}

export async function signQuote(quoteId: string, signatureDataUrl: string, turnstileToken?: string): Promise<Quote> {
  const { data, error, response } = await supabase.functions.invoke('sign-quote', {
    body: { quoteId, signatureDataUrl, turnstileToken },
  });
  if (error) {
    const body = await readErrorBody(response);
    if (body.error === 'already_signed') throw new QuoteAlreadySignedError('ההצעה כבר נחתמה.');
    throw error;
  }
  return QuoteSchema.parse((data as { quote: unknown }).quote);
}
