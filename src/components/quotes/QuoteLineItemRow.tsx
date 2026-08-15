import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SolidCard } from '@/components/shared/GlassPanel';
import { cn, coerceValidatedNumber, coerceValidatedText } from '@/lib/utils';
import {
  QuoteLineItemDescriptionSchema,
  QuoteLineItemQuantitySchema,
  QuoteLineItemUnitPriceSchema,
  lineItemTotal,
  type QuoteLineItem,
} from '@/lib/quotes/quote';
import {
  DURATION_OPTIONS,
  OTHER_TREATMENT_ID,
  PURCHASE_TYPE_OPTIONS,
  TREATMENT_OPTIONS,
  type PurchaseType,
} from '@/lib/quotes/treatmentOptions';
import type { QuoteType } from '@/lib/quotes/quote';

interface QuoteLineItemRowProps {
  item: QuoteLineItem;
  index: number;
  quoteType: QuoteType;
  onUpdate: (updates: Partial<QuoteLineItem>) => void;
  onRemove: () => void;
  /** Highlights the treatment Select when a clinic quote's save/export
   *  was blocked because this row has no treatment selected. */
  invalid?: boolean;
}

const OTHER_TREATMENT_LABEL = TREATMENT_OPTIONS.find((t) => t.id === OTHER_TREATMENT_ID)!.label;

export default function QuoteLineItemRow({ item, index, quoteType, onUpdate, onRemove, invalid }: QuoteLineItemRowProps) {
  const isClinic = quoteType === 'clinic_treatment';
  const isOther = item.treatmentName === OTHER_TREATMENT_LABEL;

  const handleUnitPriceChange = (raw: string) => {
    if (raw.trim() === '') {
      onUpdate({ unitPrice: null });
      return;
    }
    const parsed = Number(raw);
    const validated = QuoteLineItemUnitPriceSchema.safeParse(parsed);
    if (validated.success) onUpdate({ unitPrice: validated.data });
  };

  return (
    <SolidCard className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground shrink-0">שורה {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`הסר שורה ${index + 1}`}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isClinic && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor={`treatment-${item.id}`} className="text-xs text-muted-foreground mb-1 block">
              טיפול
            </Label>
            <Select value={item.treatmentName || undefined} onValueChange={(value) => onUpdate({ treatmentName: value })}>
              <SelectTrigger
                id={`treatment-${item.id}`}
                aria-label={`טיפול, שורה ${index + 1}`}
                aria-invalid={invalid || undefined}
                className={invalid ? 'border-destructive focus:ring-destructive' : undefined}
              >
                <SelectValue placeholder="בחר טיפול" />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_OPTIONS.map((t) => (
                  <SelectItem key={t.id} value={t.label}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid && <p className="text-[11px] text-destructive mt-1">יש לבחור טיפול</p>}
          </div>

          {!isOther && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">משך (דקות)</Label>
              <div className="flex gap-1.5" role="group" aria-label={`משך טיפול, שורה ${index + 1}`}>
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onUpdate({ durationMinutes: d })}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors',
                      item.durationMinutes === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isOther && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">סוג רכישה</Label>
              <div className="flex gap-1.5" role="group" aria-label={`סוג רכישה, שורה ${index + 1}`}>
                {PURCHASE_TYPE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdate({ purchaseType: p.id as PurchaseType })}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors',
                      item.purchaseType === p.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(!isClinic || isOther) && (
        <div>
          <Label htmlFor={`desc-${item.id}`} className="text-xs text-muted-foreground mb-1 block">
            {isClinic ? 'תיאור הטיפול' : 'תיאור השירות'}
          </Label>
          <Textarea
            id={`desc-${item.id}`}
            aria-label={`תיאור, שורה ${index + 1}`}
            rows={2}
            value={item.description}
            onChange={(e) => onUpdate({ description: coerceValidatedText(QuoteLineItemDescriptionSchema, e.target.value, item.description) })}
            className="bg-secondary border-border"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor={`price-${item.id}`} className="text-xs text-muted-foreground mb-1 block">
            מחיר יחידה
          </Label>
          <Input
            id={`price-${item.id}`}
            aria-label={`מחיר, שורה ${index + 1}`}
            type="number"
            placeholder="טרם תומחר"
            value={item.unitPrice ?? ''}
            onChange={(e) => handleUnitPriceChange(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>
        <div>
          <Label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground mb-1 block">
            כמות
          </Label>
          <Input
            id={`qty-${item.id}`}
            aria-label={`כמות, שורה ${index + 1}`}
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: coerceValidatedNumber(QuoteLineItemQuantitySchema, e.target.value, item.quantity) })}
            className="bg-secondary border-border"
          />
        </div>
        <div className="text-sm font-bold text-foreground text-left pb-2">
          {item.unitPrice === null ? (
            <span className="text-muted-foreground italic font-normal text-xs">טרם תומחר</span>
          ) : (
            `₪${Math.round(lineItemTotal(item)).toLocaleString('he-IL')}`
          )}
        </div>
      </div>
    </SolidCard>
  );
}
