# M&P International Freights — live tracking demo

A Nuxt 4 demo showing how a traditional freight forwarder
([M&P International Freights](https://www.mp.com.sg/)) can move from
**"CS emails the shipping details"** to a modern, self-serve tracking experience.
Styled with M&P's brand palette (charcoal `#221F1F` + orange `#F17421`).

## The story

| Today (email-based) | With M&P live tracking |
| --- | --- |
| CS emails shipping details to each client | CS shares one **tracking link** |
| Customer calls to ask "where's my cargo?" | Customer watches a **live timeline** |
| Paper POD, lost or disputed | Driver posts **photos**, customer **e-signs** |
| No feedback collected | **Review request email** sent automatically on delivery |

Three shipment modes, chosen at booking:

- **B2B** — company, PO number, incoterms (e.g. Allmighty Foods → distributor DC)
- **B2C** — consumer deliveries (e.g. Allmighty Foods online orders)
- **B2SELF** — a client moving stock between their **own** locations
  (e.g. Hey Fran restocking their own outlet), with a transfer reference

## Seeded demo data

| ID | Client | Mode | Scenario (all Singapore) |
| --- | --- | --- | --- |
| `MP-4471-AF` | Allmighty Foods (allmightyfoods.com.sg) | B2B | Freight forwarding: ingredient import ex-Bangkok, container discharged at PSA Pasir Panjang, customs cleared via TradeNet, drayage to Senoko Food Hub |
| `MP-7302-AF` | Allmighty Foods | B2C | Last mile: online order to a consumer in Bedok, out for delivery (sign-off ready) |
| `MP-5108-HF` | Hey Fran (heyfran.com) | B2SELF | Last mile: outlet restock, Kaki Bukit warehouse → Orchard Central pop-up |

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — or the deployed demo at https://mnp-flow.vercel.app

## Demo script (5 minutes)

1. **CS dashboard** (`/`) — three shipments pre-seeded. Click **+ New shipment**,
   toggle B2B / B2C / B2SELF, create one → note the tracking email in the outbox.
2. **Copy tracking link** — this is what CS sends via WhatsApp/email instead of
   typing out shipping details.
3. Open the **Driver view** on your phone (or a second tab) for `MP-7302-AF` —
   post a note, take a photo.
4. Open the **Customer view** for the same shipment — the update and photo appear
   within a few seconds (auto-refresh), no CS involvement.
5. On the customer view, **Sign off delivery** — draw a signature. Status flips to
   Delivered, a timestamped POD card appears.
6. Back on the CS dashboard outbox: a **"How did we do?"** email was generated.
   Open it → **Leave a quick review** → star rating shows up against the shipment.

## Notes

- Data lives in server memory (Nitro) — restarting the dev server (or a serverless
  cold start on Vercel) resets the demo to the seeded state.
- Mobile-first, installable (PWA manifest included); driver photo upload uses the
  phone camera via `capture="environment"` and compresses client-side.
- No external services: "emails" land in a simulated outbox on the dashboard.
