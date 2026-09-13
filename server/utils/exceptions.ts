import type { CommsThread, OutboxEmail, Shipment } from '#shared/utils/shipping'
import {
  CLAIM_LABELS,
  declarationGaps,
  etaPassed,
  isStuck,
  lastEventAt,
  PARTNER_ROLE_LABELS
} from '#shared/utils/shipping'

export type ExceptionKind =
  | 'stuck'
  | 'eta_passed'
  | 'customs_gap'
  | 'claim_open'
  | 'partner_blocked'
  | 'needs_reply'
  | 'signoff_pending'

export interface OpsException {
  id: string
  shipmentId: string
  client: string
  kind: ExceptionKind
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  since: string
  link: string
}

const NEEDS_REPLY_AFTER_MS = 2 * 3600_000
const CUSTOMS_ETA_WINDOW_MS = 48 * 3600_000

function clientOf(s: Shipment): string {
  return s.company ?? s.customerName
}

function hoursAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600_000))
}

/**
 * The ops alert list. Everything here is derived — no exception is ever stored,
 * so fixing the underlying job makes the alert disappear on the next read.
 */
export function buildExceptions(shipments: Shipment[], threads: CommsThread[]): OpsException[] {
  const out: OpsException[] = []
  const byId = new Map(shipments.map((s) => [s.id, s]))

  for (const s of shipments) {
    const client = clientOf(s)
    const link = `/ops/jobs/${s.id}`

    if (isStuck(s, 24)) {
      const at = lastEventAt(s)
      out.push({
        id: `${s.id}-stuck`,
        shipmentId: s.id,
        client,
        kind: 'stuck',
        severity: 'high',
        title: `No movement for ${hoursAgo(at)}h`,
        detail: `${s.id} is still "${s.status.replace(/_/g, ' ')}" and the last timeline entry was ${hoursAgo(at)} hours ago.`,
        since: at,
        link
      })
    }

    if (etaPassed(s)) {
      out.push({
        id: `${s.id}-eta`,
        shipmentId: s.id,
        client,
        kind: 'eta_passed',
        severity: 'high',
        title: `ETA passed ${hoursAgo(s.eta)}h ago`,
        detail: `ETA was ${s.eta} and ${s.id} has not been delivered. Route: ${s.origin} → ${s.destination}.`,
        since: s.eta,
        link
      })
    }

    if (s.customs && (s.customs.status === 'docs_pending' || s.customs.status === 'ready_for_declaration')) {
      const gaps = declarationGaps(s)
      const etaSoon = new Date(s.eta).getTime() - Date.now() < CUSTOMS_ETA_WINDOW_MS
      if (gaps.length && etaSoon) {
        out.push({
          id: `${s.id}-customs`,
          shipmentId: s.id,
          client,
          kind: 'customs_gap',
          severity: 'high',
          title: `${gaps.length} item${gaps.length === 1 ? '' : 's'} missing before TradeNet filing`,
          detail: `Still needed: ${gaps.join(', ')}.`,
          since: lastEventAt(s),
          link: `/ops/customs/${s.id}`
        })
      }
    }

    if (s.claim?.status === 'open') {
      out.push({
        id: `${s.id}-claim`,
        shipmentId: s.id,
        client,
        kind: 'claim_open',
        severity: 'medium',
        title: `${CLAIM_LABELS[s.claim.type]} open`,
        detail: s.claim.note || `${CLAIM_LABELS[s.claim.type]} raised by ${s.claim.openedBy}.`,
        since: s.claim.openedAt,
        link
      })
    }

    for (const p of s.partners ?? []) {
      if (p.state !== 'blocked') continue
      out.push({
        id: `${s.id}-partner-${p.role}`,
        shipmentId: s.id,
        client,
        kind: 'partner_blocked',
        severity: 'high',
        title: `${PARTNER_ROLE_LABELS[p.role]} blocked — ${p.name}`,
        detail: p.waitingFor ?? `${p.name} cannot proceed.`,
        since: p.since ?? lastEventAt(s),
        link: '/ops/partners'
      })
    }

    if (!s.signoff && s.status === 'out_for_delivery') {
      out.push({
        id: `${s.id}-signoff`,
        shipmentId: s.id,
        client,
        kind: 'signoff_pending',
        severity: 'low',
        title: 'Sign-off pending',
        detail: `${s.id} is out for delivery with no POD signature yet.`,
        since: lastEventAt(s),
        link
      })
    }
  }

  for (const t of threads) {
    if (t.status !== 'needs_reply') continue
    if (Date.now() - new Date(t.lastAt).getTime() < NEEDS_REPLY_AFTER_MS) continue
    const s = t.shipmentId ? byId.get(t.shipmentId) : undefined
    out.push({
      id: `thread-${t.id}`,
      shipmentId: t.shipmentId ?? '',
      client: s ? clientOf(s) : t.contactName,
      kind: 'needs_reply',
      severity: 'medium',
      title: `${t.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} from ${t.contactName} unanswered ${hoursAgo(t.lastAt)}h`,
      detail: t.messages[t.messages.length - 1]?.body ?? t.subject,
      since: t.lastAt,
      link: `/ops/inbox?thread=${encodeURIComponent(t.id)}`
    })
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.since.localeCompare(a.since))
}

export async function loadExceptions(shipments: Shipment[], emails: OutboxEmail[]): Promise<OpsException[]> {
  return buildExceptions(shipments, buildCommsThreads(shipments, emails))
}
