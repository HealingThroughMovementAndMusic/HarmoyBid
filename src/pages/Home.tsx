import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, FileText, FilePlus2, Activity, Users, BarChart3, Settings, Presentation, Library, CalendarDays } from 'lucide-react';
import { DashboardLayout, type NavOption } from '@/components/ui/dashboard-layout';
import EmptyState from '@/components/shared/EmptyState';
import ClientsList from '@/components/clients/ClientsList';
import CommandPalette from '@/components/shared/CommandPalette';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import SettingsScreen from '@/components/settings/SettingsScreen';
import InputPanel from '@/components/calculator/InputPanel';
import DashboardPanel from '@/components/calculator/DashboardPanel';
import QuotesModule from '@/components/quotes/QuotesModule';
import SlidesTab from '@/components/slides/SlidesTab';
import EventsLibrary from '@/components/events/EventsLibrary';
import EventsCalendar from '@/components/calendar/EventsCalendar';
import { NICHES, type Niche } from '@/components/calculator/NicheSelector';
import { calculateEvent, saveParams, loadParams, CalcParamsSchema, type CalcParams } from '@/lib/calcEngine';
import { EQUIPMENT_PROVIDER_LABELS, type EventPackage } from '@/lib/eventCatalog';
import { usePersistedPackages } from '@/hooks/usePersistedPackages';
import { usePersistedBookings } from '@/hooks/usePersistedBookings';
import { useQuoteStats } from '@/hooks/useQuoteStats';
import { useActivityLog } from '@/hooks/useActivityLog';
import { signOut } from '@/lib/auth/auth';
import { QuoteClientNameSchema, type Quote, type QuoteLineItem, type QuoteType } from '@/lib/quotes/quote';
import { hydrateBusinessProfile } from '@/lib/business/businessProfile';
import { hydrateMessageTemplates } from '@/lib/business/messageTemplates';
import { hydrateQuoteDocumentDefaults } from '@/lib/quotes/quoteDocumentDefaults';
import { getStoredTheme, setStoredTheme } from '@/lib/theme';

// Event Library package -> a starting quote type + one pre-filled,
// PRE-PRICED line item. Every package models event-shaped logistics
// (therapist count, duration in HOURS, equipment) — none of that maps
// onto the clinic_treatment quote type's fixed catalogs (a treatment
// name from TREATMENT_OPTIONS, duration from the fixed 45/60/75/90 set):
// confirmed by testing that even the "clinic" niche's own seed package
// ("הקמת קליניקה") is a setup/partnership engagement, not a walk-in
// treatment, so its name/duration don't match either fixed list and the
// dropdowns would silently show as unselected. Every package therefore
// becomes a private/company event with its useful fields folded into one
// description string, never touching treatmentName/durationMinutes.
//
// Price: computed via the SAME calculateEvent() formula the Events
// Calculator itself uses — the package's nicheId supplies the rate/wage/
// commission defaults (NicheSelector.NICHES, single source of truth per
// CLAUDE.md), and the package's own therapistsRequired/durationHours
// feed the calculation directly, so a quote built from a package always
// matches what the calculator would compute for the same inputs. The
// client-facing price is grossRevenue (what the client is charged) —
// internal figures (commission/wage/margin) never reach the quote.
function packageToQuoteSeed(
  pkg: EventPackage
): { quoteType: QuoteType; seedLineItem: Partial<QuoteLineItem>; seedFields: Partial<Quote> } {
  const quoteType: QuoteType = pkg.nicheId === 'b2c' ? 'private_event' : 'company_event';
  const niche = NICHES.find((n) => n.id === pkg.nicheId);
  const results = calculateEvent({
    niche: pkg.nicheId,
    therapists: pkg.therapistsRequired,
    hours: pkg.durationHours,
    ratePerHour: niche?.rate ?? 0,
    wagePerMinute: niche?.wage ?? 0,
    commissionPct: niche?.comm ?? 0,
  });
  // Description stays pure Hebrew (name + description + equipment note) —
  // hours/therapist count are NOT folded in here even though they're also
  // pure Hebrew labels, because they're already shown correctly in the
  // quote's own "פרטי האירוע" section via seedFields.eventTherapistCount
  // below; duplicating them into an interpolated string here would repeat
  // the exact "Hebrew label + embedded digit in one Text node" bug fixed
  // this session (CLAUDE.md → RTL) once seedLineItem.description reaches
  // PdfItemsTable's single-Text rendering.
  const description = `${pkg.name}${pkg.description ? ' — ' + pkg.description : ''} — ${EQUIPMENT_PROVIDER_LABELS[pkg.equipmentProvider]}`;
  return {
    quoteType,
    seedLineItem: {
      description,
      unitPrice: Math.round(results.grossRevenue),
      quantity: 1,
    },
    seedFields: {
      eventTherapistCount: pkg.therapistsRequired,
    },
  };
}

