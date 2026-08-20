import { useEffect, useState } from 'react';
import { ArrowRight, Mail, Phone, CalendarDays, FileText, StickyNote, UserPlus, Loader2 } from 'lucide-react';
import { GlassPanel } from '@/components/shared/GlassPanel';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import ActivityFeed, { type ActivityItem } from '@/components/shared/ActivityFeed';
import EmptyState from '@/components/shared/EmptyState';
import { coerceValidatedText } from '@/lib/utils';
import { z } from 'zod';
import { CLIENT_STATUS_LABELS, type Client } from '@/lib/clients';
import type { BookedEvent } from '@/lib/scheduling';
import { listQuotesByClientId } from '@/lib/quotes/quoteApi';
import { QUOTE_STATUS_LABELS, type Quote } from '@/lib/quotes/quote';

const NotesSchema = z.string().max(2000);

interface ClientProfileProps {
  client: Client;
  /** Real, live bookings (already Realtime-synced by the caller — see
   *  usePersistedBookings.ts) — no formal client_id on bookings yet, so
   *  matched by clientName, same limitation already documented for the
   *  "אירועים" section before this change, just no longer backed by
   *  hardcoded seed data. */
  bookings: BookedEvent[];
  onBack: () => void;
  onChange: (updates: Partial<Client>) => void;
}

// Full-screen glass panel, not a modal — a client profile has real depth
// (history/notes/quotes/appointments) a modal would cramp (Design Spec
// Phase 2, C6, applying the A4 "one hero surface per screen" rule).
export default function ClientProfile({ client, bookings, onBack, onChange }: ClientProfileProps) {
  const clientBookings = bookings.filter((b) => b.clientName === client.name);

  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listQuotesByClientId(client.id)
      .then((data) => {
        if (!cancelled) setQuotes(data);
      })
      .catch((err) => console.error('ClientProfile: failed to load quote history', err));
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const historyItems: ActivityItem[] = [
    { id: 'created', icon: UserPlus, title: 'לקוח נוסף למערכת', timestamp: client.createdAt.toLocaleDateString('he-IL') },
    ...clientBookings.map((b) => ({
      id: b.id,
      icon: CalendarDays,
      title: `אירוע נקבע: ${b.title}`,
      timestamp: b.start.toLocaleDateString('he-IL'),
    })),
  ];

  return (
    <div dir="rtl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
        חזרה ללקוחות
      </button>

      <GlassPanel className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">{client.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" /> {client.phone}
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {CLIENT_STATUS_LABELS[client.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" /> היסטוריה
            </h3>
            <ActivityFeed items={historyItems} emptyDescription="אין עדיין פעילות רשומה עבור לקוח זה." />
          </section>

          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-primary" aria-hidden="true" /> הערות
            </h3>
            <Label htmlFor="client-notes" className="sr-only">
              הערות על הלקוח
            </Label>
            <textarea
              id="client-notes"
              value={client.notes}
              onChange={(e) => onChange({ notes: coerceValidatedText(NotesSchema, e.target.value, client.notes) })}
              rows={6}
              placeholder="הוסיפי הערות על הלקוח..."
              className="w-full text-sm bg-secondary border border-border rounded-lg p-3 placeholder:text-muted-foreground/60"
            />
          </section>

          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" aria-hidden="true" /> הצעות מחיר
            </h3>
            {quotes === null ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                טוען...
              </div>
            ) : quotes.length === 0 ? (
              <EmptyState icon={FileText} title="אין הצעות מחיר משויכות עדיין" description="הצעות מחיר שנשמרות עבור הלקוח הזה יופיעו כאן." />
            ) : (
              <ActivityFeed
                items={quotes.map((q) => ({
                  id: q.id,
                  icon: FileText,
                  title: `${q.quoteNumber || q.id} · ${QUOTE_STATUS_LABELS[q.status]}`,
                  timestamp: q.createdAt ? q.createdAt.toLocaleDateString('he-IL') : '—',
                }))}
                emptyDescription=""
              />
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" /> אירועים
            </h3>
            {clientBookings.length === 0 ? (
              <EmptyState icon={CalendarDays} title="אין אירועים משויכים" description="אירועים שנקבעו עבור הלקוח הזה יופיעו כאן." />
            ) : (
              <ActivityFeed
                items={clientBookings.map((b) => ({
                  id: b.id,
                  icon: CalendarDays,
                  title: `${b.title} — ${b.location}`,
                  timestamp: b.start.toLocaleDateString('he-IL'),
                }))}
                emptyDescription=""
              />
            )}
          </section>
        </div>
      </GlassPanel>
    </div>
  );
}
