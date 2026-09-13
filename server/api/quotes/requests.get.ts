/** Portal quote enquiries with their auto-quote (demo) estimate, newest first. */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const status = String(q.status ?? '').trim()
  const list = listQuoteRequests()
  return status ? list.filter((r) => r.status === status) : list
})
