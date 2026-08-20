# CLAUDE.md

Guidance for working on **Harmony WS** — a Hebrew RTL pricing/quote system (React 19 + Vite + TypeScript + Tailwind + Supabase).

## Money math

- Every financial calculation (revenue, commission, payroll, VAT, discounts, totals) **must** be done with `bignumber.js`, never plain JS floats. See `src/lib/calcEngine.ts` (event/treatment profit calc) and `src/lib/quotes/quote.ts` (`lineItemTotal`, `quoteGrandTotal`, `quoteVatAmount`, `quoteTotalWithVat`) for the established pattern: build the whole computation as a `BigNumber` chain (`.times()`, `.plus()`, `.dividedBy()`, ...) and only call `.toNumber()` at the very end, at the boundary where the result is returned/rendered.
- Display formatting rounds explicitly (`Math.round(...).toLocaleString('he-IL')` for currency, `.toFixed()` only for percentages) — never let a raw unrounded float reach the UI.

## Input validation

- Every calculation input schema is defined with Zod (`CalcParamsSchema`, `PricingPlanSchema`, `PricingEngineConfigSchema`, ...).
- Numeric/text input handlers must validate through the relevant Zod schema **before** the value is written to component state or persisted (e.g. `localStorage`) — not only right before the final `calculateEvent()`/`computeBreakdown()` call. Raw `parseFloat`/`parseInt` coercion on `onChange` without a schema pass in between is a validation bypass, not just a style nit.
- `react-hook-form` and `zod` are both dependencies; if a form is built with RHF, wire it to its schema via `zodResolver` rather than validating ad hoc.

## Responsiveness & Lovable compatibility (standing rule, applies to every change)

- **Every** UI change or addition — not just ones explicitly flagged as "mobile work" — must render correctly at mobile and tablet widths, on both iOS/Safari and Android/Chrome, not just desktop. Check actual breakpoint behavior (Tailwind `sm:`/`md:`/`lg:` as already used throughout `src/components/`), not just "it looks fine on a wide viewport." When verifying a UI change per `<verification_workflow>`, include at least one narrow-viewport check (`resize_window` to `mobile`/`tablet` preset) alongside the desktop check — don't skip it just because the change "looks like a desktop-only tweak."
- **Every** code change — UI or otherwise — must stay clean and deployable as-is via Lovable (see "Deployment (Lovable)" below for what that hosting path actually needs: no server-only Node APIs leaking into `src/`, no assumptions that break a static Vite build, secrets never introduced as `VITE_`-prefixed values). Don't introduce a pattern that only works locally or only works with a Node server behind it.
- This rule was given verbally mid-session once and not originally written down here, which is why it wasn't applied consistently to every later change — it's now a standing, permanent instruction, not a one-off ask.

## RTL

- This app is **RTL-only** (Hebrew), permanently — not a bilingual app. `index.html` sets `<html lang="he" dir="rtl">` globally.
- Use physical Tailwind classes (`right-*`, `left-*`, `text-right`, `pr-*`, `pl-*`) consistently with the RTL layout, as the existing components do.
- Do **not** introduce `rtl:`/`ltr:` Tailwind variants or logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`) — there is no LTR mode to support, so those would be dead code / a sign something drifted from the RTL-only convention.
- PDF generation (`src/components/pdf/`, react-pdf) sets its own `direction`/`flexDirection` in `StyleSheet` independently of Tailwind/CSS — keep that in sync with the RTL convention too.
- **Verified rule about mixed Hebrew+number text in PDFs** (established by generating real PDFs via `pdf()` and extracting/rasterizing the actual output — not assumed, and revised three times this project as counter-examples were found each time, so trust this bullet over any single earlier claim, including its own earlier revisions): `@react-pdf/renderer`'s `textkit` engine genuinely implements Unicode Bidi reordering (`node_modules/@react-pdf/textkit` imports `bidi-js`), but that reordering is only reliable for **block-level** siblings (`View` with `flexDirection: 'row-reverse'` containing separate `Text` children — e.g. `PdfTotals.tsx`'s label/value row pattern) — it is **not** reliably correct for **inline** content, i.e. a single `Text` node whose string mixes Hebrew letters with a digit, or multiple `Text` children nested inside one shared parent `Text`. Confirmed broken in real generated output: `` <Text>{`מספר מטפלים: ${n}`}</Text> `` (Hebrew + trailing bare number), `` <Text>מע"מ ({pct}%)</Text> `` (Hebrew + embedded number mid-string), and — a prior version of this bullet claimed this one case was safe, which a later real-PDF regeneration disproved — `` <Text>{`הצעת מחיר - מס' ${quoteNumber}`}</Text> `` (`PdfTitleBanner.tsx`) all scrambled. **There is no safe exception. Never put Hebrew letters and a digit in the same `Text` node, full stop, regardless of position or run length.** Split at each Hebrew↔digit boundary into sibling `Text` elements listed in normal reading order, and lay them out via a `View` with `flexDirection: 'row-reverse'` (position-controlled by Yoga, not by textkit's inline bidi reordering) — see `CalcInternalDocument.tsx`'s `labelGroup` pattern, or `PdfTitleBanner.tsx`/`PdfItemsTable.tsx`'s `tableCellSubGroup` for working examples. When splitting adjacent pieces that need a visible space between them, put the space as a **trailing** character on the piece ending in a digit (e.g. `` `${n} ` `` then `` `דק' · ...` `` ) — a **leading** space on the piece that starts with Hebrew gets silently trimmed at the Text-box boundary and the words render glued together with no gap.
- **A second, independent class of bug hides behind the same symptom, confirmed this project**: a `Text` node that has its own `flex` value (e.g. `flex: 4`) nested *inside* an already-flexed `View` wrapper (also `flex: 4`) that itself contains a sibling `View`/`Text` (e.g. a second line of sub-text below it) causes Yoga to render the children **overlapping at the same position** instead of stacked — this looks identical to a bidi scramble at a glance (garbled-looking overlapping glyphs) but is a pure layout bug, not a bidi one, and splitting Text nodes alone will not fix it. Confirmed via an isolated minimal repro (varying one style property at a time and re-rendering) that removing the redundant `flex` from the inner `Text` — leaving `flex: 4` only on the outer wrapping `View` — resolves it. Rule: when wrapping a table cell's Text in a `View` to stack a second line beneath it, give the `flex` value to the `View` only, never also to the `Text` inside it.
- **Text-extraction from a generated PDF (`pdf-parse` or similar) is not sufficient to verify RTL/bidi or layout fixes** — it can report the textually-correct characters while the actual rendered glyph *positions* are still wrong (scrambled order, or two lines overlapping). The reliable check, used to find and confirm both bugs above: generate a real PDF via `pdf()` in an isolated Node process (see the `vite-node` pattern elsewhere in this file), rasterize it to a PNG (e.g. the `pdf-to-img` package, temporary/`--no-save`, since it needs no native `canvas` build) and actually look at the image.
- **Dev-server HMR staleness under `src/components/pdf/`, observed directly this project**: after deleting/renaming files in that directory mid-session, the browser console logged `[vite] Failed to reload ...` for the deleted module, and a real exported PDF in the running app briefly reflected pre-fix behavior even though the source on disk was already correct and a fresh Node-process `pdf()` generation proved it. If a PDF-related fix doesn't seem to take effect in the running app, don't assume the fix is wrong before ruling this out — restart the dev server and hard-reload the browser tab first, and if still in doubt, verify against a fresh `pdf()` call in an isolated Node process (not the dev server) rather than trusting what the browser currently renders.
- **The two default quote-document text lines (`quoteDocumentDefaults.ts`'s `DEFAULT_QUOTE_DOCUMENT_TEXT`, rendered into `QuoteDocument.tsx`'s terms slot) have no trailing period, by explicit request** — `'התשלום יתבצע בהתאם לתנאים שסוכמו בין הצדדים'` and `'המחיר המוצג בהצעה מתייחס לשירותים המפורטים בלבד'`. This directly followed the Hebrew+digit bidi rule above: splitting each line into its own sibling `Text` node (rather than joining multiple lines with `\n` in one shared node) had already fixed the *reordering*, but a period genuinely is punctuation at the true end of an RTL sentence and this renderer's positioning of it there was still visually inconsistent enough in practice to be worth just removing rather than chasing further — confirmed via a real generated, rasterized PDF that both lines now render with no punctuation at either edge.

## Conversion features

- **WhatsApp share** (`src/components/quotes/QuoteDocumentScreen.tsx`, reached from "הצעות מחיר"/"הצעות שמורות"): `wa.me` link (`toWhatsAppDigits` in `src/lib/quotes/quote.ts`) targets the actual client's/contact's phone correctly.
- **Digital signature**: a simple visual signature-capture widget (`SignaturePad`, `src/components/shared/SignaturePad.tsx`, using `react-signature-canvas`), stored as an image. This is **not** a legally-binding e-signature flow — no timestamp/IP/consent-text/audit-trail is in scope unless a separate plan explicitly extends it.

