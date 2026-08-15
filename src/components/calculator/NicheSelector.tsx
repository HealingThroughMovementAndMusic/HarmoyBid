import { Users, Building2, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Niche {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  rate: number;
  comm: number;
  wage: number;
}

// b2c/b2b rate+comm are sourced from Operational_Pricing_Report.pdf (Table A:
// client/venue billing rates) and the original pricing spreadsheet — see
// CLAUDE.md. `clinic` remains an unverified placeholder; no matching table
// was found in the source material for it yet. `wage` isn't sourced per-niche
// from the report — Table B tiers wage by who supplies equipment, an
// independent axis not modeled here yet.
export const NICHES: Niche[] = [
  {
    id: 'b2c',
    label: 'B2C / פרטי',
    sub: 'שעת מטפל - אירוע לקוח קצה',
    icon: Users,
    rate: 558,
    comm: 0,
    wage: 2.0,
  },
  {
    id: 'b2b',
    label: 'B2B ספק',
    sub: 'שעת מטפל - ספק מול מתחם',
    icon: Building2,
    rate: 240,
    comm: 25,
    wage: 2.0,
  },
  {
    id: 'clinic',
    label: 'הקמת קליניקה',
    sub: "הקמה וחלוקת רווחים 20% / מכירה ישירה",
    icon: Store,
    rate: 620,
    comm: 20,
    wage: 2.2,
  },
];

interface NicheSelectorProps {
  activeNiche: string;
  onNicheChange: (niche: Niche) => void;
}

export default function NicheSelector({ activeNiche, onNicheChange }: NicheSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5" dir="rtl">
      {NICHES.map((niche) => {
        const Icon = niche.icon;
        const isActive = activeNiche === niche.id;
        return (
          <button
            key={niche.id}
            onClick={() => onNicheChange(niche)}
            className={cn(
              "flex flex-col items-center text-center gap-1 p-3 rounded-xl border transition-all",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-bold">{niche.label}</span>
            <span className="text-[10px] leading-tight">{niche.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
