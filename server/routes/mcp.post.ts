import type { Shipment, WaThread } from '#shared/utils/shipping'
import {
  CLAIM_LABELS,
  CUSTOMS_LABELS,
  MAIL_FROM_DISPLAY,
  PARTNER_ROLE_LABELS,
  PARTNER_STATE_LABELS,
  STATUS_LABELS,
  customsReady,
  declarationGaps,
  docsDone
} from '#shared/utils/shipping'

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
      category: d.category,
      status: d.status,
      deadline: d.deadline,
      by: d.uploadedBy,
      note: d.note
    })),
    documentsComplete: s.documents ? `${docsDone(s).done}/${docsDone(s).total} required documents done` : undefined,
    customs: s.customs
      ? {
          status: CUSTOMS_LABELS[s.customs.status],
          declaredBy: s.customs.declaredBy,
          declaredAt: s.customs.declaredAt,
          permitNo: s.customs.permitNo,
          clearedAt: s.customs.clearedAt,
          note: s.customs.note,
          readyToDeclare: customsReady(s),
          declaration: s.customs.declaration ?? null,
          gaps: declarationGaps(s),
          howItWorks: 'M&P check the documents, then an M&P customs officer files the declaration on TradeNet by hand. Human-in-the-loop only.'
        }
      : null,
    whatsapp: s.whatsapp?.map((t) => ({
      contact: t.contactName,
      handle: t.contactHandle,
      role: t.contactRole,
      status: t.status,
      messages: t.messages.map((m) => ({
        at: m.at,
        direction: m.direction === 'in' ? 'from them' : 'from M&P',
        from: m.from,
        body: m.body,
        attachment: m.attachment?.name
      }))
    })),
    partners: s.partners?.map((p) => ({
      role: PARTNER_ROLE_LABELS[p.role],
      name: p.name,
      contact: p.contact,
      state: PARTNER_STATE_LABELS[p.state],
      waitingFor: p.waitingFor,
      since: p.since,
      eta: p.eta,
      channel: p.channel
    })),
    claim: s.claim
      ? {
          type: CLAIM_LABELS[s.claim.type],
          status: s.claim.status,
          note: s.claim.note,
          openedBy: s.claim.openedBy,
          openedAt: s.claim.openedAt,
          resolvedAt: s.claim.resolvedAt,
          resolvedNote: s.claim.resolvedNote
        }
      : null,
    signedOff: s.signoff ? `by ${s.signoff.name} at ${s.signoff.at}` : null,
    review: s.review ? { rating: s.review.rating, comment: s.review.comment, helpedBy: s.review.helpedBy, rewardSent: !!s.review.reward } : null,
    reviewAsk: s.reviewAsk ? { state: s.reviewAsk.state, trigger: s.reviewAsk.trigger, at: s.reviewAsk.at, reason: s.reviewAsk.reason } : null,
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
    description: 'Get the full status of one shipment: milestone timeline, document checklist, customs/TradeNet state, any open claim, quote reference, sign-off and review state. Use the shipment id (e.g. MP-4471-AF).',
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
    description: 'List everything currently outstanding across all shipments: documents awaiting upload or verification (with deadlines), customs jobs awaiting declaration (an M&P customs officer files them on TradeNet manually), open claims, deliveries awaiting customer sign-off, and reviews awaiting reward approval.',
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
  },
  {
    name: 'list_customs_gaps',
    description: 'List every shipment that still needs a Singapore Customs / TradeNet declaration and exactly what is missing before an M&P customs officer can file it: unfilled declaration fields (HS code, cargo value, importer UEN and so on) plus customs documents not yet approved.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_open_comms',
    description: 'List open conversation threads across email and WhatsApp that still need a reply from M&P, newest first, with the last message in each. Use this to answer "what still needs a reply?".',
    inputSchema: {
      type: 'object',
      properties: {
        shipmentId: { type: 'string', description: 'Optional — only threads tied to this shipment id' },
        includeWaiting: { type: 'boolean', description: 'Also include threads where M&P replied last and is waiting on the other side' }
      }
    }
  },
  {
    name: 'list_partner_waits',
    description: 'List the shipping lines, warehouses/CFS, customs brokers, overseas agents and hauliers M&P is currently waiting on or blocked by, per shipment, with what each one owes us and since when.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_exceptions',
    description: 'List everything going wrong right now across all shipments: jobs stuck with no movement for over 24h, ETAs already passed, customs gaps against a near ETA, open claims, blocked partners, threads unanswered for more than 2h and deliveries awaiting sign-off.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: { type: 'string', description: "Optional filter: 'high', 'medium' or 'low'" }
      }
    }
  },
  {
    name: 'send_whatsapp',
    description: 'Send a WhatsApp message to a shipment\'s customer (simulated for this demo — it is appended to the job\'s WhatsApp thread and the timeline, nothing leaves the system). Keep it short and in Singapore customer-service tone.',
    inputSchema: {
      type: 'object',
      properties: {
        shipmentId: { type: 'string', description: 'Shipment id, e.g. MP-3318-MC' },
        body: { type: 'string', description: 'Message text (max 1000 chars)' },
        to: { type: 'string', description: 'Optional WhatsApp handle, e.g. "+65 8112 9043" — defaults to the existing thread or the customer' }
      },
      required: ['shipmentId', 'body']
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
      documents: s.documents ? `${docsDone(s).done}/${docsDone(s).total} complete` : undefined,
      customs: s.customs ? CUSTOMS_LABELS[s.customs.status] : undefined,
      openClaim: s.claim?.status === 'open' ? CLAIM_LABELS[s.claim.type] : undefined,
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
      if (s.customs && (s.customs.status === 'docs_pending' || s.customs.status === 'ready_for_declaration')) {
        actions.push({
          shipment: s.id,
          client: s.company ?? s.customerName,
          action: customsReady(s)
            ? 'Customs: ready for declaration — needs M&P customs officer to file on TradeNet and mark it declared'
            : 'Customs: documents still outstanding before the declaration can be prepared',
          documents: `${docsDone(s).done}/${docsDone(s).total} required documents done`
        })
      }
      if (s.claim?.status === 'open') {
        actions.push({
          shipment: s.id,
          client: s.company ?? s.customerName,
          action: `Open ${CLAIM_LABELS[s.claim.type].toLowerCase()} — CS/claims to resolve${s.claim.note ? `: ${s.claim.note}` : ''}`,
          openedAt: s.claim.openedAt,
          reviewAsk: s.reviewAsk?.state === 'held' ? 'Review request held until the claim is resolved' : undefined
        })
      }
      const gaps = s.customs ? declarationGaps(s) : []
      if (gaps.length) {
        actions.push({
          shipment: s.id,
          client: s.company ?? s.customerName,
          action: `Customs: ${gaps.length} item(s) missing before the TradeNet declaration can be filed`,
          missing: gaps
        })
      }
      for (const p of s.partners ?? []) {
        if (p.state !== 'waiting' && p.state !== 'blocked') continue
        actions.push({
          shipment: s.id,
          client: s.company ?? s.customerName,
          action: `${PARTNER_STATE_LABELS[p.state]} — ${PARTNER_ROLE_LABELS[p.role]} ${p.name}${p.waitingFor ? `: ${p.waitingFor}` : ''}`,
          since: p.since,
          contact: p.contact
        })
      }
    }
    for (const t of threadsNeedingReply(buildCommsThreads(shipments, await dbListEmails()))) {
      actions.push({
        shipment: t.shipmentId ?? '(unmatched)',
        client: t.contactName,
        action: `Reply to ${t.contactName} on ${t.channel === 'whatsapp' ? 'WhatsApp' : 'email'} — "${t.subject}"`,
        lastMessage: t.messages[t.messages.length - 1]?.body,
        lastAt: t.lastAt
      })
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
      from: MAIL_FROM_DISPLAY,
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

  if (name === 'list_customs_gaps') {
    const rows = shipments
      .filter((s) => s.customs)
      .map((s) => ({
        shipment: s.id,
        client: s.company ?? s.customerName,
        route: `${s.origin} → ${s.destination}`,
        eta: s.eta,
        customsStatus: CUSTOMS_LABELS[s.customs!.status],
        documents: `${docsDone(s).done}/${docsDone(s).total} required documents done`,
        missing: declarationGaps(s),
        declarationSoFar: s.customs!.declaration ?? {},
        permitNo: s.customs!.permitNo,
        filedBy: s.customs!.declaredBy
      }))
      .filter((r) => r.missing.length > 0)
    return rows.length
      ? `${rows.length} shipment(s) cannot be declared on TradeNet yet. An M&P customs officer (Joreen) files each one by hand once these are in:\n\n${JSON.stringify(rows, null, 2)}`
      : 'No customs gaps — every declaration-ready job has its fields and documents in place.'
  }

  if (name === 'list_open_comms') {
    const emails = await dbListEmails()
    let threads = buildCommsThreads(shipments, emails)
    if (args?.shipmentId) {
      const wanted = String(args.shipmentId).toUpperCase()
      threads = threads.filter((t) => t.shipmentId === wanted)
    }
    threads = args?.includeWaiting
      ? threads.filter((t) => t.status !== 'closed')
      : threadsNeedingReply(threads)
    if (!threads.length) return 'No open threads — nothing is waiting on a reply from M&P.'
    return JSON.stringify(threads.map((t) => ({
      thread: t.id,
      channel: t.channel,
      shipment: t.shipmentId,
      contact: `${t.contactName} (${t.contactHandle})`,
      subject: t.subject,
      status: t.status,
      lastAt: t.lastAt,
      lastMessage: t.messages[t.messages.length - 1]
        ? `${t.messages[t.messages.length - 1]!.direction === 'in' ? 'them' : 'M&P'}: ${t.messages[t.messages.length - 1]!.body}`
        : undefined,
      messages: t.messages.length
    })), null, 2)
  }

  if (name === 'list_partner_waits') {
    const rows: any[] = []
    for (const s of shipments) {
      for (const p of s.partners ?? []) {
        if (p.state !== 'waiting' && p.state !== 'blocked') continue
        rows.push({
          shipment: s.id,
          client: s.company ?? s.customerName,
          partner: p.name,
          role: PARTNER_ROLE_LABELS[p.role],
          state: PARTNER_STATE_LABELS[p.state],
          waitingFor: p.waitingFor,
          since: p.since,
          contact: p.contact,
          channel: p.channel
        })
      }
    }
    return rows.length
      ? JSON.stringify(rows, null, 2)
      : 'No partner is holding anything up right now.'
  }

  if (name === 'list_exceptions') {
    const emails = await dbListEmails()
    let rows = buildExceptions(shipments, buildCommsThreads(shipments, emails))
    if (args?.severity) {
      const sev = String(args.severity).toLowerCase()
      rows = rows.filter((r) => r.severity === sev)
    }
    return rows.length
      ? JSON.stringify(rows.map((r) => ({
          shipment: r.shipmentId,
          client: r.client,
          kind: r.kind,
          severity: r.severity,
          title: r.title,
          detail: r.detail,
          since: r.since
        })), null, 2)
      : 'No exceptions — nothing is stuck, overdue or blocked.'
  }

  if (name === 'send_whatsapp') {
    const text = String(args?.body ?? '').trim()
    if (!text) return 'body (message text) is required.'
    if (text.length > 1000) return 'Message too long (max 1000 chars).'
    const shipment = shipments.find((x) => x.id === String(args?.shipmentId ?? '').toUpperCase())
    if (!shipment) {
      return `No shipment found with id "${args?.shipmentId}". Use list_shipments to see valid ids.`
    }

    const threads = (shipment.whatsapp ??= [])
    let thread: WaThread | undefined = threads.find((t) => t.contactRole === 'customer')
    if (!thread) {
      thread = {
        id: `wa-${shipment.id.toLowerCase()}-customer`,
        contactName: shipment.customerName,
        contactHandle: String(args?.to ?? '').trim() || '+65 —',
        contactRole: 'customer',
        status: 'waiting_on_them',
        messages: []
      }
      threads.push(thread)
    } else if (args?.to) {
      thread.contactHandle = String(args.to).trim()
    }

    const at = new Date().toISOString()
    thread.messages.push({
      id: `${thread.id}-${thread.messages.length + 1}`,
      direction: 'out',
      from: 'M&P CS',
      body: text,
      at
    })
    thread.status = 'waiting_on_them'
    addEvent(shipment, {
      type: 'message',
      actor: 'cs',
      note: '💬 WhatsApp sent via AI assistant',
      at
    })
    await dbSaveShipment(shipment)

    return `WhatsApp sent to ${thread.contactName} (${thread.contactHandle}) on ${shipment.id} and logged on the job timeline (simulated for this demo). Thread is now "waiting on them".\n\nSent: ${text}`
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
