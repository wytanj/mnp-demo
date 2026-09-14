import { STATUS_FLOW } from '#shared/utils/shipping'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const type = body?.type
  let created

  if (type === 'status') {
    if (!STATUS_FLOW.includes(body.status)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    created = addEvent(shipment, {
      type: 'status',
      status: body.status,
      note: body.note ? String(body.note) : undefined,
      actor: body.actor === 'driver' ? 'driver' : 'cs'
    })
  } else if (type === 'photo') {
    if (typeof body.photo !== 'string' || !body.photo.startsWith('data:image/')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid photo' })
    }
    created = addEvent(shipment, {
      type: 'photo',
      photo: body.photo,
      note: body.note ? String(body.note) : undefined,
      actor: 'driver'
    })
  } else if (type === 'note') {
    if (!body.note) {
      throw createError({ statusCode: 400, statusMessage: 'Missing note' })
    }
    created = addEvent(shipment, {
      type: 'note',
      note: String(body.note),
      actor: body.actor === 'driver' ? 'driver' : 'cs'
    })
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unknown event type' })
  }

  if (type === 'status' && body.status === 'delivered') {
    await maybeSendReviewAsk(shipment, 'delivered')
  }

  await dbSaveShipment(shipment)
  return created
})
