import { useMemo, useState, useCallback } from 'react';
import BigNumber from 'bignumber.js';
import { z } from 'zod';

// usePricingEngine — Pricing Math & Engine Specialist (Skill 1)
// Every financial calculation here goes through bignumber.js to avoid
// floating point precision issues (e.g. 0.1 + 0.2 !== 0.3). All inputs are
// validated with Zod before any arithmetic runs.

export const PricingPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  /** Monthly price per unit, before any discount or VAT. */
  basePrice: z.number().min(0),
  recommended: z.boolean().default(false),
  features: z.array(z.string()).default([]),
});
export type PricingPlan = z.infer<typeof PricingPlanSchema>;

export const VolumeDiscountTierSchema = z.object({
  minQuantity: z.number().int().min(1),
  discountPct: z.number().min(0).max(100),
});
export type VolumeDiscountTier = z.infer<typeof VolumeDiscountTierSchema>;

export const BillingCycleSchema = z.enum(['monthly', 'annual']);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

const DEFAULT_VOLUME_TIERS: VolumeDiscountTier[] = [
  { minQuantity: 1, discountPct: 0 },
  { minQuantity: 5, discountPct: 10 },
  { minQuantity: 10, discountPct: 15 },
  { minQuantity: 25, discountPct: 20 },
];

export const PricingEngineConfigSchema = z.object({
  quantity: z.number().int().min(1).default(1),
  billingCycle: BillingCycleSchema.default('monthly'),
  /** Dynamic VAT — configurable per currency/region (default: Israel, 18%). */
  vatPct: z.number().min(0).max(100).default(18),
  volumeDiscountTiers: z.array(VolumeDiscountTierSchema).default(DEFAULT_VOLUME_TIERS),
  /** Extra discount applied when paying for a full year upfront. */
  annualDiscountPct: z.number().min(0).max(100).default(20),
  currency: z.string().default('₪'),
});
export type PricingEngineConfig = z.infer<typeof PricingEngineConfigSchema>;

export interface PricingBreakdown {
  planId: string;
  currency: string;
  unitPrice: number;
  quantity: number;
  /** unitPrice * quantity, before any discount. */
  subtotal: number;
  volumeDiscountPct: number;
  volumeDiscountAmount: number;
  afterVolumeDiscount: number;
  billingCycle: BillingCycle;
  /** Number of monthly cycles billed at once (1 for monthly, 12 for annual). */
  cycleMonths: number;
  annualDiscountPct: number;
  annualDiscountAmount: number;
  /** Total charged for this billing cycle, before VAT. */
  afterBillingDiscount: number;
  vatPct: number;
  vatAmount: number;
  /** Final amount charged for this billing cycle, including VAT. */
  grandTotal: number;
  /** grandTotal normalized to a per-month figure, for comparing plans/cycles. */
  monthlyEquivalent: number;
  /** How much cheaper the annual cycle is vs. paying monthly for 12 months. */
  annualSavingsAmount: number;
  annualSavingsPct: number;
}

function resolveVolumeDiscountPct(quantity: number, tiers: VolumeDiscountTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  let pct = 0;
  for (const tier of sorted) {
    if (quantity >= tier.minQuantity) pct = tier.discountPct;
  }
  return pct;
}

