import type { OutboxEmail, WaThread } from '#shared/utils/shipping'
import { MAIL_FROM_DISPLAY } from '#shared/utils/shipping'

/**
 * Reply from the ops inbox. WhatsApp is simulated (pitch mode — no Twilio):
 * the outbound message is appended to the thread on the shipment and the
 * thread flips to waiting_on_them. Email goes through the normal outbox.
 *
 * POST { threadId, channel, shipmentId, to?, body }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const threadId = String(body?.threadId ?? '').trim()
  const channel = String(body?.channel ?? '').trim()
  const shipmentId = String(body?.shipmentId ?? '').trim().toUpperCase()
  const text = String(body?.body ?? '').trim()
  const to = String(body?.to ?? '').trim()

  if (!text) throw createError({ statusCode: 400, statusMessage: 'body (message text) is required' })
  if (text.length > 4000) throw createError({ statusCode: 400, statusMessage: 'Message too long (max 4000 characters)' })
  if (channel !== 'email' && channel !== 'whatsapp') {
    throw createError({ statusCode: 400, statusMessage: "channel must be 'email' or 'whatsapp'" })
  }
  if (!shipmentId) throw createError({ statusCode: 400, statusMessage: 'shipmentId is required' })

  const shipment = await dbGetShipment(shipmentId)
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })

  const at = new Date().toISOString()

  if (channel === 'whatsapp') {
    const threads = (shipment.whatsapp ??= [])
    let thread: WaThread | undefined = threads.find((t) => t.id === threadId)
    if (!thread) {
      thread = {
        id: threadId || `wa-${shipment.id.toLowerCase()}-${threads.length + 1}`,
        contactName: shipment.customerName,
        contactHandle: to || '+65 —',
        contactRole: 'customer',
        status: 'waiting_on_them',
        messages: []
      }
      threads.push(thread)
    }
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
      note: `💬 WhatsApp sent to ${thread.contactName}: "${text.slice(0, 140)}"`,
      internal: true,
      at
    })
    await dbSaveShipment(shipment)
  } else {
    const recipient = to || shipment.customerEmail
    const email: OutboxEmail = {
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      from: MAIL_FROM_DISPLAY,
      to: recipient,
      direction: 'out',
      kind: 'cs',
      subject: `${shipment.id} — update from M&P`,
      body: text,
      ctaLabel: 'Track your shipment',
      ctaUrl: `/track/${shipment.id}`,
      at
    }
    await sendEmail(email)
    await dbSaveEmail(email)
    addEvent(shipment, {
      type: 'note',
      actor: 'cs',
      note: `✉️ Email sent to ${recipient} from the ops inbox`,
      internal: true,
      at
    })
    await dbSaveShipment(shipment)
  }

  const [shipments, emails] = await Promise.all([dbGetShipments(), dbListEmails()])
  const threads = buildCommsThreads(shipments, emails).filter((t) => t.shipmentId === shipment.id)
  const updated =
    threads.find((t) => t.id === threadId) ??
    threads.find((t) => t.channel === channel) ??
    threads[0] ??
    null
  return { ok: true, thread: updated }
})
