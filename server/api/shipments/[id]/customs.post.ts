import type { ShipmentCustoms, ShipmentDocument } from '#shared/utils/shipping'
import { customsReady } from '#shared/utils/shipping'

/**
 * TradeNet is human-in-the-loop. M&P collect and check the documents here; an
 * M&P customs officer then files the declaration on TradeNet themselves and
 * records it against the job. Nothing is ever submitted automatically.
 *
 * POST { action: 'mark_ready' | 'mark_declared' | 'mark_cleared', by, permitNo? }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const action = String(body?.action ?? '')
  const by = String(body?.by ?? '').trim()
  const permitNo = String(body?.permitNo ?? '').trim()
  const at = new Date().toISOString()

  const customs: ShipmentCustoms = shipment.customs ?? { required: true, status: 'docs_pending' }

  if (action === 'mark_ready') {
    if (!customsReady(shipment)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Customs documents are still outstanding — check the document list first'
      })
    }
    customs.status = 'ready_for_declaration'
    customs.note = 'Documents checked by M&P — awaiting manual TradeNet filing by our customs team'
    shipment.customs = customs
    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: '🛃 Ready for declaration — M&P customs team files on TradeNet',
      at
    })
    await dbSaveShipment(shipment)
    return shipment
  }

  if (action === 'mark_declared') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    if (!customsReady(shipment)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Customs documents are still outstanding — cannot mark as declared'
      })
    }
    customs.status = 'declared'
    customs.declaredBy = by
    customs.declaredAt = at
    customs.note = `Declaration filed manually on TradeNet by ${by} after doc check`
    if (permitNo) customs.permitNo = permitNo
    shipment.customs = customs

    // The permit is the output of the manual filing — record it as a document.
    const docs = (shipment.documents ??= [])
    let permit = docs.find((d) => d.key === 'permit')
    if (!permit) {
      permit = { key: 'permit', label: 'Import permit (TradeNet)', required: true, category: 'customs', status: 'pending' } as ShipmentDocument
      docs.push(permit)
    }
    permit.status = 'approved'
    permit.category = 'customs'
    permit.uploadedBy = by
    permit.at = at
    permit.fileName = permit.fileName ?? `permit-${shipment.id}.pdf`
    permit.note = 'Filed manually on TradeNet by M&P after doc check'

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Declaration filed on TradeNet by ${by} (manual)${customs.permitNo ? ` · permit ${customs.permitNo}` : ''}`,
      at
    })
    await dbSaveShipment(shipment)
    return shipment
  }

  if (action === 'mark_cleared') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    customs.status = 'cleared'
    customs.clearedAt = at
    customs.note = `Cleared by Singapore Customs — confirmed by ${by}`
    if (permitNo) customs.permitNo = permitNo
    shipment.customs = customs

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Customs cleared${customs.permitNo ? ` · permit ${customs.permitNo}` : ''} — confirmed by ${by}`,
      at
    })

    const email = buildCustomsClearedEmail(shipment, at)
    await sendEmail(email)
    await dbSaveEmail(email)

    // M&P's scope ends at clearance on customs-only jobs — that is when the
    // review ask makes sense. Otherwise we wait for delivery.
    if (/customs|clearance only/i.test(shipment.service ?? '')) {
      await maybeSendReviewAsk(shipment, 'customs_cleared')
    }

    await dbSaveShipment(shipment)
    return shipment
  }

  throw createError({
    statusCode: 400,
    statusMessage: "action must be 'mark_ready', 'mark_declared' or 'mark_cleared'"
  })
})
