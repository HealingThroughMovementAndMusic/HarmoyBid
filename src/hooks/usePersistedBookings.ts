import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listBookings, upsertBooking, deleteBooking, type BookedEvent } from '@/lib/scheduling';

// Same diffing-setter pattern as usePersistedPackages.ts — see that file
// for the full rationale. Keeps EventsCalendar.tsx and
// DashboardOverview.tsx completely unchanged; only the data source
// backing `bookings`/`setBookings` in Home.tsx moves from local-only
// state to real Supabase persistence + Realtime sync.
export function usePersistedBookings() {
  const [bookings, setBookingsState] = useState<BookedEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const bookingsRef = useRef<BookedEvent[]>([]);
  bookingsRef.current = bookings;

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      listBookings()
        .then((data) => {
          if (!cancelled) setBookingsState(data);
        })
        .catch((err) => console.error('usePersistedBookings: refetch failed', err));
    };

    refetch();
    setLoaded(true);

    const channel = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refetch)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const setBookings: Dispatch<SetStateAction<BookedEvent[]>> = (update) => {
    const prev = bookingsRef.current;
    const next = typeof update === 'function' ? (update as (b: BookedEvent[]) => BookedEvent[])(prev) : update;
    setBookingsState(next);

    const prevById = new Map(prev.map((b) => [b.id, b]));
    const nextById = new Map(next.map((b) => [b.id, b]));

    for (const booking of next) {
      const before = prevById.get(booking.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(booking)) {
        upsertBooking(booking).catch((err) => console.error('usePersistedBookings: save failed', err));
      }
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) {
        deleteBooking(id).catch((err) => console.error('usePersistedBookings: delete failed', err));
      }
    }
  };

  return { bookings, setBookings, loaded };
}
