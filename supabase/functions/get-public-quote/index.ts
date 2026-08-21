// Supabase Edge Function (Deno). The ONLY way the public signing page
// (src/pages/SignQuote.tsx, route /sign/:quoteId) reads quote data —
// deliberately not a direct `supabase.from('quotes')` call from that page,
// even though quotes/quote_line_items RLS is already permissive enough
// for that to technically work. This function uses the service role key
// (never shipped to the client) and can only ever return ONE quote by ID,
// so a public signing link — the first surface in this app reachable by
// people outside the business — can't be used to browse every quote in
// the table the way a leaked/inspected anon key could.
//
// Row -> camelCase mapping is duplicated from src/lib/quotes/quoteApi.ts's
// private fromRow() rather than shared, since this function intentionally
// has zero dependency on client-side app code — keep the two in sync if
// the quotes schema changes.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  let body: { quoteId?: string };
  try {
    body = (await req.json()) as { quoteId?: string };
  } catch {
    return new Response('Invalid JSON body.', { status: 400, headers: corsHeaders() });
  }
  if (!body.quoteId) {
    return new Response('Missing required field: quoteId.', { status: 400, headers: corsHeaders() });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: row, error } = await serviceClient
    .from('quotes')
    .select('*, quote_line_items(*)')
    .eq('id', body.quoteId)
    .maybeSingle();

  if (error) {
    return new Response(`Lookup failed: ${error.message}`, { status: 500, headers: corsHeaders() });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  const lineItems = (row.quote_line_items ?? [])
    .slice()
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((r: Record<string, unknown>) => ({
      id: r.id,
      order: r.sort_order,
      treatmentName: r.treatment_name,
      durationMinutes: r.duration_minutes,
      purchaseType: r.purchase_type,
      description: r.description,
      unitPrice: r.unit_price,
      quantity: r.quantity,
    }));

  const quote = {
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
  };

  return new Response(JSON.stringify({ quote }), {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
});
