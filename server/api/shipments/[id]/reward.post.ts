/**
 * Issue the thank-you voucher on a review that already landed.
 *
 * POST { code?, value? } — CS approves a Google/Facebook proof here. A 5★
 * review issues its own code in review.post.ts, so this is the manual path;
 * leave `code` out and one is generated (MP-THANKS-…).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment?.review) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }
  if (shipment.review.reward) {
    throw createError({ statusCode: 409, statusMessage: 'Reward already sent' })
  }

  const body = await readBody(event)
  const code = String(body?.code ?? '').trim() || thanksCode(shipment.id)
  const value = String(body?.value ?? 'Grab $10').trim() || 'Grab $10'

  shipment.review.reward = { code, at: new Date().toISOString(), value }
  addEvent(shipment, {
    type: 'note',
    actor: 'cs',
    note: `🎁 Review approved — ${value} voucher ${code} emailed to customer`
  })
  await dbSaveShipment(shipment)
  const email = buildRewardEmail(shipment, code)
  await sendEmail(email)
  await dbSaveEmail(email)

  return shipment
})
