import type { QuoteRequest } from '#shared/utils/shipping'

const MODES: QuoteRequest['mode'][] = ['FCL', 'LCL', 'AIR', 'LAST_MILE']

/**
 * New enquiry from the client portal. We answer immediately with an
 * "auto-quote (demo)" — a lookup against the closest standing rate card, not
 * a pricing engine. A person still sends the real quotation.
 *
 * POST { company, contact, email, mode, origin, destination, cargo, readyDate?, incoterms? }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const need = (k: string) => {
    const v = String(body?.[k] ?? '').trim()
    if (!v) throw createError({ statusCode: 400, statusMessage: `${k} is required` })
    return v
  }

  const mode = String(body?.mode ?? '').trim().toUpperCase() as QuoteRequest['mode']
  if (!MODES.includes(mode)) {
    throw createError({ statusCode: 400, statusMessage: `mode must be one of: ${MODES.join(', ')}` })
  }

  const request = addQuoteRequest({
    company: need('company'),
    contact: need('contact'),
    email: need('email'),
    mode,
    origin: need('origin'),
    destination: need('destination'),
    cargo: need('cargo'),
    readyDate: body?.readyDate ? String(body.readyDate) : undefined,
    incoterms: body?.incoterms ? String(body.incoterms) : undefined
  })

  return request
})
