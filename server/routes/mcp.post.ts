import type { Shipment } from '#shared/utils/shipping'
import { STATUS_LABELS } from '#shared/utils/shipping'

const API_KEY = process.env.MCP_API_KEY || 'mp-demo-2481'

function authed(event: any): boolean {
  const q = getQuery(event)
  const header = getHeader(event, 'authorization') || getHeader(event, 'x-api-key') || ''
  const key = (q.key as string) || header.replace(/^Bearer\s+/i, '')
  return key === API_KEY
}

// strip base64 blobs so tool output stays small
function slim(s: Shipment) {
  return {
    id: s.id,
    client: s.company ?? s.customerName,
    contact: `${s.customerName} <${s.customerEmail}>`,
    mode: s.mode,
    service: s.service,
    status: STATUS_LABELS[s.status],
    route: `${s.origin} → ${s.destination}`,
    eta: s.eta,
    cargo: `${s.description} (${s.pieces} pcs, ${s.weightKg} kg)`,
    driver: s.driverName,
    reference: s.poNumber,
    incoterms: s.incoterms,
    quoteRef: s.quote?.ref,
    quoteLumpSum: s.quote?.lumpSum ? `${s.quote.lumpSum.currency} ${s.quote.lumpSum.amount}` : undefined,
    documents: s.documents?.map((d) => ({
      label: d.label,
      status: d.status,
      deadline: d.deadline,
      by: d.uploadedBy,
      note: d.note
    })),
    signedOff: s.signoff ? `by ${s.signoff.name} at ${s.signoff.at}` : null,
    review: s.review ? { rating: s.review.rating, comment: s.review.comment, rewardSent: !!s.review.reward } : null,
    timeline: s.events.map((e) => ({
      at: e.at,
      actor: e.actor,
      event: e.type === 'status' && e.status ? STATUS_LABELS[e.status] : e.type,
      note: e.note,
      hasPhoto: !!e.photo
    }))
  }
}

const TOOLS = [
  {
    name: 'list_shipments',
    description: 'List all shipments handled by M&P International Freights with status, route, client, ETA and document progress. Optionally filter by status keyword (e.g. "transit", "delivered") or client name.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional keyword to match against client, status, route or shipment id' }
      }
    }
  },
  {
    name: 'get_shipment',
    description: 'Get the full status of one shipment: milestone timeline, document checklist, quote reference, sign-off and review state. Use the shipment id (e.g. MP-4471-AF).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Shipment id, e.g. MP-4471-AF' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_pending_actions',
    description: 'List everything currently outstanding across all shipments: documents awaiting upload or verification (with deadlines), deliveries awaiting customer sign-off, and reviews awaiting reward approval.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'send_email',
    description: 'Send a branded M&P email via Resend and log it in the outbox. Provide a shipmentId to email that shipment\'s customer (and log the send on its timeline) — the email\'s button will link to the tracking page. Alternatively provide an explicit "to" address. Compose subject and body yourself; sign off as "— M&P International Freights".',
    inputSchema: {
      type: 'object',
      properties: {
        shipmentId: { type: 'string', description: 'Shipment id, e.g. MP-4471-AF — recipient defaults to its customer' },
        to: { type: 'string', description: 'Recipient email — required if shipmentId is not given' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Plain-text email body (line breaks preserved)' }
      },
      required: ['subject', 'body']
    }
  }
]

