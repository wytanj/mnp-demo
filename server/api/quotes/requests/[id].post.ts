/**
 * Move a quote enquiry along the pipeline from the ops Quotes board.
 * POST { action: 'send' | 'won' | 'lost' }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const request = id ? getQuoteRequest(id) : undefined
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Quote request not found' })

  const body = await readBody(event)
  const action = String(body?.action ?? '')

  if (action === 'send') {
    if (!request.autoQuote) request.autoQuote = autoQuoteFor(request.origin, request.destination)
    request.status = 'sent'
  } else if (action === 'won') {
    request.status = 'won'
  } else if (action === 'lost') {
    request.status = 'lost'
  } else {
    throw createError({ statusCode: 400, statusMessage: "action must be 'send', 'won' or 'lost'" })
  }

  return request
})
