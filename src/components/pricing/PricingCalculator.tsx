import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check, Sparkles, Percent } from 'lucide-react';
import {
  usePricingEngine,
  calculatePricing,
  type PricingPlan,
  type PricingBreakdown,
  type BillingCycle,
} from '@/hooks/usePricingEngine';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { PRICING_PLANS } from './plans';

export interface PricingSelection {
  plan: PricingPlan;
  breakdown: PricingBreakdown;
  quantity: number;
  billingCycle: BillingCycle;
  vatPct: number;
}

interface PricingCalculatorProps {
  plans?: PricingPlan[];
  onSelectionChange?: (selection: PricingSelection) => void;
}

function formatCurrency(value: number, currency = '₪') {
  return `${Math.round(value).toLocaleString('he-IL')} ${currency}`;
}

export default function PricingCalculator({ plans = PRICING_PLANS, onSelectionChange }: PricingCalculatorProps) {
  const canonicalPlan = plans.find((p) => p.recommended) ?? plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(canonicalPlan.id);

  // usePricingEngine owns the shared, interactive state (quantity / billing
  // cycle / VAT) — every plan card is then priced with calculatePricing()
  // against that same shared config, so the cards stay comparable.
  const { quantity, setQuantity, billingCycle, setBillingCycle, vatPct, setVatPct } = usePricingEngine(
    canonicalPlan,
    { defaultQuantity: 3, defaultBillingCycle: 'monthly', defaultVatPct: 18 }
  );

  const breakdownsByPlanId = useMemo(() => {
    return plans.reduce<Record<string, PricingBreakdown>>((acc, plan) => {
      acc[plan.id] = calculatePricing(plan, { quantity, billingCycle, vatPct });
      return acc;
    }, {});
  }, [plans, quantity, billingCycle, vatPct]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? canonicalPlan;
  const selectedBreakdown = breakdownsByPlanId[selectedPlan.id];

  useEffect(() => {
    onSelectionChange?.({ plan: selectedPlan, breakdown: selectedBreakdown, quantity, billingCycle, vatPct });
  }, [selectedPlan, selectedBreakdown, quantity, billingCycle, vatPct, onSelectionChange]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Shared controls: quantity slider, VAT, billing cycle */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">כמות יחידות</Label>
            <span className="text-sm font-bold text-primary">{quantity}</span>
          </div>
          <Slider value={[quantity]} min={1} max={50} step={1} onValueChange={([v]) => setQuantity(v)} />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">מע&quot;מ (%)</Label>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Percent className="w-4 h-4" />
            </span>
            <Input
              type="number"
              value={vatPct}
              min={0}
              max={100}
              onChange={(e) => setVatPct(parseFloat(e.target.value) || 0)}
              className="pr-10 bg-secondary border-border font-bold text-foreground"
            />
          </div>
        </div>

        <div className="sm:col-span-3 flex items-center justify-center pt-2">
          <BillingToggle billingCycle={billingCycle} onChange={setBillingCycle} />
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const bd = breakdownsByPlanId[plan.id];
          const isSelected = plan.id === selectedPlanId;
          return (
            <motion.button
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative text-right rounded-2xl border p-5 sm:p-6 bg-card transition-colors flex flex-col',
                plan.recommended ? 'border-primary' : 'border-border',
                isSelected && 'ring-2 ring-primary'
              )}
              style={
                plan.recommended
                  ? { boxShadow: '0 0 0 1px hsl(var(--primary) / 0.4), 0 0 40px -8px hsl(var(--primary) / 0.55)' }
                  : undefined
              }
            >
              {plan.recommended && (
                <span className="absolute -top-3 right-5 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full shadow">
                  <Sparkles className="w-3 h-3" /> מומלץ
                </span>
              )}

              <h3 className="text-lg font-extrabold text-foreground mb-1">{plan.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <AnimatedNumber
                    value={bd.monthlyEquivalent}
                    formatter={(v) => formatCurrency(v)}
                    className="text-3xl font-extrabold text-foreground"
                  />
                  <span className="text-xs text-muted-foreground">/ לחודש</span>
                </div>
                {billingCycle === 'annual' && bd.annualSavingsAmount > 0 && (
                  <p className="text-xs text-primary font-semibold mt-1">
                    חוסך {formatCurrency(bd.annualSavingsAmount)} בשנה ({bd.annualSavingsPct.toFixed(0)}%)
                  </p>
                )}
                {bd.volumeDiscountPct > 0 && (
                  <p className="text-[11px] text-accent font-semibold mt-1">כולל הנחת נפח {bd.volumeDiscountPct}%</p>
                )}
              </div>

              <ul className="space-y-1.5 mb-4 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                סה&quot;כ לחיוב ({billingCycle === 'annual' ? 'שנתי' : 'חודשי'}):{' '}
                <AnimatedNumber
                  value={bd.grandTotal}
                  formatter={(v) => formatCurrency(v)}
                  className="font-bold text-foreground"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface BillingToggleProps {
  billingCycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

const BILLING_OPTIONS: { id: BillingCycle; label: string }[] = [
  { id: 'monthly', label: 'חודשי' },
  { id: 'annual', label: 'שנתי · חיסכון' },
];

function BillingToggle({ billingCycle, onChange }: BillingToggleProps) {
  const activeIndex = BILLING_OPTIONS.findIndex((o) => o.id === billingCycle);

  return (
    <div className="relative inline-flex bg-secondary p-1 rounded-full border border-border">
      <motion.div
        className="absolute inset-y-1 w-28 rounded-full bg-primary"
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
      {BILLING_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'relative z-10 w-28 py-2 rounded-full text-xs font-bold transition-colors',
            billingCycle === opt.id ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
