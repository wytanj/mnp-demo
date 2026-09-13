import type { Shipment } from '#shared/utils/shipping'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const required = ['customerName', 'customerEmail', 'origin', 'destination', 'description']
  for (const key of required) {
    if (!body?.[key]) {
      throw createError({ statusCode: 400, statusMessage: `Missing field: ${key}` })
    }
  }

  const shipment: Shipment = {
    id: newId(),
    mode: ['b2b', 'b2c', 'b2self'].includes(body.mode) ? body.mode : 'b2c',
    service: body.service ? String(body.service) : 'Last-mile delivery',
    status: 'booked',
    customerName: String(body.customerName),
    customerEmail: String(body.customerEmail),
    company: body.company ? String(body.company) : undefined,
    poNumber: body.poNumber ? String(body.poNumber) : undefined,
    incoterms: body.incoterms ? String(body.incoterms) : undefined,
    origin: String(body.origin),
    destination: String(body.destination),
    eta: body.eta ? new Date(body.eta).toISOString() : new Date(Date.now() + 24 * 3600_000).toISOString(),
    driverName: body.driverName ? String(body.driverName) : 'Unassigned',
    driverPhone: body.driverPhone ? String(body.driverPhone).replace(/\D/g, '') : undefined,
    vehicle: body.vehicle ? String(body.vehicle) : '—',
    pieces: Number(body.pieces) || 1,
    weightKg: Number(body.weightKg) || 0,
    description: String(body.description),
    events: [],
    createdAt: new Date().toISOString()
  }

  addEvent(shipment, { type: 'created', actor: 'cs', note: 'Shipment booked, tracking link shared with customer' })
  addEvent(shipment, { type: 'status', status: 'booked', actor: 'system' })

  await dbSaveShipment(shipment)
  const email = buildTrackingEmail(shipment)
  await sendEmail(email)
  await dbSaveEmail(email)

  return shipment
})
