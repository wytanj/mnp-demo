import type { CustomsDeclaration, ShipmentCustoms, ShipmentDocument } from '#shared/utils/shipping'
import { DECLARATION_LABELS, customsReady, declarationGaps } from '#shared/utils/shipping'

/** Demo permit number — a real one comes back from TradeNet after a person files. */
function demoPermitNo(): string {
  return `IN-2026-09-${String(Math.floor(100000 + Math.random() * 900000))}`
}

const DECLARATION_KEYS = Object.keys(DECLARATION_LABELS) as Array<keyof CustomsDeclaration>
const NUMERIC_KEYS: Array<keyof CustomsDeclaration> = ['cargoValue', 'packages', 'grossWeightKg']

/** Keep only known declaration fields, and coerce the numeric ones. */
function cleanDeclaration(input: unknown): CustomsDeclaration {
  const src = (input ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of DECLARATION_KEYS) {
    if (!(key in src)) continue
    const raw = src[key]
    if (raw === null || raw === undefined || raw === '') continue
    if (NUMERIC_KEYS.includes(key)) {
      const n = Number(raw)
      if (!Number.isNaN(n)) out[key] = n
      continue
    }
    out[key] = typeof raw === 'string' ? raw.trim() : raw
  }
  return out as CustomsDeclaration
}

