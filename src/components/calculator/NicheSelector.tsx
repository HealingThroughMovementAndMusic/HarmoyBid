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

// TODO: replace default rate/comm/wage per niche with the real values from the
// original Base44 NicheSelector.jsx once available.
const NICHES: Niche[] = [
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
    rate: 480,
    comm: 15,
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
