// Single source of truth for the business's own identity, used on both
// the live quote document and the PDF export. BUSINESS_PROFILE itself
// stays a fixed constant permanently — it is the fallback getBusinessProfile()
// falls back to on any DB failure, so it must never be removed or made
// conditional.

import harmonyLogo from '@/assets/harmony-healing-logo.jpg';
import { fetchBusinessProfileRow } from '@/lib/business/businessSettingsApi';

export const BUSINESS_PROFILE = {
  nameHe: 'ריפוי הרמוני',
  email: 'healingthroughmovementandmusic@gmail.com',
  phone: '0533709919',
  idNumber: '308914217',
  logo: harmonyLogo,
  websiteUrl: 'https://harmonyhealing.co.il/',
  bookingUrl: 'https://form.harmonyhealing.co.il/',
} as const;

// Widened (non-literal) shape — BUSINESS_PROFILE itself stays `as const`
// for anything that still wants its literal types, but the live/hydrated
// value needs plain `string` fields since a DB-sourced value isn't a
// compile-time literal.
export interface BusinessProfile {
  nameHe: string;
  email: string;
  phone: string;
  idNumber: string;
  logo: string;
  websiteUrl: string;
  bookingUrl: string;
}

// Module-level resolved profile — starts equal to BUSINESS_PROFILE and is
// optionally replaced in place by hydrateBusinessProfile(). `logo` is
// never part of the DB row and is always carried over unchanged from
// BUSINESS_PROFILE (see the closed decision: the logo stays a static
// asset, not a Settings-editable field).
let current: BusinessProfile = BUSINESS_PROFILE;

export function getBusinessProfile(): BusinessProfile {
  return current;
}

// Fire-and-forget, safe to call multiple times. Never throws — any
// failure (network, RLS, missing row) simply leaves `current` at
// BUSINESS_PROFILE, so every consumer keeps working exactly as before
// this function ever existed.
export async function hydrateBusinessProfile(): Promise<void> {
  const row = await fetchBusinessProfileRow();
  if (!row) return;
  current = {
    ...BUSINESS_PROFILE,
    nameHe: row.business_name || BUSINESS_PROFILE.nameHe,
    idNumber: row.business_tax_id ?? BUSINESS_PROFILE.idNumber,
    phone: row.business_phone ?? BUSINESS_PROFILE.phone,
    email: row.business_email || BUSINESS_PROFILE.email,
    websiteUrl: row.business_website_url ?? BUSINESS_PROFILE.websiteUrl,
    bookingUrl: row.business_booking_url ?? BUSINESS_PROFILE.bookingUrl,
  };
}
