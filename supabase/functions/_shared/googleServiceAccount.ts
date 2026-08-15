// Shared by every Edge Function that calls a Google API as the business's
// single Google Cloud service account (Drive archival, Calendar sync) —
// one credential (GOOGLE_SERVICE_ACCOUNT_KEY), one JWT-minting routine,
// instead of duplicating RS256 signing in each function. Replaces the old
// per-user OAuth refresh-token flow entirely: a service account needs no
// user consent screen, so there's nothing for the client to "connect."
//
// How this works (RFC 7523 JWT Bearer grant): sign a short-lived JWT with
// the service account's private key claiming the scope we want, then trade
// it at Google's token endpoint for an access token. Google's Drive/
// Calendar REST APIs authorize purely on what the service account itself
// has been granted (a shared folder, a shared calendar) — the OAuth scope
// just bounds what the token is allowed to ask for.

function base64UrlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Returns a bearer access token scoped to `scope`, cached in-memory for
 *  this function instance until ~1 minute before expiry (Google tokens are
 *  valid 1h; re-signing a JWT per request would work too, just wastefully). */
export async function getGoogleAccessToken(scope: string): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.');

  const creds = JSON.parse(raw) as ServiceAccountCreds;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;

  const key = await importPrivateKey(creds.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const { access_token, expires_in } = (await tokenRes.json()) as { access_token: string; expires_in: number };
  tokenCache.set(scope, { token: access_token, expiresAt: Date.now() + expires_in * 1000 });
  return access_token;
}
