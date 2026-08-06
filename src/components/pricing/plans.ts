import type { PricingPlan } from '@/hooks/usePricingEngine';

// Sample plan catalogue for the interactive pricing calculator / quote
// generator. Replace with real Harmony offering tiers when available.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'בסיסי',
    description: 'לעסקים קטנים שרק מתחילים',
    basePrice: 149,
    recommended: false,
    features: ['מטפל אחד פעיל', 'מחשבון תמחור בסיסי', 'תמיכה במייל'],
  },
  {
    id: 'growth',
    name: 'צמיחה',
    description: 'לצוותים שרוצים להתרחב',
    basePrice: 349,
    recommended: true,
    features: ['עד 10 מטפלים', 'ספריית אירועים + יומן', 'הצעות מחיר עם PDF', 'תמיכה מועדפת'],
  },
  {
    id: 'enterprise',
    name: 'ארגוני',
    description: 'לרשתות ומתחמים מרובי סניפים',
    basePrice: 799,
    recommended: false,
    features: ['מטפלים ללא הגבלה', 'ריבוי סניפים/שותפים', 'API + אינטגרציות', 'מנהל לקוח ייעודי'],
  },
];
