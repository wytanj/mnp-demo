import type { ClaimType, CustomsStatus, Shipment, ShipmentMode, ShipmentStatus } from '#shared/utils/shipping'
import { declarationGaps, docsDone } from '#shared/utils/shipping'

/**
 * One row of the ops jobs list — everything app/pages/ops/jobs/index.vue needs
 * for the attention tiles, the table and search, and nothing else. No events,
 * no documents, no whatsapp, no quote. Full Shipment stays on /api/shipments/:id.
 */
export interface JobSummary {
  id: string
  mode: ShipmentMode
  service?: string
  status: ShipmentStatus
  customerName: string
  company?: string
  origin: string
  destination: string
  description: string
  eta: string
  createdAt: string
  /** Required documents done/total — was docsDone(shipment). */
  docs: { done: number; total: number }
  /** Present only when the job needs customs. gapCount = declarationGaps().length,
   *  forced to 0 once status is 'declared' or 'cleared' (matches the old page logic). */
  customs?: { status: CustomsStatus; gapCount: number }
  claim?: { type: ClaimType; status: 'open' | 'resolved' }
  /** !!shipment.signoff */
  signedOff: boolean
  /** any partner in state 'waiting' or 'blocked' */
  partnerWait: boolean
  /** any comms thread (email or WhatsApp) for this job with status 'needs_reply' — computed server-side */
  needsReply: boolean
}

/**
 * Shipment → one list row. Pure: `needsReply` is handed in because it comes
 * off the computed comms threads, not off the shipment JSON.
 */
export function jobSummary(s: Shipment, needsReply: boolean): JobSummary {
  const row: JobSummary = {
    id: s.id,
    mode: s.mode,
    status: s.status,
    customerName: s.customerName,
    origin: s.origin,
    destination: s.destination,
    description: s.description,
    eta: s.eta,
    createdAt: s.createdAt,
    docs: docsDone(s),
    signedOff: !!s.signoff,
    partnerWait: (s.partners ?? []).some((p) => p.state === 'waiting' || p.state === 'blocked'),
    needsReply
  }
  if (s.service !== undefined) row.service = s.service
  if (s.company !== undefined) row.company = s.company
  if (s.customs) {
    const settled = s.customs.status === 'declared' || s.customs.status === 'cleared'
    row.customs = {
      status: s.customs.status,
      gapCount: settled ? 0 : declarationGaps(s).length
    }
  }
  if (s.claim) row.claim = { type: s.claim.type, status: s.claim.status }
  return row
}
