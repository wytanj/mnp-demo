export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }
  return shipment
})
