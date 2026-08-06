import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, FileText, Activity, Users, BarChart3, Settings, Presentation, Library, CalendarDays } from 'lucide-react';
import { DashboardLayout, type NavOption } from '@/components/ui/dashboard-layout';
import PlaceholderTab from '@/components/shared/PlaceholderTab';
import InputPanel from '@/components/calculator/InputPanel';
import DashboardPanel from '@/components/calculator/DashboardPanel';
import PricingCalculator, { type PricingSelection } from '@/components/pricing/PricingCalculator';
import QuoteDocumentPreview from '@/components/pricing/QuoteDocumentPreview';
import SlidesTab from '@/components/slides/SlidesTab';
import EventsLibrary from '@/components/events/EventsLibrary';
import EventsCalendar from '@/components/calendar/EventsCalendar';
import type { Niche } from '@/components/calculator/NicheSelector';
import { calculateEvent, saveParams, loadParams, CalcParamsSchema, type CalcParams } from '@/lib/calcEngine';

const NAV_ITEMS: NavOption[] = [
  { title: 'מחשבון תמחור', icon: Calculator },
  { title: 'הצעות מחיר', icon: FileText },
  { title: 'מחשבון אירועים', icon: Activity },
  { title: 'לקוחות', icon: Users },
  { title: 'דוחות וניתוחים', icon: BarChart3 },
  { title: 'הגדרות מערכת', icon: Settings },
  { title: 'מצגות', icon: Presentation },
  { title: 'ספריית אירועים', icon: Library },
  { title: 'יומן', icon: CalendarDays },
];

const DEFAULT_EVENT_PARAMS: CalcParams = CalcParamsSchema.parse({
  niche: 'b2c',
  clientName: '',
  therapists: 2,
  hours: 4,
  participants: 16,
  ratePerHour: 558,
  wagePerMinute: 2.0,
  travelKm: 40,
  commissionPct: 0,
  isOwnerTreating: true,
  wageMode: 'min',
  shiftHours: 6,
  incomeGuarantee: false,
  guaranteeMin3h: 150,
  guaranteeMinShift: 300,
});

export default function Home() {
  const [activeNav, setActiveNav] = useState(NAV_ITEMS[0].title);

  // Original Harmony WS per-event (therapist/hours/participants) calculator.
  const [eventParams, setEventParams] = useState<CalcParams>(() => {
    const saved = loadParams();
    return saved ? CalcParamsSchema.parse({ ...DEFAULT_EVENT_PARAMS, ...saved }) : DEFAULT_EVENT_PARAMS;
  });
  const eventResults = useMemo(() => calculateEvent(eventParams), [eventParams]);

  useEffect(() => {
    saveParams(eventParams);
  }, [eventParams]);

  const handleEventParamChange = (updates: Partial<CalcParams>) => {
    setEventParams((prev) => ({ ...prev, ...updates }));
  };

  const handleEventNicheChange = (niche: Niche) => {
    setEventParams((prev) => ({
      ...prev,
      niche: niche.id,
      ratePerHour: niche.rate,
      commissionPct: niche.comm,
      wagePerMinute: niche.wage,
    }));
  };

  // New subscription-style pricing engine — shared between "מחשבון תמחור"
  // and "הצעות מחיר" so a quote reflects whatever was last configured.
  const [pricingSelection, setPricingSelection] = useState<PricingSelection | null>(null);
  const handlePricingSelectionChange = useCallback((selection: PricingSelection) => {
    setPricingSelection(selection);
  }, []);

  return (
    <DashboardLayout
      title="ריפוי הרמוני · Harmony Healing"
      subtitle="לחיות את עצמך מחדש | Relive Yourself"
      navItems={NAV_ITEMS}
      selected={activeNav}
      onNavigate={setActiveNav}
    >
      {activeNav === 'מחשבון תמחור' && <PricingCalculator onSelectionChange={handlePricingSelectionChange} />}

      {activeNav === 'הצעות מחיר' && <QuoteDocumentPreview selection={pricingSelection} />}

      {activeNav === 'מחשבון אירועים' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InputPanel params={eventParams} onParamChange={handleEventParamChange} onNicheChange={handleEventNicheChange} />
          <DashboardPanel results={eventResults} params={eventParams} />
        </div>
      )}

      {activeNav === 'לקוחות' && (
        <PlaceholderTab icon={Users} title="לקוחות" description="ניהול לקוחות עדיין לא הוטמע — בקרוב." />
      )}

      {activeNav === 'דוחות וניתוחים' && (
        <PlaceholderTab icon={BarChart3} title="דוחות וניתוחים" description="לוח דוחות עדיין לא הוטמע — בקרוב." />
      )}

      {activeNav === 'הגדרות מערכת' && (
        <PlaceholderTab icon={Settings} title="הגדרות מערכת" description="הגדרות מערכת עדיין לא הוטמעו — בקרוב." />
      )}

      {activeNav === 'מצגות' && <SlidesTab params={eventParams} results={eventResults} />}

      {activeNav === 'ספריית אירועים' && <EventsLibrary params={eventParams} results={eventResults} />}

      {activeNav === 'יומן' && <EventsCalendar />}
    </DashboardLayout>
  );
}
