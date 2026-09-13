import type { Quote, QuoteRequest } from '#shared/utils/shipping'

/**
 * Rate-card enquiries from the portal. Demo-only: they live in memory on the
 * Nitro instance (never Supabase) and reseed on restart, exactly like the
 * "auto-quote" itself — which is a rate-card lookup, not a pricing engine.
 */

const g = globalThis as unknown as { __quoteRequests?: QuoteRequest[] }

const USD_TO_SGD = 1.35

function minsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

/** Rough lane match on origin/destination keywords — a demo heuristic, not routing. */
export function pickRateCard(origin: string, destination: string): Quote {
  const hay = `${origin} ${destination}`.toLowerCase()
  const byRef = (ref: string) => RATE_CARDS.find((c) => c.ref === ref)
  if (/busan|korea|krpus|incheon|seoul/.test(hay)) return byRef('QT-KR-LCL') ?? RATE_CARDS[0]!
  if (/hong kong|hongkong|hkhkg|hkg|kowloon/.test(hay)) return byRef('QT-HK-AIR') ?? RATE_CARDS[0]!
  if (/shenzhen|shanghai|china|cnsz|cnsha|yantian|ningbo|guangzhou/.test(hay)) return byRef('QT-CN-LCL') ?? RATE_CARDS[0]!
  return RATE_CARDS[0]!
}

/**
 * Indicative SGD number off the matched rate card: every quoted, non-excluded
 * line, USD converted at a flat 1.35. Unit rates (per RT / per w-m) are summed
 * as-is — this is a ballpark for the room, labelled "auto-quote (demo)".
 */
export function autoQuoteFor(origin: string, destination: string): QuoteRequest['autoQuote'] {
  const card = pickRateCard(origin, destination)
  const lines: Array<{ label: string; amount: number; currency: string }> = []
  let estimate = 0
  for (const section of card.sections) {
    for (const line of section.lines) {
      if (line.amount === null || line.amount === undefined || line.excluded) continue
      if (line.amount === 0) continue
      lines.push({ label: line.label, amount: line.amount, currency: section.currency })
      estimate += section.currency === 'USD' ? line.amount * USD_TO_SGD : line.amount
    }
  }
  return {
    rateCardRef: card.ref,
    estimate: Math.round(estimate * 100) / 100,
    currency: 'SGD',
    validUntil: card.validUntil,
    lines
  }
}

function seed(): QuoteRequest[] {
  const r1: QuoteRequest = {
    id: 'QR-2601',
    ref: 'QR-2601',
    at: minsAgo(35),
    company: 'Titan Associates Pte Ltd',
    contact: 'WY Tan',
    email: 'wy.tan@titanassociates.com.sg',
    mode: 'FCL',
    origin: 'Shenzhen (Yantian), China',
    destination: 'Singapore — Tai Seng',
    cargo: "20' FCL — wireless keyboards & accessories, ~14 cbm, non-haz",
    readyDate: new Date(Date.now() + 6 * 24 * 3600_000).toISOString().slice(0, 10),
    incoterms: 'FOB',
    status: 'new'
  }

  const r2: QuoteRequest = {
    id: 'QR-2602',
    ref: 'QR-2602',
    at: minsAgo(190),
    company: 'Allmighty Foods Pte Ltd',
    contact: 'Esther Ng',
    email: 'esther@allmightyfoods.com.sg',
    mode: 'LCL',
    origin: 'Busan (KRPUS), Korea',
    destination: 'Singapore — Senoko Food Hub',
    cargo: 'LCL — 12 cbm jelly cartons on 8 pallets, ambient',
    readyDate: new Date(Date.now() + 9 * 24 * 3600_000).toISOString().slice(0, 10),
    incoterms: 'EXW',
    status: 'auto_quoted',
    autoQuote: autoQuoteFor('Busan (KRPUS), Korea', 'Singapore — Senoko Food Hub')
  }

  const r3: QuoteRequest = {
    id: 'QR-2603',
    ref: 'QR-2603',
    at: minsAgo(60 * 20),
    company: 'Mecha',
    contact: 'Brendan De Souza',
    email: 'brendan@mecha.store',
    mode: 'AIR',
    origin: 'Hong Kong (HKG)',
    destination: 'Singapore (SIN) — Mecha studio',
    cargo: 'Air — 120 kg chargeable, keycap sets, urgent restock',
    readyDate: new Date(Date.now() + 2 * 24 * 3600_000).toISOString().slice(0, 10),
    incoterms: 'EXW',
    status: 'sent',
    autoQuote: autoQuoteFor('Hong Kong (HKG)', 'Singapore (SIN) — Mecha studio')
  }

  const r4: QuoteRequest = {
    id: 'QR-2598',
    ref: 'QR-2598',
    at: minsAgo(60 * 52),
    company: 'Hey Fran',
    contact: 'Fran Lim',
    email: 'fran@heyfran.com',
    mode: 'LAST_MILE',
    origin: 'Kaki Bukit Ave 1',
    destination: 'Jewel Changi Airport #B2-241',
    cargo: 'Twice-weekly outlet restock — up to 10 cartons per run',
    incoterms: 'DAP',
    status: 'won',
    autoQuote: autoQuoteFor('Kaki Bukit Ave 1', 'Jewel Changi Airport')
  }

  return [r1, r2, r3, r4]
}

export function listQuoteRequests(): QuoteRequest[] {
  if (!g.__quoteRequests) g.__quoteRequests = seed()
  return [...g.__quoteRequests].sort((a, b) => b.at.localeCompare(a.at))
}

export function getQuoteRequest(id: string): QuoteRequest | undefined {
  if (!g.__quoteRequests) g.__quoteRequests = seed()
  const needle = id.toUpperCase()
  return g.__quoteRequests.find((r) => r.id.toUpperCase() === needle || r.ref.toUpperCase() === needle)
}

export function addQuoteRequest(input: Omit<QuoteRequest, 'id' | 'ref' | 'at' | 'status' | 'autoQuote'>): QuoteRequest {
  if (!g.__quoteRequests) g.__quoteRequests = seed()
  const n = 2605 + g.__quoteRequests.length
  const ref = `QR-${n}`
  const request: QuoteRequest = {
    ...input,
    id: ref,
    ref,
    at: new Date().toISOString(),
    status: 'auto_quoted',
    autoQuote: autoQuoteFor(input.origin, input.destination)
  }
  g.__quoteRequests.unshift(request)
  return request
}
