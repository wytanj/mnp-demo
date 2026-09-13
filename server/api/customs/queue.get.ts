import { CUSTOMS_LABELS, declarationGaps, docsDone } from '#shared/utils/shipping'

/**
 * The customs desk queue: every job that needs a TradeNet declaration, with
 * exactly what is still missing before an M&P customs officer can file it.
 */
export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  return shipments
    .filter((s) => s.customs)
    .map((s) => {
      const docs = docsDone(s)
      return {
        id: s.id,
        client: s.company ?? s.customerName,
        route: `${s.origin} → ${s.destination}`,
        status: s.customs!.status,
        statusLabel: CUSTOMS_LABELS[s.customs!.status],
        docsDone: docs.done,
        docsTotal: docs.total,
        gaps: declarationGaps(s),
        eta: s.eta,
        permitNo: s.customs!.permitNo,
        declaredBy: s.customs!.declaredBy,
        declaration: s.customs!.declaration ?? {}
      }
    })
    .sort((a, b) => b.gaps.length - a.gaps.length || a.eta.localeCompare(b.eta))
})