There used to be a second, older quote flow here — a SaaS subscription-tier calculator ("מחשבון תמחור") for licensing this software itself to other businesses, not for pricing this business's own treatments/events. Removed entirely (not just hidden) once confirmed irrelevant to a single-business deployment: `src/components/pricing/` (whole directory), `src/hooks/{usePricingEngine,useQuoteDraft}.ts`, `src/lib/quoteDraft.ts`. `SignaturePad` was the one file genuinely shared with the quotes module below — moved to `src/components/shared/` rather than deleted. **Known side effect, not yet resolved**: Calendar-event-on-approval (`create-calendar-event`, see "Google Calendar setup") was only ever triggered from that flow's `handleApprove` — it now has no caller anywhere in `src/`. The Edge Function/secrets are still live and confirmed working (see that section), but nothing in the app currently invokes it. Wiring it into the quotes module (e.g. on signing a `private_event`/`company_event` quote) needs a real design decision first — `eventHoursText` is free text, not a structured start/end time the Edge Function's `start`/`end` params need — flagged for the project owner rather than guessed at.

## Quote module (clinic treatment / private event / company event)

`src/components/quotes/` — the app's quote flow, reached via the "הצעות מחיר" (new) and "הצעות שמורות" (saved/manage) sidebar items, both rendering `QuotesModule` (`initialScreen` prop picks chooser vs. list — same internal-substate pattern `ClientsList` uses for `ClientProfile`; an `initialBuilder` prop can also skip straight to a new quote of a given type with one line item pre-filled, used by Event Library's "צור הצעת מחיר מחבילה" — see below).
- **No pricing engine, with one narrow, deliberate exception**: `unit_price` on a real stored `quote_line_items` row is always a plain, optionally-empty number the user enters — never computed, never defaulted to 0. The one exception is calc-linked event quotes (see "Events Calculator → Quotes" below): those never store a priced line item at all, and their total is computed live from `quote.ts`'s `calcSeededBasePrice`/`effectiveLineItems` — not a new general pricing engine, just the calculator's own already-trusted `grossRevenue` formula (therapists × hours × rate) applied live off the quote's own fields instead of frozen once at seed time. Treatment/duration/purchase-type options are hardcoded constants (`src/lib/quotes/treatmentOptions.ts`), not a DB-backed catalog, by explicit design choice — don't add a catalog admin screen without being asked again.
- **Tables**: `quotes` + `quote_line_items` (see `supabase/migrations/20260809100000_quotes.sql`). RLS is enabled with one permissive `anon`-access policy on both — documented in the migration as a conscious tradeoff for a no-auth internal tool, not an oversight.
- **Auto-cleanup**: a `pg_cron` job (`cleanup-stale-quotes`, daily 03:00) deletes `draft`/`rejected` quotes older than 30 days; `quote_line_items` cascades via FK.
- **Quote PDF archival**: `src/lib/storage/archiveQuotePdf.tsx` + `supabase/functions/archive-quote-pdf/` — uploads the signed quote's PDF to a private Supabase Storage bucket. Confirmed working end-to-end (real test upload + DB write-back verified directly against the deployed function and `storage.objects`). See "Quote PDF archival (Supabase Storage)" below for why this replaced an earlier Google Drive design.
- **Client autocomplete** (`src/components/quotes/ClientAutocompleteField.tsx`, used on the שם הלקוח/טלפון/כתובת מייל fields in `QuoteDocumentScreen.tsx`): a Popover+Command combobox (the same primitives already backing the ⌘K palette, so RTL/dark-theme styling is inherited automatically, not re-implemented) suggesting clients as the user types, selecting one fills all three fields. Data source is `src/lib/quotes/clientDirectory.ts`'s `listClientDirectory()` — distinct `(client_name, client_phone, client_email)` triples pulled from the `quotes` table itself (most-recently-updated first, deduplicated client-side), **not** a `clients` table, since none is persisted (see "Domain model" below — Clients is still local-state-only). Fetched via a plain `useEffect`/`useState` hook (`src/hooks/useClientDirectory.ts`), refetched after every save so a brand-new or edited client is immediately selectable — **deliberately not built on `@tanstack/react-query`'s `useQuery`/`useQueryClient`**, even though the package is a dependency and its `QueryClientProvider` is wired up in `App.tsx`: that Provider had never actually been exercised by any component before this feature, and doing so crashed on first real use (`Cannot read properties of null (reading 'useState')`, a hooks-order violation) in this exact React 19.2.8 + `@tanstack/react-query` 5.101.4 combination — confirmed via an isolated repro, not assumed. If react-query is ever genuinely needed again, re-verify that combination in isolation before relying on it further.
- **Public client-signing page** (`src/pages/SignQuote.tsx`, route `/sign/:quoteId`) — the first genuinely public-facing surface in this app: a link handed to an external client (via the WhatsApp/email buttons in `QuoteDocumentScreen.tsx`, which now append `${origin}/sign/${quote.id}` to their message bodies), opened with no login, rendering only the quote + a `SignaturePad` + an approve button, no CRM chrome. **Deliberately does not use `quoteApi.ts`'s direct `supabase.from('quotes')` calls** the way the internal app does — the broad `for all using (true)` RLS policy above is an accepted tradeoff for an internal, staff-only surface, not for one reachable by anyone a client forwards their link to (or opens devtools on). Instead it goes through two narrow, service-role Edge Functions (`get-public-quote`, `sign-quote` — same deployed-via-Supabase-MCP pattern as `archive-quote-pdf`/`create-calendar-event`) via `src/lib/quotes/publicQuoteApi.ts`: one can only ever return a single quote by ID, the other can only ever set `client_signature_data_url`+`status='signed'` on that one row (409s if already signed), and, in the background, syncs the event to Google Calendar (see "Google Calendar setup" below). On successful sign, the client also calls `archiveQuotePdf(signed, { notify: true })` exactly as the internal flow does but with notification enabled — that call is what actually fires the `RESEND_API_KEY`-backed business notification email (see "Signing notification email" below, not part of `sign-quote` itself). Hosting is Lovable — see "Deployment (Lovable)" below for what that host actually needs.
- **Clickable client signature block** (`src/components/pdf/components/PdfSignatures.tsx`): when a quote isn't signed yet and a `signingUrl` is passed to `QuoteDocument`, the "חתימת לקוח" signature block itself is a real `@react-pdf/renderer` `Link` annotation (`textDecoration: 'none'` overriding the default anchor styling, so it still reads as a plain signature line) pointing to the existing `${origin}/sign/${quote.id}` page — no separate signing-system/URL, same route as everywhere else. Once signed, it reverts to a plain block showing the actual signature image; a signed quote is never clickable again. This replaced an earlier design (`PdfSigningLink.tsx`, deleted) that showed the raw signing URL as visible plain text in the PDF.
- **PDF action links — clinic quotes only** (`src/components/pdf/components/PdfActionLinks.tsx`): two small clickable pills at the page bottom, right side — "מידע נוסף" (`BUSINESS_PROFILE.websiteUrl`) and "קביעת תור" (`BUSINESS_PROFILE.bookingUrl`), positioned directly under the "חתימת לקוח" signature block via `alignSelf: 'flex-end'` (the mirror-opposite of `PdfTotals.tsx`'s `totalsBox`, which uses `flex-start` for its own unrelated left placement). Uses `@react-pdf/renderer`'s `Link` component — the same primitive `PdfSignatures.tsx`'s client signature block uses for its own click-through to `/sign/:id` (see "Quote module" below; there used to be a separate `PdfSigningLink.tsx` showing the raw signing URL as plain text — deleted, superseded by that clickable signature block). Gated by `isClinic` in `QuoteDocument.tsx`; event-type quotes never render it, since their page budget has essentially zero spare margin already (see the `PdfItemsTable` comment just above). Both URL fields are nullable on `BUSINESS_PROFILE` and the component renders nothing if both are unset, matching this project's "build inert until configured" pattern elsewhere (Turnstile, Google Calendar secrets) — though both are in fact set now (`https://harmonyhealing.co.il/` / `https://form.harmonyhealing.co.il/`). **Verified via real generated PDF**: a realistic 2-treatment clinic quote stays at 1 page with the links added; a synthetic 8-treatment stress-test quote was confirmed to already be 2 pages *before* this feature too (isolated test with the component removed reproduced the identical 2-page result) — so long clinic quotes overflowing is a pre-existing characteristic of `PdfItemsTable` with many rows, not something this feature causes.

## Domain model: Event Library vs. Calendar

These are two deliberately distinct data models, not the same thing under two tabs:
- **Event Library** (`src/lib/eventCatalog.ts`, `EventsLibrary.tsx`) — the **product/package catalog**: sellable templates (pricing template via `nicheId`, referencing `NicheSelector.tsx`'s niches as the single source of truth for rate/comm/wage — don't duplicate those numbers here), therapist capacity range, duration model, equipment specs.
- **Calendar** (`src/lib/scheduling.ts`, `EventsCalendar.tsx`) — the **time & resource scheduling engine**: specific booked instances (date/time, assigned therapists, location, status), optionally referencing a package via `packageId`. Rendered with `react-big-calendar`. This `packageId` field is still unused scaffolding — `EventsCalendar.tsx`'s booking dialogs don't read/write it.
- **Both are now real, persisted Supabase tables** (`event_packages`, `bookings` — migration `add_packages_bookings_and_tighten_auth`), no longer local-only state. `EventsLibrary.tsx`/`EventsCalendar.tsx` themselves were **not rewritten** — both still just consume a plain `packages`/`setPackages` (and `bookings`/`setBookings`) pair shaped exactly like `useState` returns. The persistence lives one layer up, in `src/hooks/usePersistedPackages.ts`/`usePersistedBookings.ts`: local state stays the fast, optimistic render source, and the `setPackages`/`setBookings` function diffs old vs. new array by id in the background and pushes the resulting insert/update/delete to Supabase. Both hooks also subscribe to Supabase Realtime (`postgres_changes` on their table) and refetch on any change — including ones made from a different tab/session — so `DashboardOverview`'s counts and the Calendar/Library screens themselves genuinely stay in sync live, not just on next page load. `src/lib/eventCatalog.ts`/`src/lib/scheduling.ts` gained the actual Supabase CRUD functions (`listPackages`/`upsertPackage`/`deletePackage`, `listBookings`/`upsertBooking`/`deleteBooking`) backing those hooks — every row is still Zod-parsed via the existing schemas before it reaches React state, same discipline as `quoteApi.ts`.
- **A signed quote now also creates a real internal-calendar booking**, closing the gap noted below (Calendar-event-on-approval used to have no caller): `supabase/functions/sign-quote/index.ts`'s `createBookingForSignedQuote()` fires in its own independent `EdgeRuntime.waitUntil()`, alongside (never blocking, never blocked by) `syncQuoteToCalendar()` — a failure in one can't affect the other. Same trigger gate as the Calendar sync (`private_event`/`company_event` + full `eventDate`+`eventStartTime`+`eventEndTime`). Reuses the existing `bookings` model exactly as `scheduling.ts`'s `upsertBooking()` does — no new table, no new schema: `title` = `"<typeLabel> — <partyName>"`, `clientName` = the party name, `location: ''`, `therapistNames: []` (a quote only stores a therapist *count*, never real names — never fabricated), `status: 'confirmed'`, `source: 'internal'`. Because `EventsCalendar.tsx`/`DashboardOverview.tsx` already render straight off this table via `usePersistedBookings.ts`'s Realtime subscription, a booking created this way shows up in both the internal calendar and the Dashboard's "אירועים קרובים" tile with zero client-side code changes. **Idempotent by construction**: the booking's `id` is set to the quote's own `id` (both `uuid`, no FK or format assumption anywhere ties `bookings.id` to a particular generator — confirmed by reading `scheduling.ts`, `EventsCalendar.tsx`, and this table's migration before relying on it) and written via `upsert`, so a retried/duplicate call updates the same row instead of creating a second one — verified directly against Postgres (`insert ... on conflict (id) do update`) with a real retry. **Timezone**: `eventDate`+`eventStartTime`/`eventEndTime` are local `Asia/Jerusalem` wall-clock values but `bookings.start_time`/`end_time` are real `timestamptz` — `israelLocalToUtc()` (own small helper in `sign-quote/index.ts`, not shared with `googleCalendar.ts`'s different needs) computes the correct UTC instant via `Intl.DateTimeFormat`-derived offset, verified correct across both a summer (UTC+3) and winter (UTC+2) date, and against a real signed quote (18:00–21:00 Israel round-tripped exactly). An end time not after the start time on the same calendar day (e.g. an event crossing midnight — not modeled anywhere in this app yet, same as `quote.ts`'s `eventDurationHours()`) is skipped with a log line rather than guessed at.
- **Required a real, one-time Supabase permissions fix**: the original `add_packages_bookings_and_tighten_auth` migration granted `select`/`insert`/`update`/`delete` on `bookings` (and `event_packages`) to `authenticated` only, never to `service_role` — fine until `sign-quote`'s Edge Function (service-role, no user session) needed to write a booking row. Confirmed the exact failure via real function logs (`permission denied for table bookings`) before touching anything — `service_role` already bypasses RLS, but table-level `GRANT`s are a separate mechanism and simply weren't given for this table (`quotes` has this grant, `bookings`/`event_packages` didn't). Fixed by `supabase/migrations/20260820160500_grant_service_role_bookings_access.sql` (`grant select, insert, update, delete on public.bookings to service_role`) — `event_packages` left untouched, since nothing server-side writes to it.
- **Event Library → Quotes** (the one real outbound connection from the Library, added after confirming it was otherwise a dead-end catalog): each package card's "צור הצעת מחיר מחבילה" button calls `Home.tsx`'s `packageToQuoteSeed()`, which opens `QuotesModule` straight into a new quote via its `initialBuilder` prop, with one line item pre-filled from the package (never a 0 price — that's still always left for the user to enter). Every package maps to `private_event` (`nicheId: 'b2c'`) or `company_event` (everything else) — **never** `clinic_treatment`, and the seed only ever sets the line item's free-text `description`, never `treatmentName`/`durationMinutes`. Confirmed by testing: every package models event-shaped logistics (therapist range, duration in hours) that don't match `clinic_treatment`'s fixed catalogs (`TREATMENT_OPTIONS`, the 45/60/75/90 duration set) — even the `clinic`-niche seed package ("הקמת קליניקה") is a setup/partnership engagement, not a walk-in treatment, so seeding it into those fixed dropdowns left them silently unselected rather than actually matching. This is separate from, and doesn't touch, the Calendar's `packageId` field above.
- **Events Calculator → Quotes** (`DashboardPanel.tsx`'s "הכן הצעת מחיר" button, next to the export menu): opens `QuotesModule` via `Home.tsx`'s `calcToQuoteSeed()`, but — unlike Event Library's `packageToQuoteSeed()` — **seeds no line item at all**, deliberately, per explicit user request this session (a pre-filled "row 1" was confusing and, combined with `PdfIncludedServices`, was what pushed the calculator-originated PDF to two pages before that was fixed separately). quoteType follows the same `niche === 'b2c' ? private_event : company_event` rule. `seedFields` carries `eventTherapistCount`/`eventParticipantsCount`/`eventHourlyRate`/`eventExpectedHours` (the calculator's `hours` at seed time) onto the quote.
  - **Live-computed price, not a frozen snapshot**: `quote.ts`'s `calcSeededBasePrice(quote)` returns `eventTherapistCount × hours × eventHourlyRate` — exactly `calculateEvent()`'s `grossRevenue` formula — computed fresh every time a calc-linked quote's total is needed (builder screen, PDF, sign page, dashboard revenue stat), via `effectiveLineItems(quote)` (prepends a synthetic priced row ahead of any real, manually-added rows; use this everywhere instead of `quote.lineItems` directly for money math). `hours` is `eventDurationHours(quote)` (the actual `eventStartTime`/`eventEndTime` duration) when both times are set, falling back to the frozen `eventExpectedHours` calculator estimate otherwise — so editing therapist count/hourly rate/event time on the builder screen (already possible) updates the total immediately, with genuinely no manual re-entry needed. A quote is "calc-linked" purely by `eventExpectedHours !== null` — never set by any other seed path or a manually created quote.
  - **Hard, deliberate boundary, unchanged**: only those four fields (rendered in "פרטי האירוע/הצעת המחיר" via the same safe `{label, value}` sibling-Text pattern) are carried onto the quote — the calculator's internal-only figures (therapist wage, travel distance, venue commission, income guarantee) are **never** read by `calcToQuoteSeed()` and never reach a quote. This isn't just a display boundary: verified directly in `calcEngine.ts`'s `calculateEvent()` that `grossRevenue` (the client price) mathematically never depends on those fields either — they only ever affect the business's own internal payroll/margin — so there is nothing to "sync" there even in principle. `CalcEventSummary.tsx` (the shared summary block behind both of the calculator's own PDF exports) shows the identical four fields — מספר מטפלים / שעות פעילות / כמות משתתפים כוללת / תעריף שעתי — so what a client sees from the calculator's own "PDF ללקוח" export and what a client sees on a quote built from that same calculation stay consistent.
  - **Line-item table hidden entirely from the client-facing PDF and sign page for event-type quotes** (`private_event`/`company_event`) — `QuoteDocument.tsx`/`SignQuote.tsx` only render it for `clinic_treatment`. The pricing rationale is fully covered by "פרטי האירוע/הצעת המחיר" and the actual total; a table repeating one unlabeled row was pure redundancy. The builder screen's own "פירוט הצעת מחיר" section stays visible for every quote type (with an explanatory empty-state message for a calc-linked quote with zero manual rows) so a real extra ad-hoc charge can still be added on top when genuinely needed.
  - **Event date is required** before save/export for `private_event`/`company_event` (`validateEventDate()` in `QuoteDocumentScreen.tsx`) — no "not yet scheduled" quote allowed, unlike start/end time (which stays optional; a date-only quote just doesn't fire Calendar sync on signing).
  - **Event start/end time is a half-hour-increment `Select`, not a free-typed native time input** (`HALF_HOUR_TIME_OPTIONS`, 48 slots `00:00`..`23:30`, in `QuoteDocumentScreen.tsx`) — an arbitrary-minute range (e.g. 10:37–12:22) reads as a typo, not a real schedule. An existing quote's odd-minute value (saved before this restriction existed) still displays correctly via `timeSelectOptions()`'s fallback; picking any other option replaces it.
  - **Date display format**: `formatDateHe()` (`quote.ts`) renders `DD/MM/YYYY`, not the raw stored `YYYY-MM-DD` — a right-aligned plain-digit ISO string visually put the day first (nearest the right edge) and the year last, backwards from Israeli reading order; confirmed against a real generated PDF. Used in `QuoteDocument.tsx` and `SignQuote.tsx`; the builder's native `<input type="date">` is unaffected (browser-controlled).
  - **Money formatting, app-wide**: every `formatMoney`/`formatILS` in the app puts the ₪ symbol immediately before the digits with no space (`₪250`, not `250 ₪`) — a right-aligned `"250 ₪"` string put the symbol far from the number with a visible gap in this renderer's bidi handling, confirmed against a real generated PDF. Applies to `PdfTotals.tsx`, `PdfItemsTable.tsx`, `CalcInternalDocument.tsx`, `CalcEventSummary.tsx`, `SignQuote.tsx`, `DashboardOverview.tsx`, `QuoteDocumentScreen.tsx`, `QuoteLineItemRow.tsx`, and `calcEngine.ts`'s `formatILS` — one convention, everywhere a money amount is rendered.

## Dashboard (live, real data)

`src/components/dashboard/DashboardOverview.tsx`'s four KPI tiles are all real now — "הצעות מחיר פתוחות" and "הכנסות החודש" used to be permanent `"—"` placeholders (no data layer existed for them); `src/lib/quotes/quoteStats.ts` + `src/hooks/useQuoteStats.ts` now compute them from the real `quotes` table (open = `draft`/`sent` count; monthly revenue = sum of `quoteGrandTotal` — before VAT — for `signed` quotes updated in the current calendar month) and subscribe to Realtime on `quotes`, so the tiles update live on any insert/update/delete, from any tab/session, without a manual refresh. "אירועים קרובים"/"חבילות פעילות" were already reading real props from `Home.tsx`; those props are now backed by the real `bookings`/`event_packages` tables too (see "Domain model" above), so the whole dashboard is live end-to-end. `quoteStats === null` only during the very first fetch still renders `"—"` (never a fabricated `"0"`), preserving the original "no data yet" vs. "genuinely zero" distinction — it's just no longer a permanent state.

## Authentication

A single, fixed internal login — **no signup, no OAuth, by explicit design**, not an interim state pending a "real" auth system. The business owner asked for exactly one user (display username "Roman") and nothing more.

- **The account**: a real Supabase Auth user (`auth.users`), provisioned directly via SQL (`crypt()`/`gen_salt('bf')` + a matching `auth.identities` row — the standard Supabase-documented pattern for seeding a user outside the normal signup flow) rather than the Admin REST API, since no service-role key is available in this session (same secrets-handling boundary as `GOOGLE_SERVICE_ACCOUNT_KEY` etc.). The account's real email is an internal, non-deliverable placeholder (`roman@harmonybid.internal`) — Supabase Auth requires an email identity even for a password-only flow — but the login screen never shows or accepts this email, only the display username "Roman", mapped to it client-side in `src/lib/auth/auth.ts`. A typed username that doesn't match "Roman" (case-insensitive) is rejected locally before ever reaching Supabase, and the error message ("שם משתמש או סיסמה שגויים") never reveals which field was wrong.
- **The gate**: `src/pages/Login.tsx` (form) + `src/hooks/useAuthSession.ts` (tracks the Supabase session via `getSession()`/`onAuthStateChange`) + `App.tsx`'s `RequireAuth` wrapper around the `/` route only. **`/sign/:quoteId` is deliberately outside the gate** — the public client-signing page has never had, and still doesn't have, any account system; it's a completely separate route.
- **Sign-out**: the header's account icon button (`dashboard-layout.tsx`, previously non-functional — see earlier UX research findings this project) is now wired via a new optional `onSignOut` prop, threaded from `Home.tsx`'s `signOut()` call.
- **RLS tightened accordingly**: `quotes`/`quote_line_items`/`quote_number_counters`'s original `for all using (true)` policy — explicitly documented at the time as a tradeoff for a "no-auth internal tool" — no longer holds now that a real login exists. All three, plus the new `event_packages`/`bookings` tables, now use `to authenticated using (true) with check (true)` policies, with `anon` grants revoked on the quotes tables. This does **not** affect the public signing flow: `get-public-quote`/`sign-quote` always used the service-role key directly, which bypasses RLS/grants entirely regardless of this change.
- **Lovable-ready with zero new env vars**: `supabase-js`'s auth flow runs entirely client-side against the same `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` already required for everything else — nothing server-only was introduced, nothing new needs configuring on deploy.
- **Not built, deliberately out of scope unless asked again**: password reset/forgot-password flow, session-expiry UX beyond Supabase's default token refresh, multi-user/roles of any kind.

## Google Calendar setup

**A Google Cloud service account** — this replaced an earlier per-user OAuth design (no more "Connect Google Calendar" button, no more `google_calendar_tokens` table; both were removed, not just deprecated). A service account fits this app's actual shape: one business, one calendar — there was never a real multi-user "each person connects their own calendar" need. (This account was originally provisioned to cover Drive archival too — see "Quote PDF archival" below for why that part was dropped; the account and its JWT helper remain, scoped to Calendar only now.)

- **Auth helper**: `supabase/functions/_shared/googleServiceAccount.ts` — mints a short-lived Google access token from the service account's JSON key via an RS256-signed JWT (RFC 7523 JWT Bearer grant), scoped to `.../auth/calendar.events`.
- **Shared event-creation logic**: `supabase/functions/_shared/googleCalendar.ts` (`createCalendarEvent`) — the actual Calendar API POST, fixed to `Asia/Jerusalem` via the API's own `timeZone` field (not a computed UTC offset, so DST is Google's problem, not ours). Two callers: the standalone `create-calendar-event` Edge Function (still directly invokable), and `sign-quote` (calls it in-process, no HTTP hop).
- **Trigger point: quote signing.** `sign-quote/index.ts`'s `syncQuoteToCalendar()` fires automatically — `EdgeRuntime.waitUntil`, same non-blocking treatment as the email notification — whenever a `private_event`/`company_event` quote is signed **and** has a full `eventDate` + `eventStartTime` + `eventEndTime` set (see "Quote module" below for the structured-time fields this depends on). `clinic_treatment` quotes never trigger this — that quote type has no event date/time concept at all (a walk-in treatment, not a scheduled event). A quote missing any piece of the date/time just logs and skips — not an error, just "nothing to sync yet."

**Setup steps** (already completed for this project — kept here for reference/re-setup):
1. **Google Cloud** (done once, external to this repo): create a service account, enable the Calendar API, then share the target Google Calendar with the service account's `client_email`, **"Make changes to events"** access. This is normally the calendar owner's own primary calendar — sharing it exposes it under the owner's Google account email, which becomes the value for `GOOGLE_CALENDAR_ID` below (not the literal string `"primary"` — that resolves to the *service account's own* empty calendar, not the human's).
2. **Supabase secrets** — `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_CALENDAR_ID`. **No MCP tool in this project's Supabase server sets secrets** (confirmed absent from its tool list) and the Supabase CLI isn't installed in this dev environment either — the established path is the **Supabase Dashboard's own Edge Functions → Secrets Management page**, which never routes the credential through an agent session at all. The Management API's secrets endpoint with a Personal Access Token is a fallback only if the owner wants an agent to do it for them.

**Current live status: confirmed working end-to-end, including the signing trigger.** A real `private_event` quote (full date/time set) was created and signed through the actual app — `sign-quote` returned `200` and the quote's `status` flipped to `signed`, confirming the request path that also fires `syncQuoteToCalendar()` in the background. That background call can't be observed directly (Supabase's `edge-function` log service only surfaces HTTP request/response lines, not a function's internal `console.log` output), so it was independently re-verified: a direct call to the identical shared `createCalendarEvent()` logic, with this same quote's real client/date/time data, returned a real `eventId`/`htmlLink` — proving the exact code path `sign-quote` calls is fully functional. **Caveat, be aware**: because this re-verification used the same real Calendar API (not a mock), it created a second, separate calendar event alongside whatever `sign-quote`'s own background call produced — check the shared calendar for a duplicate under "אירוע פרטי — בדיקת סנכרון יומן" around 2026-09-20 10:00–13:00 and delete the extra one.

**Security rule, non-negotiable**: the service account's private key must never appear in client-side code, a `VITE_`-prefixed env var, or any response an Edge Function sends back to the browser — it lives only in the `GOOGLE_SERVICE_ACCOUNT_KEY` Supabase secret. Only the Calendar ID (an identifier, not a secret) is safe as a plain constant/env value.

## Quote PDF archival (Supabase Storage)

`src/lib/storage/archiveQuotePdf.tsx` + `supabase/functions/archive-quote-pdf/`: once a quote is saved with a client signature, the client renders the same PDF `QuotesPdfDocument` produces (one source of truth for layout — the Edge Function does *not* re-implement react-pdf in Deno) and sends the bytes to the function, which uploads them to a **private** Supabase Storage bucket (`quote-pdfs`, `public: false` — no anon/authenticated read policy at all, only the function's service-role key ever touches it, since nothing in the app currently needs to read an archived PDF back) and writes the object path back onto the quote's `storage_path` column.

**Originally built against Google Drive instead** (`archive-quote-to-drive`, same service account as Calendar) — replaced after a live test proved a real, unfixable-without-cost Google limitation: a bare service account has **no storage quota** and cannot own files in a regular ("My Drive") folder, only in a **Shared Drive**, which requires a paid Google Workspace plan. The failure was a genuine `403 storageQuotaExceeded` from the Drive API after `GOOGLE_SERVICE_ACCOUNT_KEY` was correctly set and auth succeeded — not a config gap. Supabase Storage needs **no external credential or setup at all**: the bucket was created via `supabase/migrations/20260811183816_quote_pdf_storage.sql`, and `service_role` bypasses `storage.objects` RLS the same way it does every other table in this project.

**Current live status: confirmed working end-to-end.** A real test call to `archive-quote-pdf` returned `200`, and the file's presence was independently verified via a direct `select` against `storage.objects` and the `quotes.storage_path` write-back.

If a "download the archived PDF" feature is ever wanted, it needs a signed URL generated server-side (e.g. `serviceClient.storage.from('quote-pdfs').createSignedUrl(path, expiresIn)`, likely as a new narrow Edge Function following the `get-public-quote`/`sign-quote` pattern) — the bucket's `public: false` is deliberate, don't flip it to `true` as a shortcut.

## Signing notification email

Lives in `supabase/functions/archive-quote-pdf/index.ts` (`notifyBusinessOfSignature`) — **not** `sign-quote`, despite that function's name suggesting otherwise. It moved here early on because this is the first point in the flow where the PDF is actually archived, but was never updated in this file until a real signed quote's email was checked and found to say "₪0" (see below). Sends the business (`healingthroughmovementandmusic@gmail.com`, hardcoded there — kept in sync manually with `BUSINESS_PROFILE.email` in `src/lib/business/businessProfile.ts`, since Edge Functions can't import from `src/`) a notification via the [Resend](https://resend.com) API, dispatched through `EdgeRuntime.waitUntil(...)` so it never blocks or fails the archive response. Gated behind `notify: true`, which only `SignQuote.tsx`'s public-signing call to `archiveQuotePdf()` passes — `QuoteDocumentScreen.tsx`'s internal re-save archival never does, so staff editing an already-signed quote doesn't re-trigger it. Requires the `RESEND_API_KEY` Supabase secret (same Dashboard → Secrets Management path as the Google key above). Missing the secret only logs an error and skips the send; it does not break archival.

**Confirmed live end-to-end** (a real client signature on a real quote, checked against the actual inbox — not just a 200 response): the email arrives, but **landed in Spam** — the sender is Resend's shared sandbox address `onboarding@resend.dev`, which has no DKIM/domain alignment with the recipient's Gmail; expected to resolve once a real verified sending domain is connected to Resend.

**Two real bugs found and fixed via that same real-inbox check, both only in `archive-quote-pdf/index.ts`:**
1. **Total showed ₪0 for any calc-linked event quote** (an event quote seeded from the Events Calculator, priced live via therapists × hours × hourlyRate — see "Events Calculator → Quotes" below — which never has a real stored `quote_line_items` row). `notifyBusinessOfSignature` summed only `quote_line_items`, which is empty for these quotes. Fixed by duplicating `quote.ts`'s `calcSeededBasePrice` logic locally in the Edge Function (Edge Functions can't import from `src/`, same reason `VAT_RATE_PCT`/`QUOTE_TYPE_LABELS` are already duplicated there) and prepending the live-computed base price before summing, matching `effectiveLineItems(quote)`'s behavior client-side. Verified against the real quote's real numbers (2 therapists × 4h × ₪558/h = ₪4,464 subtotal, ₪5,268 with VAT) with an isolated arithmetic check before deploying.
2. **Email body showed the raw signed Storage URL as visible text**, a long unreadable string with no real value to an internal recipient who already has app access — removed per explicit request. The `createSignedUrl` call that built it (and its `SIGNED_URL_TTL_SECONDS` constant) was removed too, since nothing else used it. The email now just says to open "הצעות שמורות" in the app.

## Signing page load performance

`/sign/:quoteId` used to ship as part of the same single ~3.1MB (~978KB gzip) JS bundle as the entire rest of the app — a client with a cold cache had to download the whole internal CRM (dashboard, calculator, calendar, PDF export libraries) just to see a one-page signing screen. Two fixes, both pure loading-order changes, no logic touched:
- **`src/App.tsx`**: every route (`Home`, `SignQuote`, `PdfPreview`) is now `React.lazy()`-loaded, wrapped in one `<Suspense fallback={<RouteFallback />}>` around `<Routes>`. `Login`/`PageNotFound` stay static imports — both are small and `Login` is needed immediately for any unauthenticated visit to `/`.
- **`src/pages/SignQuote.tsx`**: the top-level `import { archiveQuotePdf } from '@/lib/storage/archiveQuotePdf'` (which pulls in `@react-pdf/renderer` and every `Pdf*` component — not needed to render the page, only after a client actually signs) became a dynamic `import(...)` inside `handleSign`, called only once a signature has actually been submitted.
- **Measured, not assumed**: confirmed via the production `vite build` output that `SignQuote-*.js` dropped to **9.03 kB** (gzip 3.17 kB) as its own chunk, with `QuoteDocument-*.js` (1.4MB) and `Home-*.js` (1MB) split out separately and only fetched when actually needed — then confirmed again live, via the dev server's own network request log, that visiting `/sign/:quoteId` genuinely does not fetch `archiveQuotePdf.tsx`/`QuoteDocument.tsx`/any `Pdf*` component until the sign button is actually clicked.

## Cloudflare Turnstile

Bot-protection for the public `/sign/:quoteId` page — that route currently has no protection beyond an unguessable UUID (no auth, no rate limiting). Built **inert-but-ready**, same pattern as Google Calendar/Drive/Resend: code is fully present but does nothing until configured.

- **Client side**: `src/components/shared/TurnstileWidget.tsx` — loads Cloudflare's `api.js` and renders the widget only if `VITE_TURNSTILE_SITE_KEY` (build-time env var) is set; renders nothing otherwise, and the signing page's submit button has no Turnstile requirement in that case. No npm dependency — a single widget instance is simplest via Cloudflare's own script + `window.turnstile.render()`.
- **Server side**: `supabase/functions/sign-quote/index.ts`'s `verifyTurnstile()` checks the `TURNSTILE_SECRET_KEY` Supabase secret; if unset, it logs and skips verification entirely (signing still works, unprotected — matches every other "not yet configured" integration in this project). If set, it POSTs the client's token to Cloudflare's `siteverify` endpoint and rejects the sign request (403) on failure.
- **Activation steps** (not yet done — needs the project owner):
  1. Connect a real domain to Cloudflare, create a Turnstile widget for it, get a site key + secret key.
  2. Site key → Lovable's build-time env vars (same place `VITE_SUPABASE_ANON_KEY` already goes) as `VITE_TURNSTILE_SITE_KEY`. Since the code already reads this var, deploying with it set is the only client-side step needed — no further code change.
  3. Secret key → Supabase Dashboard's Edge Functions → Secrets Management page as `TURNSTILE_SECRET_KEY` (never a `VITE_`-prefixed var — same rule as the Google service-account key).
- **Not yet verified end-to-end** (can't be, in this environment — a real site key requires the owner's own Cloudflare account/domain): the widget-render and server-verify code paths are written and typecheck-clean, but no real Turnstile challenge has actually been completed and rejected/accepted against this code yet.

## Supabase project

This app is linked to a real Supabase project (`nhjeemsbykifgfpcwcnc`) — `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set in `.env.local` (git-ignored). Prefer the `supabase` MCP server (see "Intelligent Capability Selection" above) for migrations, Edge Function deploys, and DB inspection now that it's connected — `apply_migration`, `deploy_edge_function`, `list_tables`, `get_logs`, `get_advisors`. Secrets management (`GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_CALENDAR_ID`, `RESEND_API_KEY`) has no MCP tool and no local Supabase CLI (confirmed: not installed in this environment) — the established path is the project owner setting them directly via the Supabase Dashboard's Edge Functions → Secrets Management page, which never routes the credential through this session at all; the Management API + a Personal Access Token remains a fallback only if the owner wants an agent to do it for them. Any such PAT is a session-only credential, never written to a file in this repo.

## Deployment (Lovable)

This app's backend (Postgres, Edge Functions, secrets) lives entirely in Supabase — **none of it is Lovable-specific or needs re-configuring per host**. Deploying/redeploying via Lovable only needs to get two things right:

1. **Build-time env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — set in Lovable's own project environment-variables settings, same two public values already in `.env.local` locally (the anon/publishable key is safe to expose client-side by design; nothing sensitive crosses this boundary). No Google or Resend values ever belong here — those are Supabase secrets only, consumed server-side by Edge Functions regardless of where the frontend is hosted.
2. **SPA client-side routing fallback** — `/sign/:quoteId` (and any other React-Router path) must resolve to `index.html` on a cold load, not 404, or an external client's signing link breaks. Lovable's publish pipeline is expected to handle this automatically for a Vite/React-Router app; **this has not been independently verified against a real Lovable deployment** in this session — worth a real test (open a `/sign/:id` link with a fresh browser, not via in-app navigation) once first deployed.

Nothing about Calendar sync or PDF archival changes with the hosting move — both are pure Supabase Edge Function behavior (confirmed working, see their sections above), already tested directly against the deployed functions rather than through the app.

## Tooling

- Linting: `oxlint` (`npm run lint`). Type checking: `tsc -b --noEmit` (`npm run typecheck`). No test runner is configured yet.
- `scripts/quote-audit.mjs` statically checks the rules above (money math, validation, RTL invariant, conversion-feature presence) using `@babel/parser`/`@babel/traverse` for TSX-aware AST parsing (TypeScript 7's package no longer exposes the classic synchronous compiler API, so this project uses Babel for standalone AST scripts instead). Run it with `npm run audit`; see `scripts/audit-report.json` for the last run's structured findings. It only scans `src/` — `supabase/functions/` (Deno, not part of the Vite app) is out of scope for it, `tsc -b`, and the Vite build alike, since none of those tools' `include` globs reach outside `src/`.

## Intelligent Capability Selection

This section is the environment's actual capability inventory (audited from the filesystem/config, not assumed) and the rules for choosing among those capabilities automatically, without the user having to type `/skill-name` or name a tool explicitly. It complements — does not replace — "Available Capabilities Awareness" and "Phase 0.5: Capability Selection" above: those say *to* check capabilities before acting; this section says *what those capabilities concretely are* and *how to pick among them*.

**Audit provenance**: discovered by reading `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.mcp.json`, `.claude/mcp.json`, `.claude/settings.local.json`, the user-level `~/.claude/` config (`settings.json`, `plugins/installed_plugins.json`, `plugins/marketplaces/`), and the live tool list surfaced to the current session. Re-audit (don't assume this stays accurate forever) if `.claude/skills`, `.claude/agents`, `.mcp.json`, or installed plugins change.

### What's actually available

**Skills (invoked via the `Skill` tool, or automatically when clearly relevant)** — `.claude/skills/*/SKILL.md`, project-scoped:
- **Reliable / stack-relevant**: `ui-styling` and `ui-ux-pro-max` (shadcn/Radix/Tailwind UI work — directly matches this project's stack), `design`, `design-system`, `brand`, `slides` (visual design, tokens, presentations), `git`, `github`, `code-review`, `clean-code`, `debugging`, `refactoring`, `security-review`, `documentation`, `docker`, `cicd`, `devops` (generic engineering practice, framework-agnostic), `animation-vocabulary`, `apple-design`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `pick-ui-library`, `prototype`, `banner-design` (motion/UI-craft judgment, generic), `playwright-cli` (browser automation via CLI), the `21st-*` family (`21st-ai`, `21st-cli-use`, `21st-design-sync`, `21st-registry`, `21st-ui-build`, `21st-ui-explore`, `21st-ui-review` — 21st.dev component search/generation, pairs with the `21st` MCP server below).
- **⚠️ Stack-mismatched — do not follow their literal file/stack references**: `api-design`, `api-testing`, `testing`, `browser-testing`, `typescript-expert`, and likely others in this cluster were written for a *different* reference project (their frontmatter literally says `PriceSystem.Api`, `price-system-app`, Angular, ASP.NET Core, SQL Server — none of which exist in this repo; this app is React 19 + Vite + TypeScript + Tailwind + Supabase). Their general *methodology* (e.g. how to structure a test, how to design an endpoint) can still inform judgment, but never act on a concrete file path, project name, or framework claim from these skills without verifying it against this repo first — those specifics are stale/imported, not project state.
- **Project slash command**: `/quote-refactor` (`.claude/commands/quote-refactor.md`) — staged, checkpointed refactor of pricing/quote code against `scripts/quote-audit.mjs` findings and this file's rules. Manual invocation only (`/quote-refactor`), since it's a multi-stage workflow the user should knowingly kick off.
- **Built-in/global skills** (ship with Claude Code itself, not this repo): `dataviz`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`, `update-config`, `keybindings-help`, `simplify`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `run`, `init`, `review`, and the `anthropic-skills:*` family (`canvas-design`, `docx`, `pdf`, `pptx`, `xlsx`, `mcp-builder`, `skill-creator`, `skill-installer`, `consolidate-memory`, `explain-usage`, `morning`, `schedule`, `setup-cowork`). These are always available regardless of project.

**Agents (invoked via the `Agent` tool's `subagent_type`)** — `.claude/agents/*/SKILL.md`, project-scoped, all specialized frontend/visual-design agents: `design-taste-frontend` (+ `-v1`), `brandkit`, `gpt-taste`, `high-end-visual-design`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `industrial-brutalist-ui`, `minimalist-ui`, `redesign-existing-projects`, `stitch-design-taste`, `full-output-enforcement`. Plus the always-available built-ins: `Explore` (read-only codebase search), `Plan` (implementation planning), `general-purpose`, `statusline-setup`, `claude-code-guide`.

**MCP servers**:
- *Project-configured* (`.mcp.json` at repo root, `.claude/mcp.json`): `firecrawl` (web search/scrape/crawl/research), `21st` (component search + `get_component`/`generate` — **note**: CLAUDE.md's earlier design-research work in this project mandated free-tier tools only, i.e. avoid the paid `get_component` call unless the user asks), `playwright` (browser automation, overlaps with the in-pane Browser tools below — prefer the Browser pane tools for this project's own dev-server verification, reserve Playwright MCP for tasks that explicitly need it), `context7` (fetches current library/framework docs — use before answering API/config/version questions from memory, especially for anything that changes often; not a substitute for reading this repo's own code), `supabase` (direct project tools: `list_tables`, `execute_sql`, `apply_migration`, `deploy_edge_function`, `get_logs`, `get_advisors`, `list_edge_functions`, `get_edge_function`, branch management, `search_docs`, etc. — confirmed live and used successfully this session for both DB migrations and Edge Function deploys, superseding the earlier raw-Management-API-via-curl workaround documented in "Supabase project" below for anything this tool surface covers). **Known gap, confirmed by absence not assumption**: this Supabase MCP server exposes no secrets-management tool — `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_CALENDAR_ID`, and `RESEND_API_KEY` are all set via the Supabase Dashboard's Secrets Management page instead (see "Google Calendar setup" and "Signing notification email"), never via this MCP server or written to a file in this repo.
- *Global CLI tool, not an MCP server* (installed on the machine, invoked via `Bash`, not the `Skill`/MCP surface): `skillui` (npm global, confirmed via `command -v skillui` + `skillui --help`) — reverse-engineers a project or live site's design system into a `DESIGN.md` (+ optionally a packaged Claude skill) via pure static analysis (`--dir`/`--repo`/`--url`, no AI/API keys involved). Scoped narrowly to *design-token extraction from an existing surface*, not general "UI component generation" — for building new UI in this repo, the `21st-*` skills/MCP and `ui-styling`/`ui-ux-pro-max` skills above are the actual fit.
- **Not found in this session** (flag rather than silently document as active): a server named "Strix" was described as connected/active for "automated project tasks, system analysis, and execution capabilities," but no `mcp__strix__*` tools (or anything matching "strix") appear anywhere in this session's tool list — checked directly via `ToolSearch`, not assumed. Per this file's own "Preventing unnecessary or fabricated use" rule below, it is not documented here as available; if it's genuinely meant to be connected, the connection itself needs checking (session restart, auth, server name) before relying on it.
- *Platform/global* (not in any repo config — provided by the Claude Code environment itself): `Claude_Browser` (in-app preview browser — the correct tool for this project's `<when_to_verify>` dev-server checks), `claude-in-chrome` (real Chrome with the user's logged-in sessions — only when a task needs an actual signed-in session), `visualize` (render inline diagrams/dashboards/interactive widgets in chat), `scheduled-tasks` / `CronCreate` family (recurring automation), `terminal` (read a live terminal), Canva (design creation/export — tool prefix `mcp__475fa261-...`), an app-scaffolding/deployment platform (project/database/deploy management — tool prefix `mcp__8e6c23aa-...`; exact product identity isn't disclosed in the tool metadata, don't name-guess it), `mcp-registry` (discover/suggest other MCP connectors), plus internal session-management MCPs (`ccd_session`, `ccd_session_mgmt`, `ccd_directory`) that back this harness's own task/session chips — not something to "select" for user tasks, they're infrastructure.

**Plugins** (`~/.claude/plugins/installed_plugins.json` — only these two are actually installed, distinct from the much larger `claude-plugins-official` marketplace catalog which is merely *browsable*, not installed):
- `sales@knowledge-work-plugins` (user/global scope) — 9 skills: account-research, call-prep, call-summary, competitive-intelligence, create-an-asset, daily-briefing, draft-outreach, forecast, pipeline-review. Relevant only if the user does sales/CRM-style work (competitor pricing research, outreach drafting) — not part of this project's normal engineering flow, but available if asked.
- `21st@21st` — scoped to a *different* project directory (`Dina Project`), not this one. Its skills/MCP are still available here because they're separately present in this repo's own `.claude/skills/` and `.mcp.json` — but the plugin itself isn't "active for HarmonyBid."
- The `claude-plugins-official` marketplace (feature-dev, frontend-design, code-review, security-guidance, typescript-lsp, etc.) is known but **not installed** — not usable without the user explicitly installing one.

**Component library**: `src/components/ui/*` — this project's own shadcn/ui + Radix component set (already used throughout — `Dialog`, `Button`, `Table`, `Tabs`, `Drawer`, `Command`, etc.). Always check here first before adding a new UI primitive; see "Design System Rules" below.

**Templates**: no standalone template system exists in this environment. A few skills bundle their own starter files (`design-system`'s `templates/design-tokens-starter.json`, `brand`'s `templates/brand-guidelines-starter.md`) — treat those as skill-internal assets, not a general "pick a template" capability.

### Automatic selection rules

1. Before any non-trivial task, silently ask: what's the actual objective, and which of the capabilities above are *materially* relevant? Most tasks need zero or one Skill/Agent/MCP beyond ordinary tool use (Read/Edit/Bash/Browser) — do not reach for a Skill or Agent by default.
2. Never require the user to type `/skill-name`, "use the X agent," or "use the Y MCP" when the right choice is inferable from their request. Pick it yourself and proceed.
3. **Priority order** when several capabilities could apply: (1) this file's explicit project rules (money math, validation, RTL, etc. above) always win first; (2) a specialized Skill/Agent whose description is a precise match; (3) a relevant MCP server; (4) general reasoning/manual implementation. A more specific instruction inside a Skill/Agent/MCP's own definition overrides this general ordering for that capability's own scope.
4. Use the *smallest effective combination*. Don't chain a Skill + Agent + MCP when one alone solves the task.
5. For UI/frontend work in this repo specifically: check `src/components/ui/*` and existing patterns first (Design System Rules, already in this file) before reaching for `ui-styling`/`ui-ux-pro-max`/21st.dev search/a design Agent — those are for genuinely new patterns, not routine reuse.
6. For testing/API/framework-specific guidance from the stack-mismatched skill cluster (`api-design`, `api-testing`, `testing`, `browser-testing`, `typescript-expert`): use only the transferable methodology, verify every concrete claim (file paths, stack names) against this actual repo, never assume their examples apply as-is.
7. Prefer the `Claude_Browser` pane over the `playwright` MCP for this project's own dev-server verification (per `<preview_tools>`/`<verification_workflow>` already governing this session) — Playwright is for tasks that specifically need it (e.g. a CI-style scripted test), not routine "does my change render" checks.
8. Don't invoke the `sales` plugin, Canva, or the app-scaffolding MCP unless the user's request is actually about sales/CRM work, graphic design export, or app deployment/hosting respectively — they're globally available but off-topic for most of this project's engineering work.

### Preventing unnecessary or fabricated use

- Do not activate a Skill/Agent/MCP "because it exists" — only when it materially improves the result over doing the task directly.
- Never claim a Skill, Agent, Plugin, MCP, or Template was used unless it genuinely was (per this session's actual tool calls). Never invent a capability name that wasn't found in this audit.
- Never treat "a folder/file exists" as "usable" — a capability is only usable if it's actually surfaced to the current session (Skill/Agent listings, connected MCP tools, installed plugins per `installed_plugins.json`). The `claude-plugins-official` marketplace and the `21st` plugin's project-scoping to `Dina Project` are the concrete examples of "present but not active here" from this audit.

### Quality control after significant work

Match validation to what changed, don't run everything reflexively:
- Code change touching money/validation/RTL → re-run `npm run audit`, `npm run typecheck`, `npm run lint` (already this project's standing rule).
- UI change → browser verification via `Claude_Browser` per `<verification_workflow>` (already governs this session).
- Design/visual work → a quick self-check against Design System Rules (consistency, accessibility, responsive) rather than invoking a separate review Agent for routine changes; reserve `code-review`/`security-review` skills or a review Agent for larger or security-sensitive changes.

### Combinations found to be genuinely useful here

- `21st-ui-explore`/`21st-ui-build` Skill + `21st` MCP (`search`/`get_theme`/`generate`, free tier) — for exploring or building new UI patterns from real component references, already this session's precedent (design-research phase of this project).
- `design-system`/`brand` Skill + this project's own `src/index.css` tokens — extend the existing token system rather than introducing a parallel one.
- `Claude_Browser` MCP + `<verification_workflow>` — the standing pattern for this project's UI verification, already used throughout this session.
- `Explore` Agent + a multi-file/uncertain-scope question — already this session's pattern for codebase research before planning.

## Claude Code Operating System

### Mission

You are not only a coding assistant.

You operate as a complete product and engineering partner combining the roles of:
- Senior Product Manager
- UX Researcher
- Product Designer
- Solution Architect
- Senior Frontend Engineer
- Senior Backend Engineer
- Quality Engineer

Your goal is to make high quality product and engineering decisions before implementation.

Do not optimize only for writing code quickly.

Optimize for:
- Correct decisions
- Clear requirements
- Excellent user experience
- Maintainable architecture
- Reduced technical debt
- Efficient execution
- Production quality results

### Available Capabilities Awareness

Before solving problems, evaluate available project capabilities:
- Installed Skills
- MCP Servers
- Existing Agents
- Reusable Components
- Existing Templates
- Design Systems
- Project Documentation

Prefer using existing capabilities before creating new solutions from scratch.

Do not rebuild functionality that already exists inside the project.

### Phase 0: Repository Intelligence (Understand + Audit)

Before planning any significant change:

Analyze:
- Project structure
- Existing architecture
- Frameworks and dependencies
- Existing components
- Database structure
- Coding conventions
- Available tools and integrations

Understand the current system before proposing changes.

Reuse existing patterns whenever possible.

This is also the **audit** step: where the project has real audit tooling for the area being touched (e.g. `npm run audit` for money-math/validation/RTL, per Tooling above), run it and read the findings rather than eyeballing compliance. Where no static tool covers the area (e.g. an unfamiliar design-token setup, an external spec to map onto the codebase), audit it directly — read the real files, don't assume from memory or from what a similar project would look like.

### Phase 0.5: Capability Selection

Before designing a solution:

Review available:
- Skills
- MCP servers
- Agents
- Libraries
- Existing components
- Automation capabilities

Decide:
- Which capabilities should be used
- Why they are relevant
- Which capabilities should not be used

Prefer specialized tools over manual implementation when appropriate.

### Core Operating Rule

Before starting any significant implementation, understand:
- What problem are we solving?
- Who is the user?
- What outcome are we trying to achieve?
- What decisions are unclear?
- What assumptions are being made?
- What possible approaches exist?

Do not immediately start coding when planning is required.

### When To Activate This Workflow

Use this workflow for:
- New applications
- New features
- Major UI changes
- Workflow changes
- Database changes
- Architecture decisions
- Automation systems
- Technology choices
- Large refactors
- Product improvements

For:
- Small fixes
- Obvious bugs
- Minor styling changes
- Simple refactoring without behavior changes

Use normal implementation flow without unnecessary planning overhead.

### Phase 1: Create Visual Planning Artifact

Before major implementation, create a self contained HTML planning artifact.

Requirements:
- One page
- Easy to scan quickly
- No large walls of text
- Professional SaaS quality design
- Clear visual hierarchy
- Responsive layout

Use:
- Cards
- Sections
- Columns
- Diagrams
- Flowcharts
- Timelines

Use Tailwind CSS via CDN or clean embedded CSS when appropriate.

The artifact should include:

**Problem**
Explain the problem being solved.

**Proposed Solution**
Show the recommended direction visually.

**Open Decisions**
Place unresolved decisions at the top.

**User Flow**
Show how users interact with the solution.

**Technical Structure**
Show important technical components.

**Success Metrics**
Define how success will be measured.

**User Acceptance Criteria**
Define what must be true for users to consider the solution successful.

**Technical Acceptance Criteria**
Define technical requirements for completion.

**Risks**
Highlight possible problems.

**Next Actions**
Show the next steps.

Rules:
- Preserve all facts provided by the user
- Do not invent missing information
- Clearly separate facts from assumptions
- Ask targeted questions when critical information is missing

At the end include:
"What assumptions did I make while creating this plan?"

### Phase 2: Compare Solutions Before Choosing

When multiple reasonable approaches exist:

Create a visual comparison.

Compare:

**Option A**
Recommended approach.

**Option B**
Strongest alternative approach.

Do not create a weak alternative only to justify Option A.

Evaluate:
- User experience impact
- Development complexity
- Implementation time
- Cost
- Maintenance requirements
- Scalability
- Technical risks
- Security considerations
- Best fit scenario

At the bottom include:

**Recommendation**
The selected option and the strongest reason.

### Phase 3: Workflow Analysis

When the user describes an existing process:

Create a one page workflow map.

For each step show:
- Step name
- Description
- Tool used
- Responsible party: User / Team / Automation
- Estimated time
- Dependencies
- Waiting points
- Bottlenecks

After the map identify:
- The three steps with the highest effort and lowest value
- Possible improvements

### Phase 4: Assumption Validation

Before building large solutions:

Identify important assumptions.

Create an analysis containing:
- Assumption
- Why it exists
- Confidence level: High / Medium / Low
- Impact if wrong
- Cheapest validation method

Sort by: Highest cost of being wrong first.

The goal: Find expensive mistakes before development begins.

### Phase 5: User Edited Specifications & Approval Gate

When the user provides an edited version of a plan, artifact, specification, or workflow:

Treat the user's version as the new source of truth.

Rules:
- User changes override previous recommendations
- Do not restore removed elements
- Analyze what the changes imply
- Identify hidden consequences
- Rebuild according to updated requirements

For:
- New systems
- New features
- Architecture changes
- Database changes
- Major workflow changes
- Major UI redesigns

DO NOT start implementation without explicit user approval of the plan or specification artifact.

For:
- Small fixes
- Minor UI adjustments
- Bug fixes
- Refactoring without behavior changes

Proceed normally.

This is a **one-time gate before starting** a major initiative — it does not mean pausing for confirmation between the phases of an already-approved plan. Once a plan is approved, Phase 7 below governs how execution proceeds without re-asking at each step.

### Phase 6: Consistency Check

Before executing an approved plan — especially one with multiple phases or one built from several research passes — review the plan itself for internal problems, not just the code:
- Contradictions between stated scope/constraints and specific steps later in the plan (e.g. a "don't touch X" constraint followed by a step that edits X unconditionally).
- Redundant or conflicting instructions across sections.
- Steps that would affect areas outside the approved scope as a side effect (shared files/components used by more than the thing being changed are the most common source of this).

Resolve every contradiction found in favor of the more restrictive/explicit constraint, using a technique that makes the fix *structurally* safe rather than "probably fine" (e.g. a scoped/conditional change instead of an unconditional one) — don't just note the conflict and move on. Update the plan to reflect the resolution before executing it.

### Phase 7: Autonomous Execution & QA

**Before Coding:**
1. Understand requirements
2. Identify unknowns
3. Evaluate possible approaches
4. Validate risky assumptions
5. Present the plan when required
6. Wait for approval when required
7. Identify at least three critical edge cases

Edge cases should cover where relevant:
- User behavior
- Data integrity
- Security
- Performance
- Failure scenarios

**During Implementation — autonomous execution:**

Once a plan is approved, execute it to completion without stopping between phases for routine confirmation:
- For a multi-phase plan, verify after each phase (see Phase 8) before continuing to the next, and continue automatically once that phase's verification passes — don't pause to report "phase N done, should I continue?" for routine progress.
- Use relevant Skills, Agents, MCPs, Plugins, and project tools where they materially help — see "Intelligent Capability Selection" above for what's available and how to choose; this phase doesn't repeat that guidance.
- **Protect unrelated functionality**: a change scoped to one area must not alter behavior elsewhere. Don't assume a shared file/component edit is safe for other consumers — verify it explicitly (e.g. a scoped/conditional change, or an explicit before/after check of the unrelated area), per the Consistency Check above.
- Only stop and ask the user when: a decision genuinely cannot be inferred safely from the request and codebase; the task is materially ambiguous; a destructive or irreversible action is required that falls outside the approved scope; or required credentials/authorization are unavailable. Routine implementation choices within the approved scope don't need a check-in.

Also follow these principles throughout:
- Respect existing architecture
- Reuse existing components
- Follow project conventions
- Maintain accessibility
- Maintain responsive design
- Consider performance
- Consider security
- Avoid unnecessary complexity
- Avoid technical debt

**Self-Correction (Debugging & Root Cause Analysis)**

When encountering errors or unexpected behavior, including a failed verification after a phase:
- Perform root cause analysis before changing code — do not try random solutions hoping one will work.
- Explain the hypothesis behind the fix before applying it.
- Fix only what's necessary to resolve the root cause, not unrelated cleanup.
- Re-run the same verification that failed; continue to the next phase only once it passes.

### Phase 8: Final QA & Report

After implementation:

Verify:
- The solution matches the approved specification
- No syntax errors remain
- No linting issues remain
- Builds complete successfully
- Primary user flows work
- Edge cases are tested
- Temporary files are removed
- Debug code is removed

Additionally:
- Run the validation commands selected per "Quality control after significant work" above (not just a visual check) — that section already maps what changed to which commands, this step is where you actually run them.
- For UI-facing changes, perform actual browser/visual QA (render the change, inspect the DOM/computed styles or a screenshot) — "it builds" is not the same as "it renders correctly."
- Do a final review against the *original request*, not just the plan — confirm what was delivered actually satisfies what the user asked for, including anything the plan may have narrowed or deferred along the way.
- Provide one final report to the user after completion: what changed, what was verified (and how), and any deferred/flagged items — don't leave completion to be inferred from silence.

### Git Operations

Follow project Git conventions.

Rules:
- Keep commits focused and atomic
- Write clear descriptive commit messages
- Do not create commits unless requested by the user or required by the project workflow

### Design System Rules

Before creating UI:
- Inspect existing design patterns
- Reuse existing components
- Maintain consistency
- Follow typography rules
- Follow spacing conventions
- Follow layout patterns
- Avoid isolated UI solutions

### Quality Standard

Every implementation should aim for:
- Production quality
- Clean architecture
- Maintainable code
- Excellent UX
- Clear documentation
- Minimal technical debt

The objective is not only to complete tasks.

The objective is to build reliable, scalable, professional software.

Apply this operating system whenever this `CLAUDE.md` file is active.
