/**
 * Presenter cheat-sheet copy for the Tuesday live demo.
 *
 * One entry per demo surface: `what` (one sentence), `click` (2–3 concrete
 * moves, naming the hero jobs) and `say` (1–2 talking points — the "why" for
 * M&P). Total bullets per page stay at five or fewer so the slideover reads
 * at a glance on a phone.
 *
 * Shown only in the `DemoHowTo` slideover — never to a customer.
 */

export interface HowTo {
  title: string
  what: string
  click: string[]
  say: string[]
}

export type HowToKey =
  | 'doors'
  | 'ops-jobs'
  | 'ops-inbox'
  | 'ops-customs'
  | 'ops-reviews'
  | 'ops-quotes'
  | 'ops-partners'
  | 'ops-exceptions'
  | 'ops-agent'
  | 'ops-docs'
  | 'ops-billing'
  | 'ops-rewards'
  | 'portal-home'
  | 'portal-track'
  | 'portal-quote'
  | 'portal-pod'
  | 'driver'

export const HOWTO: Record<HowToKey, HowTo> = {
  'doors': {
    title: 'Doors',
    what: 'The way in — three doors onto the same job book: internal ops, the client portal, and the driver app.',
    click: [
      'Start here, then open Internal ops for the demo run.',
      'Come back to this page to switch seats — Client portal is Melissa Tan at Allmighty Foods, Driver is Hafiz on 91234567.'
    ],
    say: [
      'One system, three audiences — nobody re-keys anything between them.',
      'Whatever ops see on a job is what the customer and the driver see, filtered to what they should see.'
    ]
  },

  'ops-jobs': {
    title: 'Jobs',
    what: 'The whole job book with an attention strip on top counting what actually needs a person today.',
    click: [
      'Tap a tile in the attention strip to filter the list down to those jobs.',
      'Open MP-3318-MC (Mecha) — Docs 1/4, the two missing documents named, timeline and partners on one page.',
      'Back out and open MP-9032-TA (Titan) — stuck, ETA passed, Pan-Asia CFS blocked.'
    ],
    say: [
      'Today this lives in inboxes and someone\'s head; here it is counted before anyone asks.',
      'Every job is one page — documents, customs, partners, messages and timeline together.'
    ]
  },

  'ops-inbox': {
    title: 'Inbox',
    what: 'Email and WhatsApp in one list, with every thread already sitting on its job.',
    click: [
      'Open Brendan\'s WhatsApp thread on MP-3318-MC — flagged as needing a reply.',
      'Take the AI draft, edit a word if you like, and send — the reply lands on the job.',
      'Open "Not on a job" to show the unmatched mail folding away.'
    ],
    say: [
      'CS stops switching between three apps — and the customer\'s history stays on the shipment, not in one person\'s mailbox.'
    ]
  },

  'ops-customs': {
    title: 'Customs queue',
    what: 'Every declaration waiting to be filed, with the exact gaps listed before an officer touches TradeNet.',
    click: [
      'Click the five tiles to filter — Needs data, Draft declaration, Submitted, Queried, Cleared. MP-6220-AF sits under Queried.',
      'Open MP-9032-TA: Fill from job prefills the empty fields, Assist reads them off the documents, flags the missing permit (Pan-Asia CFS is blocked on it) and drafts the chase message.',
      'Submit to TradeNet (demo) as Joreen, then hand the pack to the broker from the same page.'
    ],
    say: [
      'Human-in-the-loop: M&P collect and check the documents, then a named customs officer files on TradeNet themselves. Assist only prefills and drafts — nothing is ever auto-submitted.'
    ]
  },

  'ops-reviews': {
    title: 'Reviews',
    what: 'Four lanes — not asked yet, asked, received, held — with the ask, the 48h reminder and the claim gate all automatic.',
    click: [
      'Held (claim open): MP-8125-HF (damage) and MP-7719-HF (fee dispute) are out of the programme on purpose — the gate line counts them.',
      'On an asked job (MP-8102-AF) hit Send 48h reminder: the row shows "Reminded ×1 · next due", and the button dies after two.',
      'On the same lane use Hold with a reason (Damage / Missing item / fee dispute / Unhappy on call) and watch the row move to Held.',
      'Not asked yet → Send ask now puts the review email in the outbox and moves the row to Asked.'
    ],
    say: [
      'You never ask a customer for a review while their claim is open — the system knows that, so nobody has to remember.',
      'We chase twice and then stop, so the programme never turns into nagging.'
    ]
  },

  'ops-quotes': {
    title: 'Quotes',
    what: 'Every enquiry from the portal and from CS, with an indicative rate-card number already attached.',
    click: [
      'Open a request marked auto-quote (demo) and show the indicative number against the standing rate card.',
      'Use New request to key one in and watch the number come back immediately.'
    ],
    say: [
      'The enquiry stops waiting for someone to be free — the customer has a ballpark on screen, and a person still sends the firm quotation.'
    ]
  },

  'ops-partners': {
    title: 'Trade partners',
    what: 'The coordination board: line, CFS, broker, agent and haulier per job, and who is waiting on whom.',
    click: [
      'Open Pan-Asia CFS on MP-9032-TA — blocked, no unstuff without the permit.',
      'Show the broker waiting and the line on track on the same job.'
    ],
    say: [
      'Trade partners are outside parties on a job (line, CFS, broker, agent, haulier) — not customers.',
      'Partner chasing normally lives in someone\'s head; here the block is visible and dated.'
    ]
  },

  'ops-exceptions': {
    title: 'Exceptions',
    what: 'Everything off-track derived live from the jobs — stuck, ETA passed, customs gaps, partner blocks, unanswered threads, sign-offs outstanding.',
    click: [
      'MP-9032-TA sits top of the list — stuck, no movement 30h, CFS blocked.',
      'Filter by severity, then click through to the job and fix it.'
    ],
    say: [
      'Nothing here is stored or ticked off — fix the job and the alert disappears on its own.',
      'This is the list a supervisor works down at the start of the day.'
    ]
  },

  'ops-agent': {
    title: 'Agent desk / MCP',
    what: 'One MCP endpoint that lets Claude or Grok Bot read the live job book and act on it — no export, no copy-paste.',
    click: [
      'Copy the endpoint and show it connected as a custom connector.',
      'Ask out loud: "What\'s outstanding on MP-3318-MC — documents, customs, partners, open messages?"',
      'Then: "Draft a WhatsApp reply to Brendan on MP-3318-MC telling him what we still need, then send it."',
      'In Try it here run draft_review_ask on MP-8102-AF — the exact review email plus the gate decision, nothing sent.',
      'Then hold_review_for_claim or issue_reward, and show the result land on /ops/reviews.'
    ],
    say: [
      'The assistant reads the same live data ops see, so its answers can\'t drift from the job book.',
      'It drafts and it holds, but the claim gate and the voucher rules stay in the system, not in the prompt.'
    ]
  },

  'ops-docs': {
    title: 'Docs vault',
    what: 'Every commercial invoice, packing list, B/L, permit and payment slip held against its job.',
    click: [
      'Filter to Missing and show MP-3318-MC at 1/4 with the two outstanding documents named.',
      'Switch to a job with a permit — MP-4471-AF, filed on TradeNet by Joreen.'
    ],
    say: [
      'Documents stop being chased down email threads; the gap is visible the moment the job is booked.'
    ]
  },

  'ops-billing': {
    title: 'Billing / SOA',
    what: 'One statement of account per customer, generated straight from the job book.',
    click: [
      'Open an Allmighty Foods statement and show the jobs and charges rolling into it.',
      'Follow the statement link the customer receives.'
    ],
    say: [
      'One SOA per customer account, generated from the job book — no re-keying from a spreadsheet.',
      'Every line traces back to the job that earned it.'
    ]
  },

  'ops-rewards': {
    title: 'Review programme',
    what: 'The programme end to end — the rules it runs on, the codes issued, the proof still to verify, and every email it sent.',
    click: [
      'Read the Programme rules card out loud: ask on delivery, hold on claim, 48h reminder ×2, 5★ → instant Grab $10.',
      'Reward codes issued — MP-8101-AF and MP-8112-HF got their voucher the second the 5★ landed, no CS step.',
      'Pending claim of reward — the Google/Facebook proof CS still has to verify before the Grab $10 goes out.',
      'Programme outbox — the actual review asks and voucher emails, then follow the link into the ops Inbox.'
    ],
    say: [
      'The ask, the reminder, the hold and the thank-you are one flow — CS never has to remember any of it.'
    ]
  },

  'portal-home': {
    title: 'My shipments',
    what: 'What Melissa Tan at Allmighty Foods sees when she signs in — her shipments, action-needed first.',
    click: [
      'Point at the shipment needing her — MP-4471-AF, where she asked a question from the tracking page.',
      'Show MP-7302-AF out for delivery, then use Track by job id or Request a quote.'
    ],
    say: [
      'She stops calling CS to ask "where\'s my cargo?" — and she only sees her own jobs, never the internal surfaces.'
    ]
  },

  'portal-track': {
    title: 'Track a shipment',
    what: 'Job-id lookup onto the live tracking page — the one link CS shares instead of emailing shipping details.',
    click: [
      'Enter MP-4471-AF and open the live timeline, documents and photos.',
      'Try MP-7302-AF — out for delivery, ready for the customer to sign off.'
    ],
    say: [
      'No login to open the link, so it can go to a consignee or a warehouse that is not an M&P account.'
    ]
  },

  'portal-quote': {
    title: 'Request a quote',
    what: 'A lane enquiry that returns an indicative rate-card number on screen straight away.',
    click: [
      'Hit Fill an example lane, then submit and show the indicative quote appear.',
      'Point out the request now sitting in the ops Quotes list.'
    ],
    say: [
      'The customer gets a ballpark immediately instead of waiting for someone to be free; a person still sends the firm quotation.'
    ]
  },

  'portal-pod': {
    title: 'POD / review',
    what: 'Every signed delivery, the proof behind it, and where the customer\'s feedback stands.',
    click: [
      'Show a signed delivery with its signature, name and time — the proof, not a paper slip.',
      'Point at a job waiting on sign-off, then at one showing a review to leave.'
    ],
    say: [
      'Paper PODs get lost and disputed; this one is signed on the customer\'s own phone and stored on the job.'
    ]
  },

  'driver': {
    title: 'Driver',
    what: 'The phone view for the driver — today\'s jobs, photos, notes and status, nothing else.',
    click: [
      'Log in with 91234567 (Hafiz) and open MP-7302-AF from today\'s list.',
      'Post a photo or a note and move the status forward.',
      'Hand over to the customer\'s /track page for the live sign-off.'
    ],
    say: [
      'The driver never marks a job Delivered — the customer signs off themselves, which is what makes the POD hold up.'
    ]
  }
}
