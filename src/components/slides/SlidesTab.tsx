import { Copy } from 'lucide-react';
import { GlassPanel, SolidCard } from '@/components/shared/GlassPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CalcParams, CalculationResult } from '@/lib/calcEngine';

interface SlidesTabProps {
  params: CalcParams;
  results: CalculationResult;
}

// Fixed marketing copy (elevator pitches for different audiences), not
// calc-derived — params/results aren't read here, same as the placeholder
// this replaces. Ported verbatim from the original Base44 SlidesTab.
interface PitchCard {
  titleHe: string;
  audienceEn: string;
  he: string;
  en: string;
}

const PITCH_CARDS: PitchCard[] = [
  {
    titleHe: 'נאום מעלית: לקוחות פרטיים ואירועי בוטיק',
    audienceEn: 'Private B2C',
    he: 'אירוע וולנס פרטי מבית ריפוי הרמוני. מגיע לכם לחיות את עצמכם מחדש. אנו מביאים את החוויה אליכם. אירוע מותאם אישית של 4 שעות עם 2 מטפלים מקצועיים, שיעניקו טיפול מדויק של 24 דקות לכל אחד מ-20 האורחים שלכם. חבילת הפרימיום המושלמת בעלות של 2,000 ₪.',
    en: 'Private Wellness by Harmony Healing. Relive Yourself with our exclusive private event deployment. We bring the ultimate relaxation experience directly to you: A custom 4-hour session featuring 2 top-tier practitioners. Each of your 20 guests will enjoy a tailored 24-minute renewal treatment. Premium bespoke package total: 2,000 ₪.',
  },
  {
    titleHe: 'נאום מעלית: משקיעים, חברות הייטק ותעופה',
    audienceEn: 'Corporate & Airlines',
    he: 'ריפוי הרמוני - לחיות את עצמך מחדש. אנו מספקים מערך וולנס פרימיום גלובלי. המודל שלנו מתוכנן לספק טיפולים מדויקים ויעילים: צוות של 2 מטפלים בכירים מעניק חוויית חידוש אנרגיה ל-20 משתתפים ב-4 שעות בלבד. העלות לארגון היא 2,000 ₪. אנו פתוחים לשיתופי פעולה אסטרטגיים וברטרים עם חברות תעופה - שירותי וולנס לטרקליני יוקרה בתמורה לכרטיסי טיסה לניוד הצוות שלנו בעולם.',
    en: 'Harmony Healing - Relive Yourself. We deliver global premium wellness operations. For your enterprise, our elite team of 2 practitioners will rejuvenate 20 individuals over a focused 4-hour session. Total corporate investment is 2,000 ₪. We actively seek strategic barter agreements with global airlines—integrating our wellness setups into premium lounges in exchange for travel access for our international deployment team.',
  },
  {
    titleHe: 'נאום מעלית: מתחמי וולנס ושיתופי פעולה B2B',
    audienceEn: 'Venue Partners',
    he: 'השותפים של ריפוי הרמוני. אנו מקימים מתחמי טיפולים פרימיום בתוך סביבות קיימות ללא מאמץ תפעולי מצדכם. עבור מודל הפעלה של 4 שעות עם 2 מטפלים (עד 20 אורחים), אנו מגדירים חלוקת הכנסות שקופה או תמחור קבלן קבוע. לחיות את עצמך מחדש - אנחנו דואגים למקצועיות, אתם נהנים משדרוג המקום והכנסה פסיבית.',
    en: "Harmony Healing Partners. We deploy plug-and-play premium wellness environments inside your existing infrastructure with zero operational friction for you. A standard 4-hour activation with 2 practitioners covers up to 20 guests. Relive Yourself - We guarantee uncompromising professionalism while upgrading your venue's prestige and driving revenue sharing.",
  },
  {
    titleHe: 'גיוס מלאכים: פנייה למטפלים להצטרפות לצוות',
    audienceEn: 'Recruiting Therapists',
    he: 'הצטרפו למלאכים של ריפוי הרמוני! מחפש/ת סביבת עבודה מעצימה? אצלנו, המטפלים הם מלאכים. אנו מציעים שכר מתגמל של 130 ₪ לשעה, עבודה באירועי פרימיום בארץ ובעולם. הזדמנות להתפתחות, לקבל חשיפה ולעזור לאנשים לחיות את עצמם מחדש.',
    en: 'Join The Angels of Harmony Healing! Seeking a prestigious clinic and empowering environment? Here, our therapists are Angels. We offer a competitive compensation of 130 ₪ per hour, operating in premium events globally. Grow with us, gain global exposure, and help people Relive Themselves.',
  },
];

function TextBlock({ text }: { text: string }) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'הטקסט הועתק' });
    } catch {
      toast({ title: 'העתקת הטקסט נכשלה', variant: 'destructive' });
    }
  };

  return (
    <SolidCard className="space-y-3">
      <p className="text-sm leading-relaxed text-foreground" dir="auto">
        {text}
      </p>
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          העתק
        </Button>
      </div>
    </SolidCard>
  );
}

export default function SlidesTab({ params, results }: SlidesTabProps) {
  void params;
  void results;
  return (
    <div dir="rtl" className="space-y-6 max-w-3xl mx-auto">
      {PITCH_CARDS.map((card, i) => (
        <GlassPanel key={i} className="p-5 space-y-4">
          <h3 className="text-base font-bold text-foreground">
            {card.titleHe} ({card.audienceEn})
          </h3>
          <TextBlock text={card.he} />
          <TextBlock text={card.en} />
        </GlassPanel>
      ))}
    </div>
  );
}
