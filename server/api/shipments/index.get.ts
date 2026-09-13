export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  return shipments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
