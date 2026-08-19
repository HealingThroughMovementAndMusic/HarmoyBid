import { motion } from 'framer-motion';
import { Loader2, Building2, Moon, Sun } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import MotionButton from '@/components/shared/MotionButton';
import { SolidCard } from '@/components/shared/GlassPanel';
import { useBusinessProfileForm } from '@/hooks/useBusinessProfileForm';
import { useToast } from '@/hooks/use-toast';

interface BusinessProfileSectionProps {
  isDark: boolean;
  onIsDarkChange: (isDark: boolean) => void;
}

// "העסק שלי" — the only fully-wired Settings section in this phase. Loads
// the existing business_settings row (seeded in Phase 1 with the values
// already live in businessProfile.ts/whatsapp.ts), lets them be edited,
// and on save propagates immediately to every PDF/WhatsApp/Email consumer
// via getBusinessProfile() (see useBusinessProfileForm's save()).
export default function BusinessProfileSection({ isDark, onIsDarkChange }: BusinessProfileSectionProps) {
  const { loadState, values, fieldErrors, updateField, save, saving, saveError, saveSuccess, retry } = useBusinessProfileForm();
  const { toast } = useToast();

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      toast({ title: 'פרטי העסק נשמרו', description: 'הפרטים המעודכנים ישמשו בהצעות מחיר, PDF, WhatsApp ואימייל הבאים.' });
    }
  };

  return (
    <div className="space-y-5">
      <SolidCard>
        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-primary" aria-hidden="true" /> פרטי העסק
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          הפרטים כאן משמשים בהצעות מחיר, PDF, הודעות WhatsApp ומייל — מקור אחד לכל המערכת.
        </p>

        {loadState === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            טוען פרטי עסק...
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
              שגיאה בטעינת פרטי העסק. הפרטים הקיימים לא נטענו — אין להזין ידנית עד לטעינה מוצלחת.
            </motion.p>
            <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
              נסה שוב
            </Button>
          </div>
        )}

        {loadState === 'ready' && values && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="biz-name" className="text-xs text-muted-foreground mb-1.5 block">
                  שם העסק
                </Label>
                <Input
                  id="biz-name"
                  value={values.business_name}
                  onChange={(e) => updateField('business_name', e.target.value)}
                  className="bg-secondary border-border"
                />
                {fieldErrors.business_name && <p className="text-xs text-destructive mt-1">{fieldErrors.business_name}</p>}
              </div>
              <div>
                <Label htmlFor="biz-tax-id" className="text-xs text-muted-foreground mb-1.5 block">
                  ח.פ / עוסק מורשה
                </Label>
                <Input
                  id="biz-tax-id"
                  value={values.business_tax_id}
                  onChange={(e) => updateField('business_tax_id', e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label htmlFor="biz-phone" className="text-xs text-muted-foreground mb-1.5 block">
                  טלפון
                </Label>
                <Input
                  id="biz-phone"
                  value={values.business_phone}
                  onChange={(e) => updateField('business_phone', e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label htmlFor="biz-email" className="text-xs text-muted-foreground mb-1.5 block">
                  אימייל
                </Label>
                <Input
                  id="biz-email"
                  type="email"
                  value={values.business_email}
                  onChange={(e) => updateField('business_email', e.target.value)}
                  className="bg-secondary border-border"
                />
                {fieldErrors.business_email && <p className="text-xs text-destructive mt-1">{fieldErrors.business_email}</p>}
              </div>
              <div>
                <Label htmlFor="biz-website" className="text-xs text-muted-foreground mb-1.5 block">
                  אתר
                </Label>
                <Input
                  id="biz-website"
                  value={values.business_website_url}
                  onChange={(e) => updateField('business_website_url', e.target.value)}
                  className="bg-secondary border-border"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="biz-booking" className="text-xs text-muted-foreground mb-1.5 block">
                  קישור להזמנות
                </Label>
                <Input
                  id="biz-booking"
                  value={values.business_booking_url}
                  onChange={(e) => updateField('business_booking_url', e.target.value)}
                  className="bg-secondary border-border"
                  dir="ltr"
                />
              </div>
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" /> : null}
                שמירה
              </MotionButton>
            </div>
          </div>
        )}
      </SolidCard>

      <SolidCard>
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
          {isDark ? <Moon className="w-4 h-4 text-primary" aria-hidden="true" /> : <Sun className="w-4 h-4 text-primary" aria-hidden="true" />} ערכת נושא
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">מצב כהה</span>
          <Switch checked={isDark} onCheckedChange={onIsDarkChange} />
        </div>
      </SolidCard>
    </div>
  );
}
