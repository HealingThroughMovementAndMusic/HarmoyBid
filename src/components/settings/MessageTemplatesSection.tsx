import { motion } from 'framer-motion';
import { Loader2, MessageCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import MotionButton from '@/components/shared/MotionButton';
import { SolidCard } from '@/components/shared/GlassPanel';
import { useMessageTemplatesForm } from '@/hooks/useMessageTemplatesForm';
import { useToast } from '@/hooks/use-toast';

// "תבניות הודעות" — one central template PER MESSAGE TYPE (WhatsApp /
// Email subject / Email body), not per quote-creation source. Every quote
// creation path converges on QuoteDocumentScreen.tsx's two builders (see
// the two audits this feature was built from), so editing these 3 fields
// here affects every quote regardless of how it was created.
export default function MessageTemplatesSection() {
  const { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry } = useMessageTemplatesForm();
  const { toast } = useToast();

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      toast({ title: 'תבניות ההודעות נשמרו', description: 'ההודעה הבאה שתישלח בכל הצעת מחיר תשתמש בתבנית המעודכנת.' });
    }
  };

  return (
    <SolidCard>
      <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4 text-primary" aria-hidden="true" /> תבניות הודעות
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        תבנית מרכזית אחת לכל סוג הודעה — חלה על כל הצעת מחיר, ללא קשר לאופן שבו נוצרה (הצעה רגילה, מחשבון אירועים, קטלוג חבילות, או פתיחת הצעה קיימת).
      </p>

      {loadState === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          טוען תבניות...
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
            שגיאה בטעינת תבניות ההודעות. הפרטים הקיימים לא נטענו — אין לערוך עד לטעינה מוצלחת.
          </motion.p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
            נסה שוב
          </Button>
        </div>
      )}

      {loadState === 'ready' && values && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="tmpl-whatsapp" className="text-xs text-muted-foreground mb-1.5 block">
              תבנית WhatsApp — משתנים מותרים: {'{{שם_לקוח}} {{שם_עסק}} {{מספר_הצעה}} {{סוג_הצעה}} {{קישור_חתימה}}'}
            </Label>
            <Textarea
              id="tmpl-whatsapp"
              value={values.msg_whatsapp_template}
              onChange={(e) => updateField('msg_whatsapp_template', e.target.value)}
              className="bg-secondary border-border font-mono text-xs"
              dir="rtl"
              rows={5}
            />
            {fieldErrors.msg_whatsapp_template && <p className="text-xs text-destructive mt-1">{fieldErrors.msg_whatsapp_template}</p>}
          </div>

          <div>
            <Label htmlFor="tmpl-email-subject" className="text-xs text-muted-foreground mb-1.5 block">
              תבנית נושא Email — משתנים מותרים: {'{{שם_לקוח}} {{שם_עסק}} {{מספר_הצעה}}'}
            </Label>
            <Textarea
              id="tmpl-email-subject"
              value={values.msg_email_subject_template}
              onChange={(e) => updateField('msg_email_subject_template', e.target.value)}
              className="bg-secondary border-border font-mono text-xs"
              dir="rtl"
              rows={2}
            />
            {fieldErrors.msg_email_subject_template && <p className="text-xs text-destructive mt-1">{fieldErrors.msg_email_subject_template}</p>}
          </div>

          <div>
            <Label htmlFor="tmpl-email-body" className="text-xs text-muted-foreground mb-1.5 block">
              תבנית גוף Email — משתנים מותרים: {'{{שם_לקוח}} {{שם_עסק}} {{מספר_הצעה}} {{קישור_חתימה}}'}
            </Label>
            <Textarea
              id="tmpl-email-body"
              value={values.msg_email_body_template}
              onChange={(e) => updateField('msg_email_body_template', e.target.value)}
              className="bg-secondary border-border font-mono text-xs"
              dir="rtl"
              rows={4}
            />
            {fieldErrors.msg_email_body_template && <p className="text-xs text-destructive mt-1">{fieldErrors.msg_email_body_template}</p>}
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
