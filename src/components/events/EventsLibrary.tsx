import { Library } from 'lucide-react';
import PlaceholderTab from '@/components/shared/PlaceholderTab';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

interface EventsLibraryProps {
  params: CalcParams;
  results: CalculationResult;
}

// TODO: port from original Base44 EventsLibrary.jsx once provided,
// wire up to the Supabase `events` table.
export default function EventsLibrary({ params, results }: EventsLibraryProps) {
  void params;
  void results;
  return (
    <PlaceholderTab
      icon={Library}
      title="ספריית אירועים"
      description="ספריית האירועים עדיין לא הוטמעה — ממתינה למקור המקורי מ-Base44 ולחיבור ל-Supabase."
    />
  );
}