// Events Calculator -> a starting quote type + seeded event-detail fields,
// no line item (see the function's own comment below for why). Same
// spirit as packageToQuoteSeed above, but the source is the calculator's
// live params rather than a saved catalog package.
// seedFields carries EXACTLY four values into the quote's "פרטי האירוع"
// section, matching the calculator's own client-facing PDF export
// (CalcEventSummary.tsx): therapist count, hours, total participants,
// hourly rate. This is a hard, deliberate boundary, not an oversight —
// the calculator's internal-only figures (therapist wage, travel
// distance, venue commission) are never read here and never reach the
// quote, matching the same client/internal separation already enforced
// throughout the Quotes module and CalcClientDocument.tsx.
function calcToQuoteSeed(
  params: CalcParams
): { quoteType: QuoteType; seedFields: Partial<Quote> } {
  const quoteType: QuoteType = params.niche === 'b2c' ? 'private_event' : 'company_event';
  // Only private_event gets clientName seeded — the calculator's "שם לקוח"
  // field is a person's name, which maps cleanly onto Quote.clientName for
  // a private event, but company_event has no equivalent "contact person
  // name" field (only companyName, a business name — a different concept)
  // to seed it into, so it's deliberately left blank there rather than
  // seeded into the wrong field.
  const clientNameParsed = quoteType === 'private_event' ? QuoteClientNameSchema.safeParse(params.clientName) : null;
  return {
    quoteType,
    seedFields: {
      ...(clientNameParsed?.success && clientNameParsed.data ? { clientName: clientNameParsed.data } : {}),
      eventTherapistCount: params.therapists,
      eventParticipantsCount: params.participants,
      eventHourlyRate: params.ratePerHour,
      // The calculator's hours at seed time — calcSeededBasePrice (quote.ts)
      // uses this as the pricing duration until eventStartTime/eventEndTime
      // are both set, at which point the actual scheduled duration wins.
      eventExpectedHours: params.hours,
    },
  };
}

const NAV_ITEMS: NavOption[] = [
  { title: 'לוח בקרה', icon: LayoutDashboard },
  { title: 'הצעות מחיר', icon: FilePlus2, group: 'תפעול' },
  { title: 'הצעות שמורות', icon: FileText, group: 'תפעול' },
  { title: 'מחשבון אירועים', icon: Activity, group: 'תפעול' },
  { title: 'ספריית אירועים', icon: Library, group: 'תפעול' },
  { title: 'יומן', icon: CalendarDays, group: 'תפעול' },
  { title: 'לקוחות', icon: Users, group: 'לקוחות' },
  { title: 'דוחות וניתוחים', icon: BarChart3, group: 'עסק' },
  { title: 'מצגות', icon: Presentation, group: 'עסק' },
  { title: 'הגדרות מערכת', icon: Settings, group: 'עסק' },
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
  incomeGuarantee: false,
  guaranteeMin3h: 150,
});

