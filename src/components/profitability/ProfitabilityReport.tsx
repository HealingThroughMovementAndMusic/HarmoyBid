import { formatILS, type CalcParams, type CalculationResult } from '@/lib/calcEngine';

interface ProfitabilityReportProps {
  params: CalcParams;
  results: CalculationResult;
}

// TODO: port the real detailed report layout from the original
// Base44 ProfitabilityReport.jsx once available.
export default function ProfitabilityReport({ params, results }: ProfitabilityReportProps) {
  void params;
  const rows: { label: string; value: number }[] = [
    { label: 'מחזור הכנסות כולל', value: results.grossRevenue },
    { label: 'שכר צוות', value: results.totalWage },
    { label: 'נסיעות', value: results.totalTravel },
    { label: 'השלמת הבטחת הכנסה', value: results.guaranteeSupplement },
    { label: 'עמלת מתחם', value: results.commissionCost },
    { label: 'רווח נקי', value: results.netProfit },
  ];

  return (
    <div className="rounded-xl border border-border bg-secondary p-4" dir="rtl">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <td className="py-2 text-muted-foreground">{row.label}</td>
              <td className="py-2 text-left font-bold text-foreground">{formatILS(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
