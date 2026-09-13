import type { Shipment } from '#shared/utils/shipping'

/**
 * Client-portal feed — the signed-in demo customer (Allmighty Foods) and
 * nothing else.
 *
 * `/api/shipments` is the OPS feed: every job, plus WhatsApp threads, the
 * partner board, driver mobiles, CS contacts and the TradeNet key-in draft.
 * The portal must never receive any of that, so this endpoint does the
 * filtering and the stripping on the server — the wire payload is already
 * customer-safe before it reaches the browser.
 *
 * Keep the stripping in step with `server/api/track/[id].get.ts` (the public
 * tracking page) and the visible surface in step with `PortalJob` in
 * `app/utils/portal.ts`.
 */

/** Mirrors PORTAL_CLIENT in `app/utils/portal.ts` — no auth in the demo. */
const PORTAL_COMPANY = 'Allmighty Foods Pte Ltd'
const PORTAL_DOMAIN = '@allmightyfoods.com.sg'

/** Mirrors `isPortalJob()` in `app/utils/portal.ts`. */
function isPortalJob(s: Shipment): boolean {
  if (s.company === PORTAL_COMPANY) return true
  if ((s.customerEmail ?? '').toLowerCase().endsWith(PORTAL_DOMAIN)) return true
  // Allmighty's own B2C orders leave their warehouse — they are the shipper.
  return /allmighty foods/i.test(s.origin ?? '')
}

/** Same redaction as the public /track payload. */
function customerSafe(shipment: Shipment) {
  const {
    contacts: _contacts,
    driverPhone: _driverPhone,
    whatsapp: _whatsapp,
    partners: _partners,
    ...safe
  } = shipment
  return {
    ...safe,
    // The TradeNet key-in draft is internal — the customer sees the outcome.
    customs: shipment.customs
      ? (({ declaration: _declaration, ...c }) => c)(shipment.customs)
      : undefined,
    events: shipment.events.filter((e) => e.internal !== true)
  }
}

export default defineEventHandler(async () => {
  const shipments = await dbGetShipments()
  return shipments
    .filter(isPortalJob)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(customerSafe)
})
