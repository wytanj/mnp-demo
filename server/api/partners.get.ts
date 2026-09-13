import { STATUS_LABELS } from '#shared/utils/shipping'

/** Partner coordination board — who else has to move before a job can. */
export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  const rank = { blocked: 0, waiting: 1, ok: 2, done: 3, na: 4 }
  return shipments
    .filter((s) => (s.partners ?? []).length > 0)
    .map((s) => ({
      shipmentId: s.id,
      client: s.company ?? s.customerName,
      route: `${s.origin} → ${s.destination}`,
      status: STATUS_LABELS[s.status],
      eta: s.eta,
      partners: [...s.partners!].sort((a, b) => rank[a.state] - rank[b.state])
    }))
    .sort((a, b) => {
      const worst = (row: (typeof a)) => Math.min(...row.partners.map((p) => rank[p.state]))
      return worst(a) - worst(b) || a.eta.localeCompare(b.eta)
    })
})
