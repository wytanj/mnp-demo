// Idempotent: attach mixed-inbox conversations to live jobs (gmail / singnet / colleague).
const h = {
  apikey: process.env.SUPABASE_ANON_KEY,
  authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
  'content-type': 'application/json',
  prefer: 'resolution=merge-duplicates'
}
const base = process.env.SUPABASE_URL + '/rest/v1/'
const ago = (mins) => new Date(Date.now() - mins * 60_000).toISOString()
const uid = () => crypto.randomUUID()
const ev = (at, note) => ({ id: uid(), at, type: 'note', actor: 'cs', note })

async function getShipment(id) {
  const res = await fetch(base + 'shipments?id=eq.' + encodeURIComponent(id) + '&select=id,data', { headers: h })
  if (!res.ok) throw new Error('get ' + id + ' ' + res.status + ' ' + await res.text())
  return (await res.json())[0]?.data
}

async function saveShipment(s) {
  const res = await fetch(base + 'shipments', {
    method: 'POST', headers: h,
    body: JSON.stringify([{ id: s.id, data: s }])
  })
  if (!res.ok) throw new Error('save ' + s.id + ' ' + res.status + ' ' + await res.text())
}

async function saveEmail(e) {
  const res = await fetch(base + 'emails', {
    method: 'POST', headers: h,
    body: JSON.stringify([{ id: e.id, at: e.at, data: e }])
  })
  if (!res.ok) throw new Error('email ' + e.id + ' ' + res.status + ' ' + await res.text())
}

function inbound(partial) {
  return {
    direction: 'in', kind: 'inbound',
    to: 'cs@mp.com.sg',
    ctaLabel: 'Open shipment',
    delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'inbound' },
    ...partial
  }
}

function reply(partial) {
  return {
    direction: 'out', kind: 'reply',
    from: 'M&P International Freights <tracking@pickletour.app>',
    ctaLabel: 'Track your shipment',
    delivery: { state: 'simulated', to: partial.to, detail: 'pre-seeded demo data' },
    ...partial
  }
}

