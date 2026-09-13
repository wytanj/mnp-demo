import { declarationGaps } from '#shared/utils/shipping'

/** Live badge counts for the ops sidebar. */
export default defineEventHandler(async () => {
  const [shipments, emails] = await Promise.all([dbGetShipments(), dbListEmails()])
  const threads = buildCommsThreads(shipments, emails)
  const exceptions = buildExceptions(shipments, threads)
  const requests = listQuoteRequests()

  const customsQueue = shipments.filter(
    (s) => s.customs && (s.customs.status === 'docs_pending' || s.customs.status === 'ready_for_declaration')
  )
  const partnerWaits = shipments.reduce(
    (n, s) => n + (s.partners ?? []).filter((p) => p.state === 'waiting' || p.state === 'blocked').length,
    0
  )

  return {
    jobs: shipments.length,
    inboxNeedsReply: threadsNeedingReply(threads).length,
    customsQueue: customsQueue.length,
    customsGaps: customsQueue.filter((s) => declarationGaps(s).length > 0).length,
    reviewsPending: shipments.filter((s) => !s.review && (s.reviewAsk?.state === 'sent' || s.reviewAsk?.state === 'held')).length,
    quotesNew: requests.filter((r) => r.status === 'new' || r.status === 'auto_quoted').length,
    partnerWaits,
    exceptions: exceptions.length
  }
})
