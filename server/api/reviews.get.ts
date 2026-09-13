import type { ClaimType, Shipment } from '#shared/utils/shipping'
import { CLAIM_LABELS, reviewAskDecision } from '#shared/utils/shipping'

export interface ReviewRow {
  id: string
  client: string
  contact: string
  deliveredAt?: string
  askAt?: string
  state: string
  rating?: number
  comment?: string
  helpedBy?: string
  reason?: string
  reward?: { code: string; at: string; value?: string }
  platforms?: Array<'google' | 'facebook'>
  screenshot?: string
  /** 48h reminder bookkeeping — set by the Reviews board / MCP. */
  reaskAt?: string
  reaskCount?: number
  reaskDueAt?: string
  /** The claim gate, resolved server-side so the board needs one feed only. */
  claimType?: ClaimType
  claimLabel?: string
  claimOpen?: boolean
  /** Why an ask cannot go out right now (empty when it can). */
  gate?: string
}

function row(s: Shipment): ReviewRow {
  const decision = reviewAskDecision(s)
  return {
    id: s.id,
    client: s.company ?? s.customerName,
    contact: `${s.customerName} <${s.customerEmail}>`,
    deliveredAt: deliveredAtOf(s),
    askAt: s.reviewAsk?.at,
    state: s.reviewAsk?.state ?? (s.review ? 'answered' : 'not_yet'),
    rating: s.review?.rating,
    comment: s.review?.comment,
    helpedBy: s.review?.helpedBy,
    reason: s.reviewAsk?.reason,
    reward: s.review?.reward,
    platforms: s.review?.platforms,
    screenshot: s.review?.screenshot,
    reaskAt: s.reviewAsk?.reaskAt,
    reaskCount: s.reviewAsk?.reaskCount,
    reaskDueAt: s.reviewAsk?.reaskDueAt,
    claimType: s.claim?.type,
    claimLabel: s.claim ? CLAIM_LABELS[s.claim.type] : undefined,
    claimOpen: s.claim?.status === 'open',
    gate: decision.send ? undefined : decision.reason
  }
}

/**
 * Review programme board — one feed for `/ops/reviews` and `/ops/rewards`.
 *
 * Four lanes: never asked / ask sent / review received / ask held. `counts`
 * carries the numbers both pages show so neither has to re-derive them.
 */
export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  const newest = (a: ReviewRow, b: ReviewRow) =>
    (b.askAt ?? b.deliveredAt ?? '').localeCompare(a.askAt ?? a.deliveredAt ?? '')

  // Delivered / signed off, nothing asked, nothing received — and not sitting
  // behind an open claim (those show in the held lane with the gate on them).
  const notAsked = shipments
    .filter(
      (s) =>
        isDeliveredJob(s) &&
        !s.review &&
        (!s.reviewAsk || s.reviewAsk.state === 'not_yet') &&
        s.claim?.status !== 'open'
    )
    .map(row)
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''))

  const asked = shipments.filter((s) => !s.review && s.reviewAsk?.state === 'sent').map(row).sort(newest)
  const received = shipments.filter((s) => !!s.review).map(row).sort(newest)

  // Held by CS or by the claim gate — including a delivered job that never got
  // an ask because a claim was already open on it.
  const suppressed = shipments
    .filter(
      (s) =>
        !s.review &&
        (s.reviewAsk?.state === 'held' ||
          (isDeliveredJob(s) && s.claim?.status === 'open' && s.reviewAsk?.state !== 'sent'))
    )
    .map(row)
    .sort(newest)

  const rated = received.filter((r) => typeof r.rating === 'number')
  const issued = received.filter((r) => r.reward)

  return {
    notAsked,
    asked,
    received,
    suppressed,
    counts: {
      notAsked: notAsked.length,
      asked: asked.length,
      received: received.length,
      held: suppressed.length,
      /** Of the held ones, how many are held by a live claim — the gate line. */
      heldByClaim: suppressed.filter((r) => r.claimOpen).length,
      reminded: asked.filter((r) => (r.reaskCount ?? 0) > 0).length,
      issued: issued.length,
      awaitingVerification: received.filter((r) => !r.reward && (r.screenshot || (r.platforms?.length ?? 0) > 0)).length,
      avgRating: rated.length
        ? Number((rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length).toFixed(1))
        : null
    }
  }
})