/**
 * TradeNet is human-in-the-loop. M&P collect and check the documents here; an
 * M&P customs officer then files the declaration on TradeNet themselves and
 * records it against the job. Nothing is ever submitted automatically.
 *
 * POST { action: 'mark_ready' | 'mark_declared' | 'mark_cleared', by, permitNo? }
 *    | { action: 'save_declaration', declaration }
 *    | { action: 'submit_demo', by }
 *    | { action: 'flag_permit', by, note? }
 *    | { action: 'raise_query', queryNote, by? }
 *    | { action: 'respond_query', by, note? }
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id.toUpperCase()) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const action = String(body?.action ?? '')
  const by = String(body?.by ?? '').trim()
  const permitNo = String(body?.permitNo ?? '').trim()
  const at = new Date().toISOString()

  const customs: ShipmentCustoms = shipment.customs ?? { required: true, status: 'docs_pending' }

  if (action === 'save_declaration') {
    const patch = cleanDeclaration(body?.declaration)
    customs.declaration = { ...(customs.declaration ?? {}), ...patch }
    shipment.customs = customs
    const gaps = declarationGaps(shipment)
    if (!gaps.length && customs.status === 'docs_pending') {
      customs.status = 'ready_for_declaration'
      customs.note = 'Declaration keyed in and documents checked — awaiting manual TradeNet filing by our customs team'
    }
    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 TradeNet declaration draft saved${gaps.length ? ` — still missing: ${gaps.join(', ')}` : ' — no gaps left, ready to file'}`,
      internal: true,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, declaration: customs.declaration, gaps, shipment }
  }

  if (action === 'submit_demo') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    const gaps = declarationGaps(shipment)
    if (gaps.length) {
      throw createError({
        statusCode: 409,
        statusMessage: `Cannot file on TradeNet yet — ${gaps.length} item${gaps.length === 1 ? '' : 's'} still missing: ${gaps.join(', ')}`
      })
    }

    const permit = permitNo || demoPermitNo()
    customs.status = 'declared'
    customs.declaredBy = by
    customs.declaredAt = at
    customs.permitNo = permit
    customs.note = `Declaration filed on TradeNet by ${by} (demo) after doc check`
    customs.declaration = { ...(customs.declaration ?? {}), filedBy: by, filedAt: at, permitNo: permit }
    shipment.customs = customs

    // The permit is the output of the filing — approve the row if the job has one.
    const permitDoc = (shipment.documents ?? []).find((d) => d.key === 'permit')
    if (permitDoc) {
      permitDoc.status = 'approved'
      permitDoc.category = 'customs'
      permitDoc.uploadedBy = by
      permitDoc.verifiedBy = by
      permitDoc.at = at
      permitDoc.fileName = permitDoc.fileName ?? `permit-${shipment.id}.pdf`
      permitDoc.note = 'Filed on TradeNet by M&P after doc check (demo)'
    }

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Declaration filed on TradeNet by ${by} (demo) · permit ${permit}`,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, permitNo: permit, customs, shipment }
  }

  if (action === 'mark_ready') {
    if (!customsReady(shipment)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Customs documents are still outstanding — check the document list first'
      })
    }
    customs.status = 'ready_for_declaration'
    customs.note = 'Documents checked by M&P — awaiting manual TradeNet filing by our customs team'
    shipment.customs = customs
    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: '🛃 Ready for declaration — M&P customs team files on TradeNet',
      at
    })
    await dbSaveShipment(shipment)
    return shipment
  }

  if (action === 'mark_declared') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    if (!customsReady(shipment)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Customs documents are still outstanding — cannot mark as declared'
      })
    }
    customs.status = 'declared'
    customs.declaredBy = by
    customs.declaredAt = at
    customs.note = `Declaration filed manually on TradeNet by ${by} after doc check`
    if (permitNo) customs.permitNo = permitNo
    shipment.customs = customs

    // The permit is the output of the manual filing — record it as a document.
    const docs = (shipment.documents ??= [])
    let permit = docs.find((d) => d.key === 'permit')
    if (!permit) {
      permit = { key: 'permit', label: 'Import permit (TradeNet)', required: true, category: 'customs', status: 'pending' } as ShipmentDocument
      docs.push(permit)
    }
    permit.status = 'approved'
    permit.category = 'customs'
    permit.uploadedBy = by
    permit.at = at
    permit.fileName = permit.fileName ?? `permit-${shipment.id}.pdf`
    permit.note = 'Filed manually on TradeNet by M&P after doc check'

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Declaration filed on TradeNet by ${by} (manual)${customs.permitNo ? ` · permit ${customs.permitNo}` : ''}`,
      at
    })
    await dbSaveShipment(shipment)
    return shipment
  }

  if (action === 'flag_permit') {
    const officer = by || 'M&P Customs'
    const docs = (shipment.documents ??= [])
    let permit = docs.find((d) => d.key === 'permit')
    if (!permit) {
      permit = {
        key: 'permit',
        label: 'Import permit (TradeNet)',
        required: true,
        category: 'customs',
        status: 'pending'
      } as ShipmentDocument
      docs.push(permit)
    }
    if (permit.status !== 'approved') {
      permit.status = 'pending'
      permit.note = `Flagged missing by M&P — ${officer} to file on TradeNet and record the permit`
      permit.at = at
    }

    // Who downstream is standing still because the permit is not on the job yet.
    const blocked = (shipment.partners ?? []).find(
      (p) => p.state === 'blocked' && (p.role === 'warehouse' || p.role === 'haulier')
    )
    const linkage = blocked ? `${blocked.name} is blocked on this permit` : ''

    customs.note = [
      `Permit outstanding — flagged for ${officer}`,
      linkage
    ].filter(Boolean).join(' · ')
    shipment.customs = customs

    const extra = String(body?.note ?? '').trim()
    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `⚠ Permit missing — flagged for ${officer}${linkage ? ` · ${linkage}` : ''}${extra ? ` · ${extra}` : ''}`,
      internal: true,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, flaggedFor: officer, blockedPartner: blocked ?? null, customs, shipment }
  }

  if (action === 'raise_query') {
    const queryNote = String(body?.queryNote ?? '').trim()
    if (!queryNote) {
      throw createError({ statusCode: 400, statusMessage: 'queryNote (what Customs asked) is required' })
    }
    customs.status = 'queried'
    customs.queriedAt = at
    customs.queryNote = queryNote
    customs.respondedAt = undefined
    customs.note = `Customs query open — ${customs.declaredBy ?? (by || 'our customs officer')} to respond`
    shipment.customs = customs

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Customs query raised — ${queryNote}`,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, customs, shipment }
  }

  if (action === 'respond_query') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    const reply = String(body?.note ?? '').trim()
    customs.status = 'declared'
    customs.respondedAt = at
    customs.declaredBy = customs.declaredBy ?? by
    customs.note = `Query answered on TradeNet by ${by}${reply ? ` — ${reply}` : ''}`
    shipment.customs = customs

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Customs query answered by ${by}${reply ? ` — ${reply}` : ''} · declaration back with Singapore Customs`,
      at
    })
    await dbSaveShipment(shipment)
    return { ok: true, customs, shipment }
  }

  if (action === 'mark_cleared') {
    if (!by) {
      throw createError({ statusCode: 400, statusMessage: 'by (M&P customs officer name) is required' })
    }
    customs.status = 'cleared'
    customs.clearedAt = at
    customs.note = `Cleared by Singapore Customs — confirmed by ${by}`
    if (permitNo) customs.permitNo = permitNo
    shipment.customs = customs

    addEvent(shipment, {
      type: 'customs',
      actor: 'cs',
      note: `🛃 Customs cleared${customs.permitNo ? ` · permit ${customs.permitNo}` : ''} — confirmed by ${by}`,
      at
    })

    const email = buildCustomsClearedEmail(shipment, at)
    await sendEmail(email)
    await dbSaveEmail(email)

    // M&P's scope ends at clearance on customs-only jobs — that is when the
    // review ask makes sense. Otherwise we wait for delivery.
    if (/customs|clearance only/i.test(shipment.service ?? '')) {
      await maybeSendReviewAsk(shipment, 'customs_cleared')
    }

    await dbSaveShipment(shipment)
    return shipment
  }

  throw createError({
    statusCode: 400,
    statusMessage: "action must be 'save_declaration', 'submit_demo', 'mark_ready', 'mark_declared', 'mark_cleared', 'flag_permit', 'raise_query' or 'respond_query'"
  })
})
