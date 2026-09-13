import type { ProgrammeStats, ReviewAsk, Shipment } from '#shared/utils/shipping'
import { REVIEW_PROGRAMMES, programmeOf, reviewAskDecision } from '#shared/utils/shipping'

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

  // Already queued by a delayed programme — leave the scheduled date alone.
  if (shipment.reviewAsk?.state === 'not_yet' && shipment.reviewAsk.scheduledFor) {
    return shipment.reviewAsk
  }

  const decision = reviewAskDecision(shipment, trigger)
  const at = new Date().toISOString()
  const programme = programmeOf(shipment)

  // Delayed programmes (B2B) do not email on sign-off — the ask is queued and
  // the board shows it in the "not asked yet" lane with its due date.
  if (decision.send && programme.delayDays > 0) {
    const scheduledFor = new Date(Date.now() + programme.delayDays * 24 * 60 * 60 * 1000).toISOString()
    shipment.reviewAsk = { state: 'not_yet', trigger, at, scheduledFor }
    addEvent(shipment, {
      type: 'note',
      actor: 'system',
      note: `🗓 Review ask scheduled for ${fmtAskDate(scheduledFor)} — ${programme.name}`,
      at
    })
    return shipment.reviewAsk
  }

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


/** Short date on the "ask scheduled" timeline note — 17 Sep. */
export function fmtAskDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })
}

/**
 * Per-programme numbers for /ops/reviews, /ops/rewards and the MCP
 * `review_programme_stats` tool. One row per programme, always in the
 * REVIEW_PROGRAMMES order, even when a programme has no jobs on it yet.
 */
export function programmeStats(shipments: Shipment[]): ProgrammeStats[] {
  return REVIEW_PROGRAMMES.map((programme) => {
    const jobs = shipments.filter((s) => isDeliveredJob(s) && programmeOf(s).id === programme.id)

    // "Asked" = an ask actually went out. A review with no ask record on it was
    // asked for somehow, so it counts too.
    const asked = jobs.filter(
      (s) => s.reviewAsk?.state === 'sent' || s.reviewAsk?.state === 'answered' || (!!s.review && !s.reviewAsk)
    )
    const received = jobs.filter((s) => !!s.review)
    const rated = received.filter((s) => typeof s.review?.rating === 'number')
    const vouchers = received.filter((s) => !!s.review?.reward)
    const cost = vouchers.length * programme.reward.cost

    return {
      id: programme.id,
      name: programme.name,
      short: programme.short,
      icon: programme.icon,
      color: programme.color,
      trigger: programme.trigger,
      rewardValue: programme.reward.value,
      jobs: jobs.length,
      asked: asked.length,
      reminders: jobs.reduce((sum, s) => sum + (s.reviewAsk?.reaskCount ?? 0), 0),
      pending: jobs.filter((s) => !s.review && s.reviewAsk?.state === 'sent').length,
      scheduled: jobs.filter((s) => s.reviewAsk?.state === 'not_yet' && !!s.reviewAsk.scheduledFor).length,
      held: jobs.filter((s) => s.reviewAsk?.state === 'held').length,
      received: received.length,
      conversion: asked.length ? Math.round((received.length / asked.length) * 100) : null,
      avgRating: rated.length
        ? Number((rated.reduce((sum, s) => sum + (s.review?.rating ?? 0), 0) / rated.length).toFixed(1))
        : null,
      fiveStar: received.filter((s) => s.review?.rating === 5).length,
      vouchers: vouchers.length,
      awaitingVerification: received.filter(
        (s) => !s.review?.reward && (!!s.review?.screenshot || (s.review?.platforms?.length ?? 0) > 0)
      ).length,
      cost,
      costPerReview: received.length ? Number((cost / received.length).toFixed(2)) : null
    }
  })
}
