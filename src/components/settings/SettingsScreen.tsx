import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BusinessProfileSection from './BusinessProfileSection';
import MessageTemplatesSection from './MessageTemplatesSection';
import QuoteDocumentDefaultsSection from './QuoteDocumentDefaultsSection';

interface SettingsScreenProps {
  isDark: boolean;
  onIsDarkChange: (isDark: boolean) => void;
}

// All 3 sections fully wired: "העסק שלי" (business_settings + Theme),
// "הצעות ומסמכים" (payment terms + fixed note — no VAT, no cancellation
// policy, no PDF footer), "תבניות הודעות" (WhatsApp/Email templates).
export default function SettingsScreen({ isDark, onIsDarkChange }: SettingsScreenProps) {
  return (
    <div dir="rtl">
      <Tabs defaultValue="business" dir="rtl">
        <TabsList>
          <TabsTrigger value="business">העסק שלי</TabsTrigger>
          <TabsTrigger value="documents">הצעות ומסמכים</TabsTrigger>
          <TabsTrigger value="templates">תבניות הודעות</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-5">
          <BusinessProfileSection isDark={isDark} onIsDarkChange={onIsDarkChange} />
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <QuoteDocumentDefaultsSection />
        </TabsContent>

        <TabsContent value="templates" className="mt-5">
          <MessageTemplatesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
