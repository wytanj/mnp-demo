export default defineEventHandler(async (event) => {
  const ref = getRouterParam(event, 'ref')
  if (!ref) throw createError({ statusCode: 404, statusMessage: 'Quote not found' })

  const byShipmentId = await dbGetShipment(ref)
  if (byShipmentId?.quote) return { quote: byShipmentId.quote, shipment: byShipmentId }

  const shipments = await dbGetShipments()
  for (const s of shipments) {
    if (s.quote?.ref === ref) return { quote: s.quote, shipment: s }
  }

  const rateCard = RATE_CARDS.find((q) => q.ref === ref)
  if (rateCard) return { quote: rateCard, shipment: null }

  throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
})
