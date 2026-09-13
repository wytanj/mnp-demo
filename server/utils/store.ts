import type { OutboxEmail, Quote, Shipment, ShipmentEvent, ShipmentStatus, ThreadMessage } from '#shared/utils/shipping'
import { MAIL_FROM_DISPLAY, STATUS_LABELS, programmeOf } from '#shared/utils/shipping'

export function newId(prefix = 'MP'): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  const letters = Array.from({ length: 2 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('')
  return `${prefix}-${digits}-${letters}`
}

export function addEvent(shipment: Shipment, event: Omit<ShipmentEvent, 'id' | 'at'> & { at?: string }): ShipmentEvent {
  const full: ShipmentEvent = {
    id: crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
    ...event
  }
  shipment.events.push(full)
  if (event.type === 'status' && event.status) {
    shipment.status = event.status
  }
  return full
}

// What the customer and the room see on every M&P mail. The real Resend send
// uses RESEND_FROM (verified domain) — server-internal, see server/utils/email.ts.
const MAIL_FROM = MAIL_FROM_DISPLAY

export function buildTrackingEmail(shipment: Shipment, at?: string): OutboxEmail {
  return {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    to: shipment.customerEmail,
    from: MAIL_FROM,
    direction: 'out',
    kind: 'tracking',
    subject: `Your shipment ${shipment.id} is booked — track it live`,
    body: [
      `Hi ${shipment.customerName},`,
      ``,
      `Your shipment ${shipment.origin} → ${shipment.destination} is confirmed.`,
      `${shipment.description} · ${shipment.pieces} pcs · ETA ${new Date(shipment.eta).toLocaleString()}`,
      shipment.poNumber ? `Ref: ${shipment.poNumber}` : ``,
      ``,
      `— M&P International Freights · Moving you forward`
    ].filter(Boolean).join('\n'),
    ctaLabel: 'Track your shipment',
    ctaUrl: `/track/${shipment.id}`,
    at: at ?? new Date().toISOString()
  }
}

export function buildReviewEmail(shipment: Shipment, at?: string): OutboxEmail {
  // What the customer gets back depends on the programme the job runs on.
  const programme = programmeOf(shipment)
  const reward = programme.reward
  const rewardLine =
    reward.auto === 'manual'
      ? `Left us a public Google or Facebook review? Tell us on the form and as a thank-you we'll credit ${reward.value.replace(/ off next booking$/, ' off your next booking')}.`
      : `Left us a public Google or Facebook review? Upload a screenshot on the form to claim a ${reward.value} voucher.`
  return {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    to: shipment.customerEmail,
    from: MAIL_FROM,
    direction: 'out',
    kind: 'review',
    subject: `Delivered! How did we do on ${shipment.id}?`,
    body: [
      `Hi ${shipment.customerName},`,
      ``,
      `Shipment ${shipment.id} was delivered${shipment.signoff ? ` and signed for by ${shipment.signoff.name}` : ''}.`,
      `How did we do? It takes 20 seconds.`,
      rewardLine,
      ``,
      `— M&P International Freights · Moving you forward`
    ].join('\n'),
    ctaLabel: 'Leave a quick review',
    ctaUrl: `/review/${shipment.id}`,
    at: at ?? new Date().toISOString()
  }
}

export function buildRewardEmail(shipment: Shipment, code: string, at?: string): OutboxEmail {
  const value = shipment.review?.reward?.value ?? 'Grab $10'
  return {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    to: shipment.customerEmail,
    from: MAIL_FROM,
    direction: 'out',
    kind: 'reward',
    subject: `Your review reward from M&P 🎁`,
    body: [
      `Hi ${shipment.customerName},`,
      ``,
      `Thanks for reviewing us! Your ${value} voucher code: ${code}`,
      `Redeem it in the Grab app. Quote it with your M&P consultant if you need a hand.`,
      ``,
      `— M&P International Freights · Moving you forward`
    ].join('\n'),
    ctaLabel: 'Book your next shipment',
    ctaUrl: `/`,
    at: at ?? new Date().toISOString()
  }
}

/** Status notice — customs cleared. Declaration itself is filed by a person. */
export function buildCustomsClearedEmail(shipment: Shipment, at?: string): OutboxEmail {
  const permit = shipment.customs?.permitNo
  return {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    to: shipment.customerEmail,
    from: MAIL_FROM,
    direction: 'out',
    kind: 'status',
    subject: `Customs cleared for ${shipment.id}`,
    body: [
      `Hi ${shipment.customerName},`,
      ``,
      `Singapore Customs has cleared ${shipment.id} (${shipment.description}).`,
      permit ? `Import permit ${permit} — declared on TradeNet by ${shipment.customs?.declaredBy ?? 'our customs team'}.` : '',
      `Next step and delivery status are on your tracking page.`,
      ``,
      `— M&P International Freights · Moving you forward`
    ].filter(Boolean).join('\n'),
    ctaLabel: 'Track your shipment',
    ctaUrl: `/track/${shipment.id}`,
    at: at ?? new Date().toISOString()
  }
}

export function buildInboundEmail(opts: {
  id?: string
  shipment: Shipment
  from: string
  fromName?: string
  subject: string
  body: string
  at: string
  matchedBy?: OutboxEmail['matchedBy']
}): OutboxEmail {
  return {
    id: opts.id ?? crypto.randomUUID(),
    shipmentId: opts.shipment.id,
    from: opts.from,
    to: 'cs@mp.com.sg',
    direction: 'in',
    kind: 'inbound',
    matchedBy: opts.matchedBy,
    subject: opts.subject,
    body: opts.body,
    ctaLabel: 'Open shipment',
    ctaUrl: `/track/${opts.shipment.id}`,
    at: opts.at,
    delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'inbound' }
  }
}

export function buildCsReplyEmail(opts: {
  id?: string
  shipment: Shipment
  to: string
  subject: string
  body: string
  at: string
}): OutboxEmail {
  return {
    id: opts.id ?? crypto.randomUUID(),
    shipmentId: opts.shipment.id,
    from: MAIL_FROM,
    to: opts.to,
    direction: 'out',
    kind: 'reply',
    subject: opts.subject.startsWith('Re:') ? opts.subject : `Re: ${opts.subject}`,
    body: opts.body,
    ctaLabel: 'Track your shipment',
    ctaUrl: `/track/${opts.shipment.id}`,
    at: opts.at,
    delivery: { state: 'simulated', to: opts.to, detail: 'pre-seeded demo data' }
  }
}

function minsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

/** Seed helper for simulated WhatsApp messages — fixed ids keep the seed deterministic. */
function wa(id: string, direction: 'in' | 'out', from: string, body: string, mins: number, attachment?: ThreadMessage['attachment']): ThreadMessage {
  return { id, direction, from, body, at: minsAgo(mins), ...(attachment ? { attachment } : {}) }
}

const SEED_SIGNATURE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70"><path d="M15 45 C 40 12, 62 58, 92 32 S 138 18, 168 40 S 195 30, 205 36" stroke="#1a2433" fill="none" stroke-width="2.5" stroke-linecap="round"/></svg>'
)