async function callTool(name: string, args: any): Promise<string> {
  const shipments = await dbGetShipments()

  if (name === 'list_shipments') {
    let list = shipments
    if (args?.filter) {
      const f = String(args.filter).toLowerCase()
      list = list.filter((s) =>
        [s.id, s.company, s.customerName, s.status, s.origin, s.destination, s.service]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(f))
      )
    }
    return JSON.stringify(list.map((s) => ({
      id: s.id,
      client: s.company ?? s.customerName,
      mode: s.mode,
      service: s.service,
      status: STATUS_LABELS[s.status],
      route: `${s.origin} → ${s.destination}`,
      eta: s.eta,
      documents: s.documents
        ? `${s.documents.filter((d) => d.status === 'approved' || d.status === 'waived').length}/${s.documents.length} complete`
        : undefined,
      trackingUrl: `https://mnp-flow.vercel.app/track/${s.id}`
    })), null, 2)
  }

  if (name === 'get_shipment') {
    const s = shipments.find((x) => x.id === String(args?.id ?? '').toUpperCase())
    if (!s) return `No shipment found with id "${args?.id}". Use list_shipments to see valid ids.`
    return JSON.stringify(slim(s), null, 2)
  }

  if (name === 'list_pending_actions') {
    const actions: any[] = []
    for (const s of shipments) {
      for (const d of s.documents ?? []) {
        if (d.status === 'pending') {
          actions.push({ shipment: s.id, client: s.company ?? s.customerName, action: `Upload ${d.label}`, deadline: d.deadline, note: d.note })
        } else if (d.status === 'uploaded') {
          actions.push({ shipment: s.id, client: s.company ?? s.customerName, action: `M&P to verify ${d.label} (uploaded by ${d.uploadedBy})` })
        }
      }
      if (!s.signoff && ['out_for_delivery', 'delivered'].includes(s.status)) {
        actions.push({ shipment: s.id, client: s.company ?? s.customerName, action: 'Customer sign-off pending — delivery in progress' })
      }
      if (s.review && !s.review.reward) {
        actions.push({ shipment: s.id, client: s.company ?? s.customerName, action: `Approve review reward (★${s.review.rating} review received)` })
      }
    }
    return actions.length ? JSON.stringify(actions, null, 2) : 'Nothing outstanding — all shipments are up to date.'
  }

  if (name === 'send_email') {
    const subject = String(args?.subject ?? '').trim()
    const body = String(args?.body ?? '').trim()
    if (!subject || !body) return 'subject and body are required.'
    if (body.length > 4000) return 'Body too long (max 4000 chars).'

    const shipment = args?.shipmentId
      ? shipments.find((x) => x.id === String(args.shipmentId).toUpperCase())
      : undefined
    if (args?.shipmentId && !shipment) {
      return `No shipment found with id "${args.shipmentId}". Use list_shipments to see valid ids.`
    }
    const to = String(args?.to ?? shipment?.customerEmail ?? '').trim()
    if (!to) return 'Provide "to" or a shipmentId with a customer email.'

    const email = {
      id: crypto.randomUUID(),
      shipmentId: shipment?.id ?? '',
      from: 'M&P International Freights <tracking@pickletour.app>',
      to,
      direction: 'out' as const,
      kind: 'cs' as const,
      subject,
      body,
      ctaLabel: shipment ? 'Track your shipment' : 'Open M&P dashboard',
      ctaUrl: shipment ? `/track/${shipment.id}` : '/',
      at: new Date().toISOString()
    }
    await sendEmail(email)
    await dbSaveEmail(email)
    if (shipment) {
      addEvent(shipment, { type: 'note', actor: 'cs', note: `✉️ Email sent via AI assistant: "${subject}"` })
      await dbSaveShipment(shipment)
    }
    const rerouted = email.delivery?.to && email.delivery.to !== to ? ` (demo reroute: delivered to ${email.delivery.to})` : ''
    return email.delivery?.state === 'sent'
      ? `Email sent to ${to}${rerouted} and logged in the outbox${shipment ? ` and on ${shipment.id}'s timeline` : ''}. Resend id: ${email.delivery.detail}`
      : `Email logged in the outbox but sending ${email.delivery?.state}: ${email.delivery?.detail ?? 'unknown error'}`
  }

  return `Unknown tool: ${name}`
}

export default defineEventHandler(async (event) => {
  if (!authed(event)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing API key. Pass ?key=... in the URL.' })
  }

  const msg = await readBody(event)

  // Notifications carry no id and expect no body
  if (typeof msg?.method === 'string' && msg.method.startsWith('notifications/')) {
    setResponseStatus(event, 202)
    return null
  }

  const respond = (result: unknown) => ({ jsonrpc: '2.0', id: msg?.id ?? null, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code, message } })

  switch (msg?.method) {
    case 'initialize':
      return respond({
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'mnp-flow-tracking', title: 'M&P Shipment Tracking', version: '1.0.0' }
      })
    case 'ping':
      return respond({})
    case 'tools/list':
      return respond({ tools: TOOLS })
    case 'tools/call':
      try {
        const text = await callTool(msg.params?.name, msg.params?.arguments ?? {})
        return respond({ content: [{ type: 'text', text }] })
      } catch (e: any) {
        return respond({ content: [{ type: 'text', text: `Tool error: ${e?.message}` }], isError: true })
      }
    default:
      return fail(-32601, `Method not found: ${msg?.method}`)
  }
})
