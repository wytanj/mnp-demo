import { reviewAskDecision } from '#shared/utils/shipping'

/**
 * Manual control over the review ask from the ops Reviews board.
 *
 * POST { action: 'send' | 'reask' | 'suppress' | 'release', reason?, force? }
 *   send     — build + save the review email, reviewAsk = { state: 'sent' }
 *   reask    — 48h reminder: re-sends the email, bumps reaskCount (max 2)
 *   suppress — hold the ask with a reason (claim, dispute, unhappy customer)
 *   release  — a held ask goes out after all
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })

  const body = await readBody(event)
  const action = String(body?.action ?? '')
  const reason = String(body?.reason ?? '').trim()
  const force = body?.force === true
  const at = new Date().toISOString()

  if (action === 'suppress') {
    if (shipment.review) {
      throw createError({ statusCode: 409, statusMessage: 'Customer has already left a review' })
    }
    shipment.reviewAsk = {
      ...(shipment.reviewAsk ?? {}),
      state: 'held',
      trigger: shipment.reviewAsk?.trigger ?? 'delivered',
      at,
      reason: reason || 'Held by CS'
    }
    addEvent(shipment, {
      type: 'note',
      actor: 'cs',
      note: `⏸ Review request held — ${shipment.reviewAsk.reason}`,
      internal: true,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, reviewAsk: shipment.reviewAsk }
  }

  if (action === 'reask') {
    if (shipment.review) {
      throw createError({ statusCode: 409, statusMessage: 'Customer has already left a review' })
    }
    if (shipment.reviewAsk?.state !== 'sent') {
      throw createError({ statusCode: 409, statusMessage: 'No ask is out on this shipment — send one first' })
    }
    if ((shipment.reviewAsk.reaskCount ?? 0) >= REASK_MAX) {
      throw createError({
        statusCode: 409,
        statusMessage: `Max reminders reached — ${REASK_MAX} sent, we stop chasing after that`
      })
    }
    const reviewAsk = await sendReviewReask(shipment)
    await dbSaveShipment(shipment)
    return { ok: true, reviewAsk, reaskCount: reviewAsk.reaskCount }
  }

  if (action === 'send' || action === 'release') {
    if (shipment.review) {
      throw createError({ statusCode: 409, statusMessage: 'Customer has already left a review' })
    }
    if (action === 'release' && shipment.reviewAsk?.state !== 'held') {
      throw createError({ statusCode: 409, statusMessage: 'No held review request to release on this shipment' })
    }
    // The claim gate applies to a fresh ask. Releasing a held one is the
    // deliberate override, so it skips the gate on purpose.
    if (action === 'send' && !force && shipment.claim?.status === 'open') {
      const decision = reviewAskDecision(shipment)
      throw createError({
        statusCode: 409,
        statusMessage: decision.send ? 'Open claim on this job' : decision.reason
      })
    }
    const email = buildReviewEmail(shipment, at)
    await sendEmail(email)
    await dbSaveEmail(email)
    shipment.reviewAsk = { state: 'sent', trigger: shipment.reviewAsk?.trigger ?? 'delivered', at }
    addEvent(shipment, {
      type: 'note',
      actor: 'cs',
      note: action === 'release' ? '⭐ Held review request released and sent' : '⭐ Review request sent',
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, reviewAsk: shipment.reviewAsk, email }
  }

  throw createError({ statusCode: 400, statusMessage: "action must be 'send', 'reask', 'suppress' or 'release'" })
})
