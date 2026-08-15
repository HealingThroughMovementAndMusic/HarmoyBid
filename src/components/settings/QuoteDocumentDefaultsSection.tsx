import { motion } from 'framer-motion';
import { Loader2, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import MotionButton from '@/components/shared/MotionButton';
import { SolidCard } from '@/components/shared/GlassPanel';
import { useQuoteDocumentDefaultsForm } from '@/hooks/useQuoteDocumentDefaultsForm';
import { useToast } from '@/hooks/use-toast';

// "הצעות ומסמכים" — exactly 2 fields (payment terms, fixed note),
// rendered into the existing compact terms slot in every quote's PDF.
// No VAT, no cancellation policy, no PDF footer — per explicit scope.
export default function QuoteDocumentDefaultsSection() {
  const { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry } = useQuoteDocumentDefaultsForm();
  const { toast } = useToast();

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      toast({ title: 'הטקסטים נשמרו', description: 'הצעת המחיר הבאה שתופק תשתמש בטקסטים המעודכנים.' });
    }
  };

  return (
    <SolidCard>
      <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-primary" aria-hidden="true" /> הצעות ומסמכים
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        שני טקסטים קבועים שמופיעים בכל הצעת מחיר. שיעור המע&quot;מ אינו ולא יהיה חלק ממסך זה.
      </p>

      {loadState === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          טוען...
        </div>
      )}

      {loadState === 'error' && (
        <div className="text-center py-6 space-y-3">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-sm text-destructive"
          >
            שגיאה בטעינה. הפרטים הקיימים לא נטענו — אין לערוך עד לטעינה מוצלחת.
          </motion.p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
            נסה שוב
          </Button>
        </div>
      )}

      {loadState === 'ready' && values && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="payment-terms" className="text-xs text-muted-foreground mb-1.5 block">
              תנאי תשלום
            </Label>
            <Textarea
              id="payment-terms"
              value={values.quote_payment_terms_text}
              onChange={(e) => updateField('quote_payment_terms_text', e.target.value)}
              className="bg-secondary border-border text-xs"
              dir="rtl"
              rows={2}
            />
            {fieldErrors.quote_payment_terms_text && <p className="text-xs text-destructive mt-1">{fieldErrors.quote_payment_terms_text}</p>}
          </div>

          <div>
            <Label htmlFor="fixed-note" className="text-xs text-muted-foreground mb-1.5 block">
              הערה קבועה להצעת מחיר
            </Label>
            <Textarea
              id="fixed-note"
              value={values.quote_fixed_note_text}
              onChange={(e) => updateField('quote_fixed_note_text', e.target.value)}
              className="bg-secondary border-border text-xs"
              dir="rtl"
              rows={2}
            />
            {fieldErrors.quote_fixed_note_text && <p className="text-xs text-destructive mt-1">{fieldErrors.quote_fixed_note_text}</p>}
          </div>

          {saveError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="text-xs text-destructive">
              {saveError}
            </motion.p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {saveSuccess && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="text-xs text-primary">
                נשמר בהצלחה
              </motion.span>
            )}
            <MotionButton whileTap={{ scale: 0.97 }} type="button" onClick={() => void handleSave()} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ms-1.5" aria-hidden="true" /> : null}
              שמירה
            </MotionButton>
          </div>
        </div>
      )}
    </SolidCard>
  );
}
