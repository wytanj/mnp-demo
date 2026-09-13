import type { ClaimType, ShipmentClaim } from '#shared/utils/shipping'
import { CLAIM_LABELS, CLAIM_TYPES } from '#shared/utils/shipping'

/**
 * Claims gate the review programme: while one is open we never ask for a
 * review — the job goes to CS/claims instead. Resolving a delivered job's
 * claim releases the ask.
 *
 * POST { action: 'open', type, note, by? } | { action: 'resolve', note? }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const action = String(body?.action ?? '')
  const at = new Date().toISOString()

  if (action === 'open') {
    if (shipment.claim?.status === 'open') {
      throw createError({ statusCode: 409, statusMessage: 'A claim is already open on this shipment' })
    }
    const type = String(body?.type ?? '') as ClaimType
    if (!CLAIM_TYPES.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `type must be one of: ${CLAIM_TYPES.join(', ')}`
      })
    }
    const openedBy = ['customer', 'cs', 'driver'].includes(String(body?.by))
      ? (String(body.by) as ShipmentClaim['openedBy'])
      : 'cs'
    const note = String(body?.note ?? '').trim()

    shipment.claim = { type, note, openedAt: at, openedBy, status: 'open' }
    addEvent(shipment, {
      type: 'claim',
      actor: openedBy === 'driver' ? 'driver' : openedBy === 'customer' ? 'customer' : 'cs',
      note: `⚠️ ${CLAIM_LABELS[type]} opened by ${openedBy}${note ? `: ${note}` : ''}`,
      at
    })
    // An ask that already went out stays out — we just stop future ones.
    await dbSaveShipment(shipment)
    return shipment
  }

  if (action === 'resolve') {
    if (!shipment.claim || shipment.claim.status !== 'open') {
      throw createError({ statusCode: 409, statusMessage: 'No open claim on this shipment' })
    }
    const note = String(body?.note ?? '').trim()
    shipment.claim = { ...shipment.claim, status: 'resolved', resolvedAt: at, resolvedNote: note || undefined }
    addEvent(shipment, {
      type: 'claim',
      actor: 'cs',
      note: `✅ ${CLAIM_LABELS[shipment.claim.type]} resolved${note ? `: ${note}` : ''}`,
      at
    })

    // Claim resolved → ask now, if the job is delivered and still unreviewed.
    if (shipment.status === 'delivered' && !shipment.review) {
      await maybeSendReviewAsk(shipment, shipment.reviewAsk?.trigger ?? 'delivered')
    }

    await dbSaveShipment(shipment)
    return shipment
  }

  throw createError({ statusCode: 400, statusMessage: "action must be 'open' or 'resolve'" })
})
