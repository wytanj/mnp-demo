export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment?.review) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }
  if (shipment.review.reward) {
    throw createError({ statusCode: 409, statusMessage: 'Reward already sent' })
  }

  const body = await readBody(event)
  const code = String(body?.code ?? '').trim()
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Reward code is required' })
  }

  const value = String(body?.value ?? 'Grab $10').trim() || 'Grab $10'
  shipment.review.reward = { code, at: new Date().toISOString(), value }
  addEvent(shipment, {
    type: 'note',
    actor: 'cs',
    note: `Review approved — reward code ${code} emailed to customer`
  })
  await dbSaveShipment(shipment)
  const email = buildRewardEmail(shipment, code)
  await sendEmail(email)
  await dbSaveEmail(email)

  return shipment
})
