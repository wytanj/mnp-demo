/**
 * Customer-safe view of a shipment for the public /track/[id] page.
 * Never exposes the CS contact list, the driver's phone number, or internal
 * CS/AI notes — and mail is never part of this payload at all.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const { contacts: _contacts, driverPhone: _driverPhone, ...safe } = shipment
  return {
    ...safe,
    events: shipment.events.filter((e) => e.internal !== true)
  }
})
