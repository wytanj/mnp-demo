export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const rating = Number(body?.rating)
  if (!rating || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Rating must be 1-5' })
  }

  const screenshot =
    typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/')
      ? body.screenshot
      : undefined

  shipment.review = {
    rating,
    comment: body.comment ? String(body.comment) : '',
    at: new Date().toISOString(),
    screenshot
  }
  addEvent(shipment, {
    type: 'note',
    actor: 'customer',
    note: `Customer left a ${rating}-star review${shipment.review.comment ? `: "${shipment.review.comment}"` : ''}`
  })
  await dbSaveShipment(shipment)

  return shipment
})
