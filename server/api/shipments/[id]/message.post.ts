import type { OutboxEmail } from '#shared/utils/shipping'

/**
 * "Ask about this shipment" box on the customer tracking page.
 * The question lands in the job-tied inbox — no ticket, no Freshdesk.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const text = String(body?.text ?? '').trim()
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'Message text is required' })
  }
  if (text.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'Message too long (max 2000 characters)' })
  }

  const name = body?.name ? String(body.name).trim() : ''
  const from = (body?.email ? String(body.email).trim() : '') || shipment.customerEmail
  const at = new Date().toISOString()

  const email: OutboxEmail = {
    id: crypto.randomUUID(),
    shipmentId: shipment.id,
    from,
    to: 'cs@mp.com.sg',
    direction: 'in',
    kind: 'message',
    matchedBy: 'shipment-id',
    subject: `${shipment.id} — question from tracking page`,
    body: name ? `${text}\n\n— ${name}` : text,
    ctaLabel: 'Open shipment',
    ctaUrl: `/track/${shipment.id}`,
    at,
    delivery: { state: 'simulated', to: 'cs@mp.com.sg', detail: 'tracking page ask box' }
  }
  await dbSaveEmail(email)

  // Not internal — the customer sees their own question echoed on the timeline.
  addEvent(shipment, {
    type: 'message',
    actor: 'customer',
    note: `💬 Customer asked via tracking page: "${text}"`,
    at
  })
  await dbSaveShipment(shipment)

  return { ok: true, shipment }
})
