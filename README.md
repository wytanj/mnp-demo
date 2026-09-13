# M&P International Freights — live tracking demo

A Nuxt 4 demo showing how a traditional freight forwarder
([M&P International Freights](https://www.mp.com.sg/)) can move from
**"CS emails the shipping details"** to a job-tied, self-serve operation.
Styled with M&P's brand palette (charcoal `#221F1F` + orange `#F17421`).

## The story

| Today (email-based) | With M&P live tracking |
| --- | --- |
| CS emails shipping details to each client | CS shares one **tracking link** |
| Customer calls to ask "where's my cargo?" | Customer watches a **live timeline** and asks on the job |
| Customs docs chased over email threads | **Document checklist per job** — Docs X/Y, then a person files on TradeNet |
| Paper POD, lost or disputed | Driver posts **photos**, customer **e-signs** |
| No feedback collected | **Review request on delivery** — held automatically when a claim is open |

Three shipment modes, chosen at booking:

- **B2B** — company, PO number, incoterms (e.g. Allmighty Foods → distributor DC)
- **B2C** — consumer deliveries
- **B2SELF** — a client moving stock between their **own** locations (e.g. Hey Fran outlet restock)

**TradeNet is human-in-the-loop.** M&P collect and verify the documents in the app;
an M&P customs officer files the declaration on TradeNet themselves and records the
permit against the job. Nothing is ever auto-submitted.

## Seeded demo data

| ID | Client | Mode | Scenario |
| --- | --- | --- | --- |
| `MP-8125-HF` | Hey Fran | B2SELF | Delivered & signed off, **open damage claim** → review request **held**, routed to CS/claims |
| `MP-3318-MC` | Mecha | B2B | HK LCL import, **customs docs pending (Docs 1/4)** — 2 documents needed before M&P can declare |
| `MP-7302-AF` | Allmighty Foods | B2C | Out for delivery — **live sign-off** in the demo, then the review request sends itself |
| `MP-4471-AF` | Allmighty Foods | B2B | Ex-Bangkok container, **declared on TradeNet by Joreen (manual)**, Docs 4/6, customer asked a question from `/track` |
| `MP-8102-AF` | Allmighty Foods | B2C | Delivered, **review request sent**, waiting on the customer |
| `MP-5108-HF` | Hey Fran | B2SELF | Outlet restock, picked up — clean `/track` page |
| `MP-6220-AF` | Allmighty Foods | B2B | Busan LCL quote, booked |
| `MP-8101-AF`, `MP-8110-AF`, `MP-8112-HF` | mixed | — | Delivered and reviewed — feed the rewards dashboard |

Plus three unmatched inbound mails (tournament schedule, a newsletter, a vendor pitch)
that fold away under **Not on a job** in the ops inbox.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — or the deployed demo at https://mnp-flow.vercel.app

## Demo script (6 beats)

1. **Ops home** (`/`) — "Operations". The attention strip counts what needs a person:
   open claims, customs docs outstanding, ready for declaration, awaiting sign-off,
   proof to verify. Jobs are sorted by that, so the work is at the top.
2. **No more ticketing detour** — the right column is the **job-tied inbox**: every
   mail already sits on its job. Tournament mail, newsletters and vendor pitches fold
   into "Not on a job". Sender always reads `M&P International Freights <cs@mp.com.sg>`.
3. **Customs intake** — open `MP-3318-MC` (or `/?job=MP-3318-MC`). Docs 1/4, and the
   panel names the two documents still needed. Verify them → **Mark ready for
   declaration** → **Mark declared on TradeNet (manual)**, entering the officer's name
   and the permit number. Compare with `MP-4471-AF`, already declared by Joreen.
4. **Delivered → review** — open the **Customer view** for `MP-7302-AF`, sign off on a
   phone. Status flips to Delivered and the review request emails itself; it lands in
   the job's mail log and the rewards dashboard.
5. **Claim → held** — open `MP-8125-HF` (or `/?job=MP-8125-HF`). Delivered, signed off,
   but a damage claim is open, so the review request was **held** and the job sits with
   CS/claims. Resolve the claim and the ask goes out.
6. **Self-serve** — the customer's `/track/MP-4471-AF` page: status, ETA, their own
   documents, uploads, and "ask about this shipment" — which lands back on the job's
   thread. No CS mail, contacts or internal notes are ever shown there.

Deep links for the presenter: `/?job=MP-4471-AF` opens that job's panel directly.

## Notes

- Data lives in server memory (Nitro) — restarting the dev server (or a serverless cold
  start on Vercel) resets the demo to the seeded state. With `SUPABASE_URL` set it
  persists instead; `scripts/reseed.mjs --yes` clears those rows so the seed re-inserts.
- Mobile-first, installable (PWA manifest included); driver photo upload uses the phone
  camera via `capture="environment"` and compresses client-side.
- Outbound mail goes through Resend when `RESEND_API_KEY` is set, otherwise it lands in
  the simulated outbox. The displayed from-address is always the M&P one.
