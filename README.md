# M&P International Freights — live tracking demo

A Nuxt 4 demo showing how a traditional freight forwarder
([M&P International Freights](https://www.mp.com.sg/)) can move from
**"CS emails the shipping details"** to a job-tied, self-serve operation.
Styled with M&P's brand palette (charcoal `#221F1F` + orange `#F17421`).

Three doors on `/`: **Internal ops** · **Client portal** · **Driver**.

## The story

| Today (email-based) | With M&P live tracking |
| --- | --- |
| CS emails shipping details to each client | CS shares one **tracking link** |
| Customer calls to ask "where's my cargo?" | Customer watches a **live timeline** and asks on the job |
| Email + WhatsApp in three places | One **inbox** — every thread already sits on its job |
| Customs docs chased over email threads | **Declaration key-in per job** — gaps listed, then a person files on TradeNet |
| Partner chasing lives in someone's head | **Partner board** — line, CFS, broker, agent, haulier per job |
| Paper POD, lost or disputed | Driver posts **photos**, customer **e-signs** |
| No feedback collected | **Review request on delivery** — held automatically when a claim is open |
| Quote enquiry waits for someone to be free | Portal returns an **indicative rate-card quote** on screen |

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
| `MP-3318-MC` | Mecha | B2B | HK LCL import, **customs docs 1/4** + half-filled declaration; Brendan's **WhatsApp needs a reply**; CFS and broker both waiting |
| `MP-9032-TA` | Titan Associates | B2B | **Shenzhen LCL, stuck** — ETA passed, no movement 30h, packing list missing, **Pan-Asia CFS blocked** without the permit, Titan waiting on an NOA |
| `MP-4471-AF` | Allmighty Foods | B2B | Ex-Busan container, **declared on TradeNet by Joreen (manual)**, Docs 4/6, customer asked a question from `/track` |
| `MP-7302-AF` | Allmighty Foods | B2C | Out for delivery — **live sign-off** in the demo, then the review request sends itself |
| `MP-7710-AF` | Allmighty Foods | B2C | Delivered today, **review asked**, and Priya's **WhatsApp still needs a reply** |
| `MP-8125-HF` | Hey Fran | B2SELF | Delivered & signed off, **open damage claim** → review request **held** |
| `MP-7719-HF` | Hey Fran | B2SELF | Delivered, **destination-fee dispute** open → review **held**, sits with CS/claims |
| `MP-8102-AF` | Allmighty Foods | B2C | Delivered, **review request sent**, waiting on the customer |
| `MP-5108-HF` | Hey Fran | B2SELF | Outlet restock, picked up — clean `/track` page |
| `MP-6220-AF` | Allmighty Foods | B2B | Busan LCL quote, booked |
| `MP-8101-AF`, `MP-8110-AF`, `MP-8112-HF` | mixed | — | Delivered and reviewed — feed the rewards dashboard |

Plus seeded quote enquiries, simulated WhatsApp threads, a partner board per job, and
three unmatched inbound mails (tournament schedule, newsletter, vendor pitch) that fold
away under **Not on a job** in the ops inbox.

## Tuesday live-demo path

1. **Doors** — `/`. Three buttons: Internal ops, Client portal, Driver. Nothing else.
2. **Internal ops → Jobs** — the attention strip counts what needs a person. Open
   **MP-3318-MC**: Docs 1/4, the two missing documents named, timeline, partners.
3. **Inbox** — email and WhatsApp in one list. **Brendan (WA) needs a reply** on
   MP-3318-MC. Open it, take the AI draft, send. The reply lands on the job.
4. **Customs queue** → open the **MP-9032-TA** declaration. The gaps are listed.
   **Pre-fill** from the job, then **Submit to TradeNet (demo)** as **Joreen** —
   a named M&P customs officer files it; the permit number comes back onto the job.
5. **Partners** — the coordination board. **Pan-Asia CFS is blocked** on MP-9032-TA
   (no unstuff without the permit), broker waiting, line on track.
6. **Reviews** — asked / received / **suppressed**. `MP-8125-HF` (damage claim) and
   `MP-7719-HF` (fee dispute) are held on purpose — you never ask for a review mid-claim.
7. **Exceptions** — stuck jobs, ETA passed, customs gaps, partner blocks, unanswered
   threads, sign-offs outstanding. MP-9032-TA is top of the list.
8. **Agent desk / MCP** — connect Claude or Grok Bot to
   `https://<host>/mcp?key=mp-demo-2481` and ask, out loud:
   1. "List every shipment M&P is handling right now and flag anything that needs a person."
   2. "What's outstanding on MP-3318-MC — documents, customs, partners, open messages?"
   3. "Which jobs have customs gaps and what exactly is missing before Joreen can file on TradeNet?"
   4. "Show me open WhatsApp and email threads that still need a reply, newest first."
   5. "Draft a WhatsApp reply to Brendan on MP-3318-MC telling him what we still need, then send it."
9. **Client portal** — `/portal` as Melissa Tan (Allmighty Foods): my shipments with
   action-needed first, **Track** by job id, **Request a quote** (indicative rate-card
   quote on screen, demo), **POD / review** (signed deliveries, reviews to leave).
10. **Driver** — `/driver`, log in with **91234567** (Hafiz). Today's jobs, open one,
    post a photo or note, move the status. The customer signs off on their own
    `/track` page — the driver never marks Delivered.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

Deployed demo: https://mnp-flow.vercel.app

## Reseed

- **Local dev is in memory.** No database, no setup — the seed rebuilds on every
  restart of `npm run dev`, so the demo is always clean.
- **Production (Supabase) seeds only when the tables are empty.** A deployment that
  already has rows will keep serving the old seed, i.e. without `MP-9032-TA`,
  `MP-7710-AF` and `MP-7719-HF`.
- To load the new seed on prod, wipe the rows first:

  ```bash
  node --env-file=.env scripts/reseed.mjs --yes
  ```

  This deletes every row in `emails` and `shipments`; the app re-inserts the seed on
  the next request. Anything done on the deployed demo (uploads, sign-offs, claims,
  reviews) is lost and there is no undo. **Not run by the agent — Felicia decides.**

## MCP

Endpoint: `https://<host>/mcp?key=mp-demo-2481` (locally `http://localhost:3000/mcp?key=mp-demo-2481`;
override the key with `MCP_API_KEY`). JSON-RPC over POST — add it as a custom connector
in Claude or Grok Bot. Nine tools:

| Tool | What it answers |
| --- | --- |
| `list_shipments` | Everything in flight, with status and ETA |
| `get_shipment` | One job in full — docs, customs, partners, threads, timeline |
| `list_pending_actions` | What needs a person: docs, customs gaps, partner waits, unanswered threads |
| `list_customs_gaps` | Exactly what is missing before a declaration can be filed |
| `list_open_comms` | Email + WhatsApp threads still waiting on M&P |
| `list_partner_waits` | Who we are waiting on, and who is waiting on us |
| `list_exceptions` | Stuck, ETA passed, blocked, unanswered, sign-off outstanding |
| `send_email` | Writes a mail onto the job (Resend when configured, else the simulated outbox) |
| `send_whatsapp` | Appends a simulated WhatsApp message to the job's thread |

## Notes

- Outbound mail goes through Resend when `RESEND_API_KEY` is set, otherwise it lands in
  the simulated outbox. The displayed from-address is always `M&P International Freights <cs@mp.com.sg>`.
- WhatsApp and TradeNet are **simulated** in this demo — no Twilio, no TradeNet API.
  "Submit to TradeNet (demo)" records the declaration as filed by a named M&P customs
  officer; it never claims to auto-file.
- Mobile-first, installable (PWA manifest included); driver photo upload uses the phone
  camera via `capture="environment"` and compresses client-side.
