import { useState } from 'react';
import { Download, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import CalcClientDocument from '@/components/pdf/documents/CalcClientDocument';
import CalcInternalDocument from '@/components/pdf/documents/CalcInternalDocument';
import { downloadCalcWorkbook } from '@/lib/export/calcExcelExport';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

interface ExportMenuProps {
  params: CalcParams;
  results: CalculationResult;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportMenu({ params, results }: ExportMenuProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'client' | 'internal' | 'excel'>(null);

  const fileLabel = params.clientName || 'ללא-שם';

  const runExport = async (kind: 'client' | 'internal' | 'excel') => {
    setBusy(kind);
    try {
      if (kind === 'client') {
        const blob = await pdf(<CalcClientDocument params={params} results={results} />).toBlob();
        downloadBlob(blob, `הצעת-מחיר-${fileLabel}.pdf`);
      } else if (kind === 'internal') {
        const blob = await pdf(<CalcInternalDocument params={params} results={results} />).toBlob();
        downloadBlob(blob, `דוח-פנימי-${fileLabel}.pdf`);
      } else {
        await downloadCalcWorkbook(params);
      }
    } catch {
      toast({ title: 'ייצוא נכשל', description: 'אירעה שגיאה בעת יצירת הקובץ, נסה שוב.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto" disabled={busy !== null}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          ייצוא קבצים
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => runExport('client')} disabled={busy !== null} className="gap-2">
          <FileText className="w-4 h-4" />
          PDF ללקוח (מחיר סופי בלבד)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runExport('internal')} disabled={busy !== null} className="gap-2">
          <FileText className="w-4 h-4" />
          PDF פנימי (דוח מלא)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runExport('excel')} disabled={busy !== null} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          ייצוא לאקסל
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
