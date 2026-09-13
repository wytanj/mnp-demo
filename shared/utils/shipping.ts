export const STATUS_FLOW = [
  'booked',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered'
] as const

export type ShipmentStatus = (typeof STATUS_FLOW)[number]

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  booked: 'Booking confirmed',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered'
}

export type ShipmentMode = 'b2b' | 'b2c' | 'b2self'

export const MODE_LABELS: Record<ShipmentMode, string> = {
  b2b: 'B2B',
  b2c: 'B2C',
  b2self: 'B2SELF'
}

export interface ShipmentEvent {
  id: string
  type: 'status' | 'photo' | 'note' | 'signoff' | 'created'
  status?: ShipmentStatus
  note?: string
  photo?: string
  actor: 'cs' | 'driver' | 'customer' | 'system'
  at: string
}

export interface QuoteLine {
  label: string
  amount: number | null // null = at cost / on application
  unit?: string // e.g. "/20'", "/BL", "/shipment"
  note?: string
  excluded?: boolean // conditional; not counted in subtotal
}

export interface QuoteSection {
  key: string
  title: string
  currency: 'USD' | 'SGD'
  subtitle?: string
  lines: QuoteLine[]
}

export type DocumentStatus = 'pending' | 'uploaded' | 'approved' | 'waived'

export interface ShipmentDocument {
  key: string
  label: string
  required: boolean
  status: DocumentStatus
  deadline?: string
  file?: string // data URL
  fileName?: string
  uploadedBy?: string
  at?: string
  note?: string
}

export interface QuoteUpdate {
  from: string
  at: string
  text: string
}

export interface Quote {
  ref: string
  title: string
  route: string
  containerType: string
  carrier: string
  validUntil: string
  cargo?: string[]
  sections: QuoteSection[]
  notes: string[]
  // per-RT / per-w/m rate cards: unit-rate sums are misleading, hide subtotals
  showSubtotals?: boolean
  lumpSum?: { amount: number; currency: string; note?: string }
  updates?: QuoteUpdate[]
}

export interface Shipment {
  id: string
  mode: ShipmentMode
  service?: string
  status: ShipmentStatus
  customerName: string
  customerEmail: string
  company?: string
  poNumber?: string
  incoterms?: string
  origin: string
  destination: string
  eta: string
  driverName: string
  driverPhone?: string
  vehicle: string
  pieces: number
  weightKg: number
  description: string
  events: ShipmentEvent[]
  quote?: Quote
  documents?: ShipmentDocument[]
  signoff?: { name: string; signature: string; at: string }
  review?: {
    rating: number
    comment: string
    at: string
    screenshot?: string // proof of public review, uploaded by customer
    platforms?: Array<'google' | 'facebook'>
    reward?: { code: string; at: string; value?: string }
  }
  // People who have written in about this job — booking address plus any
  // Gmail / SingNet / colleague domain that later attached itself.
  contacts?: ShipmentContact[]
  createdAt: string
}

export interface ShipmentContact {
  email: string
  name?: string
  source: 'booking' | 'inbound' | 'cs'
  at?: string
}

export type MailDirection = 'in' | 'out'
export type MailKind = 'tracking' | 'review' | 'reward' | 'inbound' | 'reply' | 'cs'
export type MailMatch = 'shipment-id' | 'booking-email' | 'alias' | 'company-domain'

export interface OutboxEmail {
  id: string
  shipmentId: string
  to: string
  from?: string
  subject: string
  body: string
  ctaLabel: string
  ctaUrl: string
  at: string
  direction?: MailDirection
  kind?: MailKind
  matchedBy?: MailMatch
  delivery?: { state: 'sent' | 'failed' | 'simulated'; detail?: string; to: string }
}

const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.com.sg', 'ymail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'singnet.com.sg', 'starhub.net.sg', 'pacific.net.sg',
  'qq.com', '163.com', '126.com', 'naver.com'
])

export function emailDomain(addr: string): string {
  return (addr.split('@')[1] ?? '').trim().toLowerCase()
}

export function isConsumerMailbox(addr: string): boolean {
  return CONSUMER_DOMAINS.has(emailDomain(addr))
}

export function mailKindOf(e: OutboxEmail): MailKind {
  if (e.kind) return e.kind
  if (e.direction === 'in') return 'inbound'
  if (e.ctaUrl?.startsWith('/review')) return 'review'
  if (/reward/i.test(e.subject)) return 'reward'
  if (e.ctaUrl?.startsWith('/track')) return 'tracking'
  if (/^re:/i.test(e.subject)) return 'reply'
  return 'cs'
}

export function mailDirectionOf(e: OutboxEmail): MailDirection {
  return e.direction ?? 'out'
}

export const DEFAULT_MAIL_FROM = 'M&P International Freights <tracking@pickletour.app>'

export function mailFromOf(e: OutboxEmail): string {
  if (e.from?.trim()) return e.from.trim()
  return mailDirectionOf(e) === 'in' ? 'unknown sender' : DEFAULT_MAIL_FROM
}

export function mailToOf(e: OutboxEmail): string {
  return (e.to ?? '').trim()
}

/** Address a compose/reply would go to — inbound replies to the sender, never CS. */
export function mailComposeTo(e: OutboxEmail): string {
  return mailDirectionOf(e) === 'in' ? mailFromOf(e) : mailToOf(e)
}

export function mailDeliveredTo(e: OutboxEmail): string | null {
  const live = e.delivery?.to?.trim()
  if (!live) return null
  if (live.toLowerCase() === mailToOf(e).toLowerCase()) return null
  return live
}

export function statusIndex(status: ShipmentStatus): number {
  return STATUS_FLOW.indexOf(status)
}
