import { supabase } from '@/lib/supabaseClient';
import { ClientSchema, upsertClient } from '@/lib/clients';

// Called only from useQuoteForm.ts's explicit save() — never from the
// autosave effect — for clinic_treatment/private_event quotes. Matches
// against the real `clients` table (not clientDirectory.ts's quotes-
// history-derived list, which stays a separate, unchanged autocomplete
// source), so a client created this way actually lands in the same
// table ClientsList.tsx/ClientProfile.tsx already read from.
//
// No unique DB constraint on phone/email backs this — per explicit
// product decision, neither field is an absolute business identifier
// (a phone/email can legitimately be shared or absent across two real,
// distinct clients), so duplicate prevention is this find-before-create
// check, not a constraint that would reject legitimate data.
//
// Priority, exact matches only, name is never used to match:
// 1. phone (if non-empty)
// 2. email (if phone didn't match, and email is non-empty)
// 3. create a new client
// Returns null (no lookup, no creation) if both phone and email are empty
// — not enough information to reliably identify or create a client.
export async function findOrCreateClient(input: { name: string; phone: string; email: string }): Promise<string | null> {
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!phone && !email) return null;

  if (phone) {
    const { data, error } = await supabase.from('clients').select('id').eq('phone', phone).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }

  if (email) {
    const { data, error } = await supabase.from('clients').select('id').eq('email', email).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }

  const newClient = ClientSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    name: input.name.trim() || 'לקוח חדש',
    phone,
    email,
  });
  await upsertClient(newClient);
  return newClient.id;
}
