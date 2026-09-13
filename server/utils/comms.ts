import type { CommsThread, OutboxEmail, Shipment, ThreadMessage } from '#shared/utils/shipping'
import { isNoiseMail, mailDirectionOf, mailFromOf, mailKindOf, mailToOf } from '#shared/utils/shipping'

/**
 * The unified ops inbox. Nothing here is stored: WhatsApp threads come off the
 * shipment JSON, email threads are OutboxEmail rows grouped by
 * shipment + counterpart address.
 *
 *   status = needs_reply      newest message is inbound — a person still owes a reply
 *          = waiting_on_them  we answered last
 *          = closed           notifications, or a thread the seed marked settled
 */

/** tracking / review / reward mails are system notifications, not a conversation. */
const NOTIFICATION_KINDS = new Set(['tracking', 'review', 'reward'])

function clientOf(s: Shipment): string {
  return s.company ?? s.customerName
}

function nameForAddress(s: Shipment | undefined, addr: string): string {
  const lower = addr.toLowerCase()
  const contact = s?.contacts?.find((c) => c.email.toLowerCase() === lower)
  if (contact?.name) return contact.name
  if (s && s.customerEmail.toLowerCase() === lower) return s.customerName
  const local = addr.split('@')[0] ?? addr
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || addr
}

function mailToMessage(e: OutboxEmail, s: Shipment | undefined): ThreadMessage {
  const direction = mailDirectionOf(e)
  return {
    id: e.id,
    direction,
    from: direction === 'in' ? nameForAddress(s, mailFromOf(e)) : 'M&P CS',
    body: e.body,
    at: e.at
  }
}

function waThreads(shipments: Shipment[]): CommsThread[] {
  const out: CommsThread[] = []
  for (const s of shipments) {
    for (const t of s.whatsapp ?? []) {
      const messages = [...t.messages].sort((a, b) => a.at.localeCompare(b.at))
      out.push({
        id: t.id,
        channel: 'whatsapp',
        shipmentId: s.id,
        contactName: t.contactName,
        contactHandle: t.contactHandle,
        contactRole: t.contactRole,
        subject: `${s.id} · ${clientOf(s)}`,
        lastAt: messages[messages.length - 1]?.at ?? s.createdAt,
        status: t.status,
        messages
      })
    }
  }
  return out
}

function emailThreads(shipments: Shipment[], emails: OutboxEmail[]): CommsThread[] {
  const byId = new Map(shipments.map((s) => [s.id, s]))
  const convos = new Map<string, OutboxEmail[]>()
  const notices = new Map<string, OutboxEmail[]>()

  for (const e of emails) {
    if (!e.shipmentId?.trim()) continue
    if (isNoiseMail(e)) continue
    const s = byId.get(e.shipmentId)
    if (!s) continue
    if (NOTIFICATION_KINDS.has(mailKindOf(e))) {
      const list = notices.get(e.shipmentId) ?? []
      list.push(e)
      notices.set(e.shipmentId, list)
      continue
    }
    const counterpart = (mailDirectionOf(e) === 'in' ? mailFromOf(e) : mailToOf(e)).toLowerCase()
    const key = `${e.shipmentId}|${counterpart}`
    const list = convos.get(key) ?? []
    list.push(e)
    convos.set(key, list)
  }

  const out: CommsThread[] = []

  for (const [key, list] of convos) {
    const [shipmentId, counterpart] = key.split('|') as [string, string]
    const s = byId.get(shipmentId)
    const messages = list
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => mailToMessage(e, s))
    const newest = list[list.length - 1]!
    out.push({
      id: `em-${shipmentId}-${counterpart.replace(/[^a-z0-9]+/g, '-')}`,
      channel: 'email',
      shipmentId,
      contactName: nameForAddress(s, counterpart),
      contactHandle: counterpart,
      contactRole: s && s.customerEmail.toLowerCase() === counterpart ? 'customer' : 'other',
      subject: newest.subject,
      lastAt: newest.at,
      status: mailDirectionOf(newest) === 'in' ? 'needs_reply' : 'waiting_on_them',
      messages
    })
  }

  for (const [shipmentId, list] of notices) {
    const s = byId.get(shipmentId)
    const messages = list
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => ({ ...mailToMessage(e, s), body: `${e.subject}\n\n${e.body}` }))
    out.push({
      id: `em-${shipmentId}-notifications`,
      channel: 'email',
      shipmentId,
      contactName: s ? s.customerName : shipmentId,
      contactHandle: s?.customerEmail ?? '',
      contactRole: 'customer',
      subject: `Notifications · ${shipmentId}`,
      lastAt: messages[messages.length - 1]?.at ?? s?.createdAt ?? '',
      status: 'closed',
      messages
    })
  }

  return out
}

/** Every thread across both channels, newest activity first. */
export function buildCommsThreads(shipments: Shipment[], emails: OutboxEmail[]): CommsThread[] {
  return [...waThreads(shipments), ...emailThreads(shipments, emails)]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Threads still owed a reply by a person at M&P. */
export function threadsNeedingReply(threads: CommsThread[]): CommsThread[] {
  return threads.filter((t) => t.status === 'needs_reply')
}
