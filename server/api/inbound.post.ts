import type { Shipment } from '#shared/utils/shipping'
import { STATUS_LABELS } from '#shared/utils/shipping'

// Resend `email.received` webhook → AI-drafted CS reply, sent back via Resend
// and logged on the shipment timeline + outbox.

const WEBHOOK_KEY = process.env.MCP_API_KEY || 'mp-demo-2481'

function shipmentContext(s: Shipment): string {
  return JSON.stringify({
    id: s.id,
    client: s.company ?? s.customerName,
    status: STATUS_LABELS[s.status],
    route: `${s.origin} → ${s.destination}`,
    eta: s.eta,
    cargo: s.description,
    driver: `${s.driverName} (${s.vehicle})`,
    pendingDocuments: s.documents?.filter((d) => d.status !== 'approved' && d.status !== 'waived').map((d) => d.label),
    signedOff: !!s.signoff,
    recentEvents: s.events.slice(-5).map((e) => `${e.at}: ${e.note ?? e.status ?? e.type}`)
  })
}

async function draftReply(customerMessage: string, shipment?: Shipment): Promise<string> {
  const key = process.env.XAI_KEY
  const fallback = [
    `Thanks for your message — our customer service team has received it and will get back to you shortly.`,
    shipment ? `Meanwhile, live status for ${shipment.id} is always available on your tracking page.` : '',
    ``,
    `— M&P Customer Service`
  ].filter(Boolean).join('\n')
  if (!key) return fallback

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || 'grok-4-fast-non-reasoning',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: [
              'You are the customer service assistant for M&P International Freights, a Singapore freight forwarder.',
              'Reply to the customer email below: concise (under 120 words), warm, professional Singapore business tone.',
              'Answer from the shipment data provided. If asked something the data does not cover, say the CS team will follow up — never invent rates, dates or commitments.',
              'Never write URLs or links — the email template automatically appends a tracking button. You may say "see the tracking button below". Plain text only.',
              'Sign off exactly as: "— M&P Customer Service (AI assistant)"',
              shipment ? `Shipment data: ${shipmentContext(shipment)}` : 'No shipment matched this email.'
            ].join('\n')
          },
          { role: 'user', content: customerMessage.slice(0, 4000) }
        ]
      })
    })
    if (!res.ok) throw new Error(`xAI ${res.status}`)
    const data: any = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    return text || fallback
  } catch {
    return fallback
  }
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  if (q.key !== WEBHOOK_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid webhook key' })
  }

  const payload = await readBody(event)
  if (payload?.type && payload.type !== 'email.received') return { ok: true, ignored: payload.type }

  const d = payload?.data ?? payload ?? {}
  const fromRaw = Array.isArray(d.from) ? d.from[0] : d.from
  let from: string = fromRaw?.email ?? String(fromRaw ?? '')
  let subject: string = String(d.subject ?? '')
  let text: string = String(d.text ?? d.html ?? '').replace(/<[^>]+>/g, ' ').trim()

  // The email.received webhook carries metadata only — fetch the body by id
  const emailId = d.email_id ?? d.id
  if (!text && emailId && process.env.RESEND_API_KEY) {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` }
    })
    if (res.ok) {
      const detail: any = await res.json()
      from = from || (Array.isArray(detail.from) ? detail.from[0] : detail.from) || ''
      subject = subject || String(detail.subject ?? '')
      text = String(detail.text ?? detail.html ?? '').replace(/<[^>]+>/g, ' ').trim()
    }
  }
  // extract the sender's actual email if formatted as "Name <addr>"
  from = from.match(/<([^>]+)>/)?.[1] ?? from
  // drop quoted reply history so the AI answers the new message only
  text = text.split(/\r?\nOn .{5,120}wrote:\r?\n/s)[0]!.trim() || text
  if (!from || !text) return { ok: true, ignored: 'no sender or body' }

  // Match the job — never the mailbox. Gmail / SingNet / a colleague's
  // company address all attach if the subject has MP-XXXX-XX, or if we've
  // seen that address on this shipment before.
  const shipments = await dbGetShipments()
  const { shipment, matchedBy } = matchShipmentForInbound({ from, subject, text, shipments })

  const inboundAt = new Date().toISOString()
  await dbSaveEmail({
    id: crypto.randomUUID(),
    shipmentId: shipment?.id ?? '',
    from,
    to: 'cs@mp.com.sg',
    direction: 'in',
    kind: 'inbound',
    matchedBy,
    subject,
    body: text,
    ctaLabel: shipment ? 'Open shipment' : 'Open M&P tracking',
    ctaUrl: shipment ? `/track/${shipment.id}` : '/',
    at: inboundAt,
    delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'inbound' }
  })

  // Kill switch: set INBOUND_AUTOREPLY=off to stop AI replies while still
  // logging inbound mail. Also skip when nothing matched a real shipment, so
  // unrelated mail on this shared inbox (e.g. Pickletour) doesn't get a freight reply.
  const autoreplyOff = ['off', 'false', '0', 'no'].includes(String(process.env.INBOUND_AUTOREPLY ?? 'on').toLowerCase())
  if (autoreplyOff || !shipment) {
    return { ok: true, replied: 'skipped', reason: autoreplyOff ? 'autoreply-off' : 'no-shipment-match', shipment: shipment?.id ?? null, matchedBy: matchedBy ?? null }
  }

  const reply = await draftReply(text, shipment)

  const email = {
    id: crypto.randomUUID(),
    shipmentId: shipment?.id ?? '',
    from: 'M&P International Freights <tracking@pickletour.app>',
    to: from,
    direction: 'out' as const,
    kind: 'reply' as const,
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    body: reply,
    ctaLabel: shipment ? 'Track your shipment' : 'Open M&P tracking',
    ctaUrl: shipment ? `/track/${shipment.id}` : '/',
    at: new Date().toISOString()
  }
  await sendEmail(email)
  await dbSaveEmail(email)

  if (shipment) {
    const added = rememberContact(shipment, from)
    const who = added ? ` (new address ${from})` : ''
    addEvent(shipment, {
      type: 'note',
      actor: 'cs',
      note: `📩 ${from} wrote in${matchedBy === 'shipment-id' ? ' quoting this job' : matchedBy === 'company-domain' ? ' from the company domain' : ''}${who}`
    })
    addEvent(shipment, { type: 'note', actor: 'cs', note: `🤖 AI auto-replied to "${subject}"` })
    await dbSaveShipment(shipment)
  }

  return { ok: true, replied: email.delivery?.state, shipment: shipment?.id ?? null, matchedBy: matchedBy ?? null }
})
