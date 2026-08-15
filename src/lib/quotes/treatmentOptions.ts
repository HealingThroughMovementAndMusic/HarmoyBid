// Fixed treatment/duration/purchase-type options for the Quote module.
// Deliberately NOT a database table — no admin CRUD screen, no price
// list, exactly the same "plain typed array" pattern NICHES already
// uses in src/components/calculator/NicheSelector.tsx. If a future need
// for admin-managed treatments arises, this is a fine seed to migrate
// from, but nothing here requires that today.

import { z } from 'zod';

export interface TreatmentOption {
  id: string;
  label: string;
}

export const TREATMENT_OPTIONS: TreatmentOption[] = [
  { id: 'swedish', label: 'עיסוי שוודי הוליסטי' },
  { id: 'sports', label: 'עיסוי ספורטאי משקם' },
  { id: 'deep-tissue', label: 'עיסוי רקמות עמוקות וטריגר פוינטס' },
  { id: 'other', label: 'אחר' },
];

export const OTHER_TREATMENT_ID = 'other';

export const DURATION_OPTIONS = [45, 60, 75, 90] as const;

export const PurchaseTypeSchema = z.enum(['single', 'series']);
export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

export const PURCHASE_TYPE_OPTIONS: { id: PurchaseType; label: string }[] = [
  { id: 'single', label: 'טיפול בודד' },
  { id: 'series', label: 'סדרת טיפולים / כרטיסייה' },
];
