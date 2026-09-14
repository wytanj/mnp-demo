/**
 * Unified inbox — WhatsApp threads off the shipment JSON plus email threads
 * grouped by shipment + counterpart. Computed on every read, newest first.
 * `?shipment=MP-…` narrows it to one job.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const shipmentId = String(q.shipment ?? '').trim().toUpperCase()

  const [shipments, emails] = await Promise.all([dbGetShipments(), dbListEmails()])
  const threads = buildCommsThreads(shipments, emails)
  return shipmentId ? threads.filter((t) => t.shipmentId === shipmentId) : threads
})
