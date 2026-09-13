import type { Shipment } from '#shared/utils/shipping'

interface ReviewRow {
  id: string
  client: string
  contact: string
  deliveredAt?: string
  askAt?: string
  state: string
  rating?: number
  comment?: string
  helpedBy?: string
  reason?: string
  reward?: { code: string; at: string; value?: string }
  platforms?: Array<'google' | 'facebook'>
  screenshot?: string
}

function deliveredAt(s: Shipment): string | undefined {
  return s.signoff?.at ?? [...s.events].reverse().find((e) => e.status === 'delivered')?.at
}

function row(s: Shipment): ReviewRow {
  return {
    id: s.id,
    client: s.company ?? s.customerName,
    contact: `${s.customerName} <${s.customerEmail}>`,
    deliveredAt: deliveredAt(s),
    askAt: s.reviewAsk?.at,
    state: s.reviewAsk?.state ?? (s.review ? 'answered' : 'not_yet'),
    rating: s.review?.rating,
    comment: s.review?.comment,
    helpedBy: s.review?.helpedBy,
    reason: s.reviewAsk?.reason,
    reward: s.review?.reward,
    platforms: s.review?.platforms,
    screenshot: s.review?.screenshot
  }
}

/** Review programme board: ask sent / review received / ask suppressed. */
export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  const newest = (a: ReviewRow, b: ReviewRow) => (b.askAt ?? b.deliveredAt ?? '').localeCompare(a.askAt ?? a.deliveredAt ?? '')

  return {
    asked: shipments.filter((s) => !s.review && s.reviewAsk?.state === 'sent').map(row).sort(newest),
    received: shipments.filter((s) => !!s.review).map(row).sort((a, b) => newest(a, b)),
    suppressed: shipments.filter((s) => !s.review && s.reviewAsk?.state === 'held').map(row).sort(newest)
  }
})
