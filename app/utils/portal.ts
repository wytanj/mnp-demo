import {
  MODE_LABELS,
  STATUS_LABELS,
  statusIndex,
  type CustomsStatus,
  type Shipment,
  type ShipmentMode,
  type ShipmentStatus
} from '#shared/utils/shipping'

/**
 * Client portal — signed in as one hardcoded customer (no auth in the demo).
 *
 * `/api/shipments` is the OPS feed: it carries WhatsApp threads, the partner
 * board, driver mobiles, CS contacts and the TradeNet key-in draft. None of
 * that may reach the portal, so every page runs the feed through
 * `toPortalJob()` inside a `useFetch` transform — the payload that gets
 * serialised into the page is the customer-safe projection below, nothing else.
 */
export const PORTAL_CLIENT = {
  name: 'Melissa Tan',
  initials: 'MT',
  company: 'Allmighty Foods Pte Ltd',
  shortCompany: 'Allmighty Foods',
  email: 'melissa@allmightyfoods.com.sg',
  domain: '@allmightyfoods.com.sg'
} as const

/** Customer-facing customs wording — the TradeNet key-in stays internal. */
function customsLabel(status: CustomsStatus): string {
  if (status === 'docs_pending') return 'Documents pending'
  if (status === 'ready_for_declaration') return 'Ready for customs'
  if (status === 'declared') return 'Declared on TradeNet'
  return 'Customs cleared'
}

export type PortalReviewState = 'none' | 'asked' | 'held' | 'received'

/** The ONLY shipment fields the portal is allowed to see. */
export interface PortalJob {
  id: string
  status: ShipmentStatus
  statusLabel: string
  stepIndex: number
  mode: ShipmentMode
  modeLabel: string
  service?: string
  origin: string
  destination: string
  eta: string
  createdAt: string
  description: string
  pieces: number
  weightKg: number
  poNumber?: string
  incoterms?: string
  /** B2C last mile: the person Allmighty Foods is shipping to. */
  recipient?: string
  docsDone: number
  docsTotal: number
  /** Labels of required documents still waiting on the customer. */
  docsPending: string[]
  customsLabel?: string
  signoff?: { name: string; at: string }
  deliveredAt?: string
  reviewState: PortalReviewState
  rating?: number
  reviewComment?: string
  reviewedAt?: string
  /** Things only the customer can clear. Drives the "Action needed" chip. */
  actions: string[]
}

/** Jobs this signed-in client can see: their company, their domain, their warehouse. */
export function isPortalJob(s: Shipment): boolean {
  if (s.company === PORTAL_CLIENT.company) return true
  if ((s.customerEmail ?? '').toLowerCase().endsWith(PORTAL_CLIENT.domain)) return true
  // Allmighty's own B2C orders leave their warehouse — they are the shipper.
  return /allmighty foods/i.test(s.origin ?? '')
}

export function toPortalJob(s: Shipment): PortalJob {
  const required = (s.documents ?? []).filter((d) => d.required)
  const done = required.filter((d) => d.status === 'approved' || d.status === 'waived')
  // "pending" = not sent to us yet. "uploaded" is already with M&P to check.
  const docsPending = required.filter((d) => d.status === 'pending').map((d) => d.label)

  const actions: string[] = []
  for (const label of docsPending) actions.push(`${label} still needed`)
  if (s.status === 'out_for_delivery' && !s.signoff) actions.push('Sign for delivery on arrival')

  let reviewState: PortalReviewState = 'none'
  if (s.review) reviewState = 'received'
  else if (s.reviewAsk?.state === 'sent') reviewState = 'asked'
  else if (s.reviewAsk?.state === 'held') reviewState = 'held'

  const deliveredAt =
    s.signoff?.at ??
    [...(s.events ?? [])].reverse().find((e) => e.status === 'delivered')?.at ??
    undefined

  return {
    id: s.id,
    status: s.status,
    statusLabel: STATUS_LABELS[s.status],
    stepIndex: statusIndex(s.status),
    mode: s.mode,
    modeLabel: MODE_LABELS[s.mode],
    service: s.service,
    origin: s.origin,
    destination: s.destination,
    eta: s.eta,
    createdAt: s.createdAt,
    description: s.description,
    pieces: s.pieces,
    weightKg: s.weightKg,
    poNumber: s.poNumber,
    incoterms: s.incoterms,
    recipient: s.mode === 'b2c' ? s.customerName : undefined,
    docsDone: done.length,
    docsTotal: required.length,
    docsPending,
    customsLabel: s.customs ? customsLabel(s.customs.status) : undefined,
    signoff: s.signoff ? { name: s.signoff.name, at: s.signoff.at } : undefined,
    deliveredAt,
    reviewState,
    rating: s.review?.rating,
    reviewComment: s.review?.comment,
    reviewedAt: s.review?.at,
    actions
  }
}

/** Feed → customer-safe list. Use inside a useFetch `transform`. */
export function toPortalJobs(rows: Shipment[]): PortalJob[] {
  return rows.filter(isPortalJob).map(toPortalJob)
}

export function needsAction(j: PortalJob): boolean {
  return j.actions.length > 0
}

/** Anything the customer has to clear floats to the top, then soonest ETA. */
export function sortPortalJobs(jobs: PortalJob[]): PortalJob[] {
  const rank = (j: PortalJob) => (needsAction(j) ? 0 : j.status === 'delivered' ? 2 : 1)
  return [...jobs].sort((a, b) => rank(a) - rank(b) || a.eta.localeCompare(b.eta))
}

export const SG_TZ = 'Asia/Singapore'

function dayKey(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: SG_TZ })
}

export function isToday(iso: string): boolean {
  return dayKey(iso) === dayKey(Date.now())
}

/** Deterministic across SSR/client — always Singapore time. */
export function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-SG', {
    timeZone: SG_TZ, hour: 'numeric', minute: '2-digit'
  })
  const key = dayKey(d)
  if (key === dayKey(Date.now())) return `Today, ${time}`
  if (key === dayKey(Date.now() + 86_400_000)) return `Tomorrow, ${time}`
  if (key === dayKey(Date.now() - 86_400_000)) return `Yesterday, ${time}`
  return `${d.toLocaleDateString('en-SG', { timeZone: SG_TZ, day: 'numeric', month: 'short' })}, ${time}`
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', {
    timeZone: SG_TZ, day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function statusColor(status: ShipmentStatus): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'delivered') return 'success'
  if (status === 'out_for_delivery') return 'warning'
  if (status === 'booked') return 'neutral'
  return 'info'
}

export const JOB_ID_RE = /^MP-\d{4}-[A-Z]{2}$/

export function normalizeJobId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}
