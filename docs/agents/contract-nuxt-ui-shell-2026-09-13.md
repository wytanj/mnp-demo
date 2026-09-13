# Worker contract — Nuxt UI three-door shell (2026-09-13)

Companion to `brief-mnp-nuxt-ui-shell-2026-09-13.md`. Every worker codes against THIS
file so parallel work grafts cleanly. Orchestrator (Fable) owns git; workers never commit,
never create worktrees, never touch files outside their ownership list.

## Ground rules (all workers)
- Repo: `/Users/feliciawu/Desktop/Coding/mnp-demo-wt-demo` (Nuxt 4.5, `app/` dir, Nitro `server/`, `shared/utils/shipping.ts` types).
- Brand: charcoal `#221F1F` (neutral/ink) + orange `#F17421` (primary). Nuxt UI v4 (`@nuxt/ui` ^4.11) + Tailwind v4.
- Pitch mode: no real Twilio/Gmail/TradeNet. Simulated WhatsApp/email/TradeNet is fine and must LOOK real.
- TradeNet stays human-in-the-loop in copy: "Submit to TradeNet (demo)" records the declaration as
  *filed by a named M&P customs officer*. Never say "auto-filed".
- Keep all existing routes working: `/track/[id]`, `/review/[id]`, `/quote/[ref]`, `/statement/[id]`,
  `/driver`, `/driver/[id]`, `/rewards`, `/mcp`, every `server/api/**`.
- Existing global CSS in `app/assets/css/main.css` stays (legacy pages use `.page .card .pill …`).
  Add Tailwind/Nuxt UI on top; do not delete legacy classes.
- Times in seed are relative to `Date.now()` (see `minsAgo`), ids are fixed strings. Seed must be
  deterministic apart from timestamps.
