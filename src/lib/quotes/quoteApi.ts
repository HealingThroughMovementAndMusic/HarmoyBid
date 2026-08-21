// Supabase persistence for the Quote module. Direct supabase.from(...)
// calls (no Edge Function layer at this scope — see the plan's RLS
// section for why that's an acceptable tradeoff for a no-auth internal
// tool). Every response is Zod-parsed via QuoteSchema before it reaches
// React state, per CLAUDE.md's input-validation rule applied at the
// network boundary.

import { supabase } from '@/lib/supabaseClient';
import { QuoteSchema, type Quote, type QuoteLineItem } from './quote';

interface QuoteRow {
  id: string;
  quote_number: string;
  quote_type: string;
  status: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  company_name: string;
  company_tax_id: string;
  contact_person_phone: string;
  contact_person_email: string;
  event_date: string | null;
  event_start_time: string;
  event_end_time: string;
  event_therapist_count: number | null;
  event_participants_count: number | null;
  event_hourly_rate: number | null;
  event_expected_hours: number | null;
  event_location: string;
  notes_text: string;
  client_signature_data_url: string | null;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
  client_id: string | null;
  quote_line_items: QuoteLineItemRow[];
}

interface QuoteLineItemRow {
  id: string;
  sort_order: number;
  treatment_name: string;
  duration_minutes: number | null;
  purchase_type: string | null;
  description: string;
  unit_price: number | null;
  quantity: number;
}

function fromRow(row: QuoteRow): Quote {
  const lineItems: QuoteLineItem[] = (row.quote_line_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      id: r.id,
      order: r.sort_order,
      treatmentName: r.treatment_name,
      durationMinutes: r.duration_minutes,
      purchaseType: r.purchase_type as QuoteLineItem['purchaseType'],
      description: r.description,
      unitPrice: r.unit_price,
      quantity: r.quantity,
    }));

  return QuoteSchema.parse({
    id: row.id,
    quoteNumber: row.quote_number,
    quoteType: row.quote_type,
    status: row.status,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    companyName: row.company_name,
    companyTaxId: row.company_tax_id,
    contactPersonPhone: row.contact_person_phone,
    contactPersonEmail: row.contact_person_email,
    eventDate: row.event_date,
    eventStartTime: row.event_start_time,
    eventEndTime: row.event_end_time,
    eventTherapistCount: row.event_therapist_count,
    eventParticipantsCount: row.event_participants_count,
    eventHourlyRate: row.event_hourly_rate,
    eventExpectedHours: row.event_expected_hours,
    eventLocation: row.event_location,
    notesText: row.notes_text,
    clientSignatureDataUrl: row.client_signature_data_url,
    storagePath: row.storage_path,
    lineItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedAt: row.signed_at,
    clientId: row.client_id,
  });
}

const QUOTE_SELECT = '*, quote_line_items(*)';

export async function listQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as QuoteRow[]).map(fromRow);
}

export async function getQuote(id: string): Promise<Quote | null> {
  const { data, error } = await supabase.from('quotes').select(QUOTE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as QuoteRow) : null;
}

export async function saveQuote(quote: Quote): Promise<Quote> {
  const parsed = QuoteSchema.parse(quote);
  const quoteRow = {
    id: parsed.id,
    quote_type: parsed.quoteType,
    status: parsed.status,
    client_name: parsed.clientName,
    client_phone: parsed.clientPhone,
    client_email: parsed.clientEmail,
    company_name: parsed.companyName,
    company_tax_id: parsed.companyTaxId,
    contact_person_phone: parsed.contactPersonPhone,
    contact_person_email: parsed.contactPersonEmail,
    event_date: parsed.eventDate,
    event_start_time: parsed.eventStartTime,
    event_end_time: parsed.eventEndTime,
    event_therapist_count: parsed.eventTherapistCount,
    event_participants_count: parsed.eventParticipantsCount,
    event_hourly_rate: parsed.eventHourlyRate,
    event_expected_hours: parsed.eventExpectedHours,
    event_location: parsed.eventLocation,
    notes_text: parsed.notesText,
    client_signature_data_url: parsed.clientSignatureDataUrl,
    storage_path: parsed.storagePath,
    client_id: parsed.clientId,
    updated_at: new Date().toISOString(),
    // quote_number is intentionally omitted on insert — the DB trigger
    // assigns it. On update, Postgres leaves the existing value alone
    // since the column isn't in the payload.
  };

  const { data: savedQuote, error: quoteError } = await supabase
    .from('quotes')
    .upsert(quoteRow)
    .select()
    .single();
  if (quoteError) throw quoteError;

  // Line items: replace-in-full is the simplest correct approach at this
  // scope (delete then insert), since there's no history/audit
  // requirement on individual row edits here.
  const { error: deleteError } = await supabase.from('quote_line_items').delete().eq('quote_id', parsed.id);
  if (deleteError) throw deleteError;

  if (parsed.lineItems.length > 0) {
    const lineItemRows = parsed.lineItems.map((row, index) => ({
      id: row.id,
      quote_id: parsed.id,
      sort_order: index,
      treatment_name: row.treatmentName,
      duration_minutes: row.durationMinutes,
      purchase_type: row.purchaseType,
      description: row.description,
      unit_price: row.unitPrice,
      quantity: row.quantity,
    }));
    const { error: insertError } = await supabase.from('quote_line_items').insert(lineItemRows);
    if (insertError) throw insertError;
  }

  const saved = await getQuote(savedQuote.id);
  if (!saved) throw new Error('שמירת ההצעה נכשלה — לא נמצאה לאחר השמירה.');
  return saved;
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw error;
}

/** Quote history for a single client — ClientProfile.tsx's "הצעות מחיר"
 *  section. Same QUOTE_SELECT/fromRow as listQuotes(), just filtered. */
export async function listQuotesByClientId(clientId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as QuoteRow[]).map(fromRow);
}