function reviewShot(name: string, stars: number, text: string, platform: string): string {
  const star = '★'.repeat(stars) + '☆'.repeat(5 - stars)
  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const line1 = text.slice(0, 58)
  const line2 = text.slice(58, 116)
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="168">
      <rect width="380" height="168" rx="10" fill="#ffffff"/>
      <rect x="0.5" y="0.5" width="379" height="167" rx="10" fill="none" stroke="#e5e7eb"/>
      <text x="18" y="32" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="#221f1f">${safe(name)}</text>
      <text x="18" y="56" font-family="Segoe UI, Arial" font-size="16" fill="#f59e0b">${star}</text>
      <text x="18" y="86" font-family="Segoe UI, Arial" font-size="13" fill="#3a3432">${safe(line1)}</text>
      <text x="18" y="106" font-family="Segoe UI, Arial" font-size="13" fill="#3a3432">${safe(line2)}</text>
      <text x="18" y="148" font-family="Segoe UI, Arial" font-size="11" fill="#69727d">${safe(platform)} · Public review</text>
    </svg>`
  )
}

// Standing rate cards — static, not persisted
export const RATE_CARDS: Quote[] = [
  {
    ref: 'QT-CN-LCL',
    title: 'Sea Freight Import — LCL ex-China',
    route: 'Shanghai / Shenzhen (CNSHA / CNSZX) → Singapore (SGSIN)',
    containerType: 'LCL — general cargo, non-hazardous',
    carrier: 'LCL consolidation',
    validUntil: '2026-09-30',
    showSubtotals: false,
    sections: [
      {
        key: 'A',
        title: 'Ocean freight & surcharges',
        currency: 'USD',
        lines: [
          { label: 'Ocean freight', amount: 50, unit: '/m³' },
          { label: 'General rate increase (GRI)', amount: 10, unit: '/m³' },
          { label: 'Emergency bunker surcharge (EBS)', amount: 15, unit: '/RT' }
        ]
      },
      {
        key: 'B',
        title: 'Origin charges (China)',
        currency: 'USD',
        lines: [
          { label: 'CFS', amount: 15, unit: '/RT' },
          { label: 'Documentation (DOC)', amount: 30, unit: '/BL' },
          { label: 'Customs', amount: 40, unit: '/BL' },
          { label: 'Collection cost', amount: null, note: 'TBA — case to case' }
        ]
      },
      {
        key: 'C',
        title: 'Singapore local charges',
        currency: 'SGD',
        lines: [
          { label: 'LCL charges', amount: 18, unit: '/w-m' },
          { label: 'THC', amount: 9, unit: '/w-m' },
          { label: 'PSA wharfage', amount: 1.75, unit: '/w-m' },
          { label: 'Delivery order fee', amount: 180, unit: '/set' },
          { label: 'Agency fee', amount: 60, unit: '/shipment' },
          { label: 'Import permit', amount: 40, unit: '/set' },
          { label: 'Clearance charges', amount: 50, unit: '/shipment' },
          { label: 'Transportation', amount: 90, unit: '/trip', note: 'or SGD 9.50/w-m · subject to GST' },
          { label: 'Import processing fee', amount: 35, unit: '/shipment' },
          { label: 'Cargo tracing fee', amount: 15, unit: '/shipment' },
          { label: 'Forklift', amount: 55, unit: '/3 cbm' },
          { label: 'FTZ surcharges', amount: 6, unit: '/w-m' },
          { label: 'Surge fee', amount: 8, unit: '/w-m' },
          { label: 'Tailgate', amount: 60, excluded: true, note: 'if required' },
          { label: 'Labour cost', amount: 70, excluded: true, note: 'if required' },
          { label: 'Warehouse surcharges', amount: 0, note: 'waived' },
          { label: 'Admin surcharges', amount: 0, note: 'waived' },
          { label: 'Singapore GST', amount: null, note: 'at cost, on cargo value' }
        ]
      }
    ],
    notes: [
      'Excludes insurance coverage.',
      'Transport rate assumes industrial / warehouse areas with proper unloading facilities.'
    ]
  },
  {
    ref: 'QT-KR-LCL',
    title: 'Sea Freight Import — LCL ex-Korea',
    route: 'Busan (KRPUS) → Singapore (SGSIN)',
    containerType: 'LCL — general cargo, palletised or loose',
    carrier: 'LCL consolidation',
    validUntil: '2026-09-30',
    showSubtotals: false,
    sections: [
      {
        key: 'A',
        title: 'Ocean freight & surcharges',
        currency: 'USD',
        subtitle: 'Per revenue ton (RT)',
        lines: [
          { label: 'Ocean freight', amount: 30, unit: '/RT' },
          { label: 'Low sulphur surcharge (LSS)', amount: 13, unit: '/RT' },
          { label: 'Peak season surcharge (PSS)', amount: 30, unit: '/RT' }
        ]
      },
      {
        key: 'B',
        title: 'Origin charges (Korea)',
        currency: 'USD',
        lines: [
          { label: 'CFS', amount: 6.5, unit: '/RT' },
          { label: 'THC', amount: 6.5, unit: '/RT' },
          { label: 'Documentation (DOC)', amount: 60, unit: '/BL' },
          { label: 'Handling (HDL)', amount: 40, unit: '/BL' },
          { label: 'Customs clearance fee', amount: null, note: 'FOB value × 0.15%, min USD 60/shpt' }
        ]
      },
      {
        key: 'C',
        title: 'Singapore local charges',
        currency: 'SGD',
        lines: [
          { label: 'LCL charges', amount: 18, unit: '/w-m' },
          { label: 'THC', amount: 9, unit: '/w-m' },
          { label: 'PSA wharfage', amount: 1.75, unit: '/w-m' },
          { label: 'Delivery order fee', amount: 180, unit: '/set' },
          { label: 'Agency fee', amount: 60, unit: '/shipment' },
          { label: 'Import permit', amount: 40, unit: '/set' },
          { label: 'Clearance charges', amount: 50, unit: '/shipment' },
          { label: 'Transportation', amount: 90, unit: '/trip', note: 'subject to GST' },
          { label: 'Import processing fee', amount: 35, unit: '/shipment' },
          { label: 'Tailgate', amount: 60, excluded: true, note: 'if required' },
          { label: 'Singapore GST', amount: null, note: 'at cost, on cargo value' }
        ]
      }
    ],
    notes: [
      'Excludes insurance coverage.',
      'EXW rate subject to change if cargo details change.'
    ]
  },
  {
    ref: 'QT-HK-AIR',
    title: 'Air Freight Import — ex-Hong Kong',
    route: 'Hong Kong (HKG) → Singapore (SIN)',
    containerType: 'Air freight — general cargo, chargeable weight',
    carrier: 'SQ / CX consolidation',
    validUntil: '2026-09-30',
    showSubtotals: false,
    sections: [
      {
        key: 'A',
        title: 'Air freight & origin (Hong Kong)',
        currency: 'USD',
        lines: [
          { label: 'Air freight', amount: 2.1, unit: '/kg', note: 'min 45 kg chargeable' },
          { label: 'Fuel surcharge', amount: 0.55, unit: '/kg' },
          { label: 'Security surcharge', amount: 0.18, unit: '/kg' },
          { label: 'AWB / documentation fee', amount: 45, unit: '/AWB' },
          { label: 'Origin handling', amount: 55, unit: '/shipment' },
          { label: 'Export declaration fee', amount: null, note: 'CIF value HKD × 0.025%, min HKD 15' }
        ]
      },
      {
        key: 'B',
        title: 'Singapore local charges',
        currency: 'SGD',
        lines: [
          { label: 'Airport terminal handling', amount: 0.16, unit: '/kg', note: 'min SGD 50' },
          { label: 'Delivery order fee', amount: 95, unit: '/set' },
          { label: 'Agency fee', amount: 60, unit: '/shipment' },
          { label: 'Import permit', amount: 40, unit: '/set' },
          { label: 'Clearance charges', amount: 50, unit: '/shipment' },
          { label: 'Transportation (Changi → your door)', amount: 110, unit: '/trip', note: 'subject to GST' },
          { label: 'After-hours release', amount: 80, excluded: true, note: 'if required' },
          { label: 'Singapore GST', amount: null, note: 'at cost, on cargo value' }
        ]
      }
    ],
    notes: [
      'Excludes insurance coverage.',
      'Chargeable weight = greater of actual weight or volumetric (÷ 6000).'
    ]
  }
]

// Unmatched clutter on the shared CS inbox (shipmentId '') — proves the fold.
function noiseMails(): OutboxEmail[] {
  const base = (id: string, from: string, subject: string, body: string, at: string): OutboxEmail => ({
    id,
    shipmentId: '',
    from,
    to: 'cs@mp.com.sg',
    direction: 'in',
    kind: 'inbound',
    subject,
    body,
    ctaLabel: 'Open M&P tracking',
    ctaUrl: '/',
    at,
    delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'inbound' }
  })
  return [
    base(
      'in-noise-pickletour',
      'noreply@pickletour.app',
      'OCBC PickleSprout 2026 — court schedule update',
      'Your court allocation for Saturday has moved to Court 4. Do not reply to this email.',
      minsAgo(95)
    ),
    base(
      'in-noise-newsletter',
      'newsletter@freightweekly.example',
      'Freight Weekly: rates dip 4%',
      'Asia–Europe spot rates dipped 4% week on week. Unsubscribe at any time.',
      minsAgo(170)
    ),
    base(
      'in-noise-vendor',
      'hello@some-vendor.example',
      'Re: Partnership opportunity',
      'Following up on my previous email about a partnership with your logistics team.',
      minsAgo(260)
    )
  ]
}

export function buildSeedData(): { shipments: Shipment[]; emails: OutboxEmail[] } {
  // Scenario 1 — B2B freight forwarding: Allmighty Foods ingredient import,
  // container ex-Busan discharged at PSA, customs cleared, drayage to Senoko
  const s1: Shipment = {
    id: 'MP-4471-AF',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'Sea freight import + customs + drayage',
    status: 'in_transit',
    customerName: 'Melissa Tan',
    customerEmail: 'melissa@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd',
    poNumber: 'PO-4471',
    incoterms: 'EXW',
    origin: 'PSA Pasir Panjang Terminal 3',
    destination: 'Allmighty Foods, Senoko Food Hub',
    eta: new Date(Date.now() + 3 * 3600_000).toISOString(),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: 'Prime mover — XD 4521 K',
    pieces: 1,
    weightKg: 11200,
    description: "20' container TEMU 482391-0 — konjac flour & oat fibre (ex-Busan, SINOKOR)",
    events: [],
    customs: {
      required: true,
      status: 'declared',
      declaredBy: 'Joreen (M&P Customs)',
      declaredAt: minsAgo(60 * 6),
      permitNo: 'IN-2026-09-044713',
      note: 'Documents checked by M&P, declaration filed manually on TradeNet',
      declaration: {
        declarationType: 'IN',
        hsCode: '1108.19.00',
        cargoValue: 38420,
        currency: 'USD',
        countryOfOrigin: 'KR — Republic of Korea',
        importerUEN: '201422319R',
        importerName: 'Allmighty Foods Pte Ltd',
        permitType: 'IN-PAYMENT (GST)',
        vesselName: 'SINOKOR NAGOYA',
        voyage: '2418S',
        blNo: 'SKRSIN-2409114',
        containerNo: 'TEMU 482391-0',
        portOfLoading: 'KRPUS — Busan',
        portOfDischarge: 'SGSIN — PSA Pasir Panjang T3',
        packages: 1,
        grossWeightKg: 11200,
        description: 'Konjac flour & oat fibre, food grade, bagged',
        incoterms: 'EXW',
        filedBy: 'Joreen (M&P Customs)',
        filedAt: minsAgo(60 * 6),
        permitNo: 'IN-2026-09-044713'
      }
    },
    documents: [
      { key: 'cinv', label: 'Commercial invoice', required: true, category: 'customs', status: 'approved', fileName: 'INV-AF-2481.pdf', uploadedBy: 'Allmighty Foods', at: minsAgo(60 * 23) },
      { key: 'plist', label: 'Packing list', required: true, category: 'customs', status: 'approved', fileName: 'PL-AF-2481.pdf', uploadedBy: 'Allmighty Foods', at: minsAgo(60 * 23) },
      { key: 'bl', label: 'Bill of lading (HBL)', required: true, category: 'customs', status: 'approved', fileName: 'SEARASI-HBL.pdf', uploadedBy: 'M&P', at: minsAgo(60 * 24) },
      { key: 'permit', label: 'Import permit (TradeNet)', required: true, category: 'customs', status: 'approved', fileName: 'permit-MP4471.pdf', uploadedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 6), note: 'Filed manually on TradeNet by M&P after doc check' },
      { key: 'auth', label: 'Haulier authorisation letter', required: true, category: 'delivery', status: 'uploaded', fileName: 'auth-letter.pdf', uploadedBy: 'Allmighty Foods', at: minsAgo(60 * 5), note: 'Haulier: NEK Logistics · CR 199402400H' },
      { key: 'slip', label: 'Payment transfer slip', required: true, category: 'payment', status: 'pending', deadline: new Date(Date.now() + 24 * 3600_000).toISOString(), note: 'SGD 485.00 local charges — upload proof of transfer' },
      { key: 'photos', label: 'Container photos (yard)', required: false, category: 'delivery', status: 'pending', note: 'Or ask your driver — photos posted to the timeline count too' }
    ],
    quote: {
      ref: 'QT-2481',
      title: "Sea Freight Import — FCL 20' Dry",
      route: 'Busan (KRPUS) → Singapore (SGSIN)',
      containerType: "20' dry container, non-hazardous cargo",
      carrier: 'SINOKOR',
      validUntil: '2026-09-30',
      sections: [
        {
          key: 'A',
          title: 'Origin ex-works charges',
          currency: 'USD',
          lines: [
            { label: 'Pick-up charge to Busan', amount: 870, unit: "/20'" },
            { label: 'Export clearance', amount: 60, unit: '/shipment', note: '0.25% of invoice value, min USD 60' },
            { label: 'Origin port charge', amount: 145, unit: "/20'" },
            { label: 'Documentation fee', amount: 60, unit: '/BL' }
          ]
        },
        {
          key: 'B',
          title: 'Ocean freight',
          currency: 'USD',
          subtitle: 'SINOKOR · subject to space & empty equipment',
          lines: [
            { label: 'Ocean freight', amount: 1250, unit: "/20'" },
            { label: 'Low sulphur surcharge (LSS)', amount: 240, unit: "/20'" }
          ]
        },
        {
          key: 'C',
          title: 'Singapore local charges',
          currency: 'SGD',
          lines: [
            { label: 'Terminal handling (THC)', amount: 230, unit: "/20'" },
            { label: 'DO fee', amount: 180, unit: '/set' },
            { label: 'Agency fee', amount: 60, unit: '/shipment' },
            { label: 'Import permit', amount: 40, unit: '/set' },
            { label: 'FCL charges', amount: 50, unit: '/shipment' },
            { label: 'Import trucking to your warehouse', amount: 160, unit: "/20'", note: 'subject to GST' },
            { label: 'LOLO', amount: 59, unit: "/20'" },
            { label: 'Depot', amount: 50, unit: '/cntr' },
            { label: 'Portnet', amount: 10, unit: '/cntr' },
            { label: 'CMS', amount: 15, unit: '/cntr', note: 'subject to GST' },
            { label: 'Fuel surcharge', amount: 45, unit: '/cntr' },
            { label: 'Outskirt surcharge', amount: 70, unit: '/cntr' },
            { label: 'Tuas terminal surcharge', amount: 100, unit: '/cntr', excluded: true, note: 'only if vessel berths at Tuas Terminal' }
          ]
        },
        {
          key: 'D',
          title: 'At cost',
          currency: 'SGD',
          lines: [
            { label: 'Other charges from yard', amount: null, note: 'washing / detention / demurrage etc.' },
            { label: 'Singapore GST', amount: null, note: '9%, where applicable' }
          ]
        }
      ],
      notes: [
        'Rates exclude palletisation / unstuffing.',
        'Tuas terminal surcharge applies only if the vessel berths at the new Tuas Terminal.',
        'Subject to space & empty equipment availability.'
      ]
    },
    createdAt: minsAgo(60 * 26)
  }
  addEvent(s1, { type: 'created', actor: 'cs', note: 'Import job booked, tracking link shared with Allmighty Foods', at: minsAgo(60 * 26) })
  addEvent(s1, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 26) })
  addEvent(s1, { type: 'note', actor: 'cs', note: 'Vessel berthed, container discharged at Pasir Panjang T3', at: minsAgo(60 * 9) })
  addEvent(s1, { type: 'customs', actor: 'cs', note: '🛃 Ready for declaration — invoice, packing list and B/L checked by M&P', at: minsAgo(60 * 7) })
  addEvent(s1, { type: 'customs', actor: 'cs', note: '🛃 Declaration filed on TradeNet by Joreen (M&P Customs) (manual) · permit IN-2026-09-044713', at: minsAgo(60 * 6) })
  addEvent(s1, { type: 'status', status: 'picked_up', actor: 'driver', note: 'Container collected from PSA gate, seal intact', at: minsAgo(60 * 2) })
  addEvent(s1, { type: 'status', status: 'in_transit', actor: 'driver', note: 'On the way to Senoko via AYE → SLE', at: minsAgo(80) })

  // Scenario 2 — B2C last mile: Allmighty Foods online order to a consumer
  const s2: Shipment = {
    id: 'MP-7302-AF',
    programmeId: 'auto5',
    mode: 'b2c',
    service: 'Last-mile delivery',
    status: 'out_for_delivery',
    customerName: 'Daniel Wong',
    customerEmail: 'daniel.wong@gmail.com',
    company: 'Allmighty Foods Pte Ltd',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub',
    destination: 'Blk 512 Bedok North Ave 2, #07-134',
    eta: new Date(Date.now() + 45 * 60_000).toISOString(),
    driverName: 'Suresh Kumar',
    driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D',
    pieces: 2,
    weightKg: 6,
    description: 'Online order #AMF-10482 — konjac jelly & noodle bundle',
    events: [],
    createdAt: minsAgo(60 * 8)
  }
  addEvent(s2, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent to customer', at: minsAgo(60 * 8) })
  addEvent(s2, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 8) })
  addEvent(s2, { type: 'status', status: 'picked_up', actor: 'driver', note: 'Order collected from Senoko warehouse', at: minsAgo(90) })
  addEvent(s2, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(75) })
  addEvent(s2, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: '3 stops away, Bedok North area', at: minsAgo(20) })

  // Scenario 3 — B2SELF last mile: Hey Fran restocking their own pop-up
  const s3: Shipment = {
    id: 'MP-5108-HF',
    programmeId: 'auto5',
    mode: 'b2self',
    service: 'Last-mile delivery (own outlets)',
    status: 'picked_up',
    customerName: 'Fran Lim',
    customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran',
    poNumber: 'TRF-0219',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1',
    destination: 'Hey Fran pop-up, Orchard Central #02-18',
    eta: new Date(Date.now() + 2 * 3600_000).toISOString(),
    driverName: 'Azlan Ismail',
    driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A',
    pieces: 9,
    weightKg: 110,
    description: 'Outlet restock — retail stock, packaging & display fixtures',
    events: [],
    createdAt: minsAgo(60 * 3)
  }
  addEvent(s3, { type: 'created', actor: 'cs', note: 'Internal transfer booked, tracking link shared with Hey Fran team', at: minsAgo(60 * 3) })
  addEvent(s3, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 3) })
  addEvent(s3, { type: 'status', status: 'picked_up', actor: 'driver', note: 'Loaded 9 boxes at Kaki Bukit, sealing van', at: minsAgo(25) })

  // Scenario 4 — B2B LCL import at quotation stage: Allmighty Foods jelly cartons
  const s4: Shipment = {
    id: 'MP-6220-AF',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'LCL sea import + customs + delivery',
    status: 'booked',
    customerName: 'Esther Ng',
    customerEmail: 'esther@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd',
    poNumber: 'PO-4512',
    incoterms: 'EXW',
    origin: 'Shipper facility, Gyeonggi-do → Busan CFS',
    destination: 'Allmighty Foods, Senoko Food Hub',
    eta: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
    driverName: 'Unassigned',
    vehicle: '—',
    pieces: 376,
    weightKg: 5078,
    description: 'Jelly-filled cartons ×375 + 1 pallet spare flat cartons — 10.971 m³ / 4,687.5 kg',
    events: [],
    // Filed ahead of arrival, then Singapore Customs came back with a question —
    // the officer answers it on TradeNet, nothing about this is automatic.
    customs: {
      required: true,
      status: 'queried',
      declaredBy: 'Joreen (M&P Customs)',
      declaredAt: minsAgo(60 * 9),
      permitNo: 'IN-2026-09-062204',
      queriedAt: minsAgo(60 * 3),
      queryNote: 'Singapore Customs: HS code 1704.90 vs description mismatch — confirm jelly confectionery vs fruit preparation, and re-state the FOB value used.',
      note: 'Customs query open — Joreen (M&P Customs) to respond on TradeNet',
      declaration: {
        declarationType: 'IN',
        hsCode: '1704.90.90',
        cargoValue: 3943,
        currency: 'SGD',
        countryOfOrigin: 'KR — Republic of Korea',
        importerUEN: '201422319R',
        importerName: 'Allmighty Foods Pte Ltd',
        permitType: 'IN-PAYMENT (GST)',
        vesselName: 'SUNNY CALLA',
        voyage: '2411S',
        blNo: 'SJLSIN-6220114',
        portOfLoading: 'KRPUS — Busan',
        portOfDischarge: 'SGSIN — Keppel Distripark',
        packages: 376,
        grossWeightKg: 5078,
        description: 'Jelly-filled cartons, retail packed, food grade',
        incoterms: 'EXW',
        filedBy: 'Joreen (M&P Customs)',
        filedAt: minsAgo(60 * 9),
        permitNo: 'IN-2026-09-062204'
      }
    },
    documents: [
      { key: 'hbl', label: 'House bill of lading', required: true, category: 'customs', status: 'approved', fileName: 'HBL-SJL-6220114.pdf', uploadedBy: 'Sunjin Logis', verifiedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 12) },
      { key: 'cinv', label: 'Commercial invoice', required: true, category: 'customs', status: 'approved', fileName: 'INV-AF-6220.pdf', uploadedBy: 'Allmighty Foods', verifiedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 12) },
      { key: 'plist', label: 'Packing list', required: true, category: 'customs', status: 'approved', fileName: 'PL-AF-6220.pdf', uploadedBy: 'Allmighty Foods', verifiedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 12) },
      { key: 'permit', label: 'Import permit (TradeNet)', required: true, category: 'customs', status: 'approved', fileName: 'permit-MP-6220-AF.pdf', uploadedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 9), note: 'Filed on TradeNet by Joreen — query raised against it by Singapore Customs' }
    ],
    quote: {
      ref: 'QT-6220',
      title: 'Sea Freight Import — LCL ex-Korea',
      route: 'Busan (KRPUS) → Singapore (SGSIN)',
      containerType: 'LCL — 1 pallet + 375 cartons',
      carrier: 'LCL consolidation',
      validUntil: '2026-09-30',
      cargo: [
        'Spare flat cartons — 1 pallet / 3,000 pcs / 390 kg ≈ 1.5 m³',
        'Jelly-filled cartons — 375 ctns @ 41 × 22 × 28 cm, 12.5 kg each = 4,687.5 kg / 9.471 m³',
        'Total chargeable: 10.971 m³ (w/m)'
      ],
      showSubtotals: false,
      lumpSum: {
        amount: 3943.04,
        currency: 'SGD',
        note: 'USD 1,931.50 × 1.43 + SGD 1,180.99 · subject to GST, customs clearance (FOB × 0.15%, min USD 60) & palletisation USD 80/pallet'
      },
      sections: [
        {
          key: 'A',
          title: 'Ocean freight & surcharges',
          currency: 'USD',
          subtitle: 'Per revenue ton (RT), EXW — rate subject to change if cargo detail changes',
          lines: [
            { label: 'Ocean freight', amount: 30, unit: '/RT' },
            { label: 'Low sulphur surcharge (LSS)', amount: 13, unit: '/RT' },
            { label: 'Peak season surcharge (PSS)', amount: 30, unit: '/RT' }
          ]
        },
        {
          key: 'B',
          title: 'Origin charges (Korea)',
          currency: 'USD',
          lines: [
            { label: 'CFS', amount: 6.5, unit: '/RT' },
            { label: 'THC', amount: 6.5, unit: '/RT' },
            { label: 'Wharfage (WFG)', amount: 1, unit: '/RT' },
            { label: 'Documentation (DOC)', amount: 60, unit: '/BL' },
            { label: 'Handling (HDL)', amount: 40, unit: '/BL' },
            { label: 'Drayage (SHTV)', amount: 7, unit: '/RT', note: 'VAT 10%' },
            { label: 'Trucking charge', amount: 800, unit: '/shpt' },
            { label: 'Customs clearance fee', amount: null, note: 'FOB value × 0.15%, min USD 60/shpt' },
            { label: 'Palletisation (packing charge)', amount: 80, unit: '/pallet' }
          ]
        },
        {
          key: 'C',
          title: 'Singapore local charges',
          currency: 'SGD',
          lines: [
            { label: 'LCL charges', amount: 18, unit: '/w-m' },
            { label: 'THC', amount: 9, unit: '/w-m' },
            { label: 'PSA wharfage', amount: 1.75, unit: '/w-m' },
            { label: 'Delivery order fee', amount: 180, unit: '/set' },
            { label: 'Agency fee', amount: 60, unit: '/shipment' },
            { label: 'Import permit', amount: 40, unit: '/set' },
            { label: 'Clearance charges', amount: 50, unit: '/shipment' },
            { label: 'Transportation', amount: 90, unit: '/trip', note: 'or SGD 9.50/w-m · subject to GST' },
            { label: 'Import processing fee', amount: 35, unit: '/shipment' },
            { label: 'Cargo tracing fee', amount: 15, unit: '/shipment' },
            { label: 'Forklift', amount: 55, unit: '/3 cbm' },
            { label: 'FTZ surcharges', amount: 6, unit: '/w-m' },
            { label: 'Surge fee', amount: 8, unit: '/w-m' },
            { label: 'Tailgate', amount: 60, excluded: true, note: 'if required' },
            { label: 'CBD area surcharge', amount: 60, excluded: true, note: 'if required' },
            { label: 'Labour cost', amount: 70, excluded: true, note: 'if required' },
            { label: 'Warehouse surcharges', amount: 0, note: 'waived' },
            { label: 'Admin surcharges', amount: 0, note: 'waived' },
            { label: 'Singapore GST', amount: null, note: 'at cost, on cargo value' }
          ]
        }
      ],
      notes: [
        'Excludes insurance coverage.',
        'Transport rate assumes industrial / warehouse areas with proper unloading facilities.',
        'EXW rate subject to change if cargo details change.'
      ],
      updates: [
        { from: 'M&P · Jason', at: minsAgo(60 * 48), text: 'EXW rate card shared (sections above). Rates subject to change if cargo detail changes.' },
        { from: 'Allmighty Foods · Esther', at: minsAgo(60 * 30), text: 'Thanks! Can we get an estimated lump sum for the full consignment (10.971 m³)?' },
        { from: 'M&P · Jason', at: minsAgo(60 * 26), text: 'Estimated lump sum: USD 1,931.50 × 1.43 + SGD 1,180.99 = SGD 3,943.04. Subject to Singapore GST, customs clearance fee (FOB value × 0.15%, min USD 60) and palletisation USD 80/pallet.' },
        { from: 'Allmighty Foods · Esther', at: minsAgo(60 * 22), text: 'Please also check FCL 20ft: (a) truck the container to shipper for stuffing — total cost; (b) truck the container to our end and we unstuff ourselves.' },
        { from: 'M&P · Jason', at: minsAgo(60 * 4), text: 'Checking FCL 20ft rates and both stuffing options with our Korea team — will revert shortly.' }
      ]
    },
    createdAt: minsAgo(60 * 49)
  }
  addEvent(s4, { type: 'created', actor: 'cs', note: 'Enquiry received — quotation QT-6220 shared with Allmighty Foods', at: minsAgo(60 * 49) })
  addEvent(s4, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 49) })
  addEvent(s4, { type: 'note', actor: 'cs', note: 'Awaiting confirmation — FCL 20ft comparison in progress', at: minsAgo(60 * 4) })
  addEvent(s4, { type: 'customs', actor: 'cs', note: '🛃 Declaration filed on TradeNet by Joreen (M&P Customs) · permit IN-2026-09-062204', at: minsAgo(60 * 9) })
  addEvent(s4, { type: 'customs', actor: 'cs', note: '🛃 Customs query raised — Singapore Customs: HS code 1704.90 vs description mismatch — confirm jelly confectionery vs fruit preparation, and re-state the FOB value used.', at: minsAgo(60 * 3) })

  // Scenario 5 — B2B LCL import ex-Hong Kong for Mecha (mecha.store)
  const s5: Shipment = {
    id: 'MP-3318-MC',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'LCL sea import (HK → SG)',
    status: 'in_transit',
    customerName: 'Brendan De Souza',
    customerEmail: 'brendan@mecha.store',
    company: 'Mecha',
    poNumber: 'EXW-HK-1201',
    incoterms: 'EXW',
    origin: 'Shipper warehouse, Kowloon → HK CFS',
    destination: 'Mecha, Singapore',
    eta: new Date(Date.now() + 2 * 24 * 3600_000).toISOString(),
    driverName: 'Unassigned',
    vehicle: '—',
    pieces: 32,
    weightKg: 296,
    description: '32 cartons — 295.52 kg / 1.299 m³ (LCL, vessel HONGKONG BRIDGE V.0055S)',
    events: [],
    customs: {
      required: true,
      status: 'docs_pending',
      note: '2 documents outstanding before M&P can declare on TradeNet',
      declaration: {
        declarationType: 'IN',
        currency: 'USD',
        countryOfOrigin: 'HK — Hong Kong SAR',
        importerName: 'Mecha Pte Ltd',
        permitType: 'IN-PAYMENT (GST)',
        vesselName: 'HONGKONG BRIDGE',
        voyage: '0055S',
        blNo: 'HBL-ICS-3318-0055',
        portOfLoading: 'HKHKG — Hong Kong',
        portOfDischarge: 'SGSIN — Keppel Distripark',
        packages: 32,
        grossWeightKg: 296,
        description: 'Mechanical keyboard kits & accessories, retail packed',
        incoterms: 'EXW'
        // hsCode, cargoValue and importerUEN still missing — see declarationGaps()
      }
    },
    documents: [
      { key: 'hbl', label: 'House bill of lading', required: true, category: 'customs', status: 'approved', fileName: 'HBL-ICS-draft.pdf', uploadedBy: 'M&P', at: minsAgo(60 * 68), note: 'Checked by M&P — becomes final on vessel departure' },
      { key: 'cinv', label: 'Commercial invoice', required: true, category: 'customs', status: 'pending', deadline: new Date(Date.now() + 24 * 3600_000).toISOString(), note: 'Needed before M&P can declare on TradeNet' },
      { key: 'plist', label: 'Packing list', required: true, category: 'customs', status: 'pending', deadline: new Date(Date.now() + 24 * 3600_000).toISOString(), note: 'Needed before M&P can declare on TradeNet' },
      { key: 'gst', label: 'GST payment advice', required: true, category: 'payment', status: 'pending', note: 'GST is cash/COD term — upload transfer proof before delivery' }
    ],
    quote: {
      ref: 'QT-3318',
      title: 'Sea Freight Import — LCL ex-Hong Kong',
      route: 'Hong Kong (HKHKG) → Singapore (SGSIN)',
      containerType: 'LCL — 32 cartons',
      carrier: 'LCL consolidation',
      validUntil: '2026-09-30',
      cargo: ['32 cartons — 295.52 kg / 1.299 m³ chargeable (w/m)'],
      showSubtotals: false,
      lumpSum: {
        amount: 1224.13,
        currency: 'SGD',
        note: 'USD 392.94 × 1.38 + SGD 681.87 · subject to carpark fee, shipper warehouse gate charges, export declaration (CIF HKD × 0.025%, min HKD 15 + HKD 100 handling) & GST'
      },
      sections: [
        {
          key: 'A',
          title: 'Ocean freight & origin (Hong Kong)',
          currency: 'USD',
          lines: [
            { label: 'Ocean freight', amount: 20, unit: '/m³' },
            { label: 'CFS', amount: 40, unit: '/RT' },
            { label: 'Handling', amount: 65, unit: '/set' },
            { label: 'Documentation fee', amount: 60, unit: '/set' },
            { label: 'Pick-up fee', amount: 0.25, unit: '/kg', note: 'or USD 20/cbm · min USD 120' },
            { label: 'CFS warehouse gate charge', amount: 70, unit: '/shpt' },
            { label: 'Carpark fee', amount: null, note: 'at cost' },
            { label: "Shipper's warehouse gate charges", amount: null, note: 'at cost' },
            { label: 'Export declaration fee', amount: null, note: 'CIF value HKD × 0.025%, min HKD 15' },
            { label: 'Export declaration handling', amount: null, note: 'HKD 100' }
          ]
        },
        {
          key: 'B',
          title: 'Singapore local charges',
          currency: 'SGD',
          lines: [
            { label: 'LCL charges', amount: 18, unit: '/w-m' },
            { label: 'THC', amount: 9, unit: '/w-m' },
            { label: 'PSA wharfage', amount: 1.75, unit: '/w-m' },
            { label: 'Delivery order fee', amount: 150, unit: '/set' },
            { label: 'Agency fee', amount: 60, unit: '/shipment' },
            { label: 'Import permit', amount: 40, unit: '/set' },
            { label: 'Clearance charges', amount: 50, unit: '/shipment' },
            { label: 'Transportation', amount: 90, unit: '/trip', note: 'or SGD 9.50/w-m · subject to GST' },
            { label: 'Import processing fee', amount: 35, unit: '/shipment' },
            { label: 'Cargo tracing fee', amount: 15, unit: '/shipment' },
            { label: 'Forklift', amount: 55, unit: '/3 cbm' },
            { label: 'FTZ surcharges', amount: 6, unit: '/w-m' },
            { label: 'Tailgate', amount: 60, excluded: true, note: 'if required' },
            { label: 'Labour cost', amount: 70, excluded: true, note: 'if required' },
            { label: 'Warehouse surcharges', amount: 0, note: 'waived' },
            { label: 'Admin surcharges', amount: 0, note: 'waived' },
            { label: 'Singapore GST', amount: null, note: 'at cost, on cargo value' }
          ]
        }
      ],
      notes: [
        'Excludes insurance coverage.',
        'Transport rate assumes industrial / warehouse areas with proper unloading facilities.'
      ],
      updates: [
        { from: 'M&P · Joreen', at: minsAgo(60 * 144), text: 'LCL quotation shared — estimated lump sum SGD 1,224.13 for 32 ctns / 1.299 m³.' },
        { from: 'M&P · Joreen', at: minsAgo(60 * 138), text: 'HK agent assigned: Super Nova Logistics (Mr Fong, +852 2765 8741). Please share shipper details.' },
        { from: 'Mecha · Brendan', at: minsAgo(60 * 120), text: 'Shipper details sent — Brendan handling this shipment going forward.' },
        { from: 'M&P · Joreen', at: minsAgo(60 * 96), text: 'HK side has reached the shipper — booking form will be submitted today.' },
        { from: 'M&P · Joreen', at: minsAgo(60 * 72), text: 'Cargo collected. Booked on HONGKONG BRIDGE V.0055S — ETA Singapore in 2 days.' },
        { from: 'Mecha · Brendan', at: minsAgo(60 * 70), text: 'Thanks for your work 😄⭐' },
        { from: 'M&P · Christina', at: minsAgo(60 * 20), text: 'Vessel ETA updated per carrier. Will update delivery status once container is unstuffed.' }
      ]
    },
    createdAt: minsAgo(60 * 144)
  }
  addEvent(s5, { type: 'created', actor: 'cs', note: 'Enquiry received via WhatsApp — LCL quotation QT-3318 shared', at: minsAgo(60 * 144) })
  addEvent(s5, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 144) })
  addEvent(s5, { type: 'note', actor: 'cs', note: 'HK agent assigned: Super Nova Logistics (Mr Fong)', at: minsAgo(60 * 138) })
  addEvent(s5, { type: 'note', actor: 'cs', note: 'Shipper contacted — booking form submitted', at: minsAgo(60 * 96) })
  addEvent(s5, { type: 'status', status: 'picked_up', actor: 'cs', note: 'Cargo collected at shipper warehouse, Kowloon', at: minsAgo(60 * 72) })
  addEvent(s5, { type: 'status', status: 'in_transit', actor: 'cs', note: 'Loaded on HONGKONG BRIDGE V.0055S — ETA Singapore in 2 days', at: minsAgo(60 * 70) })
  addEvent(s5, { type: 'customs', actor: 'cs', note: '🛃 Import declaration pending — commercial invoice & packing list still needed. M&P files on TradeNet once documents are checked.', at: minsAgo(60 * 20) })

  // Review-program seeds — delivered jobs that feed the rewards dashboard
  const s6: Shipment = {
    id: 'MP-8101-AF',
    programmeId: 'proof',
    mode: 'b2b',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Melissa Tan',
    customerEmail: 'melissa@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd',
    poNumber: 'PO-4488',
    incoterms: 'DAP',
    origin: 'Allmighty Foods, Senoko Food Hub',
    destination: 'RedMart DC, 20 Jurong Port Rd',
    eta: minsAgo(60 * 20),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 48,
    weightKg: 380,
    description: 'Oat pasta cartons — weekly replenishment (4 pallets)',
    events: [],
    createdAt: minsAgo(60 * 30),
    signoff: { name: 'Kumar (Receiving)', signature: SEED_SIGNATURE, at: minsAgo(60 * 19) },
    review: {
      rating: 5,
      comment: 'On time, driver helped restack pallets. Great service!',
      at: minsAgo(60 * 16),
      screenshot: reviewShot('Melissa Tan', 5, 'On time, driver helped restack pallets. Great service!', 'Google'),
      platforms: ['google', 'facebook'],
      reward: { code: 'MP-THANKS-8101KQ', at: minsAgo(60 * 12), value: 'Grab $10' },
      helpedBy: 'Hafiz (driver)'
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 18) }
  }
  addEvent(s6, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 30) })
  addEvent(s6, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 30) })
  addEvent(s6, { type: 'status', status: 'picked_up', actor: 'driver', note: 'Collected 4 pallets, Senoko bay 2', at: minsAgo(60 * 26) })
  addEvent(s6, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 25) })
  addEvent(s6, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Arriving Jurong Port Rd', at: minsAgo(60 * 21) })
  addEvent(s6, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Kumar (Receiving)', at: minsAgo(60 * 19) })
  addEvent(s6, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 19) })
  addEvent(s6, { type: 'note', actor: 'customer', note: 'Customer left a 5-star review: "On time, driver helped restack pallets. Great service!"', at: minsAgo(60 * 16) })
  addEvent(s6, { type: 'note', actor: 'system', note: '⭐ 5-star review — thank-you voucher MP-THANKS-8101KQ issued automatically', at: minsAgo(60 * 12) })

  const s7: Shipment = {
    id: 'MP-8110-AF',
    programmeId: 'proof',
    mode: 'b2b',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Esther Ng',
    customerEmail: 'esther@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd',
    poNumber: 'PO-4490',
    incoterms: 'DAP',
    origin: 'Allmighty Foods, Senoko Food Hub',
    destination: 'GreenMart Distribution Centre, Tuas',
    eta: minsAgo(60 * 28),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 60,
    weightKg: 495,
    description: 'Jelly cartons — 5 pallets, ambient',
    events: [],
    createdAt: minsAgo(60 * 40),
    signoff: { name: 'Ahmad (GreenMart inbound)', signature: SEED_SIGNATURE, at: minsAgo(60 * 27) },
    review: {
      rating: 4,
      comment: 'Smooth delivery, slight delay at the gate but driver kept us posted.',
      at: minsAgo(60 * 20),
      screenshot: reviewShot('Esther Ng', 4, 'Smooth delivery, slight delay at the gate but driver kept us posted.', 'Google'),
      platforms: ['google']
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 26) }
  }
  addEvent(s7, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 40) })
  addEvent(s7, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 40) })
  addEvent(s7, { type: 'status', status: 'picked_up', actor: 'driver', note: '5 pallets loaded', at: minsAgo(60 * 34) })
  addEvent(s7, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 33) })
  addEvent(s7, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Queueing at GreenMart gate, ~20 min', at: minsAgo(60 * 29) })
  addEvent(s7, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Ahmad (GreenMart inbound)', at: minsAgo(60 * 27) })
  addEvent(s7, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 27) })
  addEvent(s7, { type: 'note', actor: 'customer', note: 'Customer left a 4-star review: "Smooth delivery, slight delay at the gate but driver kept us posted."', at: minsAgo(60 * 20) })

  const s8: Shipment = {
    id: 'MP-8102-AF',
    programmeId: 'auto5',
    mode: 'b2c',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Priya Nair',
    customerEmail: 'priya.nair@example.sg',
    company: 'Allmighty Foods Pte Ltd',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub',
    destination: 'Blk 88 Tampines St 81, #11-203',
    eta: minsAgo(60 * 5),
    driverName: 'Suresh Kumar',
    driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D',
    pieces: 1,
    weightKg: 3,
    description: 'Online order #AMF-10513 — gummies & jelly pack',
    events: [],
    createdAt: minsAgo(60 * 10),
    signoff: { name: 'Priya Nair', signature: SEED_SIGNATURE, at: minsAgo(60 * 5) },
    reviewAsk: { state: 'sent', trigger: 'delivered', at: minsAgo(60 * 4) }
  }
  addEvent(s8, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 10) })
  addEvent(s8, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 10) })
  addEvent(s8, { type: 'status', status: 'picked_up', actor: 'driver', at: minsAgo(60 * 8) })
  addEvent(s8, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 7) })
  addEvent(s8, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Tampines area, 2 stops away', at: minsAgo(60 * 6) })
  addEvent(s8, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Priya Nair', at: minsAgo(60 * 5) })
  addEvent(s8, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 5) })
  addEvent(s8, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 4) })

  const s9: Shipment = {
    id: 'MP-8112-HF',
    programmeId: 'auto5',
    mode: 'b2self',
    service: 'Last-mile delivery (own outlets)',
    status: 'delivered',
    customerName: 'Fran Lim',
    customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran',
    poNumber: 'TRF-0220',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1',
    destination: 'Hey Fran pop-up, Orchard Central #02-18',
    eta: minsAgo(60 * 48),
    driverName: 'Azlan Ismail',
    driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A',
    pieces: 8,
    weightKg: 96,
    description: 'Weekend restock — retail stock & display cards',
    events: [],
    createdAt: minsAgo(60 * 56),
    signoff: { name: 'Fran Lim', signature: SEED_SIGNATURE, at: minsAgo(60 * 47) },
    review: {
      rating: 5,
      comment: 'Van arrived before opening — stock was on the floor in 15 minutes.',
      at: minsAgo(60 * 44),
      screenshot: reviewShot('Fran Lim', 5, 'Van arrived before opening — stock was on the floor in 15 minutes.', 'Facebook'),
      platforms: ['facebook'],
      reward: { code: 'MP-THANKS-8112RD', at: minsAgo(60 * 40), value: 'Grab $10' },
      helpedBy: 'Azlan (driver)'
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 46) }
  }
  addEvent(s9, { type: 'created', actor: 'cs', note: 'Internal transfer booked, tracking link shared', at: minsAgo(60 * 56) })
  addEvent(s9, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 56) })
  addEvent(s9, { type: 'status', status: 'picked_up', actor: 'driver', note: '8 boxes loaded at Kaki Bukit', at: minsAgo(60 * 52) })
  addEvent(s9, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 51) })
  addEvent(s9, { type: 'status', status: 'out_for_delivery', actor: 'driver', at: minsAgo(60 * 49) })
  addEvent(s9, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Fran Lim', at: minsAgo(60 * 47) })
  addEvent(s9, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 47) })
  addEvent(s9, { type: 'note', actor: 'customer', note: 'Customer left a 5-star review: "Van arrived before opening — stock was on the floor in 15 minutes."', at: minsAgo(60 * 44) })
  addEvent(s9, { type: 'note', actor: 'system', note: '⭐ 5-star review — thank-you voucher MP-THANKS-8112RD issued automatically', at: minsAgo(60 * 40) })

  // Delivered but NOT clean — open damage claim suppresses the review ask
  const s10: Shipment = {
    id: 'MP-8125-HF',
    programmeId: 'auto5',
    mode: 'b2self',
    service: 'Last-mile delivery (own outlets)',
    status: 'delivered',
    customerName: 'Fran Lim',
    customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran',
    poNumber: 'TRF-0224',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1',
    destination: 'Hey Fran pop-up, Jewel Changi Airport #B2-241',
    eta: minsAgo(95),
    driverName: 'Azlan Ismail',
    driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A',
    pieces: 8,
    weightKg: 104,
    description: 'Outlet restock — retail stock, packaging & display cards (Jewel pop-up)',
    events: [],
    createdAt: minsAgo(60 * 5),
    signoff: { name: 'Aiman (Jewel outlet)', signature: SEED_SIGNATURE, at: minsAgo(90) },
    claim: {
      type: 'damage',
      note: '2 of 8 cartons dented at corner — photos on timeline',
      openedAt: minsAgo(80),
      openedBy: 'customer',
      status: 'open'
    },
    reviewAsk: {
      state: 'held',
      trigger: 'delivered',
      at: minsAgo(80),
      reason: 'Open damage claim — routed to CS/claims, no review ask sent'
    }
  }
  addEvent(s10, { type: 'created', actor: 'cs', note: 'Internal transfer booked, tracking link shared', at: minsAgo(60 * 5) })
  addEvent(s10, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 5) })
  addEvent(s10, { type: 'status', status: 'picked_up', actor: 'driver', note: '8 cartons loaded at Kaki Bukit', at: minsAgo(60 * 4) })
  addEvent(s10, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 3) })
  addEvent(s10, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Arriving Jewel loading bay', at: minsAgo(110) })
  addEvent(s10, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Aiman (Jewel outlet)', at: minsAgo(90) })
  addEvent(s10, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(90) })
  addEvent(s10, { type: 'claim', actor: 'customer', note: '⚠️ Damage claim opened by customer: 2 of 8 cartons dented at corner — photos on timeline', at: minsAgo(80) })
  addEvent(s10, { type: 'note', actor: 'system', note: '⏸ Review request held — open damage claim → CS/claims', internal: true, at: minsAgo(80) })
  addEvent(s10, { type: 'note', actor: 'cs', note: 'Claim acknowledged — Sarah (CS) collecting photos and carton counts for the report', at: minsAgo(70) })


  // Scenario 11 — B2B LCL import ex-Shenzhen for Titan Associates (ex docs/sample-email-3).
  // The sick job: ETA already passed, no movement for 30h, packing list missing,
  // CFS blocked without the permit, and the customer is waiting on an NOA.
  const s11: Shipment = {
    id: 'MP-9032-TA',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'LCL sea import + customs + delivery',
    status: 'in_transit',
    customerName: 'WY Tan',
    customerEmail: 'wy.tan@titanassociates.com.sg',
    company: 'Titan Associates Pte Ltd',
    poNumber: 'ICS2008403',
    incoterms: 'FOB',
    origin: 'Cafganic Import & Export Trading Co. Ltd, Shenzhen (Yantian) CFS',
    destination: 'Titan Associates, 8 Tai Seng Link',
    eta: new Date(Date.now() - 6 * 3600_000).toISOString(),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 40,
    weightKg: 500,
    description: '40 pkgs wireless keyboards — 500 kg / 1.5 m³ (LCL, WAN HAI 516 V.W050)',
    events: [],
    customs: {
      required: true,
      status: 'docs_pending',
      note: 'Packing list outstanding — TradeNet draft half keyed in, waiting on HS code, cargo value and importer UEN',
      declaration: {
        declarationType: 'IN',
        importerName: 'Titan Associates Pte Ltd',
        permitType: 'IN-PAYMENT (GST)',
        vesselName: 'WAN HAI 516',
        voyage: 'W050',
        blNo: 'ICS2008403A',
        portOfLoading: 'CNSZX — Shenzhen (Yantian)',
        portOfDischarge: 'SGSIN — Keppel Distripark',
        packages: 40,
        grossWeightKg: 500,
        description: 'Wireless keyboards, retail packed',
        incoterms: 'FOB'
        // hsCode, cargoValue, currency, countryOfOrigin, importerUEN still missing
      }
    },
    documents: [
      { key: 'hbl', label: 'House bill of lading', required: true, category: 'customs', status: 'approved', fileName: 'HBL-COPY-ICS2008403A.pdf', uploadedBy: 'ICS Shenzhen', verifiedBy: 'Christina (M&P CS)', at: minsAgo(60 * 58), note: 'Copy checked by M&P — final release still with ICS' },
      { key: 'cinv', label: 'Commercial invoice', required: true, category: 'customs', status: 'approved', fileName: 'INV-CAFGANIC-2008403.pdf', uploadedBy: 'Titan Associates', verifiedBy: 'Joreen (M&P Customs)', at: minsAgo(60 * 44) },
      { key: 'plist', label: 'Packing list', required: true, category: 'customs', status: 'pending', deadline: new Date(Date.now() + 6 * 3600_000).toISOString(), note: 'Shipper has not released it — Joreen cannot file on TradeNet without it' },
      { key: 'gst', label: 'GST payment advice', required: true, category: 'payment', status: 'pending', note: 'GST on cash/COD term — transfer proof needed before delivery' }
    ],
    whatsapp: [
      {
        id: 'wa-9032-kelvin',
        contactName: 'Kelvin Lau (ICS Shenzhen)',
        contactHandle: '+852 9761 4408',
        contactRole: 'agent',
        status: 'waiting_on_them',
        messages: [
          wa('wa-9032-kelvin-1', 'out', 'M&P CS', 'Kelvin, can you release the final HBL for ICS2008403? We only have the copy on our side.', 60 * 29),
          wa('wa-9032-kelvin-2', 'in', 'Kelvin Lau (ICS Shenzhen)', 'Checking with Shenzhen office. Shipper still holding the packing list so HBL not finalised yet.', 60 * 28),
          wa('wa-9032-kelvin-3', 'out', 'M&P CS', 'Please chase them — cargo already discharged here and Pan-Asia CFS won\'t unstuff without the permit.', 60 * 26)
        ]
      }
    ],
    partners: [
      { role: 'shipping_line', name: 'Wan Hai Lines', contact: 'sin.import@wanhai.example', state: 'done', since: minsAgo(60 * 30), channel: 'email' },
      { role: 'agent', name: 'ICS / Iconsol Shipping — Kelvin Lau', contact: '+852 9761 4408', state: 'waiting', waitingFor: 'Final HBL release for ICS2008403', since: minsAgo(60 * 29), channel: 'whatsapp' },
      { role: 'warehouse', name: 'Pan-Asia CFS, Keppel Distripark', contact: 'ops@panasiacfs.example', state: 'blocked', waitingFor: 'Cannot unstuff without the import permit — slot given away this morning', since: minsAgo(60 * 20), channel: 'email' },
      { role: 'broker', name: 'Joreen (M&P Customs)', contact: 'joreen@mp.com.sg', state: 'waiting', waitingFor: 'Packing list, HS code, cargo value and importer UEN before TradeNet filing', since: minsAgo(60 * 30), channel: 'email' }
    ],
    contacts: [
      { email: 'wy.tan@titanassociates.com.sg', name: 'WY Tan', source: 'booking' },
      { email: 'wytanj@gmail.com', name: 'WY Tan (personal)', source: 'inbound', at: minsAgo(150) }
    ],
    createdAt: minsAgo(60 * 96)
  }
  addEvent(s11, { type: 'created', actor: 'cs', note: 'New booking from Shenzhen agent — ex LCL Shenzhen to Singapore, c/o Titan Associates 2008403', at: minsAgo(60 * 96) })
  addEvent(s11, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 96) })
  addEvent(s11, { type: 'note', actor: 'cs', note: 'Cargo ready at shipper CFS, Shenzhen — 40 pkgs / 500 kg / 1.5 m³ wireless keyboards', at: minsAgo(60 * 80) })
  addEvent(s11, { type: 'status', status: 'picked_up', actor: 'cs', note: 'Cargo received into Shenzhen CFS by ICS', at: minsAgo(60 * 72) })
  addEvent(s11, { type: 'status', status: 'in_transit', actor: 'cs', note: 'Loaded on WAN HAI 516 V.W050 — ETD Shenzhen, ETA Singapore 11th', at: minsAgo(60 * 60) })
  addEvent(s11, { type: 'customs', actor: 'cs', note: '🛃 Import declaration pending — packing list, HS code, cargo value and importer UEN still missing. M&P files on TradeNet once documents are checked.', at: minsAgo(60 * 30) })

  // Scenario 12 — B2C last mile, delivered today, review ask already out and the
  // customer has replied on WhatsApp asking about the reward.
  const s12: Shipment = {
    id: 'MP-7710-AF',
    programmeId: 'auto5',
    mode: 'b2c',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Priya Nair',
    customerEmail: 'priya.nair@example.sg',
    company: 'Allmighty Foods Pte Ltd',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub',
    destination: 'Blk 88 Tampines St 81, #11-203',
    eta: minsAgo(60 * 3),
    driverName: 'Suresh Kumar',
    driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D',
    pieces: 1,
    weightKg: 4,
    description: 'Online order #AMF-10620 — jelly variety box & noodle pack',
    events: [],
    whatsapp: [
      {
        id: 'wa-7710-priya',
        contactName: 'Priya Nair',
        contactHandle: '+65 9887 3102',
        contactRole: 'customer',
        status: 'needs_reply',
        messages: [
          wa('wa-7710-priya-1', 'in', 'Priya Nair', 'Hi, nobody home till 7pm — can the driver come after that?', 60 * 6),
          wa('wa-7710-priya-2', 'out', 'M&P CS', 'Hi Priya, noted. Suresh will swing back at the end of his route, around 7.15pm.', 330),
          wa('wa-7710-priya-3', 'in', 'Priya Nair', 'Thanks, received 🙏 Is there a promo code for the review?', 135)
        ]
      }
    ],
    createdAt: minsAgo(60 * 11),
    signoff: { name: 'Priya Nair', signature: SEED_SIGNATURE, at: minsAgo(60 * 3) },
    reviewAsk: { state: 'sent', trigger: 'delivered', at: minsAgo(60 * 2) }
  }
  addEvent(s12, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 11) })
  addEvent(s12, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 11) })
  addEvent(s12, { type: 'status', status: 'picked_up', actor: 'driver', at: minsAgo(60 * 7) })
  addEvent(s12, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 6) })
  addEvent(s12, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Tampines area, 3 stops away', at: minsAgo(340) })
  addEvent(s12, { type: 'note', actor: 'driver', note: 'Nobody home — customer asked for after 7pm, moved to last stop', at: minsAgo(335) })
  addEvent(s12, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Priya Nair', at: minsAgo(60 * 3) })
  addEvent(s12, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 3) })
  addEvent(s12, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 2) })

  // Scenario 13 — delivered but disputed: Jewel charged an after-hours bay fee that
  // Hey Fran says was never quoted. Open claim → review ask held.
  const s13: Shipment = {
    id: 'MP-7719-HF',
    programmeId: 'auto5',
    mode: 'b2self',
    service: 'Last-mile delivery (own outlets)',
    status: 'delivered',
    customerName: 'Fran Lim',
    customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran',
    poNumber: 'TRF-0226',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1',
    destination: 'Hey Fran pop-up, Jewel Changi Airport #B2-241',
    eta: minsAgo(60 * 27),
    driverName: 'Azlan Ismail',
    driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A',
    pieces: 6,
    weightKg: 74,
    description: 'Mid-week restock — retail stock & chiller display cards',
    events: [],
    whatsapp: [
      {
        id: 'wa-7719-fran',
        contactName: 'Fran Lim',
        contactHandle: '+65 9021 7744',
        contactRole: 'customer',
        status: 'waiting_on_them',
        messages: [
          wa('wa-7719-fran-1', 'in', 'Fran Lim', 'Jewel charged us $45 after-hours bay access again. That was never in the quote — can M&P absorb it or re-bill?', 60 * 24),
          wa('wa-7719-fran-2', 'out', 'M&P CS', 'Hi Fran, logged as a destination fee dispute. Pulling the Jewel bay receipt and our quote — will revert by tomorrow.', 60 * 23),
          wa('wa-7719-fran-3', 'out', 'M&P CS', 'Can your outlet send the Jewel charge slip? Billing needs it to raise the credit note.', 60 * 21)
        ]
      }
    ],
    createdAt: minsAgo(60 * 34),
    signoff: { name: 'Aiman (Jewel outlet)', signature: SEED_SIGNATURE, at: minsAgo(60 * 26) },
    claim: {
      type: 'destination_fee',
      note: 'Jewel B2 loading bay billed SGD 45 after-hours access — Hey Fran says it was not in the quote',
      openedAt: minsAgo(60 * 24),
      openedBy: 'customer',
      status: 'open'
    },
    reviewAsk: {
      state: 'held',
      trigger: 'delivered',
      at: minsAgo(60 * 24),
      reason: 'Open destination fee dispute — routed to CS/claims, no review ask sent'
    }
  }
  addEvent(s13, { type: 'created', actor: 'cs', note: 'Internal transfer booked, tracking link shared', at: minsAgo(60 * 34) })
  addEvent(s13, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 34) })
  addEvent(s13, { type: 'status', status: 'picked_up', actor: 'driver', note: '6 cartons loaded at Kaki Bukit', at: minsAgo(60 * 30) })
  addEvent(s13, { type: 'status', status: 'in_transit', actor: 'driver', at: minsAgo(60 * 29) })
  addEvent(s13, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Arriving Jewel B2 loading bay', at: minsAgo(60 * 27) })
  addEvent(s13, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Aiman (Jewel outlet)', at: minsAgo(60 * 26) })
  addEvent(s13, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 26) })
  addEvent(s13, { type: 'claim', actor: 'customer', note: '⚠️ Destination fee dispute opened by customer: Jewel B2 loading bay billed SGD 45 after-hours access', at: minsAgo(60 * 24) })
  addEvent(s13, { type: 'note', actor: 'system', note: '⏸ Review request held — open destination fee dispute → CS/claims', internal: true, at: minsAgo(60 * 24) })
  addEvent(s13, { type: 'note', actor: 'cs', note: 'Billing pulling the Jewel charge slip against QT-HF standing rates', at: minsAgo(60 * 21) })

  // Scenario 14 — B2C online order on the 5★ auto programme: review came back
  // 3★, so nothing auto-issued. CS sees an unhappy-ish review, not a voucher.
  const s14: Shipment = {
    id: 'MP-8130-AF',
    programmeId: 'auto5',
    mode: 'b2c',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Marcus Ong',
    customerEmail: 'marcus.ong@example.sg',
    company: 'Allmighty Foods Pte Ltd',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub',
    destination: 'Blk 219 Serangoon Ave 4, #05-88',
    eta: minsAgo(60 * 30),
    driverName: 'Suresh Kumar',
    driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D',
    pieces: 1,
    weightKg: 5,
    description: 'Online order #AMF-10744 — konjac snack multipack',
    events: [],
    createdAt: minsAgo(60 * 36),
    signoff: { name: 'Marcus Ong', signature: SEED_SIGNATURE, at: minsAgo(60 * 30) },
    review: {
      rating: 3,
      comment: 'Box was dented, contents fine',
      at: minsAgo(60 * 26)
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 29) }
  }
  addEvent(s14, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 36) })
  addEvent(s14, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 36) })
  addEvent(s14, { type: 'status', status: 'picked_up', actor: 'driver', at: minsAgo(60 * 34) })
  addEvent(s14, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Serangoon area, 4 stops away', at: minsAgo(60 * 31) })
  addEvent(s14, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Marcus Ong', at: minsAgo(60 * 30) })
  addEvent(s14, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 30) })
  addEvent(s14, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 29) })
  addEvent(s14, { type: 'note', actor: 'customer', note: 'Customer left a 3-star review: "Box was dented, contents fine"', at: minsAgo(60 * 26) })
  addEvent(s14, { type: 'note', actor: 'cs', note: '3★ — no voucher on the 5★ auto programme. Sarah (CS) to call about the dented carton.', internal: true, at: minsAgo(60 * 25) })

  // Scenario 15 — public-proof programme, one reminder already out, still silent.
  const s15: Shipment = {
    id: 'MP-8140-AF',
    programmeId: 'proof',
    mode: 'b2b',
    service: 'Last-mile delivery',
    status: 'delivered',
    customerName: 'Esther Ng',
    customerEmail: 'esther@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd',
    poNumber: 'PO-4502',
    incoterms: 'DAP',
    origin: 'Allmighty Foods, Senoko Food Hub',
    destination: 'FairPrice Distribution Centre, Joo Koon Circle',
    eta: minsAgo(60 * 73),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 72,
    weightKg: 610,
    description: 'Jelly & noodle cartons — 6 pallets, ambient',
    events: [],
    createdAt: minsAgo(60 * 84),
    signoff: { name: 'Rosli (FairPrice inbound)', signature: SEED_SIGNATURE, at: minsAgo(60 * 72) },
    reviewAsk: {
      state: 'sent',
      trigger: 'delivered',
      at: minsAgo(60 * 71),
      reaskAt: minsAgo(60 * 23),
      reaskCount: 1,
      reaskDueAt: new Date(Date.now() + 25 * 3600_000).toISOString()
    }
  }
  addEvent(s15, { type: 'created', actor: 'cs', note: 'Delivery booked, tracking link sent', at: minsAgo(60 * 84) })
  addEvent(s15, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 84) })
  addEvent(s15, { type: 'status', status: 'picked_up', actor: 'driver', note: '6 pallets loaded, Senoko bay 1', at: minsAgo(60 * 78) })
  addEvent(s15, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Booked into the Joo Koon 9am window', at: minsAgo(60 * 74) })
  addEvent(s15, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Rosli (FairPrice inbound)', at: minsAgo(60 * 72) })
  addEvent(s15, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 72) })
  addEvent(s15, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 71) })
  addEvent(s15, { type: 'note', actor: 'system', note: '🔁 Review reminder sent (re-ask #1) — next in 48h', at: minsAgo(60 * 23) })

  // Scenario 16 — public-proof done properly: Facebook screenshot uploaded, CS
  // verified it by hand, then the voucher went out.
  const s16: Shipment = {
    id: 'MP-8118-HF',
    programmeId: 'proof',
    mode: 'b2self',
    service: 'Last-mile delivery (own outlets)',
    status: 'delivered',
    customerName: 'Fran Lim',
    customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran',
    poNumber: 'TRF-0228',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1',
    destination: 'Hey Fran pop-up, Orchard Central #02-18',
    eta: minsAgo(60 * 51),
    driverName: 'Azlan Ismail',
    driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A',
    pieces: 11,
    weightKg: 128,
    description: 'Launch week restock — retail stock, tote bags & display cards',
    events: [],
    createdAt: minsAgo(60 * 60),
    signoff: { name: 'Fran Lim', signature: SEED_SIGNATURE, at: minsAgo(60 * 50) },
    review: {
      rating: 5,
      comment: 'Posted this on our Facebook page — Azlan unloaded and stacked before we even opened.',
      at: minsAgo(60 * 45),
      screenshot: reviewShot('Hey Fran', 5, 'Posted this on our Facebook page — Azlan unloaded and stacked before we even opened.', 'Facebook'),
      platforms: ['facebook'],
      reward: { code: 'MP-THANKS-8118MV', at: minsAgo(60 * 42), value: 'Grab $10' },
      helpedBy: 'Azlan (driver)'
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 49) }
  }
  addEvent(s16, { type: 'created', actor: 'cs', note: 'Internal transfer booked, tracking link shared', at: minsAgo(60 * 60) })
  addEvent(s16, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 60) })
  addEvent(s16, { type: 'status', status: 'picked_up', actor: 'driver', note: '11 boxes loaded at Kaki Bukit', at: minsAgo(60 * 55) })
  addEvent(s16, { type: 'status', status: 'out_for_delivery', actor: 'driver', at: minsAgo(60 * 51) })
  addEvent(s16, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Fran Lim', at: minsAgo(60 * 50) })
  addEvent(s16, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 50) })
  addEvent(s16, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 49) })
  addEvent(s16, { type: 'note', actor: 'customer', note: 'Customer left a 5-star review with a Facebook screenshot · shout-out for Azlan (driver)', at: minsAgo(60 * 45) })
  addEvent(s16, { type: 'note', actor: 'cs', note: '🔍 Facebook screenshot checked against the Hey Fran page — genuine public review (Sarah, CS)', internal: true, at: minsAgo(60 * 43) })
  addEvent(s16, { type: 'note', actor: 'cs', note: '🎁 Review approved — Grab $10 voucher MP-THANKS-8118MV emailed to customer', at: minsAgo(60 * 42) })

  // Scenario 17 — B2B delayed programme run through: delivered, the ask waited
  // three days, then a 4★ came back. The SGD 20 credit is the AM's call.
  const s17: Shipment = {
    id: 'MP-9040-TA',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'LCL sea import + customs + delivery',
    status: 'delivered',
    customerName: 'WY Tan',
    customerEmail: 'wy.tan@titanassociates.com.sg',
    company: 'Titan Associates Pte Ltd',
    poNumber: 'ICS2007912',
    incoterms: 'FOB',
    origin: 'Cafganic Import & Export Trading Co. Ltd, Shenzhen (Yantian) CFS',
    destination: 'Titan Associates, 8 Tai Seng Link',
    eta: minsAgo(60 * 24 * 6 + 60 * 2),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 34,
    weightKg: 430,
    description: '34 pkgs wireless keyboards — Cafganic PO ICS2007912 (LCL, unstuffed at Keppel)',
    events: [],
    createdAt: minsAgo(60 * 24 * 14),
    signoff: { name: 'Jason Sim (Titan stores)', signature: SEED_SIGNATURE, at: minsAgo(60 * 24 * 6) },
    review: {
      rating: 4,
      comment: 'Permit and delivery both on schedule. Would like the invoice a day earlier next time.',
      at: minsAgo(60 * 24 * 2)
    },
    reviewAsk: { state: 'answered', trigger: 'delivered', at: minsAgo(60 * 24 * 3) }
  }
  addEvent(s17, { type: 'created', actor: 'cs', note: 'Booking from ICS Shenzhen — Cafganic PO ICS2007912', at: minsAgo(60 * 24 * 14) })
  addEvent(s17, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 24 * 14) })
  addEvent(s17, { type: 'status', status: 'picked_up', actor: 'cs', note: 'Cargo received into Shenzhen CFS', at: minsAgo(60 * 24 * 12) })
  addEvent(s17, { type: 'customs', actor: 'cs', note: '🛃 Import permit approved on TradeNet — filed by Joreen (M&P Customs)', at: minsAgo(60 * 24 * 7) })
  addEvent(s17, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Unstuffed at Keppel, on the way to Tai Seng', at: minsAgo(60 * 24 * 6 + 180) })
  addEvent(s17, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Jason Sim (Titan stores)', at: minsAgo(60 * 24 * 6) })
  addEvent(s17, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 24 * 6) })
  addEvent(s17, { type: 'note', actor: 'system', note: '🗓 Review ask scheduled — B2B delayed programme asks 3 days after delivery', at: minsAgo(60 * 24 * 6) })
  addEvent(s17, { type: 'note', actor: 'system', note: '⭐ Review request sent', at: minsAgo(60 * 24 * 3) })
  addEvent(s17, { type: 'note', actor: 'customer', note: 'Customer left a 4-star review: "Permit and delivery both on schedule. Would like the invoice a day earlier next time."', at: minsAgo(60 * 24 * 2) })

  // Scenario 18 — the delayed ask in flight: delivered yesterday, nothing emailed
  // yet, the queue shows it due in two days.
  const s18: Shipment = {
    id: 'MP-9044-TA',
    programmeId: 'b2b-delayed',
    mode: 'b2b',
    service: 'Last-mile delivery (ex CFS)',
    status: 'delivered',
    customerName: 'WY Tan',
    customerEmail: 'wy.tan@titanassociates.com.sg',
    company: 'Titan Associates Pte Ltd',
    poNumber: 'ICS2008471',
    incoterms: 'FOB',
    origin: 'Pan-Asia CFS, Keppel Distripark',
    destination: 'Titan Associates, 8 Tai Seng Link',
    eta: minsAgo(60 * 25),
    driverName: 'Hafiz Rahman',
    driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K',
    pieces: 18,
    weightKg: 220,
    description: '18 pkgs wireless mice — unstuffed ex ICS2008471',
    events: [],
    createdAt: minsAgo(60 * 40),
    signoff: { name: 'Jason Sim (Titan stores)', signature: SEED_SIGNATURE, at: minsAgo(60 * 24) },
    reviewAsk: {
      state: 'not_yet',
      trigger: 'delivered',
      at: minsAgo(60 * 24),
      scheduledFor: new Date(Date.now() + 2 * 24 * 3600_000).toISOString()
    }
  }
  addEvent(s18, { type: 'created', actor: 'cs', note: 'Delivery booked off the CFS unstuffing — tracking link sent', at: minsAgo(60 * 40) })
  addEvent(s18, { type: 'status', status: 'booked', actor: 'system', at: minsAgo(60 * 40) })
  addEvent(s18, { type: 'status', status: 'picked_up', actor: 'driver', note: '18 pkgs collected at Keppel Distripark', at: minsAgo(60 * 28) })
  addEvent(s18, { type: 'status', status: 'out_for_delivery', actor: 'driver', note: 'Arriving Tai Seng Link', at: minsAgo(60 * 25) })
  addEvent(s18, { type: 'signoff', actor: 'customer', note: 'Delivery signed off by Jason Sim (Titan stores)', at: minsAgo(60 * 24) })
  addEvent(s18, { type: 'status', status: 'delivered', actor: 'system', at: minsAgo(60 * 24) })
  addEvent(s18, { type: 'note', actor: 'system', note: '🗓 Review ask scheduled — B2B delayed programme asks 3 days after delivery', at: minsAgo(60 * 24) })

  // WhatsApp + partner coordination on the existing hero jobs
  s1.whatsapp = [
    {
      id: 'wa-4471-melissa',
      contactName: 'Melissa Tan',
      contactHandle: '+65 9123 4567',
      contactRole: 'customer',
      status: 'closed',
      messages: [
        wa('wa-4471-melissa-1', 'in', 'Melissa Tan', 'Morning! Container out of PSA already? Need to tell my warehouse boys what time to standby.', 200),
        wa('wa-4471-melissa-2', 'out', 'M&P CS', 'Hi Melissa, permit cleared this morning. Hafiz collected at PSA about 2h ago, heading Senoko now.', 195),
        wa('wa-4471-melissa-3', 'in', 'Melissa Tan', 'Can we take the 2pm slot tomorrow instead? Bay 2 is tied up today.', 40),
        wa('wa-4471-melissa-4', 'out', 'M&P CS', '2pm Senoko slot confirmed with NEK. Hafiz will call 30 min before he reaches.', 30)
      ]
    },
    {
      id: 'wa-4471-hafiz',
      contactName: 'Hafiz Rahman (driver)',
      contactHandle: '+65 9123 4567',
      contactRole: 'driver',
      status: 'closed',
      messages: [
        wa('wa-4471-hafiz-1', 'in', 'Hafiz Rahman', 'Reached PSA gate, queue about 20 min.', 130),
        wa('wa-4471-hafiz-2', 'out', 'M&P CS', 'Noted Hafiz. Check seal against the DO then straight to Senoko ah.', 128),
        wa('wa-4471-hafiz-3', 'in', 'Hafiz Rahman', 'Seal intact, photo posted on the job.', 120, { name: 'seal-TEMU4823910.jpg', kind: 'image' }),
        wa('wa-4471-hafiz-4', 'out', 'M&P CS', 'Good, thanks 👍', 118)
      ]
    }
  ]
  s1.partners = [
    { role: 'shipping_line', name: 'SINOKOR Merchant Marine', contact: 'sin.docs@sinokor.example', state: 'done', since: minsAgo(60 * 9), channel: 'email' },
    { role: 'warehouse', name: 'PSA Pasir Panjang Terminal 3', state: 'done', since: minsAgo(60 * 2), channel: 'email' },
    { role: 'broker', name: 'Joreen (M&P Customs)', contact: 'joreen@mp.com.sg', state: 'done', since: minsAgo(60 * 6), channel: 'email' },
    { role: 'haulier', name: 'NEK Logistics', contact: '+65 6285 4410', state: 'ok', waitingFor: '2pm Senoko unloading slot confirmed', since: minsAgo(30), eta: new Date(Date.now() + 3 * 3600_000).toISOString(), channel: 'whatsapp' }
  ]

  s4.partners = [
    { role: 'agent', name: 'Sunjin Logis (Mr Park) — M&P Korea partner', contact: 'park@sunjinlogis.example', state: 'waiting', waitingFor: 'Shipper cargo-ready date + FCL 20ft stuffing option', since: minsAgo(60 * 22), channel: 'email' },
    { role: 'warehouse', name: 'Busan CFS', state: 'na', since: minsAgo(60 * 22) },
    { role: 'broker', name: 'Joreen (M&P Customs)', contact: 'joreen@mp.com.sg', state: 'na', since: minsAgo(60 * 22), channel: 'email' }
  ]

  s5.whatsapp = [
    {
      id: 'wa-3318-brendan',
      contactName: 'Brendan De Souza',
      contactHandle: '+65 8112 9043',
      contactRole: 'customer',
      status: 'needs_reply',
      messages: [
        wa('wa-3318-brendan-1', 'out', 'M&P CS', 'Hi Brendan — HONGKONG BRIDGE ETA Singapore in 2 days. We still need the commercial invoice and packing list before Joreen can file the permit.', 60 * 6),
        wa('wa-3318-brendan-2', 'in', 'Brendan De Souza', 'Noted! Invoice coming tonight from the HK side. Can you pre-fill the declaration first so we don\'t lose a day?', 60 * 5)
      ]
    }
  ]
  s5.partners = [
    { role: 'shipping_line', name: 'ICS / Iconsol Shipping', contact: '+852 2765 8741', state: 'ok', waitingFor: 'Vessel ETA Singapore in 2 days', since: minsAgo(60 * 20), eta: new Date(Date.now() + 2 * 24 * 3600_000).toISOString(), channel: 'email' },
    { role: 'warehouse', name: 'Keppel Distripark CFS', contact: 'slots@keppelcfs.example', state: 'waiting', waitingFor: 'Unstuff slot — CFS to confirm bay and timing', since: minsAgo(60 * 18), channel: 'email' },
    { role: 'broker', name: 'Joreen (M&P Customs)', contact: 'joreen@mp.com.sg', state: 'waiting', waitingFor: 'Commercial invoice + packing list before TradeNet filing', since: minsAgo(60 * 20), channel: 'email' }
  ]

  s8.whatsapp = [
    {
      id: 'wa-8102-priya',
      contactName: 'Priya Nair',
      contactHandle: '+65 9887 3102',
      contactRole: 'customer',
      status: 'closed',
      messages: [
        wa('wa-8102-priya-1', 'in', 'Priya Nair', 'Hi, is the gummies order arriving today? I am home after 4.', 60 * 7),
        wa('wa-8102-priya-2', 'out', 'M&P CS', 'Hi Priya, yes — Suresh is 2 stops away, about 25 min.', 60 * 6),
        wa('wa-8102-priya-3', 'in', 'Priya Nair', 'Received, thank you!', 60 * 5),
        wa('wa-8102-priya-4', 'out', 'M&P CS', 'Thanks Priya 🙏 We have sent a quick review link to your email.', 60 * 4)
      ]
    }
  ]

  s10.whatsapp = [
    {
      id: 'wa-8125-fran',
      contactName: 'Fran Lim',
      contactHandle: '+65 9021 7744',
      contactRole: 'customer',
      status: 'waiting_on_them',
      messages: [
        wa('wa-8125-fran-1', 'in', 'Fran Lim', '2 of the 8 cartons came in dented at the corner — Jewel outlet just flagged it.', 80, { name: 'dented-carton.jpg', kind: 'image' }),
        wa('wa-8125-fran-2', 'out', 'M&P CS', 'Sorry about that Fran. Sarah from CS has opened a damage claim. Can the outlet send photos of both cartons plus the carton numbers?', 70)
      ]
    }
  ]
  s10.partners = [
    { role: 'haulier', name: 'M&P own fleet — Azlan Ismail', contact: '+65 9345 6789', state: 'done', since: minsAgo(90), channel: 'whatsapp' },
    { role: 'warehouse', name: 'Jewel Changi B2 loading bay', state: 'waiting', waitingFor: 'Bay CCTV clip for the damage report', since: minsAgo(70), channel: 'email' }
  ]

  // Same job, different inboxes — colleague / Gmail / personal
  s1.contacts = [
    { email: s1.customerEmail, name: s1.customerName, source: 'booking' },
    { email: 'esther@allmightyfoods.com.sg', name: 'Esther Ng', source: 'inbound', at: minsAgo(50) }
  ]
  addEvent(s1, { type: 'note', actor: 'cs', note: '📩 esther@allmightyfoods.com.sg wrote in from the company domain (new address esther@allmightyfoods.com.sg)', internal: true, at: minsAgo(50) })
  addEvent(s1, { type: 'note', actor: 'cs', note: '🤖 AI auto-replied to "Container TEMU 482391-0 — customs?"', internal: true, at: minsAgo(49) })
  addEvent(s1, { type: 'message', actor: 'customer', note: '💬 Customer asked via tracking page: "Can the truck do the 2pm slot at Senoko tomorrow?"', at: minsAgo(35) })
  addEvent(s1, { type: 'note', actor: 'cs', note: '✅ M&P replied — 2pm Senoko slot confirmed with the haulier', at: minsAgo(30) })

  s5.contacts = [
    { email: s5.customerEmail, name: s5.customerName, source: 'booking' },
    { email: 'brendan.ds@gmail.com', name: 'Brendan De Souza', source: 'inbound', at: minsAgo(60 * 18) }
  ]
  addEvent(s5, { type: 'note', actor: 'cs', note: '📩 brendan.ds@gmail.com wrote in quoting this job (new address brendan.ds@gmail.com)', internal: true, at: minsAgo(60 * 18) })
  addEvent(s5, { type: 'note', actor: 'cs', note: '🤖 AI auto-replied to "MP-3318-MC — any update on unstuffing?"', internal: true, at: minsAgo(60 * 17) })

  const shipments = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18]
  const emails: OutboxEmail[] = [
    ...[s1, s2, s3, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18].map((s) => buildTrackingEmail(s, s.createdAt)),
    buildReviewEmail(s6, minsAgo(60 * 18)),
    buildRewardEmail(s6, 'MP-THANKS-8101KQ', minsAgo(60 * 12)),
    buildReviewEmail(s7, minsAgo(60 * 26)),
    buildReviewEmail(s8, minsAgo(60 * 4)),
    buildReviewEmail(s9, minsAgo(60 * 46)),
    buildRewardEmail(s9, 'MP-THANKS-8112RD', minsAgo(60 * 40)),
    buildReviewEmail(s12, minsAgo(60 * 2)),
    buildReviewEmail(s14, minsAgo(60 * 29)),
    buildReviewEmail(s15, minsAgo(60 * 71)),
    { ...buildReviewEmail(s15, minsAgo(60 * 23)), id: 'out-8140-reask', subject: `Reminder: how did we do on ${s15.id}?` },
    buildReviewEmail(s16, minsAgo(60 * 49)),
    buildRewardEmail(s16, 'MP-THANKS-8118MV', minsAgo(60 * 42)),
    buildReviewEmail(s17, minsAgo(60 * 24 * 3)),
    // Titan: CS chased the packing list, WY replied asking for the arrival notice — needs a reply
    buildCsReplyEmail({
      id: 'out-9032-titan',
      shipment: s11,
      to: 'wytanj@gmail.com',
      subject: 'MP-9032-TA — packing list still outstanding',
      body: 'Dear WY,\n\nWe have the commercial invoice and the HBL copy, but the shipper has not released the packing list. Joreen cannot file the TradeNet declaration without it, and Pan-Asia CFS will not unstuff until the permit is out.\n\nCould you chase Cafganic on your side?\n\n— Christina Ng, M&P Customer Service',
      at: minsAgo(60 * 26)
    }),
    buildInboundEmail({
      id: 'in-9032-titan',
      shipment: s11,
      from: 'wytanj@gmail.com',
      fromName: 'WY Tan',
      subject: 'MP-9032-TA — arrival notice (NOA) and invoice?',
      body: 'Hi Christina,\n\nMy warehouse says the vessel is already in. Can you send us the arrival notice (NOA) plus the invoices so I can arrange payment? GST on cash term like last time, I will provide the payment advice.\n\nAlso chasing Cafganic for the packing list now.\n\nThanks,\nWY Tan\nTitan Associates Pte Ltd',
      at: minsAgo(150),
      matchedBy: 'shipment-id'
    }),
    buildInboundEmail({
      id: 'in-4471-esther',
      shipment: s1,
      from: 'esther@allmightyfoods.com.sg',
      fromName: 'Esther Ng',
      subject: 'Container TEMU 482391-0 — customs?',
      body: 'Hi M&P,\n\nMelissa is out today. Has SG Customs cleared MP-4471-AF? We need the truck window for Senoko tomorrow.\n\nThanks,\nEsther',
      at: minsAgo(50),
      matchedBy: 'company-domain'
    }),
    buildCsReplyEmail({
      id: 'out-4471-esther',
      shipment: s1,
      to: 'esther@allmightyfoods.com.sg',
      subject: 'Container TEMU 482391-0 — customs?',
      body: 'Hi Esther,\n\nYes — TradeNet permit is approved and the container is on the way to Senoko via AYE → SLE. Live status is on the tracking button below.\n\n— M&P Customer Service (AI assistant)',
      at: minsAgo(49)
    }),
    buildInboundEmail({
      id: 'in-3318-gmail',
      shipment: s5,
      from: 'brendan.ds@gmail.com',
      fromName: 'Brendan De Souza',
      subject: 'MP-3318-MC — any update on unstuffing?',
      body: 'Hi, emailing from my Gmail — office Outlook is down. Has HONGKONG BRIDGE unstuffed yet? Need to plan delivery.\n\nBrendan',
      at: minsAgo(60 * 18),
      matchedBy: 'shipment-id'
    }),
    buildCsReplyEmail({
      id: 'out-3318-gmail',
      shipment: s5,
      to: 'brendan.ds@gmail.com',
      subject: 'MP-3318-MC — any update on unstuffing?',
      body: 'Hi Brendan,\n\nMP-3318-MC is still in transit on HONGKONG BRIDGE V.0055S — ETA Singapore in 2 days. We will update delivery once the container is unstuffed.\n\n— M&P Customer Service (AI assistant)',
      at: minsAgo(60 * 17)
    }),
    // Ask box on /track → straight into the job-tied inbox
    {
      id: 'in-4471-melissa-ask',
      shipmentId: s1.id,
      from: 'melissa@allmightyfoods.com.sg',
      to: 'cs@mp.com.sg',
      direction: 'in',
      kind: 'message',
      matchedBy: 'shipment-id',
      subject: `${s1.id} — question from tracking page`,
      body: 'Can the truck do the 2pm slot at Senoko tomorrow?',
      ctaLabel: 'Open shipment',
      ctaUrl: `/track/${s1.id}`,
      at: minsAgo(35),
      delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'tracking page ask box' }
    },
    buildCsReplyEmail({
      id: 'out-4471-melissa-ask',
      shipment: s1,
      to: 'melissa@allmightyfoods.com.sg',
      subject: `${s1.id} — question from tracking page`,
      body: 'Hi Melissa,\n\n2pm at Senoko tomorrow works — haulier confirmed the slot. Driver Hafiz will call 30 minutes before arrival.\n\n— M&P Customer Service',
      at: minsAgo(30)
    }),
    // Inbox noise — unmatched mail the ops feed folds away
    ...noiseMails()
  ]
  return { shipments, emails }
}

export function labelFor(status: ShipmentStatus): string {
  return STATUS_LABELS[status]
}