- `npm run build` must stay green. Run `npx nuxi typecheck` only if it already passes on main (it may not; don't chase pre-existing errors).
- Do not run `scripts/reseed.mjs` (prod). Local dev is in-memory and reseeds on restart.
- No `?job=` kitchen sink on `/`. Door page is three buttons only.

## Routes (final)
| Route | Layout | Owner |
| --- | --- | --- |
| `/` | none (door page: 3 big buttons → `/ops`, `/portal`, `/driver`) | W1 |
| `/ops` → redirect `/ops/jobs` | ops | W1 |
| `/ops/jobs`, `/ops/jobs/[id]` | ops | W3 |
| `/ops/customs`, `/ops/customs/[id]` (declaration form) | ops | W3 |
| `/ops/exceptions` | ops | W3 |
| `/ops/inbox` (+ `?thread=`) | ops | W4 |
| `/ops/partners` | ops | W4 |
| `/ops/reviews` | ops | W4 |
| `/ops/quotes` | ops | W4 |
| `/ops/agent` | ops | W4 |
| `/ops/docs`, `/ops/billing` (light) | ops | W4 |
| `/rewards` (existing, give it `layout: 'ops'`) | ops | W4 |
| `/portal`, `/portal/track`, `/portal/quote`, `/portal/pod` | portal | W5 |
| `/driver`, `/driver/[id]` (existing; reskin only) | driver | W5 |
| Legacy `/?job=MP-…` → redirect to `/ops/jobs/MP-…` (route middleware) | — | W1 |

Sidebar order (ops layout, W1 builds it): Jobs · Inbox · Customs queue · Reviews · Quotes ·
Partners · Exceptions · Agent desk · — · Docs vault · Billing / SOA · Rewards.
Sidebar shows live badge counts from `GET /api/ops/summary` (W2) — W1 wires it.

## Layouts (W1 builds; others use via `definePageMeta({ layout: 'ops' })`)
- `app/layouts/ops.vue`: `UDashboardGroup` > `UDashboardSidebar` (logo `/mp-logo.svg`, `UNavigationMenu` vertical, badges) + `<slot />`.
  Pages wrap themselves in `<UDashboardPanel>` with `<template #header><UDashboardNavbar title="…" /></template>` and `<template #body>…</template>`.
- `app/layouts/portal.vue`: light top nav (logo, My shipments · Track · Request quote · POD / review), max-w 1100 content.
- `app/layouts/driver.vue`: phone-first, dark charcoal top bar, max-w 480 content.
- `app/app.vue` wraps `<UApp><NuxtLayout><NuxtPage /></NuxtLayout></UApp>` (so `useToast()` works everywhere).
- Theme: `app/app.config.ts` → `ui: { colors: { primary: 'brand', neutral: 'zinc' } }`; `main.css` defines
  `--color-brand-50…950` around `#F17421` inside `@theme`. Charcoal `#221F1F` as sidebar/navbar ground.

## Data model additions (W2 builds in `shared/utils/shipping.ts`; everyone reads)
```ts
export type Channel = 'email' | 'whatsapp'
export type PartnerRole = 'shipping_line' | 'warehouse' | 'broker' | 'agent' | 'haulier'
export type PartnerState = 'ok' | 'waiting' | 'blocked' | 'done' | 'na'

export interface ThreadMessage {
  id: string; direction: 'in' | 'out'; from: string; body: string; at: string
  attachment?: { name: string; kind: 'pdf' | 'image' }
}
/** A WhatsApp conversation tied to a job (embedded in the shipment JSON → persists with it). */
export interface WaThread {
  id: string                       // 'wa-4471-melissa'
  contactName: string
  contactHandle: string            // '+65 9123 4567'
  contactRole: 'customer' | PartnerRole | 'driver' | 'other'
  status: 'needs_reply' | 'waiting_on_them' | 'closed'
  messages: ThreadMessage[]
}
export interface PartnerStatus {
  role: PartnerRole; name: string; contact?: string
  state: PartnerState; waitingFor?: string; since?: string; eta?: string; channel?: Channel
}
/** TradeNet declaration draft — fillable client-side, missing fields = customs gap. */
export interface CustomsDeclaration {
  declarationType?: 'IN' | 'OUT' | 'TRANSHIPMENT'
  hsCode?: string; cargoValue?: number; currency?: string; countryOfOrigin?: string
  importerUEN?: string; importerName?: string; permitType?: string
  vesselName?: string; voyage?: string; blNo?: string; containerNo?: string
  portOfLoading?: string; portOfDischarge?: string
  packages?: number; grossWeightKg?: number; description?: string; incoterms?: string
  filedBy?: string; filedAt?: string; permitNo?: string   // set by submit (demo)
}
export const DECLARATION_REQUIRED: Array<keyof CustomsDeclaration> = [
  'declarationType','hsCode','cargoValue','currency','countryOfOrigin','importerUEN',
  'vesselName','blNo','portOfLoading','portOfDischarge','packages','grossWeightKg','description'
]
export function declarationGaps(s: Shipment): string[]   // labels of missing required fields (+ missing customs docs)

// Shipment gains:
//   whatsapp?: WaThread[]
//   partners?: PartnerStatus[]
//   customs.declaration?: CustomsDeclaration
```
Unified inbox thread (computed by `GET /api/comms`, NOT stored):
```ts
export interface CommsThread {
  id: string; channel: Channel; shipmentId: string | null
  contactName: string; contactHandle: string; contactRole: string
  subject: string; lastAt: string; status: 'needs_reply' | 'waiting_on_them' | 'closed'
  messages: ThreadMessage[]            // email threads = OutboxEmail rows grouped by shipment+counterpart, oldest first
}
```
Quote requests (in-memory only, `server/utils/quotes.ts`):
```ts
export interface QuoteRequest {
  id: string; ref: string; at: string; company: string; contact: string; email: string
  mode: 'FCL' | 'LCL' | 'AIR' | 'LAST_MILE'; origin: string; destination: string
  cargo: string; readyDate?: string; incoterms?: string
  status: 'new' | 'auto_quoted' | 'sent' | 'won' | 'lost'
  autoQuote?: { rateCardRef: string; estimate: number; currency: string; validUntil: string; lines: Array<{label:string; amount:number; currency:string}> }
}
```

## Nitro APIs (W2 builds; all return JSON)
- `GET /api/ops/summary` → `{ jobs, inboxNeedsReply, customsQueue, reviewsPending, quotesNew, partnerWaits, exceptions }` counts for sidebar badges.
- `GET /api/comms` → `CommsThread[]` (email + WhatsApp, newest first). `?shipment=MP-…` filters.
- `POST /api/comms/reply` `{ threadId, channel, shipmentId, to, body }` → appends simulated outbound message (WA: push to `s.whatsapp[].messages`, mark `waiting_on_them`; email: `dbSaveEmail` kind `cs`), adds timeline note, returns updated thread.
- `GET /api/customs/queue` → `[{ id, client, route, status, docsDone, docsTotal, gaps: string[], eta, declaration }]` for jobs with `customs`.
- `POST /api/shipments/[id]/customs` — existing actions kept; ADD `{ action: 'save_declaration', declaration }` (merge) and `{ action: 'submit_demo', by }` → requires `declarationGaps(s)` empty (409 otherwise), sets `customs.status='declared'`, `declaredBy=by`, `permitNo='IN-2026-09-' + 6 digits`, timeline event "🛃 Declaration filed on TradeNet by {by} (demo)".
- `GET /api/partners` → `[{ shipmentId, client, route, status, partners: PartnerStatus[] }]`.
- `POST /api/shipments/[id]/partners` `{ role, state, waitingFor?, note? }` → update one partner, timeline note.
- `GET /api/reviews` → `{ asked: Row[], received: Row[], suppressed: Row[] }` (Row: id, client, contact, deliveredAt, askAt, state, rating?, comment?, helpedBy?, reason?, reward?).
- `POST /api/shipments/[id]/review-ask` `{ action: 'send' | 'suppress' | 'release', reason? }` → send = build+save review email, `reviewAsk={state:'sent'}`; suppress = `reviewAsk={state:'held', reason}`; release = held→send.
- `GET /api/quotes/requests`, `POST /api/quotes/requests` (body = QuoteRequest minus id/ref/at/status/autoQuote) → auto-quote from the closest `RATE_CARDS` lane (`status:'auto_quoted'`), returns the request. `POST /api/quotes/requests/[id]` `{ action: 'send' | 'won' | 'lost' }`.
- `GET /api/exceptions` → `[{ id, shipmentId, client, kind, severity: 'high'|'medium'|'low', title, detail, since, link }]` with kinds:
  `stuck` (not delivered & last event > 24h), `eta_passed`, `customs_gap` (docs_pending/declaration gaps with ETA < 48h), `claim_open`, `partner_blocked`, `needs_reply` (thread needs_reply > 2h), `signoff_pending`.
- MCP (`server/routes/mcp.post.ts`): keep 4 tools; extend `slim()` with `whatsapp`, `partners`, `customs.declaration` + `customs.gaps`; ADD tools `list_customs_gaps`, `list_open_comms` (needs-reply threads across email+WA with last message), `list_partner_waits`, `list_exceptions`, `send_whatsapp` (simulated; `{ shipmentId, body }` → appends to the customer's WA thread, timeline note). Update `/mcp` GET hint. `list_pending_actions` also includes customs gaps, partner waits, needs-reply threads.

## Seed (W2, `server/utils/store.ts`) — hero jobs the spoken demo relies on
Keep all 10 existing jobs. Enrich/add so these questions work from Grok/Claude without typing data:
1. "What's outstanding on MP-3318-MC?" → Mecha HK LCL: customs docs 1/4, declaration draft missing HS code / cargo value / importer UEN, WA thread Brendan needs reply ("invoice coming tonight, can you pre-fill?"), partners: shipping line ICS ok (ETA 2 days), CFS warehouse *waiting* unstuff slot, broker Joreen *waiting* on invoice+packing list.
2. "Which jobs have customs gaps?" → MP-3318-MC + NEW `MP-9032-TA` (Titan Associates, LCL Shenzhen → Singapore, ex `docs/sample-email-3`): docs 2/4, declaration half-filled, ETA passed 6h ago, last event 30h ago (→ stuck + eta_passed), WA thread with shipping-line agent (ICS, Kelvin) waiting_on_them re HBL final, email thread Titan (WY) asking NOA — needs reply, partners: warehouse Pan-Asia CFS *blocked* (no unstuff without permit), broker *waiting*.
3. "Who is waiting on us / who are we waiting on?" → partner waits above + MP-6220-AF Korea agent waiting shipper ready date + MP-4471-AF haulier NEK *ok*, PSA *done*.
4. "Any open WhatsApp or email threads?" → Brendan (WA, needs reply), Melissa MP-4471-AF (WA, closed: 2pm slot confirmed), Titan WY (email, needs reply), Esther (email, replied), driver Hafiz (WA, 'reached PSA gate, queue 20 min' — closed), NEW `MP-7710-AF` consumer Priya (WA, needs reply: "nobody home till 7pm, can driver come after?").
5. "Which reviews are pending / suppressed?" → asked: MP-8102-AF + MP-7710-AF (delivered earlier today, ask sent); received: 8101, 8110, 8112; suppressed: MP-8125-HF (damage claim) + NEW `MP-7719-HF` (destination-fee dispute, held).
6. "Ask about MP-4471-AF" → full status incl. declaration filed by Joreen, permit, partners, both WA + email threads.
Every new job needs realistic `events`, `documents`, `driverName/driverPhone` (reuse 91234567 / 92345678 / 93456789 so `/driver` login shows them), `contacts`.

## Demo prompts (README + Agent desk, same 5)
1. "List every shipment M&P is handling right now and flag anything that needs a person."
2. "What's outstanding on MP-3318-MC — documents, customs, partners, open messages?"
3. "Which jobs have customs gaps and what exactly is missing before Joreen can file on TradeNet?"
4. "Show me open WhatsApp and email threads that still need a reply, newest first."
5. "Draft a WhatsApp reply to Brendan on MP-3318-MC telling him what we still need, then send it."

## Definition of done per worker
Each worker ends with: `npm run build` green, a list of files touched, and 3 lines of manual-verify notes.
