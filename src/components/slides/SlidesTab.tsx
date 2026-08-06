import { Presentation } from 'lucide-react';
import PlaceholderTab from '@/components/shared/PlaceholderTab';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

interface SlidesTabProps {
  params: CalcParams;
  results: CalculationResult;
}

// TODO: port from original Base44 SlidesTab.jsx once provided.
export default function SlidesTab({ params, results }: SlidesTabProps) {
  void params;
  void results;
  return (
    <PlaceholderTab
      icon={Presentation}
      title="מצגות"
      description="מחולל המצגות עדיין לא הוטמע — ממתין למקור המקורי מ-Base44."
    />
  );
}