const threads = [
  {
    id: 'MP-4471-AF',
    contact: { email: 'esther@allmightyfoods.com.sg', name: 'Esther Ng', source: 'inbound', at: ago(50) },
    notes: [
      ev(ago(50), '📩 esther@allmightyfoods.com.sg wrote in from the company domain (new address esther@allmightyfoods.com.sg)'),
      ev(ago(49), '🤖 AI auto-replied to "Container TEMU 482391-0 — customs?"')
    ],
    emails: [
      inbound({
        id: 'in-4471-esther', shipmentId: 'MP-4471-AF',
        from: 'esther@allmightyfoods.com.sg', matchedBy: 'company-domain',
        subject: 'Container TEMU 482391-0 — customs?',
        body: 'Hi M&P,\n\nMelissa is out today. Has SG Customs cleared MP-4471-AF? We need the truck window for Senoko tomorrow.\n\nThanks,\nEsther',
        ctaUrl: '/track/MP-4471-AF', at: ago(50)
      }),
      reply({
        id: 'out-4471-esther', shipmentId: 'MP-4471-AF',
        to: 'esther@allmightyfoods.com.sg',
        subject: 'Re: Container TEMU 482391-0 — customs?',
        body: 'Hi Esther,\n\nYes — TradeNet permit is approved and the container is on the way to Senoko via AYE → SLE. Live status is on the tracking button below.\n\n— M&P Customer Service (AI assistant)',
        ctaUrl: '/track/MP-4471-AF', at: ago(49)
      })
    ]
  },
  {
    id: 'MP-3318-MC',
    contact: { email: 'brendan.ds@gmail.com', name: 'Brendan De Souza', source: 'inbound', at: ago(60 * 18) },
    notes: [
      ev(ago(60 * 18), '📩 brendan.ds@gmail.com wrote in quoting this job (new address brendan.ds@gmail.com)'),
      ev(ago(60 * 17), '🤖 AI auto-replied to "MP-3318-MC — any update on unstuffing?"')
    ],
    emails: [
      inbound({
        id: 'in-3318-gmail', shipmentId: 'MP-3318-MC',
        from: 'brendan.ds@gmail.com', matchedBy: 'shipment-id',
        subject: 'MP-3318-MC — any update on unstuffing?',
        body: 'Hi, emailing from my Gmail — office Outlook is down. Has HONGKONG BRIDGE unstuffed yet? Need to plan delivery.\n\nBrendan',
        ctaUrl: '/track/MP-3318-MC', at: ago(60 * 18)
      }),
      reply({
        id: 'out-3318-gmail', shipmentId: 'MP-3318-MC',
        to: 'brendan.ds@gmail.com',
        subject: 'Re: MP-3318-MC — any update on unstuffing?',
        body: 'Hi Brendan,\n\nMP-3318-MC is still in transit on HONGKONG BRIDGE V.0055S — ETA Singapore in 2 days. We will update delivery once the container is unstuffed.\n\n— M&P Customer Service (AI assistant)',
        ctaUrl: '/track/MP-3318-MC', at: ago(60 * 17)
      })
    ]
  },
  {
    id: 'MP-1633-TA',
    contact: { email: 'wy.tan@gmail.com', name: 'WY Tan', source: 'inbound', at: ago(80) },
    notes: [
      ev(ago(80), '📩 wy.tan@gmail.com wrote in quoting this job (new address wy.tan@gmail.com)'),
      ev(ago(78), '🤖 AI auto-replied to "MP-1633-TA washing charge"')
    ],
    emails: [
      inbound({
        id: 'in-1633-gmail', shipmentId: 'MP-1633-TA',
        from: 'wy.tan@gmail.com', matchedBy: 'shipment-id',
        subject: 'MP-1633-TA washing charge',
        body: 'Hi, writing from Gmail — can we see the yard photos for the SGD 20 washing charge on TEMU 1633288?\n\nWY Tan',
        ctaUrl: '/track/MP-1633-TA', at: ago(80)
      }),
      reply({
        id: 'out-1633-gmail', shipmentId: 'MP-1633-TA',
        to: 'wy.tan@gmail.com',
        subject: 'Re: MP-1633-TA washing charge',
        body: 'Hi WY,\n\nThe yard flagged washing on TEMU 1633288. Photos are still pending from the haulier — once they land on the tracking page we will send them through.\n\n— M&P Customer Service (AI assistant)',
        ctaUrl: '/track/MP-1633-TA', at: ago(78)
      })
    ]
  },
  {
    id: 'MP-2008-TA',
    contact: { email: 'wytan@singnet.com.sg', name: 'WY Tan', source: 'inbound', at: ago(60 * 8) },
    notes: [
      ev(ago(60 * 8), '📩 wytan@singnet.com.sg wrote in quoting this job (new address wytan@singnet.com.sg)'),
      ev(ago(60 * 7), '🤖 AI auto-replied to "GST on MP-2008-TA"')
    ],
    emails: [
      inbound({
        id: 'in-2008-singnet', shipmentId: 'MP-2008-TA',
        from: 'wytan@singnet.com.sg', matchedBy: 'shipment-id',
        subject: 'GST on MP-2008-TA',
        body: 'Hello, using my SingNet because the office mail is bouncing. Confirming GST on HBL ICS2008403A was paid before delivery?\n\nWY',
        ctaUrl: '/track/MP-2008-TA', at: ago(60 * 8)
      }),
      reply({
        id: 'out-2008-singnet', shipmentId: 'MP-2008-TA',
        to: 'wytan@singnet.com.sg',
        subject: 'Re: GST on MP-2008-TA',
        body: 'Hi WY,\n\nYes — GST under the cash/COD term was settled before delivery, and MP-2008-TA is signed off. The tracking page has the POD.\n\n— M&P Customer Service (AI assistant)',
        ctaUrl: '/track/MP-2008-TA', at: ago(60 * 7)
      })
    ]
  }
]

for (const t of threads) {
  const s = await getShipment(t.id)
  if (!s) {
    console.log('skip missing', t.id)
    continue
  }
  const booking = { email: s.customerEmail, name: s.customerName, source: 'booking' }
  const contacts = s.contacts?.length ? [...s.contacts] : [booking]
  if (!contacts.some((c) => c.email.toLowerCase() === t.contact.email.toLowerCase())) {
    contacts.push(t.contact)
  }
  s.contacts = contacts
  s.events = [...(s.events ?? []), ...t.notes]
  await saveShipment(s)
  for (const e of t.emails) await saveEmail(e)
  console.log('threaded', t.id, t.contact.email)
}

console.log('done')
