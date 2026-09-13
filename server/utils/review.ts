import type { ReviewAsk, Shipment } from '#shared/utils/shipping'
import { reviewAskDecision } from '#shared/utils/shipping'

/**
 * Single entry point for the automatic review ask.
 *
 * Sends the review email when the job is clean; holds it (with a CS-only note
 * on the timeline) when there is an open claim, a review already given, or an
 * ask already out. A held ask stays held until CS releases it on the Reviews
 * board — nothing automatic lets it out. Mutates the shipment — the caller
 * persists it.
 */
export async function maybeSendReviewAsk(
  shipment: Shipment,
  trigger: 'delivered' | 'customs_cleared' = 'delivered'
): Promise<ReviewAsk> {
  // Never downgrade an ask that already went out.
  if (shipment.reviewAsk?.state === 'sent' || shipment.reviewAsk?.state === 'answered') {
    return shipment.reviewAsk
  }

  // CS parked it — only a release on the Reviews board lets it out, so leave the
  // hold (and its reason) exactly as it is, with no second note on the timeline.
  if (shipment.reviewAsk?.state === 'held') {
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

/** Max reminders after the first ask, and the gap between them. */
export const REASK_MAX = 2
export const REASK_WINDOW_MS = 48 * 60 * 60 * 1000

/** Readable, demo-friendly voucher code: MP-THANKS-9032AB. */
export function thanksCode(id: string): string {
  // Job ids look like MP-9032-TA, so chars 3-6 are the job number.
  const stem = id.slice(3, 7).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'MPMP'
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const salt = letters[Math.floor(Math.random() * letters.length)]! + letters[Math.floor(Math.random() * letters.length)]!
  return `MP-THANKS-${stem}${salt}`
}

/** When the delivery actually happened — sign-off first, else the delivered event. */
export function deliveredAtOf(s: Shipment): string | undefined {
  return s.signoff?.at ?? [...(s.events ?? [])].reverse().find((e) => e.status === 'delivered')?.at
}

/**
 * The job is finished from the customer's point of view, so the review
 * programme is allowed to have an opinion about it.
 */
export function isDeliveredJob(s: Shipment): boolean {
  return s.status === 'delivered' || !!s.signoff
}

/**
 * Send (or re-send) the review email for a re-ask. Mutates the shipment —
 * the caller persists it. Returns the new reviewAsk.
 */
export async function sendReviewReask(shipment: Shipment): Promise<ReviewAsk> {
  const at = new Date().toISOString()
  const count = (shipment.reviewAsk?.reaskCount ?? 0) + 1
  const dueAt = new Date(Date.now() + REASK_WINDOW_MS).toISOString()

  const email = buildReviewEmail(shipment, at)
  email.subject = `Reminder: how did we do on ${shipment.id}?`
  await sendEmail(email)
  await dbSaveEmail(email)

  shipment.reviewAsk = {
    ...(shipment.reviewAsk ?? { state: 'sent' }),
    state: 'sent',
    trigger: shipment.reviewAsk?.trigger ?? 'delivered',
    at: shipment.reviewAsk?.at ?? at,
    reaskAt: at,
    reaskCount: count,
    reaskDueAt: dueAt
  }
  addEvent(shipment, {
    type: 'note',
    actor: 'system',
    note: `🔁 Review reminder sent (re-ask #${count}) — next in 48h`,
    at
  })
  return shipment.reviewAsk
}
