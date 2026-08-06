import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Download, Loader2, Stamp } from 'lucide-react';
import type { PricingSelection } from './PricingCalculator';
import QuotePDFDocument from './QuotePDFDocument';

interface QuoteDocumentPreviewProps {
  selection: PricingSelection | null;
}

type QuoteStatus = 'draft' | 'approved';

function money(value: number, currency = '₪') {
  return `${Math.round(value).toLocaleString('he-IL')} ${currency}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function QuoteDocumentPreview({ selection }: QuoteDocumentPreviewProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<QuoteStatus>('draft');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const quoteId = useMemo(() => `HW-${Date.now().toString(36).toUpperCase()}`, []);
  const issueDate = useMemo(() => new Date(), []);
  const expiryDate = useMemo(() => {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 14);
    return d;
  }, [issueDate]);

  const handleDownload = async () => {
    if (!selection) return;
    setIsGenerating(true);
    try {
      const blob = await pdf(
        <QuotePDFDocument
          quoteId={quoteId}
          issueDate={formatDate(issueDate)}
          expiryDate={formatDate(expiryDate)}
          status={status}
          clientName={clientName}
          clientEmail={clientEmail}
          selection={selection}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quoteId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'שגיאה ביצירת PDF', description: 'נסי שוב, או בדקי את חיבור הרשת (טעינת הפונט).' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!selection) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground" dir="rtl">
        בחרי תוכנית במחשבון כדי לראות תצוגה מקדימה של הצעת המחיר.
      </div>
    );
  }

  const { plan, breakdown, quantity, billingCycle } = selection;
  const cycleLabel = billingCycle === 'annual' ? 'שנתי' : 'חודשי';

  const rows: { label: string; value: number; negative?: boolean }[] = [
    { label: `${plan.name} — ${money(breakdown.unitPrice)} × ${quantity} יח' (${cycleLabel})`, value: breakdown.subtotal },
  ];
  if (breakdown.volumeDiscountAmount > 0) {
    rows.push({ label: `הנחת נפח (${breakdown.volumeDiscountPct}%)`, value: breakdown.volumeDiscountAmount, negative: true });
  }
  if (breakdown.annualDiscountAmount > 0) {
    rows.push({ label: `הנחת תשלום שנתי (${breakdown.annualDiscountPct}%)`, value: breakdown.annualDiscountAmount, negative: true });
  }
  rows.push({ label: `מע"מ (${breakdown.vatPct}%)`, value: breakdown.vatAmount });

  return (
    <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden" dir="rtl">
      {/* Client info + status */}
      <div className="p-4 sm:p-6 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">שם לקוח</Label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="הכנס שם לקוח..."
            className="bg-secondary border-border font-bold"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">אימייל לקוח</Label>
          <Input
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="client@example.com"
            className="bg-secondary border-border"
          />
        </div>
      </div>

      {/* Document body */}
      <div className="relative p-4 sm:p-8">
        <StatusStamp status={status} />

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">ריפוי הרמוני — Harmony Healing</h2>
            <p className="text-sm text-muted-foreground">הצעת מחיר</p>
          </div>
          <div className="text-left text-xs text-muted-foreground space-y-0.5">
            <p>מס&apos; הצעה: <span className="font-bold text-foreground">{quoteId}</span></p>
            <p>תאריך הפקה: {formatDate(issueDate)}</p>
            <p>בתוקף עד: {formatDate(expiryDate)}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-right font-semibold pb-2">תיאור</th>
              <th className="text-left font-semibold pb-2">סכום</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/60">
                <td className="py-2 text-foreground">{row.label}</td>
                <td className={cn('py-2 text-left font-semibold', row.negative ? 'text-primary' : 'text-foreground')}>
                  {row.negative ? '-' : ''}
                  {money(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>לפני מע&quot;מ</span>
              <span>{money(breakdown.afterBillingDiscount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>מע&quot;מ</span>
              <span>{money(breakdown.vatAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-foreground border-t border-border pt-2 mt-1">
              <span>סה&quot;כ לתשלום</span>
              <span>{money(breakdown.grandTotal)}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
          תנאים והערות: ההצעה תקפה עד לתאריך שצוין לעיל. המחירים כוללים מע&quot;מ כחוק. הצעה זו אינה מהווה חשבונית מס.
        </p>
      </div>

      {/* Actions */}
      <div className="p-4 sm:p-6 border-t border-border flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex gap-2">
          <StatusButton active={status === 'draft'} onClick={() => setStatus('draft')} label="טיוטה" />
          <StatusButton active={status === 'approved'} onClick={() => setStatus('approved')} label="מאושר" />
        </div>
        <Button onClick={handleDownload} disabled={isGenerating} className="gap-2">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          הכן להורדה כ-PDF
        </Button>
      </div>
    </div>
  );
}

function StatusButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-xs font-bold border transition-colors',
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'
      )}
    >
      {label}
    </button>
  );
}

function StatusStamp({ status }: { status: QuoteStatus }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: -14 }}
      animate={{ opacity: 0.5, scale: 1, rotate: -14 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className={cn(
        'absolute top-4 left-4 sm:top-8 sm:left-8 border-4 rounded-md px-4 py-1.5 text-lg sm:text-xl font-extrabold tracking-wider pointer-events-none select-none flex items-center gap-2',
        status === 'approved' ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500'
      )}
    >
      <Stamp className="w-5 h-5" />
      {status === 'approved' ? 'מאושר' : 'טיוטה'}
    </motion.div>
  );
}
