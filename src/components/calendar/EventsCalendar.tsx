import { CalendarDays } from 'lucide-react';
import PlaceholderTab from '@/components/shared/PlaceholderTab';

// TODO: port from original Base44 EventsCalendar.jsx once provided,
// wire up to the Supabase `calendar_entries` table.
export default function EventsCalendar() {
  return (
    <PlaceholderTab
      icon={CalendarDays}
      title="יומן אירועים"
      description="היומן עדיין לא הוטמע — ממתין למקור המקורי מ-Base44 ולחיבור ל-Supabase."
    />
  );
}
