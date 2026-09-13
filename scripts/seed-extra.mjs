// Ten extra demo jobs across statuses — run: node --env-file=.env scripts/seed-extra.mjs
const h = {
  apikey: process.env.SUPABASE_ANON_KEY,
  authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
  'content-type': 'application/json',
  prefer: 'resolution=merge-duplicates'
}

const now = Date.now()
const ago = (mins) => new Date(now - mins * 60_000).toISOString()
const ahead = (mins) => new Date(now + mins * 60_000).toISOString()
const uid = () => crypto.randomUUID()

const SIGNATURE = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70"><path d="M15 45 C 40 12, 62 58, 92 32 S 138 18, 168 40 S 195 30, 205 36" stroke="#1a2433" fill="none" stroke-width="2.5" stroke-linecap="round"/></svg>'
).toString('base64')

const reviewShot = (name, stars, text, platform) => {
  const star = '★'.repeat(stars) + '☆'.repeat(5 - stars)
  const safe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="168">
    <rect width="380" height="168" rx="10" fill="#ffffff"/>
    <rect x="0.5" y="0.5" width="379" height="167" rx="10" fill="none" stroke="#e5e7eb"/>
    <text x="18" y="32" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="#221f1f">${safe(name)}</text>
    <text x="18" y="56" font-family="Segoe UI, Arial" font-size="16" fill="#f59e0b">${star}</text>
    <text x="18" y="86" font-family="Segoe UI, Arial" font-size="13" fill="#3a3432">${safe(text.slice(0, 58))}</text>
    <text x="18" y="106" font-family="Segoe UI, Arial" font-size="13" fill="#3a3432">${safe(text.slice(58, 116))}</text>
    <text x="18" y="148" font-family="Segoe UI, Arial" font-size="11" fill="#69727d">${safe(platform)} · Public review</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const ev = (at, type, actor, extra = {}) => ({ id: uid(), at, type, actor, ...extra })

const jobs = [
  {
    id: 'MP-8101-AF', mode: 'b2b', service: 'Last-mile delivery', status: 'delivered',
    customerName: 'Melissa Tan', customerEmail: 'melissa@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd', poNumber: 'PO-4488', incoterms: 'DAP',
    origin: 'Allmighty Foods, Senoko Food Hub', destination: 'RedMart DC, 20 Jurong Port Rd',
    eta: ago(60 * 20), driverName: 'Hafiz Rahman', driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K', pieces: 48, weightKg: 380,
    description: 'Oat pasta cartons — weekly replenishment (4 pallets)',
    createdAt: ago(60 * 30),
    signoff: { name: 'Kumar (Receiving)', signature: SIGNATURE, at: ago(60 * 19) },
    review: {
      rating: 5,
      comment: 'On time, driver helped restack pallets. Great service!',
      at: ago(60 * 16),
      screenshot: reviewShot('Melissa Tan', 5, 'On time, driver helped restack pallets. Great service!', 'Google'),
      platforms: ['google', 'facebook'],
      reward: { code: 'MP10OFF', at: ago(60 * 12), value: 'Grab $10' }
    },
    events: [
      ev(ago(60 * 30), 'created', 'cs', { note: 'Delivery booked, tracking link sent' }),
      ev(ago(60 * 30), 'status', 'system', { status: 'booked' }),
      ev(ago(60 * 26), 'status', 'driver', { status: 'picked_up', note: 'Collected 4 pallets, Senoko bay 2' }),
      ev(ago(60 * 25), 'status', 'driver', { status: 'in_transit' }),
      ev(ago(60 * 21), 'status', 'driver', { status: 'out_for_delivery', note: 'Arriving Jurong Port Rd' }),
      ev(ago(60 * 19), 'signoff', 'customer', { note: 'Delivery signed off by Kumar (Receiving)' }),
      ev(ago(60 * 19), 'status', 'system', { status: 'delivered' }),
      ev(ago(60 * 16), 'note', 'customer', { note: 'Customer left a 5-star review: "On time, driver helped restack pallets. Great service!"' }),
      ev(ago(60 * 12), 'note', 'cs', { note: 'Review approved — reward code MP10OFF emailed to customer' })
    ]
  },
  {
    id: 'MP-8102-AF', mode: 'b2c', service: 'Last-mile delivery', status: 'delivered',
    customerName: 'Priya Nair', customerEmail: 'priya.nair@example.sg',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub', destination: 'Blk 88 Tampines St 81, #11-203',
    eta: ago(60 * 5), driverName: 'Suresh Kumar', driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D', pieces: 1, weightKg: 3,
    description: 'Online order #AMF-10513 — gummies & jelly pack',
    createdAt: ago(60 * 10),
    signoff: { name: 'Priya Nair', signature: SIGNATURE, at: ago(60 * 5) },
    events: [
      ev(ago(60 * 10), 'created', 'cs', { note: 'Delivery booked, tracking link sent' }),
      ev(ago(60 * 10), 'status', 'system', { status: 'booked' }),
      ev(ago(60 * 8), 'status', 'driver', { status: 'picked_up' }),
      ev(ago(60 * 7), 'status', 'driver', { status: 'in_transit' }),
      ev(ago(60 * 6), 'status', 'driver', { status: 'out_for_delivery', note: 'Tampines area, 2 stops away' }),
      ev(ago(60 * 5), 'signoff', 'customer', { note: 'Delivery signed off by Priya Nair' }),
      ev(ago(60 * 5), 'status', 'system', { status: 'delivered' })
    ]
  },
  {
    id: 'MP-8103-HF', mode: 'b2self', service: 'Last-mile delivery (own outlets)', status: 'out_for_delivery',
    customerName: 'Fran Lim', customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran', poNumber: 'TRF-0224',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1', destination: 'Hey Fran kiosk, Jewel Changi #B2-42',
    eta: ahead(50), driverName: 'Azlan Ismail', driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A', pieces: 6, weightKg: 72,
    description: 'Kiosk restock — retail stock & carrier bags',
    createdAt: ago(60 * 4),
    events: [
      ev(ago(60 * 4), 'created', 'cs', { note: 'Internal transfer booked' }),
      ev(ago(60 * 4), 'status', 'system', { status: 'booked' }),
      ev(ago(80), 'status', 'driver', { status: 'picked_up', note: '6 boxes loaded at Kaki Bukit' }),
      ev(ago(65), 'status', 'driver', { status: 'in_transit', note: 'PIE eastbound' }),
      ev(ago(15), 'status', 'driver', { status: 'out_for_delivery', note: 'Arriving Jewel B2 loading dock' })
    ]
  },
  {
    id: 'MP-8104-MC', mode: 'b2b', service: 'LCL sea export (SG → HK)', status: 'booked',
    customerName: 'Brendan De Souza', customerEmail: 'brendan@mecha.store',
    company: 'Mecha', poNumber: 'EXP-HK-0812', incoterms: 'FOB',
    origin: 'Mecha, Singapore', destination: 'Consignee warehouse, Kwun Tong, Hong Kong',
    eta: ahead(60 * 24 * 6), driverName: 'Unassigned', vehicle: '—',
    pieces: 18, weightKg: 210,
    description: '18 cartons — return consignment, 0.9 m³',
    createdAt: ago(60 * 2),
    documents: [
      { key: 'cinv', label: 'Commercial invoice', required: true, status: 'pending', deadline: ahead(60 * 24 * 2), note: 'Needed for export declaration' },
      { key: 'plist', label: 'Packing list', required: true, status: 'pending', deadline: ahead(60 * 24 * 2) }
    ],
    events: [
      ev(ago(60 * 2), 'created', 'cs', { note: 'Export booking received — vessel space requested' }),
      ev(ago(60 * 2), 'status', 'system', { status: 'booked' })
    ]
  },
  {
    // The real Busan container thread (sample-email 1), dated to today
    id: 'MP-1633-TA', mode: 'b2b', service: 'Sea freight import + customs + drayage', status: 'in_transit',
    customerName: 'WY Tan', customerEmail: 'accounts@titan-associates.sg',
    company: 'Titan Associates Pte Ltd', poNumber: 'OI2103-0002-01', incoterms: 'CIF',
    origin: 'Busan (Kim Hae APT) → PSA Singapore', destination: 'Titan Associates, 201 Henderson Rd #07-25',
    eta: ahead(60 * 4), driverName: 'NEK Logistics (haulier)', vehicle: 'Prime mover — XE 8842 U',
    pieces: 750, weightKg: 6600,
    description: "20'GP TEMU 1633288 — Allmighty jelly foods, 750 boxes, 6,600 kg / 15.7 m³ (shipper BPIN Co Ltd, vessel RIO GRANDE 0002S, HBL SEARASI21030105)",
    createdAt: ago(60 * 72),
    documents: [
      { key: 'bl', label: 'Bill of lading (HBL SEARASI21030105)', required: true, status: 'approved', fileName: 'HBL-SEARASI21030105.pdf', uploadedBy: 'Searail Korea via M&P', at: ago(60 * 70) },
      { key: 'noa', label: 'Arrival notice (ADP Logistics)', required: true, status: 'approved', fileName: 'NOA-OI2103-0002-01.pdf', uploadedBy: 'ADP Logistics', at: ago(60 * 68), note: 'Local charges SGD 485.00 — THC 215 · DO 160 · FCL 35 · agency 50 · collect fee 25' },
      { key: 'slip', label: 'Payment transfer slip (SGD 485.00)', required: true, status: 'uploaded', fileName: 'FAST-HBKFT-D467370.pdf', uploadedBy: 'Titan Associates', at: ago(60 * 40), note: 'FAST transfer to ADP Logistics (OCBC 521-884-122-001), conf. HBKFT210308D467370' },
      { key: 'auth', label: 'Haulier authorisation letter', required: true, status: 'approved', fileName: 'auth-NEK-I43153.pdf', uploadedBy: 'Titan Associates', at: ago(60 * 38), note: 'NEK Logistics Pte Ltd · CR 199402400H · ref I43153' },
      { key: 'permit', label: 'Import permit (TradeNet)', required: true, status: 'approved', fileName: 'permit-2103.pdf', uploadedBy: 'M&P', at: ago(60 * 20), note: 'Submitted to carrier before deadline' },
      { key: 'photos', label: 'Container photos (yard)', required: false, status: 'pending', note: 'Washing charge SGD 20.00 flagged by yard — photos requested as evidence' }
    ],
    events: [
      ev(ago(60 * 72), 'created', 'cs', { note: 'Import job booked — NOA received from ADP Logistics, local charges SGD 485.00' }),
      ev(ago(60 * 72), 'status', 'system', { status: 'booked' }),
      ev(ago(60 * 40), 'note', 'customer', { note: '📄 Payment transfer slip uploaded — FAST SGD 485.00, conf. HBKFT210308D467370' }),
      ev(ago(60 * 38), 'note', 'cs', { note: 'Haulier authorised: NEK Logistics (CR 199402400H) — letter sent to ADP inward dept' }),
      ev(ago(60 * 20), 'note', 'cs', { note: 'Import permit approved & submitted to carrier — DO exchanged' }),
      ev(ago(60 * 6), 'status', 'cs', { status: 'picked_up', note: 'Vessel RIO GRANDE berthed — container TEMU 1633288 discharged, collected by NEK Logistics' }),
      ev(ago(60 * 5), 'status', 'cs', { status: 'in_transit', note: 'En route to Henderson Rd. Yard flagged washing charge SGD 20.00 — photos requested' })
    ]
  },
  {
    id: 'MP-8106-AF', mode: 'b2c', service: 'Last-mile delivery', status: 'out_for_delivery',
    customerName: 'Marcus Lee', customerEmail: 'marcus.lee@example.sg',
    origin: 'Allmighty Foods warehouse, Senoko Food Hub', destination: 'Blk 268C Punggol Field, #05-311',
    eta: ahead(35), driverName: 'Suresh Kumar', driverPhone: '92345678',
    vehicle: 'Van — GX 8814 D', pieces: 3, weightKg: 9,
    description: 'Online order #AMF-10527 — noodle bundle x3',
    createdAt: ago(60 * 6),
    events: [
      ev(ago(60 * 6), 'created', 'cs', { note: 'Delivery booked, tracking link sent' }),
      ev(ago(60 * 6), 'status', 'system', { status: 'booked' }),
      ev(ago(100), 'status', 'driver', { status: 'picked_up' }),
      ev(ago(90), 'status', 'driver', { status: 'in_transit' }),
      ev(ago(10), 'status', 'driver', { status: 'out_for_delivery', note: 'Punggol area, next stop' })
    ]
  },
  {
    id: 'MP-8107-HF', mode: 'b2self', service: 'Last-mile delivery (own outlets)', status: 'booked',
    customerName: 'Fran Lim', customerEmail: 'fran@heyfran.com',
    company: 'Hey Fran', poNumber: 'TRF-0225',
    origin: 'Hey Fran HQ & warehouse, Kaki Bukit Ave 1', destination: 'Hey Fran pop-up, Orchard Central #02-18',
    eta: ahead(60 * 26), driverName: 'Azlan Ismail', driverPhone: '93456789',
    vehicle: 'Van — GY 3307 A', pieces: 11, weightKg: 130,
    description: 'Weekly restock — retail stock, packaging, POS rolls',
    createdAt: ago(45),
    events: [
      ev(ago(45), 'created', 'cs', { note: 'Weekly transfer scheduled for tomorrow morning' }),
      ev(ago(45), 'status', 'system', { status: 'booked' })
    ]
  },
  {
    // The real Shenzhen LCL thread (sample-emails 3 & 4), dated to today
    id: 'MP-2008-TA', mode: 'b2b', service: 'LCL sea import (Shenzhen → SG)', status: 'delivered',
    customerName: 'WY Tan', customerEmail: 'accounts@titan-associates.sg',
    company: 'Titan Associates Pte Ltd', poNumber: '2008403', incoterms: 'EXW',
    origin: 'Shenzhen → Singapore CFS', destination: 'Titan Associates, 201 Henderson Rd #07-25',
    eta: ago(60 * 3), driverName: 'Hafiz Rahman', driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K', pieces: 12, weightKg: 640,
    description: 'LCL consignment — HBL ICS2008403A (NOA SZSSIN004026110), 12 cartons',
    createdAt: ago(60 * 96),
    signoff: { name: 'WY Tan', signature: SIGNATURE, at: ago(60 * 3) },
    documents: [
      { key: 'hbl', label: 'HBL ICS2008403A (draft approval)', required: true, status: 'approved', fileName: 'HBL-ICS2008403A.pdf', uploadedBy: 'M&P', at: ago(60 * 90), note: 'Draft checked & approved by Titan' },
      { key: 'cinv', label: 'Commercial invoice & packing list', required: true, status: 'approved', fileName: 'TITAN2004.pdf', uploadedBy: 'Titan Associates', at: ago(60 * 70), note: 'Incoterm (EXW) stated per carrier request' },
      { key: 'gst', label: 'GST payment advice (cash/COD)', required: true, status: 'approved', fileName: 'gst-advice.pdf', uploadedBy: 'Titan Associates', at: ago(60 * 10), note: 'GST under cash/COD term — paid before delivery' }
    ],
    events: [
      ev(ago(60 * 96), 'created', 'cs', { note: 'LCL import booked — NOA SZSSIN004026110 received' }),
      ev(ago(60 * 96), 'status', 'system', { status: 'booked' }),
      ev(ago(60 * 90), 'note', 'cs', { note: 'HBL ICS2008403A draft shared for checking/approval' }),
      ev(ago(60 * 70), 'note', 'customer', { note: '📄 Commercial invoice & packing list uploaded (TITAN2004.pdf)' }),
      ev(ago(60 * 24), 'status', 'cs', { status: 'picked_up', note: 'Container unstuffed at Mapex warehouse' }),
      ev(ago(60 * 10), 'note', 'customer', { note: '📄 GST payment advice uploaded — cash/COD term settled' }),
      ev(ago(60 * 5), 'status', 'driver', { status: 'out_for_delivery', note: 'Cargo on lorry, delivering today as promised' }),
      ev(ago(60 * 3), 'signoff', 'customer', { note: 'Delivery signed off by WY Tan' }),
      ev(ago(60 * 3), 'status', 'system', { status: 'delivered' })
    ]
  },
  {
    id: 'MP-8109-MC', mode: 'b2c', service: 'Last-mile delivery', status: 'in_transit',
    customerName: 'Sarah Goh', customerEmail: 'sarah.goh@example.sg',
    origin: 'Mecha, Singapore', destination: '12 Holland Grove View',
    eta: ahead(70), driverName: 'Mei Ling Chua', driverPhone: '94567890',
    vehicle: 'Van — GW 2210 E', pieces: 1, weightKg: 14,
    description: 'Mecha order #MC-3391 — collectible figure (fragile)',
    createdAt: ago(60 * 3),
    events: [
      ev(ago(60 * 3), 'created', 'cs', { note: 'Delivery booked for Mecha, tracking link sent' }),
      ev(ago(60 * 3), 'status', 'system', { status: 'booked' }),
      ev(ago(50), 'status', 'driver', { status: 'picked_up', note: 'Fragile — double-boxed' }),
      ev(ago(40), 'status', 'driver', { status: 'in_transit' })
    ]
  },
  {
    id: 'MP-8110-AF', mode: 'b2b', service: 'Last-mile delivery', status: 'delivered',
    customerName: 'Esther Ng', customerEmail: 'esther@allmightyfoods.com.sg',
    company: 'Allmighty Foods Pte Ltd', poNumber: 'PO-4490', incoterms: 'DAP',
    origin: 'Allmighty Foods, Senoko Food Hub', destination: 'GreenMart Distribution Centre, Tuas',
    eta: ago(60 * 28), driverName: 'Hafiz Rahman', driverPhone: '91234567',
    vehicle: '14-ft lorry — GBC 4521 K', pieces: 60, weightKg: 495,
    description: 'Jelly cartons — 5 pallets, ambient',
    createdAt: ago(60 * 40),
    signoff: { name: 'Ahmad (GreenMart inbound)', signature: SIGNATURE, at: ago(60 * 27) },
    review: {
      rating: 4,
      comment: 'Smooth delivery, slight delay at the gate but driver kept us posted.',
      at: ago(60 * 20),
      screenshot: reviewShot('Esther Ng', 4, 'Smooth delivery, slight delay at the gate but driver kept us posted.', 'Google'),
      platforms: ['google']
    },
    events: [
      ev(ago(60 * 40), 'created', 'cs', { note: 'Delivery booked, tracking link sent' }),
      ev(ago(60 * 40), 'status', 'system', { status: 'booked' }),
      ev(ago(60 * 34), 'status', 'driver', { status: 'picked_up', note: '5 pallets loaded' }),
      ev(ago(60 * 33), 'status', 'driver', { status: 'in_transit' }),
      ev(ago(60 * 29), 'status', 'driver', { status: 'out_for_delivery', note: 'Queueing at GreenMart gate, ~20 min' }),
      ev(ago(60 * 27), 'signoff', 'customer', { note: 'Delivery signed off by Ahmad (GreenMart inbound)' }),
      ev(ago(60 * 27), 'status', 'system', { status: 'delivered' }),
      ev(ago(60 * 20), 'note', 'customer', { note: 'Customer left a 4-star review: "Smooth delivery, slight delay at the gate but driver kept us posted."' })
    ]
  }
]

const res = await fetch(process.env.SUPABASE_URL + '/rest/v1/shipments', {
  method: 'POST', headers: h,
  body: JSON.stringify(jobs.map((j) => ({ id: j.id, data: j })))
})
console.log('insert shipments:', res.status, res.ok ? `${jobs.length} jobs` : await res.text())

// review-request email for the delivered-but-unrewarded job (keeps outbox story coherent)
const reviewEmail = {
  id: uid(), shipmentId: 'MP-8110-AF', to: 'esther@allmightyfoods.com.sg',
  subject: 'Delivered! How did we do on MP-8110-AF?',
  body: 'Hi Esther,\n\nShipment MP-8110-AF was delivered and signed for by Ahmad (GreenMart inbound).\nHow did we do? It takes 20 seconds.\n\n— M&P International Freights · Moving you forward',
  ctaLabel: 'Leave a quick review', ctaUrl: '/review/MP-8110-AF', at: ago(60 * 26),
  delivery: { state: 'simulated', to: 'esther@allmightyfoods.com.sg', detail: 'pre-seeded demo data' }
}
const r2 = await fetch(process.env.SUPABASE_URL + '/rest/v1/emails', {
  method: 'POST', headers: h,
  body: JSON.stringify([{ id: reviewEmail.id, at: reviewEmail.at, data: reviewEmail }])
})
console.log('insert email:', r2.status)
