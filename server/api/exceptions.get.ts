/** Derived ops alert list — stuck jobs, passed ETAs, customs gaps, claims, blocked partners, unanswered threads. */
export default defineEventHandler(async () => {
  const [shipments, emails] = await Promise.all([dbGetShipments(), dbListEmails()])
  return loadExceptions(shipments, emails)
})
