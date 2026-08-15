// Sample Quote fixtures for the /pdf-preview dev route — deliberately
// covers the RTL/bidi test matrix (mixed Hebrew+English, long names,
// long descriptions, multi-item tables, signed vs. unsigned) so the
// preview loop doubles as a manual run of that matrix.
import { createEmptyLineItem, type Quote, type QuoteType } from '@/lib/quotes/quote';

function makeQuote(overrides: Partial<Quote> & { quoteType: QuoteType }): Quote {
  return {
    id: 'preview',
    quoteNumber: 'Q-2026-0042',
    status: 'draft',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    companyName: '',
    companyTaxId: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    eventDate: null,
    eventStartTime: '',
    eventEndTime: '',
    eventTherapistCount: null,
    eventParticipantsCount: null,
    eventHourlyRate: null,
    eventExpectedHours: null,
    notesText: '',
    clientSignatureDataUrl: null,
    storagePath: null,
    lineItems: [],
    ...overrides,
  };
}

export const SAMPLE_QUOTES: Record<string, Quote> = {
  clinic: makeQuote({
    quoteType: 'clinic_treatment',
    clientName: 'מיכל אברהם-כהן ואן דר ברג', // Test 12: extremely long client name
    clientPhone: '050-1234567',
    clientEmail: 'michal.avraham-cohen@example.com', // Test 6
    notesText: 'תודה שבחרת ב-Harmony WS! נשמח לראותך שוב בקרוב.', // Test 2: Hebrew+English mixed
    lineItems: [
      {
        ...createEmptyLineItem(0),
        treatmentName: 'עיסוי שוודי הוליסטי',
        durationMinutes: 60, // Test 3: Hebrew+numbers
        purchaseType: 'single',
        unitPrice: 320,
        quantity: 1,
      },
      {
        ...createEmptyLineItem(1),
        treatmentName: 'רפלקסולוגיה',
        durationMinutes: 45,
        purchaseType: 'series',
        description:
          'טיפול ארוך במיוחד עם תיאור מפורט מאוד שנועד לבדוק גלישת טקסט בתוך התא של הטבלה ולוודא שאין חיתוך או חפיפה', // Test 07
        unitPrice: null, // Test 11-adjacent: unpriced row
        quantity: 1,
      },
    ],
  }),
  companyLarge: makeQuote({
    quoteType: 'company_event',
    companyName: 'Google Israel Ltd. — טכנולוגיות מתקדמות בע"מ', // Test 13/02: English-only + mixed
    companyTaxId: '514312345',
    contactPersonPhone: '03-9001234',
    contactPersonEmail: 'events@example.co.il',
    eventDate: '2026-12-31',
    eventStartTime: '10:00',
    eventEndTime: '18:00',
    eventTherapistCount: 8,
    clientSignatureDataUrl: null,
    lineItems: Array.from({ length: 12 }, (_, i) => ({
      ...createEmptyLineItem(i),
      description: `תחנת עיסוי מס' ${i + 1} — כולל ציוד וכיסא ייעודי`, // Test 09: long table
      unitPrice: 450 + i * 10,
      quantity: 1,
    })), // Test 08: large multi-item quote
  }),
  signed: makeQuote({
    quoteType: 'private_event',
    clientName: 'דניאל לוי',
    clientPhone: '052-7654321',
    clientEmail: 'daniel@example.com',
    eventDate: '2026-06-15',
    eventStartTime: '09:00',
    eventEndTime: '13:00',
    eventTherapistCount: 2,
    clientSignatureDataUrl:
      'data:image/svg+xml;base64,' +
      btoa('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50"><text x="10" y="30" font-size="20">Signed</text></svg>'), // Test 10
    lineItems: [{ ...createEmptyLineItem(0), description: 'אירוע פרטי — יום הולדת', unitPrice: 1800, quantity: 1 }],
  }),
};
