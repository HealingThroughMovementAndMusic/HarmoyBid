import { HeartPulse, PartyPopper, Building2, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel, SolidCard } from '@/components/shared/GlassPanel';
import { cn } from '@/lib/utils';
import { QUOTE_TYPE_LABELS, type QuoteType } from '@/lib/quotes/quote';

interface QuoteTypeOption {
  type: QuoteType;
  icon: LucideIcon;
  description: string;
}

const QUOTE_TYPE_OPTIONS: QuoteTypeOption[] = [
  { type: 'clinic_treatment', icon: HeartPulse, description: 'הצעה לטיפול או סדרת טיפולים בקליניקה' },
  { type: 'private_event', icon: PartyPopper, description: 'הצעה לאירוע וולנס פרטי — תאריך, שעות ומספר מטפלים' },
  { type: 'company_event', icon: Building2, description: 'הצעה לחברה — כולל ח.פ/ע.מ ואיש קשר' },
];

interface QuoteTypeChooserProps {
  onChoose: (type: QuoteType) => void;
  onBrowse: () => void;
}

export default function QuoteTypeChooser({ onChoose, onBrowse }: QuoteTypeChooserProps) {
  return (
    <div dir="rtl" className="space-y-6">
      <GlassPanel className="p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">הצעת מחיר חדשה</h2>
          <p className="text-sm text-muted-foreground mt-1">בחרי את סוג ההצעה שברצונך ליצור</p>
        </div>
        <button
          onClick={onBrowse}
          className="flex items-center gap-1 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
        >
          כל ההצעות
          <ChevronLeft className="h-4 w-4" />
        </button>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {QUOTE_TYPE_OPTIONS.map(({ type, icon: Icon, description }) => (
          <button key={type} onClick={() => onChoose(type)} className="text-right w-full">
            <SolidCard
              className={cn(
                'h-full flex flex-col gap-3 transition-colors hover:border-primary/40',
                'cursor-pointer'
              )}
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-foreground">{QUOTE_TYPE_LABELS[type]}</h3>
              <p className="text-sm text-muted-foreground flex-1">{description}</p>
              <span className="text-sm font-bold text-primary">צור הצעה ←</span>
            </SolidCard>
          </button>
        ))}
      </div>
    </div>
  );
}
