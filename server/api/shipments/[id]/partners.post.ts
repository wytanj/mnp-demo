import type { PartnerRole, PartnerState, PartnerStatus } from '#shared/utils/shipping'
import { PARTNER_ROLE_LABELS, PARTNER_STATE_LABELS } from '#shared/utils/shipping'

const ROLES: PartnerRole[] = ['shipping_line', 'warehouse', 'broker', 'agent', 'haulier']
const STATES: PartnerState[] = ['ok', 'waiting', 'blocked', 'done', 'na']

/**
 * Update one partner's state on a job from the coordination board.
 * POST { role, state, waitingFor?, note?, name?, contact?, eta? }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })

  const body = await readBody(event)
  const role = String(body?.role ?? '') as PartnerRole
  const state = String(body?.state ?? '') as PartnerState
  if (!ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: `role must be one of: ${ROLES.join(', ')}` })
  }
  if (!STATES.includes(state)) {
    throw createError({ statusCode: 400, statusMessage: `state must be one of: ${STATES.join(', ')}` })
  }

  const waitingFor = String(body?.waitingFor ?? '').trim()
  const note = String(body?.note ?? '').trim()
  const at = new Date().toISOString()

  const partners = (shipment.partners ??= [])
  let partner: PartnerStatus | undefined = partners.find((p) => p.role === role)
  if (!partner) {
    partner = { role, name: String(body?.name ?? PARTNER_ROLE_LABELS[role]), state }
    partners.push(partner)
  }
  partner.state = state
  partner.since = at
  if (body?.name) partner.name = String(body.name)
  if (body?.contact) partner.contact = String(body.contact)
  if (body?.eta) partner.eta = String(body.eta)
  partner.waitingFor = waitingFor || (state === 'ok' || state === 'done' || state === 'na' ? undefined : partner.waitingFor)

  addEvent(shipment, {
    type: 'note',
    actor: 'cs',
    note: `🤝 ${PARTNER_ROLE_LABELS[role]} ${partner.name} → ${PARTNER_STATE_LABELS[state]}${waitingFor ? ` · waiting for ${waitingFor}` : ''}${note ? ` · ${note}` : ''}`,
    internal: true,
    at
  })
  await dbSaveShipment(shipment)

  return { ok: true, partners: shipment.partners }
})
