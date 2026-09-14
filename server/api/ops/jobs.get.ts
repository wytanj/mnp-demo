import type { JobSummary } from '#shared/utils/jobs'
import { jobSummary } from '#shared/utils/jobs'

/**
 * The slim list feed for /ops/jobs — summary rows only, so the page does not
 * SSR whole shipments (event timelines, documents, quotes, WhatsApp threads).
 * Full shipments stay on /api/shipments and /api/shipments/:id for the callers
 * that genuinely need them (billing, docs, statements, job detail).
 */
export default defineEventHandler(async (): Promise<JobSummary[]> => {
  const [shipments, emails] = await Promise.all([dbGetShipments(), dbListEmails()])
  const threads = buildCommsThreads(shipments, emails)
  const needsReply = new Set(
    threads.filter((t) => t.status === 'needs_reply').map((t) => t.shipmentId)
  )

  return shipments
    .map((s) => jobSummary(s, needsReply.has(s.id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
