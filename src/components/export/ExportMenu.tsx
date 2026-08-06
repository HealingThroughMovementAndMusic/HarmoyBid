import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

interface ExportMenuProps {
  params: CalcParams;
  results: CalculationResult;
}

// TODO: port the real export logic (PDF/Excel/etc.) from the original
// Base44 ExportMenu.jsx once available. For now this is a placeholder
// that confirms the wiring works end-to-end.
export default function ExportMenu({ params, results }: ExportMenuProps) {
  void params;
  void results;
  const { toast } = useToast();

  const handleExport = () => {
    toast({
      title: 'ייצוא קבצים',
      description: 'הפיצ׳ר עדיין לא הוטמע — ממתין למקור המקורי מ-Base44.',
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
      <Download className="w-4 h-4" />
      ייצוא קבצים
    </Button>
  );
}
