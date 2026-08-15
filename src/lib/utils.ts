import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Per CLAUDE.md's input-validation rule: numeric text-input values must be
// Zod-validated before they reach state, not only right before the final
// calculation. Coerces a raw string (e.g. from a number <Input>) against the
// given Zod number field schema — reusing the same schema the calculation
// engine validates against, so there's one source of truth for the
// constraint (min/max/int). Falls back to the previous value (not a
// hardcoded default) when the input is momentarily invalid, e.g. while the
// user is still typing.
export function coerceValidatedNumber(fieldSchema: z.ZodType<number>, raw: string, fallback: number): number {
  const coerced = z.coerce.number().safeParse(raw);
  if (!coerced.success) return fallback;
  const validated = fieldSchema.safeParse(coerced.data);
  return validated.success ? validated.data : fallback;
}

// Text-input sibling to coerceValidatedNumber — same contract (schema is the
// source of truth for the constraint, fallback to the previous value on
// invalid input) for the text fields CLAUDE.md's validation rule also
// covers (line item labels/notes, quote terms, etc.).
export function coerceValidatedText(fieldSchema: z.ZodType<string>, raw: string, fallback: string): string {
  const validated = fieldSchema.safeParse(raw);
  return validated.success ? validated.data : fallback;
}
