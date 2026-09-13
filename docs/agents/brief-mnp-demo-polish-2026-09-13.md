# Brief: M&P demo polish — partners, billing, rewards redo, how-to

**Branch:** `demo/tuesday-hygiene-musthaves` (this worktree). Draft PR #1 already open — push commits there.

**Felicia locks (2026-09-13):**
1. Partners By job cards currently lead with **customer** names — confusing. Trade partners ≠ customers.
2. Seed those customers into Billing/SOA (not Titan-only).
3. Every nav page stays in the demo; **redo Rewards** (do not delete the story).
4. How-to: button **top-right of each page header** → USlideover.

## ROLE SPLIT
Fable orchestrates; Opus implements. Done webhook if available; otherwise push + PR comment when green.

## A — Trade partners (`app/pages/ops/partners.vue`)
- **By job:** card title = job id + status; **customer as muted subtitle**; chips = trade partners (keep).
- **By role:** already partner-led — make partner **name** the hero; job/customer secondary.
- Seed/display real partner org names prominently (Pan-Asia CFS, Wan Hai, NEK Logistics, etc. — already in data; surface them).
- Keep "Trade partners" nav label.

## B — Billing / SOA (`app/pages/ops/billing.vue` + statement if needed)
- Seed **one SOA card per demo customer** that appears on partners/jobs: Titan, Allmighty Foods, Hey Fran, Mecha (and any other company on seeded shipments).
- Invoice lines already pull from quotes — keep; ensure each customer has at least one SOA-ready statement link or a stub statement page.
- Copy: "Customers (accounts), not trade partners."

## C — Rewards redo
- Current `/rewards` + `RewardsDashboard.vue` is kitchen-sink — **redo**, do not leave as-is.
- Target: thin ops page **"Review programme"** (or fold into `/ops/reviews` as a tab/section):
  - Pending asks / held / received
  - Reward codes issued after 5★ (demo)
  - Link to customer thank-you path
- Remove kitchen-sink tabs (clients/automations flyer pile) OR hide behind a "legacy" fold — prefer clean Nuxt UI.
- Sidebar: rename Rewards → "Review programme" or drop nav item and deep-link from Reviews only.
- **Customer path (do not break):** `/review/[id]` + portal POD/review. On thank-you after 5★, show a simple reward voucher card (customer-facing). Ops never shown to customer.

## D — How-to Slideover (all demo pages in nav)
- Shared component e.g. `DemoHowTo.vue`: icon button top-right of page header (ops `UDashboardNavbar` trailing slot; portal page h1 row; doors; driver).
- Short copy per route (what / click / say) — 3–5 bullets max.
- Cover: doors, every ops nav item, every portal nav item, driver home.

## E — Out of scope
- No real integrations. Seeded/fake data only.
- Do not rewrite Jobs/Inbox/Customs core.

## Acceptance
- Soft-reload: partners no longer look like a customer list
- Billing shows multiple customer SOAs
- Rewards page feels demo-ready (or folded into Reviews)
- How-to `?` top-right on every nav page
- Push to existing PR

## PRIORITY LOCK (Felicia 2026-09-13 later)

**Most important demo wedges — make EXTENSIVE (many features, not redundant):**

### 1) Review / reward automation (ops + customer)
Depth targets (seeded, clickable, Nuxt UI):
- Ops Reviews board: pending asks, held (claim open), sent, received, suppress, release, 48h re-ask
- Claim/hold gate: unhappy customer never gets review ask mid-claim
- Reward programme page (redo `/rewards`): codes issued on 5★, pending claim of reward, Google/FB platform proof, flyer/outbox emails simulated
- Customer `/review/[id]`: stars → thank-you → voucher if 5★; portal POD/review list of “to leave”
- Agent desk hooks: “draft review ask”, “hold because claim”, “issue reward”
- Timeline events on the job when ask/hold/reward fires
- Do NOT duplicate the same list three times — one source of truth, Reviews + thin programme page + customer thank-you

### 2) Customs declarations automation
Depth targets:
- Customs queue with statuses (needs data, draft declaration, submitted, queried, cleared)
- Job → declaration form prefill from shipment (HS, weight, consignee, invoice lines) — editable demo fields
- Agent/Grok assist: “fill from docs”, “flag missing permit”, WhatsApp/email nudge copy
- Document checklist per declaration (invoice, packing list, permit)
- Partner handoff to broker (link to trade partners on that job)
- Exception when blocked on permit (ties to partners blocked chip)
- Avoid a second customs UI elsewhere — deepen `/ops/customs` + `/ops/customs/[id]` only

Partners/billing/how-to still ship, but **spend most Opus time on (1) and (2)**. Thin polish elsewhere.
