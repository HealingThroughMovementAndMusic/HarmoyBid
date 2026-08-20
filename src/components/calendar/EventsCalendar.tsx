import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarDays, Plus, Trash2, Users2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { coerceValidatedText } from '@/lib/utils';
import { BookedEventSchema, BookingStatusSchema, deleteBookingAndCalendarEvent, type BookedEvent } from '@/lib/scheduling';
import { logActivity } from '@/lib/activity/activityLog';
import { z } from 'zod';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: he }),
  getDay,
  locales: { he },
});

interface EventsCalendarProps {
  bookings: BookedEvent[];
  setBookings: Dispatch<SetStateAction<BookedEvent[]>>;
  /** Set true (by the parent) to pop the create dialog open on mount/update — the Dashboard's "קבע אירוע חדש" quick action deep-link. One-shot: consumed via onAutoOpenHandled. */
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
}

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  bookingId: string;
  resourceId?: string;
}

const TITLE_SCHEMA = z.string().min(1).max(200);
const TEXT_SCHEMA = z.string().max(200);

const CREATE_BOOKING_SCHEMA = z
  .object({
    title: TITLE_SCHEMA,
    clientName: TEXT_SCHEMA,
    location: TEXT_SCHEMA,
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((data) => data.end > data.start, { message: 'זמן הסיום חייב להיות אחרי זמן ההתחלה', path: ['end'] });

// Sensible defaults for the create dialog — next round hour, +4h duration —
// replacing the old hardcoded "tomorrow at noon" fabrication.
function defaultDraftDateTime() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return {
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
  };
}

// Calendar — time & resource scheduling engine. Distinct from the Event
// Library (package templates): this renders specific booked instances,
// therapist assignments, and (once Phase C's external setup is complete) a
// Google Calendar overlay. State lifted to Home.tsx (Design Spec Phase 2,
// C1) so the Dashboard overview can read real, live booking data. Local
// state for now — see CLAUDE.md (no Supabase table wired yet).
export default function EventsCalendar({ bookings, setBookings, autoOpenCreate, onAutoOpenHandled }: EventsCalendarProps) {
  const [view, setView] = useState<View>('week');
  const [byTherapist, setByTherapist] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const [deletingBooking, setDeletingBooking] = useState(false);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftClient, setDraftClient] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftTherapists, setDraftTherapists] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const openCreateDialog = () => {
    const defaults = defaultDraftDateTime();
    setDraftTitle('');
    setDraftClient('');
    setDraftLocation('');
    setDraftTherapists('');
    setDraftDate(defaults.date);
    setDraftStartTime(defaults.startTime);
    setDraftEndTime(defaults.endTime);
    setCreateError(null);
    setCreateOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreate) {
      openCreateDialog();
      onAutoOpenHandled?.();
    }
  }, [autoOpenCreate, onAutoOpenHandled]);

  // Therapist resource-column view (Design Spec Phase 2, C5) — a genuine
  // functional gap, not just cosmetic: scheduling.ts's therapistNames field
  // already supports this, the UI just didn't expose it. react-big-calendar
  // renders resource columns reliably in Day view, so switching this on
  // forces Day view. Multi-therapist bookings are exploded into one
  // render-only entry per resource column (the underlying booking is not
  // duplicated in state, only in this derived rendering array).
  const resources = useMemo(() => {
    if (!byTherapist) return undefined;
    const names = new Set<string>();
    bookings.forEach((b) => b.therapistNames.forEach((n) => names.add(n)));
    return [...names].map((name) => ({ resourceId: name, resourceTitle: name }));
  }, [byTherapist, bookings]);

  const rbcEvents = useMemo<RbcEvent[]>(() => {
    if (byTherapist) {
      return bookings.flatMap((b) =>
        (b.therapistNames.length ? b.therapistNames : ['ללא שיוך']).map((name) => ({
          id: `${b.id}-${name}`,
          bookingId: b.id,
          title: b.title,
          start: b.start,
          end: b.end,
          resourceId: name,
        }))
      );
    }
    return bookings.map((b) => ({
      id: b.id,
      bookingId: b.id,
      title: `${b.title}${b.therapistNames.length ? ` — ${b.therapistNames.join(', ')}` : ''}`,
      start: b.start,
      end: b.end,
    }));
  }, [bookings, byTherapist]);

  const handleCreateSubmit = () => {
    const start = new Date(`${draftDate}T${draftStartTime}`);
    const end = new Date(`${draftDate}T${draftEndTime}`);
    const result = CREATE_BOOKING_SCHEMA.safeParse({
      title: draftTitle,
      clientName: draftClient,
      location: draftLocation,
      start,
      end,
    });
    if (!result.success) {
      setCreateError(result.error.issues[0]?.message ?? 'קלט לא תקין');
      return;
    }
    const therapistNames = draftTherapists.split(',').map((s) => s.trim()).filter(Boolean);
    const newBooking = BookedEventSchema.parse({
      id: crypto.randomUUID(),
      title: result.data.title,
      clientName: result.data.clientName,
      location: result.data.location,
      therapistNames,
      start: result.data.start,
      end: result.data.end,
    });
    setBookings((prev) => [...prev, newBooking]);
    setCreateOpen(false);
    logActivity({
      actionType: 'booking_created',
      entityType: 'booking',
      entityId: newBooking.id,
      title: `אירוע נקבע ביומן: ${newBooking.title}`,
    }).catch((err) => console.error('EventsCalendar: failed to log booking_created activity', err));
  };

  const updateBooking = (id: string, updates: Partial<BookedEvent>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? BookedEventSchema.parse({ ...b, ...updates }) : b)));
  };

  // A dedicated wrapper around the status-button click only — updateBooking()
  // above is a fully generic setter also used for trivial field edits
  // (title, location, therapists), so logging inside it would spam an
  // activity row for every keystroke. This only fires when the status
  // actually transitions *into* 'cancelled' from something else — clicking
  // an already-cancelled booking's "cancelled" button again is a no-op
  // that logs nothing.
  const handleStatusChange = (booking: BookedEvent, status: BookedEvent['status']) => {
    updateBooking(booking.id, { status });
    if (status === 'cancelled' && booking.status !== 'cancelled') {
      logActivity({
        actionType: 'booking_cancelled',
        entityType: 'booking',
        entityId: booking.id,
        title: `אירוע בוטל: ${booking.title}`,
      }).catch((err) => console.error('EventsCalendar: failed to log booking_cancelled activity', err));
    }
  };

  // Date/start/end-time editing for the details dialog — a single shared
  // date for both start and end (same convention the "קבע אירוע" create
  // dialog already uses), reconstructing whichever of the three fields
  // wasn't the one just edited from the booking's current start/end.
  const updateBookingDateTime = (booking: BookedEvent, field: 'date' | 'startTime' | 'endTime', value: string) => {
    const date = field === 'date' ? value : format(booking.start, 'yyyy-MM-dd');
    const startTime = field === 'startTime' ? value : format(booking.start, 'HH:mm');
    const endTime = field === 'endTime' ? value : format(booking.end, 'HH:mm');
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    updateBooking(booking.id, { start, end });
  };

  // Same shared teardown scheduling.ts's deleteBookingAndCalendarEvent()
  // exposes — the one place that knows how to also remove the Google
  // Calendar event, so this and QuotesListScreen.tsx's quote-delete flow
  // can never drift apart. setBookings' own diffing setter (see
  // usePersistedBookings.ts) will also call deleteBooking() again for the
  // local-state removal below — a harmless, idempotent no-op against a
  // row that's already gone.
  const handleDeleteBooking = async (booking: BookedEvent) => {
    setDeletingBooking(true);
    try {
      await deleteBookingAndCalendarEvent(booking);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      setSelectedBookingId(null);
      toast({ title: 'האירוע נמחק' });
      logActivity({
        actionType: 'booking_deleted',
        entityType: 'booking',
        entityId: booking.id,
        title: `אירוע נמחק מהיומן: ${booking.title}`,
      }).catch((err) => console.error('EventsCalendar: failed to log booking_deleted activity', err));
    } catch (err) {
      toast({
        title: 'מחיקת האירוע נכשלה',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setDeletingBooking(false);
    }
  };

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">יומן — שיבוץ זמנים ומשאבים</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setByTherapist((v) => !v);
              if (!byTherapist) setView('day');
            }}
            aria-pressed={byTherapist}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
              byTherapist ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users2 className="w-4 h-4" /> תצוגת מטפלים
          </button>
          <button
            onClick={openCreateDialog}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> קבע אירוע
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-3 sm:p-4 harmony-rbc">
        <Calendar
          key={byTherapist ? 'resource' : 'plain'}
          localizer={localizer}
          events={rbcEvents}
          startAccessor="start"
          endAccessor="end"
          view={byTherapist ? 'day' : view}
          onView={(v) => !byTherapist && setView(v)}
          views={byTherapist ? ['day'] : ['month', 'week', 'day', 'agenda']}
          resources={resources}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          onSelectEvent={(event) => setSelectedBookingId((event as RbcEvent).bookingId)}
          style={{ height: 600 }}
          culture="he"
          rtl
          messages={{
            month: 'חודש',
            week: 'שבוע',
            day: 'יום',
            agenda: 'סדר יום',
            today: 'היום',
            previous: 'הקודם',
            next: 'הבא',
            noEventsInRange: 'אין אירועים בטווח זה.',
          }}
        />
      </div>

      {bookings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="font-bold text-foreground">{b.title}</span>
              <span>
                {b.clientName} · {b.location} · {b.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Booking details — opens on event click, edit-in-place (Design Spec
          Phase 2, C5), same coerce-validate-with-fallback pattern used
          throughout the app rather than a new ad hoc approach. */}
      <Dialog open={selectedBookingId !== null} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent dir="rtl" className="text-right">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle>פרטי אירוע</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="booking-title" className="text-xs text-muted-foreground mb-1 block">
                    כותרת
                  </Label>
                  <Input
                    id="booking-title"
                    value={selectedBooking.title}
                    onChange={(e) => updateBooking(selectedBooking.id, { title: coerceValidatedText(TITLE_SCHEMA, e.target.value, selectedBooking.title) })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="booking-date" className="text-xs text-muted-foreground mb-1 block">
                      תאריך
                    </Label>
                    <Input
                      id="booking-date"
                      type="date"
                      value={format(selectedBooking.start, 'yyyy-MM-dd')}
                      onChange={(e) => updateBookingDateTime(selectedBooking, 'date', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="booking-start-time" className="text-xs text-muted-foreground mb-1 block">
                      שעת התחלה
                    </Label>
                    <Input
                      id="booking-start-time"
                      type="time"
                      value={format(selectedBooking.start, 'HH:mm')}
                      onChange={(e) => updateBookingDateTime(selectedBooking, 'startTime', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="booking-end-time" className="text-xs text-muted-foreground mb-1 block">
                      שעת סיום
                    </Label>
                    <Input
                      id="booking-end-time"
                      type="time"
                      value={format(selectedBooking.end, 'HH:mm')}
                      onChange={(e) => updateBookingDateTime(selectedBooking, 'endTime', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="booking-client" className="text-xs text-muted-foreground mb-1 block">
                    לקוח
                  </Label>
                  <Input
                    id="booking-client"
                    value={selectedBooking.clientName}
                    onChange={(e) => updateBooking(selectedBooking.id, { clientName: coerceValidatedText(TEXT_SCHEMA, e.target.value, selectedBooking.clientName) })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="booking-location" className="text-xs text-muted-foreground mb-1 block">
                    מיקום
                  </Label>
                  <Input
                    id="booking-location"
                    value={selectedBooking.location}
                    onChange={(e) => updateBooking(selectedBooking.id, { location: coerceValidatedText(TEXT_SCHEMA, e.target.value, selectedBooking.location) })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="booking-therapists" className="text-xs text-muted-foreground mb-1 block">
                    מטפלים (מופרדים בפסיק)
                  </Label>
                  <Input
                    id="booking-therapists"
                    value={selectedBooking.therapistNames.join(', ')}
                    onChange={(e) =>
                      updateBooking(selectedBooking.id, {
                        therapistNames: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">סטטוס</Label>
                  <div className="flex gap-1.5">
                    {BookingStatusSchema.options.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedBooking, status)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                          selectedBooking.status === status
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => handleDeleteBooking(selectedBooking)}
                  disabled={deletingBooking}
                >
                  <Trash2 className="h-4 w-4" />
                  מחק אירוע
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create booking — replaces the old silent titleless "phantom" insert
          (fabricated tomorrow-noon date) with a real form, including actual
          date/time controls the create path never had before. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>קביעת אירוע חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-booking-title" className="text-xs text-muted-foreground mb-1 block">
                כותרת *
              </Label>
              <Input
                id="new-booking-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(coerceValidatedText(TITLE_SCHEMA, e.target.value, draftTitle))}
                className="bg-secondary border-border"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="new-booking-client" className="text-xs text-muted-foreground mb-1 block">
                לקוח
              </Label>
              <Input
                id="new-booking-client"
                value={draftClient}
                onChange={(e) => setDraftClient(coerceValidatedText(TEXT_SCHEMA, e.target.value, draftClient))}
                className="bg-secondary border-border"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="new-booking-date" className="text-xs text-muted-foreground mb-1 block">
                  תאריך
                </Label>
                <Input
                  id="new-booking-date"
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label htmlFor="new-booking-start" className="text-xs text-muted-foreground mb-1 block">
                  שעת התחלה
                </Label>
                <Input
                  id="new-booking-start"
                  type="time"
                  value={draftStartTime}
                  onChange={(e) => setDraftStartTime(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label htmlFor="new-booking-end" className="text-xs text-muted-foreground mb-1 block">
                  שעת סיום
                </Label>
                <Input
                  id="new-booking-end"
                  type="time"
                  value={draftEndTime}
                  onChange={(e) => setDraftEndTime(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-booking-location" className="text-xs text-muted-foreground mb-1 block">
                מיקום
              </Label>
              <Input
                id="new-booking-location"
                value={draftLocation}
                onChange={(e) => setDraftLocation(coerceValidatedText(TEXT_SCHEMA, e.target.value, draftLocation))}
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <Label htmlFor="new-booking-therapists" className="text-xs text-muted-foreground mb-1 block">
                מטפלים (מופרדים בפסיק)
              </Label>
              <Input
                id="new-booking-therapists"
                value={draftTherapists}
                onChange={(e) => setDraftTherapists(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!draftTitle.trim()}>
              קבע אירוע
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