function computeBreakdown(plan: PricingPlan, config: PricingEngineConfig): PricingBreakdown {
  const unitPriceBN = new BigNumber(plan.basePrice);
  const quantityBN = new BigNumber(config.quantity);
  const subtotalBN = unitPriceBN.times(quantityBN);

  const volumeDiscountPct = resolveVolumeDiscountPct(config.quantity, config.volumeDiscountTiers);
  const volumeDiscountAmountBN = subtotalBN.times(volumeDiscountPct).dividedBy(100);
  const afterVolumeDiscountBN = subtotalBN.minus(volumeDiscountAmountBN);

  const isAnnual = config.billingCycle === 'annual';
  const cycleMonths = isAnnual ? 12 : 1;
  const annualDiscountPct = isAnnual ? config.annualDiscountPct : 0;

  const cycleBaseBN = afterVolumeDiscountBN.times(cycleMonths);
  const annualDiscountAmountBN = isAnnual
    ? cycleBaseBN.times(annualDiscountPct).dividedBy(100)
    : new BigNumber(0);
  const afterBillingDiscountBN = cycleBaseBN.minus(annualDiscountAmountBN);

  const vatAmountBN = afterBillingDiscountBN.times(config.vatPct).dividedBy(100);
  const grandTotalBN = afterBillingDiscountBN.plus(vatAmountBN);

  const monthlyEquivalentBN = grandTotalBN.dividedBy(cycleMonths);

  // Savings vs. paying the monthly plan for 12 separate months.
  const monthlyOverYearBN = afterVolumeDiscountBN.times(12);
  const annualSavingsAmountBN = isAnnual ? monthlyOverYearBN.minus(afterBillingDiscountBN) : new BigNumber(0);
  const annualSavingsPctBN =
    isAnnual && monthlyOverYearBN.gt(0)
      ? annualSavingsAmountBN.dividedBy(monthlyOverYearBN).times(100)
      : new BigNumber(0);

  return {
    planId: plan.id,
    currency: config.currency,
    unitPrice: unitPriceBN.toNumber(),
    quantity: config.quantity,
    subtotal: subtotalBN.toNumber(),
    volumeDiscountPct,
    volumeDiscountAmount: volumeDiscountAmountBN.toNumber(),
    afterVolumeDiscount: afterVolumeDiscountBN.toNumber(),
    billingCycle: config.billingCycle,
    cycleMonths,
    annualDiscountPct,
    annualDiscountAmount: annualDiscountAmountBN.toNumber(),
    afterBillingDiscount: afterBillingDiscountBN.toNumber(),
    vatPct: config.vatPct,
    vatAmount: vatAmountBN.toNumber(),
    grandTotal: grandTotalBN.toNumber(),
    monthlyEquivalent: monthlyEquivalentBN.toNumber(),
    annualSavingsAmount: annualSavingsAmountBN.toNumber(),
    annualSavingsPct: annualSavingsPctBN.toNumber(),
  };
}

export interface UsePricingEngineOptions {
  defaultQuantity?: number;
  defaultBillingCycle?: BillingCycle;
  defaultVatPct?: number;
  volumeDiscountTiers?: VolumeDiscountTier[];
  annualDiscountPct?: number;
  currency?: string;
}

export function usePricingEngine(plan: PricingPlan, options: UsePricingEngineOptions = {}) {
  const validatedPlan = useMemo(() => PricingPlanSchema.parse(plan), [plan]);

  const [quantity, setQuantityState] = useState(options.defaultQuantity ?? 1);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(options.defaultBillingCycle ?? 'monthly');
  const [vatPct, setVatPctState] = useState(options.defaultVatPct ?? 18);

  const setQuantity = useCallback((next: number) => {
    setQuantityState(Math.max(1, Math.round(next)));
  }, []);

  const setVatPct = useCallback((next: number) => {
    setVatPctState(Math.min(100, Math.max(0, next)));
  }, []);

  const toggleBillingCycle = useCallback(() => {
    setBillingCycle((prev) => (prev === 'monthly' ? 'annual' : 'monthly'));
  }, []);

  const breakdown = useMemo<PricingBreakdown>(() => {
    const config = PricingEngineConfigSchema.parse({
      quantity,
      billingCycle,
      vatPct,
      volumeDiscountTiers: options.volumeDiscountTiers,
      annualDiscountPct: options.annualDiscountPct,
      currency: options.currency,
    });
    return computeBreakdown(validatedPlan, config);
  }, [validatedPlan, quantity, billingCycle, vatPct, options.volumeDiscountTiers, options.annualDiscountPct, options.currency]);

  return {
    plan: validatedPlan,
    quantity,
    setQuantity,
    billingCycle,
    setBillingCycle,
    toggleBillingCycle,
    vatPct,
    setVatPct,
    breakdown,
  };
}

/** Pure helper — computes a breakdown for a plan without hook state, e.g. for comparing multiple plans server-side. */
export function calculatePricing(rawPlan: PricingPlan, rawConfig: Partial<PricingEngineConfig> = {}): PricingBreakdown {
  const plan = PricingPlanSchema.parse(rawPlan);
  const config = PricingEngineConfigSchema.parse(rawConfig);
  return computeBreakdown(plan, config);
}
