import type { MailMatch, Shipment } from '#shared/utils/shipping'
import { emailDomain, isConsumerMailbox } from '#shared/utils/shipping'

export function findShipmentId(text: string): string | undefined {
  return text.match(/MP-\d{4}-[A-Z]{2}/i)?.[0]?.toUpperCase()
}

function pickActive(list: Shipment[]): Shipment {
  const rank = (s: Shipment) => (s.status === 'delivered' ? 0 : 1)
  return [...list].sort((a, b) => {
    const r = rank(b) - rank(a)
    return r || b.createdAt.localeCompare(a.createdAt)
  })[0]!
}

function knownAddresses(s: Shipment): string[] {
  const addrs = [s.customerEmail, ...(s.contacts ?? []).map((c) => c.email)]
  return addrs.map((a) => a.toLowerCase())
}

export function matchShipmentForInbound(opts: {
  from: string
  subject: string
  text: string
  shipments: Shipment[]
}): { shipment?: Shipment; matchedBy?: MailMatch } {
  const id = findShipmentId(`${opts.subject}\n${opts.text}`)
  if (id) {
    const shipment = opts.shipments.find((s) => s.id === id)
    if (shipment) return { shipment, matchedBy: 'shipment-id' }
  }

  const from = opts.from.trim().toLowerCase()
  if (!from.includes('@')) return {}

  const byBooking = opts.shipments.filter((s) => s.customerEmail.toLowerCase() === from)
  if (byBooking.length) return { shipment: pickActive(byBooking), matchedBy: 'booking-email' }

  const byAlias = opts.shipments.filter((s) =>
    (s.contacts ?? []).some((c) => c.email.toLowerCase() === from)
  )
  if (byAlias.length) return { shipment: pickActive(byAlias), matchedBy: 'alias' }

  // Company domain is a hint, never a consumer mailbox (gmail / singnet / …)
  if (isConsumerMailbox(from)) return {}
  const domain = emailDomain(from)
  if (!domain) return {}
  const byDomain = opts.shipments.filter((s) =>
    knownAddresses(s).some((a) => emailDomain(a) === domain)
  )
  if (byDomain.length) return { shipment: pickActive(byDomain), matchedBy: 'company-domain' }
  return {}
}

export function rememberContact(s: Shipment, email: string, name?: string): boolean {
  const list = s.contacts?.length
    ? [...s.contacts]
    : [{ email: s.customerEmail, name: s.customerName, source: 'booking' as const }]
  const exists = list.some((c) => c.email.toLowerCase() === email.toLowerCase())
  if (!exists) {
    list.push({
      email,
      name,
      source: 'inbound',
      at: new Date().toISOString()
    })
  }
  s.contacts = list
  return !exists
}
