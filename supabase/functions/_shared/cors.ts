// Every Edge Function in this project is called via `supabase.functions.invoke()`
// from a browser (the internal app, or now the public /sign/:id page) — the
// Supabase Edge Runtime does NOT add CORS headers automatically, so without
// this every call fails at the browser's preflight (OPTIONS) check before
// the function body ever runs, regardless of what the function itself
// returns. `'*'` is fine here: none of these functions rely on cookies/
// credentialed requests for authorization (auth is the Supabase JWT in the
// Authorization header, or nothing for the intentionally-public ones), so
// there's no session to leak via a permissive origin.

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Call first in every handler. Returns a Response to send immediately if
 *  this was a preflight request, or null to continue normal handling. */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  return null;
}

/** Wraps a Response's init so every real response also carries CORS
 *  headers — the preflight passing isn't enough on its own, the actual
 *  response needs them too or the browser blocks reading it. */
export function corsHeaders(extra?: HeadersInit): HeadersInit {
  return { ...CORS_HEADERS, ...(extra as Record<string, string> | undefined) };
}