export default function Home() {
  const [activeNav, setActiveNav] = useState(NAV_ITEMS[0].title);

  // Both quote-module sidebar entries share one QuotesModule instance
  // internally (chooser vs. list initial screen). Re-clicking either one
  // while already on it doesn't change `activeNav`, so React wouldn't
  // otherwise re-render QuotesModule — bumping this key forces a fresh
  // mount back to that entry's home screen every click, not just the
  // first one that navigates there.
  const [quotesModuleKey, setQuotesModuleKey] = useState(0);
  // One-shot seed for "צור הצעת מחיר מחבילה" (Event Library -> Quotes) —
  // same spirit as pendingQuickAction below, but carries data instead of
  // just a signal. Cleared on any normal navigation to the quotes tab so
  // it can't leak into a later, unrelated visit to the chooser.
  const [pendingPackageSeed, setPendingPackageSeed] = useState<ReturnType<typeof packageToQuoteSeed> | ReturnType<typeof calcToQuoteSeed> | null>(null);
  const handleNavigate = (tab: string) => {
    if (tab === 'הצעות מחיר' || tab === 'הצעות שמורות') {
      setQuotesModuleKey((k) => k + 1);
    }
    if (tab === 'הצעות מחיר') {
      setPendingPackageSeed(null);
    }
    setActiveNav(tab);
  };

  const handleCreateQuoteFromPackage = (pkg: EventPackage) => {
    const seed = packageToQuoteSeed(pkg);
    handleNavigate('הצעות מחיר');
    setPendingPackageSeed(seed);
  };

  const handleCreateQuoteFromCalculator = () => {
    const seed = calcToQuoteSeed(eventParams);
    handleNavigate('הצעות מחיר');
    setPendingPackageSeed(seed);
  };

  // Dashboard quick-actions that need to both navigate AND trigger an
  // action on arrival (e.g. "לקוח חדש" -> Clients tab with the create
  // dialog already open) — a one-shot signal consumed by the target
  // screen's own useEffect, then cleared.
  const [pendingQuickAction, setPendingQuickAction] = useState<'create-client' | 'create-booking' | null>(null);
  const handleQuickAction = (tab: string, action: 'create-client' | 'create-booking') => {
    handleNavigate(tab);
    setPendingQuickAction(action);
  };

  // Global ⌘K / Ctrl+K command palette (Design Spec Phase 2, A7/B).
  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // One-shot, fire-and-forget: pulls live business-profile fields from
  // business_settings if reachable, otherwise silently leaves every
  // consumer on the BUSINESS_PROFILE fallback constant it already had.
  useEffect(() => {
    void hydrateBusinessProfile();
  }, []);

  // Same pattern for the central WhatsApp/Email quote-message templates.
  useEffect(() => {
    void hydrateMessageTemplates();
  }, []);

  // Same pattern for the quote-document defaults (payment terms + fixed note).
  useEffect(() => {
    void hydrateQuoteDocumentDefaults();
  }, []);

  // Theme — localStorage only, never business_settings. Lazy initializer
  // reads any previously-saved choice; falls back to the app's original
  // default (dark) when nothing has been saved yet, so a first-ever visit
  // looks exactly as it always has. Lifted here (rather than left as
  // dashboard-layout.tsx's own internal state) so the Settings screen's
  // Theme switch and the header's sun/moon button drive the same value.
  const [isDark, setIsDarkState] = useState(() => getStoredTheme() !== 'light');
  const handleIsDarkChange = (next: boolean) => {
    setIsDarkState(next);
    setStoredTheme(next ? 'dark' : 'light');
  };

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
    setEventParams((prev) => ({
      ...prev,
      ...updates,
      // The income guarantee toggle is fully derived from activity hours
      // whenever hours itself changes: <4h -> on, >=4h -> off. This only
      // fires on an hours edit, never on any other field, so a manual
      // toggle flip still sticks for as long as hours stays put.
      ...(updates.hours !== undefined ? { incomeGuarantee: updates.hours < 4 } : {}),
    }));
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

  // Lifted from EventsLibrary/EventsCalendar (Design Spec Phase 2, C1) so
  // the Dashboard overview can read real, live data. Now backed by real
  // Supabase tables (event_packages/bookings) with Realtime sync via
  // these hooks — see usePersistedPackages.ts/usePersistedBookings.ts.
  // EventsLibrary/EventsCalendar/DashboardOverview are all unchanged:
  // they only ever consumed a plain [array, setState-shaped setter] pair.
  const { packages, setPackages } = usePersistedPackages();
  const { bookings, setBookings } = usePersistedBookings();
  const { stats: quoteStats, revenueTrend } = useQuoteStats(bookings);
  const recentActivity = useActivityLog();

  return (
    <>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} navItems={NAV_ITEMS} onSelect={handleNavigate} />
      <DashboardLayout
        title="ריפוי הרמוני · Harmony Healing"
        subtitle="לחיות את עצמך מחדש | Relive Yourself"
        navItems={NAV_ITEMS}
        selected={activeNav}
        onNavigate={handleNavigate}
        onOpenCommandPalette={() => setCommandOpen(true)}
        onSignOut={signOut}
        isDark={isDark}
        onIsDarkChange={handleIsDarkChange}
      >
      {activeNav === 'לוח בקרה' && (
        <DashboardOverview
          packages={packages}
          bookings={bookings}
          quoteStats={quoteStats}
          revenueTrend={revenueTrend}
          recentActivity={recentActivity}
          onNavigate={handleNavigate}
          onQuickAction={handleQuickAction}
        />
      )}

      {activeNav === 'הצעות מחיר' && (
        <QuotesModule key={`chooser-${quotesModuleKey}`} initialScreen="chooser" initialBuilder={pendingPackageSeed ?? undefined} />
      )}

      {activeNav === 'הצעות שמורות' && <QuotesModule key={`list-${quotesModuleKey}`} initialScreen="list" />}

      {activeNav === 'מחשבון אירועים' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InputPanel params={eventParams} onParamChange={handleEventParamChange} onNicheChange={handleEventNicheChange} />
          <DashboardPanel results={eventResults} params={eventParams} onCreateQuote={handleCreateQuoteFromCalculator} />
        </div>
      )}

      {activeNav === 'לקוחות' && (
        <ClientsList
          autoOpenCreate={pendingQuickAction === 'create-client'}
          onAutoOpenHandled={() => setPendingQuickAction(null)}
        />
      )}

      {activeNav === 'דוחות וניתוחים' && (
        <EmptyState
          icon={BarChart3}
          title="דוחות וניתוחים"
          description="דוחות יופיעו כאן לאחר שתתחילו לתעד הצעות מחיר ואירועים במערכת."
        />
      )}

      {activeNav === 'הגדרות מערכת' && <SettingsScreen isDark={isDark} onIsDarkChange={handleIsDarkChange} />}

      {activeNav === 'מצגות' && <SlidesTab params={eventParams} results={eventResults} />}

      {activeNav === 'ספריית אירועים' && (
        <EventsLibrary packages={packages} setPackages={setPackages} onCreateQuote={handleCreateQuoteFromPackage} />
      )}

      {activeNav === 'יומן' && (
        <EventsCalendar
          bookings={bookings}
          setBookings={setBookings}
          autoOpenCreate={pendingQuickAction === 'create-booking'}
          onAutoOpenHandled={() => setPendingQuickAction(null)}
        />
      )}
      </DashboardLayout>
    </>
  );
}
