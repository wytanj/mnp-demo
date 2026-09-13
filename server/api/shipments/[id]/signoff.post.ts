export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }
  if (shipment.signoff) {
    throw createError({ statusCode: 409, statusMessage: 'Already signed off' })
  }

  const body = await readBody(event)
  if (!body?.name || typeof body.signature !== 'string' || !body.signature.startsWith('data:image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Name and signature are required' })
  }

  shipment.signoff = {
    name: String(body.name),
    signature: body.signature,
    at: new Date().toISOString()
  }
  addEvent(shipment, {
    type: 'signoff',
    actor: 'customer',
    note: `Delivery signed off by ${shipment.signoff.name}`
  })
  addEvent(shipment, { type: 'status', status: 'delivered', actor: 'system' })
  // Ask for a review — unless an open claim (or an existing review) says otherwise.
  await maybeSendReviewAsk(shipment, 'delivered')
  await dbSaveShipment(shipment)

  return shipment
})
