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

  // Internal-only surfaces: CS contact list, driver mobile, the simulated
  // WhatsApp threads and the partner coordination board never leave the office.
  const {
    contacts: _contacts,
    driverPhone: _driverPhone,
    whatsapp: _whatsapp,
    partners: _partners,
    ...safe
  } = shipment
  return {
    ...safe,
    // The TradeNet key-in draft is internal too — the customer sees the outcome.
    customs: shipment.customs
      ? (({ declaration: _declaration, ...c }) => c)(shipment.customs)
      : undefined,
    events: shipment.events.filter((e) => e.internal !== true)
  }
})
