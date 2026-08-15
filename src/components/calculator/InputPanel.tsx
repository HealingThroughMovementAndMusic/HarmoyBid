import { z } from 'zod';
import BigNumber from 'bignumber.js';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn, coerceValidatedNumber } from '@/lib/utils';
import { UserCheck, Clock, Users, Car, Percent, ShieldCheck, User } from 'lucide-react';
import NicheSelector, { type Niche } from './NicheSelector';
import { CalcParamsSchema, type CalcParams } from '@/lib/calcEngine';

interface InputPanelProps {
  params: CalcParams;
  onParamChange: (updates: Partial<CalcParams>) => void;
  onNicheChange: (niche: Niche) => void;
}

export default function InputPanel({ params, onParamChange, onNicheChange }: InputPanelProps) {
  const { wageMode = 'min' } = params;

  const handleWageModeChange = (mode: CalcParams['wageMode']) => {
    if (mode === wageMode) return;
    onParamChange({ wageMode: mode });
  };

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border shadow-xl" dir="rtl">
      <h3 className="text-base font-bold text-primary mb-5 flex items-center gap-2 pb-3 border-b border-border">
        <span className="w-2 h-2 rounded-full bg-primary" />
        בחירת מודל פעילות
      </h3>

      <NicheSelector activeNiche={params.niche} onNicheChange={onNicheChange} />

      {/* Client Name */}
      <div className="mb-5">
        <Label className="text-xs text-muted-foreground mb-1.5 block">שם לקוח</Label>
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><User className="w-4 h-4" /></span>
          <Input
            type="text"
            placeholder="הכנס שם לקוח..."
            value={params.clientName || ''}
            onChange={(e) => onParamChange({ clientName: e.target.value })}
            className="pr-10 bg-secondary border-border font-bold text-foreground"
          />
        </div>
      </div>

      <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 pb-3 border-b border-border mt-6">
        <span className="w-2 h-2 rounded-full bg-primary" />
        התאמת כמויות ושכר
      </h3>

      <Label className="text-xs text-muted-foreground mb-2 block">שיטת תמחור שכר מטפלים:</Label>
      <div className="flex bg-secondary p-1 rounded-lg border border-border mb-4 gap-1">
        <button
          onClick={() => handleWageModeChange('min')}
          className={cn(
            "flex-1 py-2.5 rounded-md text-xs font-bold transition-all",
            wageMode === 'min' ? "bg-card text-foreground border border-border" : "text-muted-foreground"
          )}
        >
          ⏱️ לפי דקה
        </button>
        <button
          onClick={() => handleWageModeChange('hr')}
          className={cn(
            "flex-1 py-2.5 rounded-md text-xs font-bold transition-all",
            wageMode === 'hr' ? "bg-card text-foreground border border-border" : "text-muted-foreground"
          )}
        >
          👤 לפי שעה
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="מספר מטפלים"
          icon={<UserCheck className="w-4 h-4" />}
          value={params.therapists}
          onChange={(v) => onParamChange({ therapists: coerceValidatedNumber(CalcParamsSchema.shape.therapists, v, params.therapists) })}
          min={1}
        />
        <InputField
          label="שעות הפעילות"
          icon={<Clock className="w-4 h-4" />}
          value={params.hours}
          onChange={(v) => onParamChange({ hours: coerceValidatedNumber(CalcParamsSchema.shape.hours, v, params.hours) })}
          min={1}
        />
        <div className="col-span-2">
          <InputField
            label="כמות משתתפים כוללת"
            icon={<Users className="w-4 h-4" />}
            value={params.participants}
            onChange={(v) => onParamChange({ participants: coerceValidatedNumber(CalcParamsSchema.shape.participants, v, params.participants) })}
            min={1}
          />
        </div>
        <InputField
          label="תעריף שעתי (גבייה)"
          icon={<span className="text-xs font-bold">₪</span>}
          value={params.ratePerHour}
          onChange={(v) => onParamChange({ ratePerHour: coerceValidatedNumber(CalcParamsSchema.shape.ratePerHour, v, params.ratePerHour) })}
        />
        <InputField
          label={wageMode === 'min' ? 'שכר מטפל (לדקה)' : 'שכר מטפל (לשעה)'}
          icon={<span className="text-xs font-bold">₪</span>}
          value={wageMode === 'min' ? params.wagePerMinute : new BigNumber(params.wagePerMinute).times(60).toNumber()}
          onChange={(v) => {
            // Displayed value is per-hour in "hr" mode — convert to the
            // canonical per-minute unit before validating against the schema.
            const coerced = z.coerce.number().safeParse(v);
            if (!coerced.success) return;
            const perMinute = wageMode === 'min' ? coerced.data : coerced.data / 60;
            const validated = CalcParamsSchema.shape.wagePerMinute.safeParse(perMinute);
            if (validated.success) onParamChange({ wagePerMinute: validated.data });
          }}
          step={wageMode === 'min' ? 0.1 : 5}
        />
        <InputField
          label='מרחק נסיעה (ק"מ)'
          icon={<Car className="w-4 h-4" />}
          value={params.travelKm}
          onChange={(v) => onParamChange({ travelKm: coerceValidatedNumber(CalcParamsSchema.shape.travelKm, v, params.travelKm) })}
        />
        <InputField
          label="עמלת מתחם (%)"
          icon={<Percent className="w-4 h-4" />}
          value={params.commissionPct}
          onChange={(v) => onParamChange({ commissionPct: coerceValidatedNumber(CalcParamsSchema.shape.commissionPct, v, params.commissionPct) })}
          min={0}
          max={100}
        />
      </div>

      <div className="flex justify-between items-center bg-secondary p-3 sm:p-4 rounded-xl border border-border mt-4 gap-3">
        <span className="text-sm font-semibold leading-snug">אני מטפל בעצמי (חיסכון שכר מטפל אחד)</span>
        <Switch
          checked={params.isOwnerTreating}
          onCheckedChange={(v) => onParamChange({ isOwnerTreating: v })}
        />
      </div>

      <div className="flex justify-between items-center bg-secondary p-3 sm:p-4 rounded-xl border border-border mt-3 gap-3">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold leading-snug">הגעה ברכב אחד (איחוד נסיעות)</span>
        </div>
        <Switch
          checked={params.oneCarArrival ?? false}
          onCheckedChange={(v) => onParamChange({ oneCarArrival: v })}
        />
      </div>

      {/* Income Guarantee */}
      <div className="flex justify-between items-center bg-secondary p-3 sm:p-4 rounded-xl border border-border mt-3 gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold leading-snug">הפעל הבטחת הכנסה למטפל</span>
        </div>
        <Switch
          checked={params.incomeGuarantee ?? false}
          onCheckedChange={(v) => onParamChange({ incomeGuarantee: v })}
        />
      </div>

      {params.incomeGuarantee && (
        <div className="grid grid-cols-1 gap-4 mt-3 p-3 bg-primary/5 border border-dashed border-primary/40 rounded-xl">
          <div className="text-xs text-primary font-bold mb-1">מינימום מובטח למטפל:</div>
          <InputField
            label="תעריף שעתי מובטח (₪) — לאירועים עד 4 שעות"
            icon={<span className="text-xs font-bold">₪</span>}
            value={params.guaranteeMin3h ?? 150}
            onChange={(v) => onParamChange({ guaranteeMin3h: coerceValidatedNumber(CalcParamsSchema.shape.guaranteeMin3h, v, params.guaranteeMin3h ?? 150) })}
            min={0}
          />
        </div>
      )}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}

function InputField({ label, icon, value, onChange, min, max, step }: InputFieldProps) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="pr-10 bg-secondary border-border font-bold text-foreground"
        />
      </div>
    </div>
  );
}
