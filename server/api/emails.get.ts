export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const shipment = String(q.shipment ?? '').trim().toUpperCase()
  const emails = await dbListEmails()
  if (!shipment) return emails
  return emails.filter((e) => e.shipmentId === shipment)
})
