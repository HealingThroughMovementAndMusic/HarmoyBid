import BigNumber from 'bignumber.js';
import { z } from 'zod';

// Core calculation engine for Harmony WS
// Per project convention (Skill 1 — Pricing Math & Engine Specialist):
// every financial calculation MUST use bignumber.js to avoid floating point
// precision issues, and inputs MUST be validated with a Zod schema first.

export const CalcParamsSchema = z.object({
  niche: z.string().default('b2c'),
  clientName: z.string().default(''),
  therapists: z.number().int().min(1).default(2),
  hours: z.number().min(0.25).default(4),
  participants: z.number().int().min(1).default(16),
  ratePerHour: z.number().min(0).default(558),
  wagePerMinute: z.number().min(0).default(2.0),
  travelKm: z.number().min(0).default(40),
  commissionPct: z.number().min(0).max(100).default(0),
  isOwnerTreating: z.boolean().default(true),
  wageMode: z.enum(['min', 'hr']).default('min'),
  incomeGuarantee: z.boolean().default(false),
  guaranteeMin3h: z.number().min(0).default(150),
  /** "הגעה ברכב אחד (איחוד נסיעות)" — all therapists travel together in a
   *  single car, so travel cost is charged for exactly one vehicle
   *  regardless of therapist count. */
  oneCarArrival: z.boolean().default(false),
});

export type CalcParams = z.infer<typeof CalcParamsSchema>;
// Accept any partial/unknown-shaped object (e.g. straight from localStorage or
// a controlled form) — Zod fills in defaults and strips unrecognized keys.
export type CalcParamsInput = Partial<CalcParams> & Record<string, unknown>;

// Direct fuel cost only (no depreciation/wear) — ₪/liter and km/liter are
// fixed business constants, not user-configurable inputs.
const FUEL_PRICE_PER_LITER = 8;
const FUEL_KM_PER_LITER = 10;

export interface CalculationResult {
  totalMinutes: number;
  minPerParticipant: number;
  grossRevenue: number;
  commissionCost: number;
  totalPayroll: number;
  totalWage: number;
  totalTravel: number;
  guaranteeSupplement: number;
  netProfit: number;
  margin: number;
  hourlyWage: number;
  paidTherapists: number;
  vehicleCount: number;
}

export function calculateEvent(rawParams: CalcParamsInput): CalculationResult {
  const {
    therapists,
    hours,
    participants,
    ratePerHour,
    wagePerMinute,
    travelKm,
    commissionPct,
    isOwnerTreating,
    incomeGuarantee,
    guaranteeMin3h,
    oneCarArrival,
  } = CalcParamsSchema.parse(rawParams);

  const bnTherapists = new BigNumber(therapists);
  const bnHours = new BigNumber(hours);
  const bnParticipants = new BigNumber(participants);

  const totalMinutesBN = bnTherapists.times(bnHours).times(60);
  const minPerParticipant = bnParticipants.gt(0)
    ? totalMinutesBN.dividedBy(bnParticipants).integerValue(BigNumber.ROUND_FLOOR).toNumber()
    : 0;

  const grossRevenueBN = bnTherapists.times(bnHours).times(ratePerHour);
  const commissionCostBN = grossRevenueBN.times(commissionPct).dividedBy(100);

  const paidTherapists = isOwnerTreating && therapists >= 1 ? therapists - 1 : therapists;
  const bnPaidTherapists = new BigNumber(paidTherapists);

  const hourlyWageBN = new BigNumber(wagePerMinute).times(60);
  const totalWageBN = bnPaidTherapists.times(bnHours).times(hourlyWageBN);

  // Vehicle count: one car if arriving together, otherwise one car per
  // paid therapist (mirrors the owner-treating discount already applied
  // to paidTherapists above).
  const vehicleCount = oneCarArrival ? 1 : paidTherapists;
  const bnVehicleCount = new BigNumber(vehicleCount);
  const fuelCostPerVehicleBN = new BigNumber(travelKm).dividedBy(FUEL_KM_PER_LITER).times(FUEL_PRICE_PER_LITER);
  const totalTravelBN = fuelCostPerVehicleBN.times(bnVehicleCount);

  // Income guarantee supplement per therapist — an hourly FLOOR RATE
  // (guaranteeMin3h ₪/hour): if the real hourly wage is below that rate,
  // top up the shortfall for every hour of the event. Applies only to
  // events under 4 hours (business decision) — a 4h+ event pays plain
  // wage with no guarantee involved at all, regardless of its length.
  let guaranteeSupplementBN = new BigNumber(0);
  if (incomeGuarantee && paidTherapists > 0 && hours < 4) {
    const supplementPerTherapistBN = BigNumber.max(0, new BigNumber(guaranteeMin3h).minus(hourlyWageBN)).times(bnHours);
    guaranteeSupplementBN = supplementPerTherapistBN.times(bnPaidTherapists);
  }

  const totalPayrollBN = totalWageBN.plus(totalTravelBN).plus(guaranteeSupplementBN);
  const netProfitBN = grossRevenueBN.minus(commissionCostBN).minus(totalPayrollBN);
  const marginBN = grossRevenueBN.gt(0)
    ? netProfitBN.dividedBy(grossRevenueBN).times(100)
    : new BigNumber(0);

  return {
    totalMinutes: totalMinutesBN.toNumber(),
    minPerParticipant,
    grossRevenue: grossRevenueBN.toNumber(),
    commissionCost: commissionCostBN.toNumber(),
    totalPayroll: totalPayrollBN.toNumber(),
    totalWage: totalWageBN.toNumber(),
    totalTravel: totalTravelBN.toNumber(),
    guaranteeSupplement: guaranteeSupplementBN.toNumber(),
    netProfit: netProfitBN.toNumber(),
    margin: marginBN.toNumber(),
    hourlyWage: hourlyWageBN.toNumber(),
    paidTherapists,
    vehicleCount,
  };
}

// Symbol immediately before the digits, no space — matches the quote
// PDF's money formatting (PdfTotals.tsx) for consistency across the app.
export function formatILS(num: number): string {
  return '₪' + Math.round(num).toLocaleString('he-IL');
}

// Local storage helpers
const STORAGE_KEY = 'harmony_ws_params';

export function saveParams(params: unknown): void {
  const validated = CalcParamsSchema.safeParse(params);
  if (!validated.success) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated.data));
  } catch {
    // silent fail
  }
}

export function loadParams(): CalcParams | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const validated = CalcParamsSchema.safeParse(JSON.parse(saved));
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}
