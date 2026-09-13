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
  type: 'status' | 'photo' | 'note' | 'signoff' | 'created' | 'claim' | 'customs' | 'message'
  status?: ShipmentStatus
  note?: string
  photo?: string
  actor: 'cs' | 'driver' | 'customer' | 'system'
  at: string
  /** CS-only note — stripped from the customer tracking API (/api/track/[id]). */
  internal?: boolean
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

/**
 * customs   — needed before M&P can declare on TradeNet (commercial invoice,
 *             packing list, B/L or AWB, import permit)
 * commercial— PO / quote paperwork
 * delivery  — haulier authorisation, photos, POD
 * payment   — transfer slips, GST advice
 */
export type DocumentCategory = 'customs' | 'commercial' | 'delivery' | 'payment'

export interface ShipmentDocument {
  key: string
  label: string
  required: boolean
  status: DocumentStatus
  category?: DocumentCategory
  deadline?: string
  file?: string // data URL
  fileName?: string
  uploadedBy?: string
  /** Who at M&P verified (approved) the document. */
  verifiedBy?: string
  at?: string
  note?: string
}

export type ClaimType = 'damage' | 'missing' | 'destination_fee' | 'no_reply'

export interface ShipmentClaim {
  type: ClaimType
  note: string
  openedAt: string
  openedBy: 'customer' | 'cs' | 'driver'
  status: 'open' | 'resolved'
  resolvedAt?: string
  resolvedNote?: string
}

export const CLAIM_TYPES: ClaimType[] = ['damage', 'missing', 'destination_fee', 'no_reply']

export const CLAIM_LABELS: Record<ClaimType, string> = {
  damage: 'Damage claim',
  missing: 'Missing cargo claim',
  destination_fee: 'Destination fee dispute',
  no_reply: 'No-reply complaint'
}

/**
 * TradeNet is human-in-the-loop: M&P collect and check the documents, then an
 * M&P customs officer files the declaration manually and records it here.
 */
export type CustomsStatus = 'docs_pending' | 'ready_for_declaration' | 'declared' | 'cleared'

export interface ShipmentCustoms {
  required: true
  status: CustomsStatus
  declaredBy?: string // human name, e.g. 'Joreen (M&P Customs)'
  declaredAt?: string
  permitNo?: string // manual entry after a person files on TradeNet
  clearedAt?: string
  note?: string
}

export const CUSTOMS_LABELS: Record<CustomsStatus, string> = {
  docs_pending: 'Documents pending',
  ready_for_declaration: 'Ready for declaration',
  declared: 'Declared on TradeNet',
  cleared: 'Customs cleared'
}

export type ReviewAskState = 'not_yet' | 'sent' | 'held' | 'answered'

export interface ReviewAsk {
  state: ReviewAskState
  trigger?: 'delivered' | 'customs_cleared'
  at?: string
  reason?: string
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
    helpedBy?: string // "who helped you?" — named-staff praise
  }
  /** Open claim suppresses the automatic review ask — CS/claims handle it. */
  claim?: ShipmentClaim
  customs?: ShipmentCustoms
  reviewAsk?: ReviewAsk
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
export type MailKind = 'tracking' | 'review' | 'reward' | 'inbound' | 'reply' | 'cs' | 'message' | 'status'
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

/**
 * The address customers and the room see. The real Resend send may still use
 * RESEND_FROM (the verified sending domain) — that stays server-internal in
 * server/utils/email.ts.
 */
export const MAIL_FROM_DISPLAY = 'M&P International Freights <cs@mp.com.sg>'
export const DEFAULT_MAIL_FROM = MAIL_FROM_DISPLAY

// Legacy rows persisted in Supabase carry the old sending domain — mask it.
const LEGACY_FROM_RE = /@pickletour\.app/i

export function mailFromOf(e: OutboxEmail): string {
  const raw = e.from?.trim()
  // Inbound mail keeps its real sender (noise mail genuinely comes from there).
  if (mailDirectionOf(e) === 'in') return raw || 'unknown sender'
  if (!raw) return MAIL_FROM_DISPLAY
  return LEGACY_FROM_RE.test(raw) ? MAIL_FROM_DISPLAY : raw
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

/** Inbound clutter on the shared CS inbox — folded away in the ops mail log. */
const NOISE_RE = /pickle|tournament|newsletter|unsubscribe|no-reply|noreply/i

export function isNoiseMail(e: OutboxEmail): boolean {
  if (mailDirectionOf(e) !== 'in') return false
  if (!e.shipmentId?.trim()) return true
  return NOISE_RE.test(`${e.subject ?? ''} ${e.from ?? ''}`)
}

function docDone(d: ShipmentDocument): boolean {
  return d.status === 'approved' || d.status === 'waived'
}

/** Ops pill "Docs X/Y" — required documents only. */
export function docsDone(s: Shipment): { done: number; total: number } {
  const required = (s.documents ?? []).filter((d) => d.required)
  return { done: required.filter(docDone).length, total: required.length }
}

/** Documents a customs declaration needs — the permit is the output, not an input. */
export function customsDocs(s: Shipment): ShipmentDocument[] {
  return (s.documents ?? []).filter((d) => d.category === 'customs' && d.key !== 'permit')
}

/**
 * True when every required customs document is approved, i.e. an M&P customs
 * officer can now file the declaration on TradeNet (manually — never auto).
 */
export function customsReady(s: Shipment): boolean {
  const docs = customsDocs(s).filter((d) => d.required)
  return docs.length > 0 && docs.every((d) => d.status === 'approved')
}

export type ReviewAskDecision = { send: true } | { send: false; reason: string }

/**
 * Should we ask for a review right now? An open claim always wins — that goes
 * to CS/claims, not to a "how did we do?" email.
 */
export function reviewAskDecision(
  s: Shipment,
  _trigger: 'delivered' | 'customs_cleared' = 'delivered'
): ReviewAskDecision {
  if (s.claim?.status === 'open') {
    return {
      send: false,
      reason: `Open ${CLAIM_LABELS[s.claim.type].toLowerCase()} — routed to CS/claims, no review ask sent`
    }
  }
  if (s.review) return { send: false, reason: 'Customer has already left a review' }
  if (s.reviewAsk?.state === 'sent') return { send: false, reason: 'Review request already sent' }
  if (s.reviewAsk?.state === 'answered') return { send: false, reason: 'Review request already answered' }
  return { send: true }
}
