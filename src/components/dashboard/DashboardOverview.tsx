import { FileText, TrendingUp, CalendarDays, Library, Plus, Calculator, BarChart3, UserPlus, CalendarPlus } from 'lucide-react';
import { SolidCard } from '@/components/shared/GlassPanel';
import EmptyState from '@/components/shared/EmptyState';
import ActivityFeed from '@/components/shared/ActivityFeed';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { FloatingDock, type FloatingDockItem } from '@/components/shared/FloatingDock';
import type { EventPackage } from '@/lib/eventCatalog';
import type { BookedEvent } from '@/lib/scheduling';
import type { QuoteStats } from '@/lib/quotes/quoteStats';

interface DashboardOverviewProps {
  packages: EventPackage[];
  bookings: BookedEvent[];
  /** Real Supabase-backed quote counts/revenue, live via Realtime — `null` only while the first fetch is still in flight. */
  quoteStats: QuoteStats | null;
  onNavigate: (tab: string) => void;
  onQuickAction: (tab: string, action: 'create-client' | 'create-booking') => void;
}

// Symbol immediately before the digits, no space — matches the quote PDF's
// money formatting (PdfTotals.tsx) for consistency across the app.
function formatMoney(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`;
}

// Dashboard overview — the at-a-glance landing screen (Design Spec Phase 2,
// C1). Every KPI tile now reads real, live, Supabase-backed data: quotes/
// packages/bookings are all real tables with Realtime subscriptions (see
// usePersistedPackages.ts/usePersistedBookings.ts/useQuoteStats.ts) — a
// delete or edit made anywhere (including another tab/session) updates
// these tiles without a manual refresh. `quoteStats === null` (only true
// during the very first fetch) still renders "—" rather than a fabricated
// "0", preserving the original "no data yet" vs. "genuinely zero"
// distinction — it's just no longer a permanent state.
export default function DashboardOverview({ packages, bookings, quoteStats, onNavigate, onQuickAction }: DashboardOverviewProps) {
  const upcomingBookings = bookings
    .filter((b) => b.start.getTime() >= Date.now())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const quickActions: FloatingDockItem[] = [
    { title: 'הצעת מחיר חדשה', icon: <FileText className="h-full w-full" />, onClick: () => onNavigate('הצעות מחיר') },
    { title: 'חשב אירוע חדש', icon: <Calculator className="h-full w-full" />, onClick: () => onNavigate('מחשבון אירועים') },
    { title: 'הוסף חבילה', icon: <Plus className="h-full w-full" />, onClick: () => onNavigate('ספריית אירועים') },
    { title: 'לקוח חדש', icon: <UserPlus className="h-full w-full" />, onClick: () => onQuickAction('לקוחות', 'create-client') },
    { title: 'קבע אירוע חדש', icon: <CalendarPlus className="h-full w-full" />, onClick: () => onQuickAction('יומן', 'create-booking') },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      {/* Quick actions — moved to the top, directly under the page header */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">פעולות מהירות</h3>
        <FloatingDock items={quickActions} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={FileText} label="הצעות מחיר פתוחות" value={quoteStats ? quoteStats.openCount : null} />
        <KpiTile icon={TrendingUp} label="הכנסות החודש" value={quoteStats ? quoteStats.monthlyRevenue : null} formatter={formatMoney} />
        <KpiTile icon={CalendarDays} label="אירועים קרובים" value={upcomingBookings.length} />
        <KpiTile icon={Library} label="חבילות פעילות" value={packages.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming appointments */}
        <SolidCard>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" /> אירועים קרובים
          </h3>
          {upcomingBookings.length === 0 ? (
            <EmptyState icon={CalendarDays} title="אין אירועים קרובים" description="אירועים שנקבעו ביומן יופיעו כאן." />
          ) : (
            <ul className="space-y-2">
              {upcomingBookings.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.clientName} · {b.location}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {b.start.toLocaleDateString('he-IL')} {b.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SolidCard>

        {/* Revenue overview — gated on real data (Design Spec Phase 2, C7's
            build-order principle applies equally here: no fabricated chart
            over data that doesn't exist yet). */}
        <SolidCard>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" /> סקירת הכנסות
          </h3>
          <EmptyState
            icon={BarChart3}
            title="אין עדיין נתוני הכנסות"
            description="גרף ההכנסות יופיע כאן לאחר שהצעות מחיר יתועדו לצמיתות במערכת."
          />
        </SolidCard>
      </div>

      {/* Recent activity — honest gap: no activity log exists yet (would
          require instrumenting every create/update/delete across the app),
          so this stays an explicit EmptyState rather than fabricated rows. */}
      <SolidCard>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-primary" aria-hidden="true" /> פעילות אחרונה
        </h3>
        <ActivityFeed items={[]} emptyDescription="יומן פעילות טרם מומש — פעולות אחרונות (הצעות, אירועים, חבילות) יופיעו כאן בעתיד." />
      </SolidCard>
    </div>
  );
}

// `value: null` renders a static "—" (no data fetched yet — CLAUDE.md's
// "genuinely zero" vs. "no data yet" distinction). A real number always
// animates via AnimatedNumber — display-only: the number rendered at rest
// is exactly `formatter(value)`, identical to the un-animated string this
// tile used to render; no rounding/truncation is introduced by the spring,
// only the transient in-between frames while it settles.
function KpiTile({
  icon: Icon,
  label,
  value,
  formatter = (v) => Math.round(v).toString(),
  hint,
}: {
  icon: typeof FileText;
  label: string;
  value: number | null;
  formatter?: (value: number) => string;
  hint?: string;
}) {
  return (
    <SolidCard className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      {value === null ? (
        <span className="text-2xl font-extrabold text-foreground">—</span>
      ) : (
        <AnimatedNumber value={value} formatter={formatter} className="text-2xl font-extrabold text-foreground" />
      )}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </SolidCard>
  );
}
