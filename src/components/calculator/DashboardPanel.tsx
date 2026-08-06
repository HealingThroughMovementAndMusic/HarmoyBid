import { useState } from 'react';
import { formatILS, type CalcParams, type CalculationResult } from '@/lib/calcEngine';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import ExportMenu from '@/components/export/ExportMenu';
import ProfitabilityReport from '@/components/profitability/ProfitabilityReport';
import { BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = ['hsl(160, 84%, 39%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)'];

interface DashboardPanelProps {
  results: CalculationResult;
  params: CalcParams;
}

export default function DashboardPanel({ results, params }: DashboardPanelProps) {
  const [showReport, setShowReport] = useState(false);
  const { grossRevenue, totalPayroll, commissionCost, netProfit, margin, minPerParticipant } = results;

  const chartData = [
    { name: 'רווח נקי', value: Math.max(0, netProfit) },
    { name: 'שכר ונסיעות', value: totalPayroll },
    { name: 'עמלת מתחם', value: commissionCost },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border shadow-xl" dir="rtl">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-5">
        <h3 className="text-base font-bold text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          דשבורד פיננסי בזמן אמת
        </h3>
        <ExportMenu params={params} results={results} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <DashBox label="מחזור הכנסות כולל" value={formatILS(grossRevenue)} />
        <DashBox label="שכר ונסיעות (צוות)" value={formatILS(results.totalWage + results.totalTravel)} valueClass="text-chart-2" />
        {results.guaranteeSupplement > 0 && (
          <div className="col-span-2">
            <DashBox label="השלמת שכר (הבטחת הכנסה)" value={formatILS(results.guaranteeSupplement)} valueClass="text-accent" />
          </div>
        )}
        <DashBox label="עמלת מתחם שותף" value={formatILS(commissionCost)} valueClass="text-accent" />
        <DashBox
          label="רווח נקי"
          value={formatILS(netProfit)}
          valueClass="text-primary"
          highlight
          sub={`${margin.toFixed(1)}% מרג'ין`}
        />
      </div>

      <p className="text-center text-sm text-muted-foreground mb-4">
        זמן טיפול ממוצע לאורח: <strong className="text-foreground">{minPerParticipant} דקות</strong>
      </p>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatILS(Number(value))}
              contentStyle={{ background: 'hsl(222, 47%, 6%)', border: '1px solid hsl(215, 25%, 27%)', borderRadius: '8px', direction: 'rtl' }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
            />
            <Legend
              wrapperStyle={{ direction: 'rtl', fontSize: '13px' }}
              formatter={(value: string) => <span className="text-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Profitability Report Toggle */}
      <button
        onClick={() => setShowReport((r) => !r)}
        className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-primary/50 text-primary text-sm font-bold hover:bg-primary/5 transition-colors"
      >
        <BarChart2 className="w-4 h-4" />
        {showReport ? 'הסתר דוח רווחיות' : 'הצג דוח רווחיות מפורט'}
        {showReport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showReport && (
        <div className="mt-4">
          <ProfitabilityReport params={params} results={results} />
        </div>
      )}
    </div>
  );
}

interface DashBoxProps {
  label: string;
  value: string;
  valueClass?: string;
  highlight?: boolean;
  sub?: string;
}

function DashBox({ label, value, valueClass = "text-foreground", highlight = false, sub }: DashBoxProps) {
  return (
    <div className={`bg-secondary border rounded-xl p-4 text-center ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <div className="text-[10px] sm:text-[11px] uppercase text-muted-foreground font-semibold mb-1">{label}</div>
      <div className={`text-lg sm:text-2xl font-extrabold ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-primary mt-1 font-semibold">{sub}</div>}
    </div>
  );
}
