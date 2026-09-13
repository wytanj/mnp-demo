import type { ReviewAsk, Shipment } from '#shared/utils/shipping'
import { reviewAskDecision } from '#shared/utils/shipping'

/**
 * Single entry point for the automatic review ask.
 *
 * Sends the review email when the job is clean; holds it (with a CS-only note
 * on the timeline) when there is an open claim, a review already given, or an
 * ask already out. Mutates the shipment — the caller persists it.
 */
export async function maybeSendReviewAsk(
  shipment: Shipment,
  trigger: 'delivered' | 'customs_cleared' = 'delivered'
): Promise<ReviewAsk> {
  // Never downgrade an ask that already went out.
  if (shipment.reviewAsk?.state === 'sent' || shipment.reviewAsk?.state === 'answered') {
    return shipment.reviewAsk
  }

  const decision = reviewAskDecision(shipment, trigger)
  const at = new Date().toISOString()

  if (decision.send) {
    const email = buildReviewEmail(shipment, at)
    await sendEmail(email)
    await dbSaveEmail(email)
    shipment.reviewAsk = { state: 'sent', trigger, at }
    addEvent(shipment, { type: 'note', actor: 'system', note: '⭐ Review request sent', at })
  } else {
    shipment.reviewAsk = { state: 'held', trigger, at, reason: decision.reason }
    addEvent(shipment, {
      type: 'note',
      actor: 'system',
      note: `⏸ Review request held — ${decision.reason}`,
      internal: true,
      at
    })
  }

  return shipment.reviewAsk
}
