export const STATUS_FLOW = [
  'booked',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered'
] as const

export type ShipmentStatus = (typeof STATUS_FLOW)[number]

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  booked: 'Booking confirmed',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered'
}

export type ShipmentMode = 'b2b' | 'b2c' | 'b2self'

export const MODE_LABELS: Record<ShipmentMode, string> = {
  b2b: 'B2B',
  b2c: 'B2C',
  b2self: 'B2SELF'
}

export interface ShipmentEvent {
  id: string
  type: 'status' | 'photo' | 'note' | 'signoff' | 'created' | 'claim' | 'customs' | 'message'
  status?: ShipmentStatus
  note?: string
  photo?: string
  actor: 'cs' | 'driver' | 'customer' | 'system'
  at: string
  /** CS-only note — stripped from the customer tracking API (/api/track/[id]). */
  internal?: boolean
}

export interface QuoteLine {
  label: string
  amount: number | null // null = at cost / on application
  unit?: string // e.g. "/20'", "/BL", "/shipment"
  note?: string
  excluded?: boolean // conditional; not counted in subtotal
}

export interface QuoteSection {
  key: string
  title: string
  currency: 'USD' | 'SGD'
  subtitle?: string
  lines: QuoteLine[]
}

export type DocumentStatus = 'pending' | 'uploaded' | 'approved' | 'waived'

/**
 * customs   — needed before M&P can declare on TradeNet (commercial invoice,
 *             packing list, B/L or AWB, import permit)
 * commercial— PO / quote paperwork
 * delivery  — haulier authorisation, photos, POD
 * payment   — transfer slips, GST advice
 */
export type DocumentCategory = 'customs' | 'commercial' | 'delivery' | 'payment'

export interface ShipmentDocument {
  key: string
  label: string
  required: boolean
  status: DocumentStatus
  category?: DocumentCategory
  deadline?: string
  file?: string // data URL
  fileName?: string
  uploadedBy?: string
  /** Who at M&P verified (approved) the document. */
  verifiedBy?: string
  at?: string
  note?: string
}

export type ClaimType = 'damage' | 'missing' | 'destination_fee' | 'no_reply'

export interface ShipmentClaim {
  type: ClaimType
  note: string
  openedAt: string
  openedBy: 'customer' | 'cs' | 'driver'
  status: 'open' | 'resolved'
  resolvedAt?: string
  resolvedNote?: string
}

export const CLAIM_TYPES: ClaimType[] = ['damage', 'missing', 'destination_fee', 'no_reply']

export const CLAIM_LABELS: Record<ClaimType, string> = {
  damage: 'Damage claim',
  missing: 'Missing cargo claim',
  destination_fee: 'Destination fee dispute',
  no_reply: 'No-reply complaint'
}

/**
 * TradeNet is human-in-the-loop: M&P collect and check the documents, then an
 * M&P customs officer files the declaration manually and records it here.
 */
export type CustomsStatus =
  | 'docs_pending'
  | 'ready_for_declaration'
  | 'declared'
  | 'queried'
  | 'cleared'

export interface ShipmentCustoms {
  required: true
  status: CustomsStatus
  declaredBy?: string // human name, e.g. 'Joreen (M&P Customs)'
  declaredAt?: string
  permitNo?: string // manual entry after a person files on TradeNet
  clearedAt?: string
  note?: string
  /** Singapore Customs came back with a question — an officer answers it. */
  queriedAt?: string
  queryNote?: string
  respondedAt?: string
  /** TradeNet key-in draft — see DECLARATION_REQUIRED / declarationGaps(). */
  declaration?: CustomsDeclaration
}

export const CUSTOMS_LABELS: Record<CustomsStatus, string> = {
  docs_pending: 'Documents pending',
  ready_for_declaration: 'Ready for declaration',
  declared: 'Declared on TradeNet',
  queried: 'Customs query — officer to respond',
  cleared: 'Customs cleared'
}

export type ReviewAskState = 'not_yet' | 'sent' | 'held' | 'answered'

export interface ReviewAsk {
  state: ReviewAskState
  trigger?: 'delivered' | 'customs_cleared'
  at?: string
  reason?: string
  /** 48h re-ask (reminder) bookkeeping — set by the ops Reviews board. */
  reaskAt?: string
  reaskCount?: number
  reaskDueAt?: string
  /** Delayed programmes (B2B): the ask is queued, not sent — ISO date it is due. */
  scheduledFor?: string
}

export interface QuoteUpdate {
  from: string
  at: string
  text: string
}

export interface Quote {
  ref: string
  title: string
  route: string
  containerType: string
  carrier: string
  validUntil: string
  cargo?: string[]
  sections: QuoteSection[]
  notes: string[]
  // per-RT / per-w/m rate cards: unit-rate sums are misleading, hide subtotals
  showSubtotals?: boolean
  lumpSum?: { amount: number; currency: string; note?: string }
  updates?: QuoteUpdate[]
}

export interface Shipment {
  id: string
  mode: ShipmentMode
  service?: string
  status: ShipmentStatus
  customerName: string
  customerEmail: string
  company?: string
  poNumber?: string
  incoterms?: string
  origin: string
  destination: string
  eta: string
  driverName: string
  driverPhone?: string
  vehicle: string
  pieces: number
  weightKg: number
  description: string
  events: ShipmentEvent[]
  quote?: Quote
  documents?: ShipmentDocument[]
  signoff?: { name: string; signature: string; at: string }
  review?: {
    rating: number
    comment: string
    at: string
    screenshot?: string // proof of public review, uploaded by customer
    platforms?: Array<'google' | 'facebook'>
    reward?: { code: string; at: string; value?: string }
    helpedBy?: string // "who helped you?" — named-staff praise
  }
  /** Open claim suppresses the automatic review ask — CS/claims handle it. */
  claim?: ShipmentClaim
  customs?: ShipmentCustoms
  reviewAsk?: ReviewAsk
  /** Which review programme this job is enrolled in — see REVIEW_PROGRAMMES. */
  programmeId?: ProgrammeId
  // People who have written in about this job — booking address plus any
  // Gmail / SingNet / colleague domain that later attached itself.
  contacts?: ShipmentContact[]
  /** Simulated WhatsApp conversations tied to this job (pitch mode). */
  whatsapp?: WaThread[]
  /** Who else has to move before this job can: line, CFS, broker, agent, haulier. */
  partners?: PartnerStatus[]
  createdAt: string
}

export interface ShipmentContact {
  email: string
  name?: string
  source: 'booking' | 'inbound' | 'cs'
  at?: string
}

export type MailDirection = 'in' | 'out'
export type MailKind = 'tracking' | 'review' | 'reward' | 'inbound' | 'reply' | 'cs' | 'message' | 'status'
export type MailMatch = 'shipment-id' | 'booking-email' | 'alias' | 'company-domain'

export interface OutboxEmail {
  id: string
  shipmentId: string
  to: string
  from?: string
  subject: string
  body: string
  ctaLabel: string
  ctaUrl: string
  at: string
  direction?: MailDirection
  kind?: MailKind
  matchedBy?: MailMatch
  delivery?: { state: 'sent' | 'failed' | 'simulated'; detail?: string; to: string }
}

const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.com.sg', 'ymail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'singnet.com.sg', 'starhub.net.sg', 'pacific.net.sg',
  'qq.com', '163.com', '126.com', 'naver.com'
])

export function emailDomain(addr: string): string {
  return (addr.split('@')[1] ?? '').trim().toLowerCase()
}

export function isConsumerMailbox(addr: string): boolean {
  return CONSUMER_DOMAINS.has(emailDomain(addr))
}

export function mailKindOf(e: OutboxEmail): MailKind {
  if (e.kind) return e.kind
  if (e.direction === 'in') return 'inbound'
  if (e.ctaUrl?.startsWith('/review')) return 'review'
  if (/reward/i.test(e.subject)) return 'reward'
  if (e.ctaUrl?.startsWith('/track')) return 'tracking'
  if (/^re:/i.test(e.subject)) return 'reply'
  return 'cs'
}

export function mailDirectionOf(e: OutboxEmail): MailDirection {
  return e.direction ?? 'out'
}

/**
 * The address customers and the room see. The real Resend send may still use
 * RESEND_FROM (the verified sending domain) — that stays server-internal in
 * server/utils/email.ts.
 */
export const MAIL_FROM_DISPLAY = 'M&P International Freights <cs@mp.com.sg>'
export const DEFAULT_MAIL_FROM = MAIL_FROM_DISPLAY

// Legacy rows persisted in Supabase carry the old sending domain — mask it.
const LEGACY_FROM_RE = /@pickletour\.app/i

export function mailFromOf(e: OutboxEmail): string {
  const raw = e.from?.trim()
  // Inbound mail keeps its real sender (noise mail genuinely comes from there).
  if (mailDirectionOf(e) === 'in') return raw || 'unknown sender'
  if (!raw) return MAIL_FROM_DISPLAY
  return LEGACY_FROM_RE.test(raw) ? MAIL_FROM_DISPLAY : raw
}

export function mailToOf(e: OutboxEmail): string {
  return (e.to ?? '').trim()
}

/** Address a compose/reply would go to — inbound replies to the sender, never CS. */
export function mailComposeTo(e: OutboxEmail): string {
  return mailDirectionOf(e) === 'in' ? mailFromOf(e) : mailToOf(e)
}

export function mailDeliveredTo(e: OutboxEmail): string | null {
  const live = e.delivery?.to?.trim()
  if (!live) return null
  if (live.toLowerCase() === mailToOf(e).toLowerCase()) return null
  return live
}

export function statusIndex(status: ShipmentStatus): number {
  return STATUS_FLOW.indexOf(status)
}

/** Inbound clutter on the shared CS inbox — folded away in the ops mail log. */
const NOISE_RE = /pickle|tournament|newsletter|unsubscribe|no-reply|noreply/i

export function isNoiseMail(e: OutboxEmail): boolean {
  if (mailDirectionOf(e) !== 'in') return false
  if (!e.shipmentId?.trim()) return true
  return NOISE_RE.test(`${e.subject ?? ''} ${e.from ?? ''}`)
}

function docDone(d: ShipmentDocument): boolean {
  return d.status === 'approved' || d.status === 'waived'
}

/** Ops pill "Docs X/Y" — required documents only. */
export function docsDone(s: Shipment): { done: number; total: number } {
  const required = (s.documents ?? []).filter((d) => d.required)
  return { done: required.filter(docDone).length, total: required.length }
}

/** Documents a customs declaration needs — the permit is the output, not an input. */
export function customsDocs(s: Shipment): ShipmentDocument[] {
  return (s.documents ?? []).filter((d) => d.category === 'customs' && d.key !== 'permit')
}

/**
 * True when every required customs document is approved, i.e. an M&P customs
 * officer can now file the declaration on TradeNet (manually — never auto).
 */
export function customsReady(s: Shipment): boolean {
  const docs = customsDocs(s).filter((d) => d.required)
  return docs.length > 0 && docs.every((d) => d.status === 'approved')
}

export type ReviewAskDecision = { send: true } | { send: false; reason: string }

/**
 * Should we ask for a review right now? An open claim always wins — that goes
 * to CS/claims, not to a "how did we do?" email. A held ask stays held too:
 * once CS parks it, only a release on the Reviews board lets it out.
 */
export function reviewAskDecision(
  s: Shipment,
  _trigger: 'delivered' | 'customs_cleared' = 'delivered'
): ReviewAskDecision {
  if (s.claim?.status === 'open') {
    return {
      send: false,
      reason: `Open ${CLAIM_LABELS[s.claim.type].toLowerCase()} — routed to CS/claims, no review ask sent`
    }
  }
  if (s.review) return { send: false, reason: 'Customer has already left a review' }
  if (s.reviewAsk?.state === 'held') {
    return {
      send: false,
      reason: s.reviewAsk.reason
        ? `Held — ${s.reviewAsk.reason}`
        : 'Held by CS — release it on the Reviews board'
    }
  }
  if (s.reviewAsk?.state === 'sent') return { send: false, reason: 'Review request already sent' }
  if (s.reviewAsk?.state === 'answered') return { send: false, reason: 'Review request already answered' }
  return { send: true }
}

// ---------------------------------------------------------------------------
// Review programmes — one job, one programme. Which ask goes out, when it goes
// out, and what the customer gets back all hang off this table.
// ---------------------------------------------------------------------------

export type ProgrammeId = 'auto5' | 'proof' | 'b2b-delayed'

/**
 * How the voucher is earned:
 *   five_star      — 5★ issues it on the spot, no CS step
 *   verified_proof — CS eyeballs the public-review screenshot first
 *   manual         — the account manager credits it by hand
 */
export type RewardAuto = 'five_star' | 'verified_proof' | 'manual'

export interface ReviewProgramme {
  id: ProgrammeId
  name: string
  short: string
  description: string
  icon: string
  color: 'primary' | 'success' | 'info' | 'warning' | 'neutral' | 'error'
  audience: string
  trigger: string
  /** Days after delivery before the ask goes out. 0 = on sign-off. */
  delayDays: number
  reward: { value: string; cost: number; auto: RewardAuto }
  rules: Array<{ icon: string; text: string }>
}

export const REVIEW_PROGRAMMES: ReviewProgramme[] = [
  {
    id: 'auto5',
    name: '5★ auto Grab $10',
    short: 'Auto 5★',
    description: 'Ask on sign-off; a 5★ pays itself out instantly, anything lower goes to CS.',
    icon: 'i-lucide-zap',
    color: 'primary',
    audience: 'B2C & B2Self deliveries',
    trigger: 'On delivery sign-off',
    delayDays: 0,
    reward: { value: 'Grab $10', cost: 10, auto: 'five_star' },
    rules: [
      { icon: 'i-lucide-package-check', text: 'Ask goes out on delivery — the moment the customer signs off.' },
      { icon: 'i-lucide-star', text: '5★ earns a Grab $10 thank-you code instantly, no CS step.' },
      { icon: 'i-lucide-message-circle-warning', text: '1–4★ lands on the CS desk instead — we fix it before we ask again.' },
      { icon: 'i-lucide-bell-ring', text: '48h reminder, twice at most — then we stop chasing.' },
      { icon: 'i-lucide-shield-alert', text: 'Held automatically while a claim is open; CS releases it once the claim closes.' }
    ]
  },
  {
    id: 'proof',
    name: 'Public review screenshot',
    short: 'Public proof',
    description: 'For accounts whose word carries publicly — screenshot the Google or Facebook review, CS verifies, voucher goes out.',
    icon: 'i-lucide-shield-check',
    color: 'success',
    audience: 'B2B accounts with public presence',
    trigger: 'On delivery sign-off',
    delayDays: 0,
    reward: { value: 'Grab $10', cost: 10, auto: 'verified_proof' },
    rules: [
      { icon: 'i-lucide-package-check', text: 'Ask goes out on delivery, with the Google and Facebook links in it.' },
      { icon: 'i-lucide-image-up', text: 'Customer uploads a screenshot of their public review to claim.' },
      { icon: 'i-lucide-shield-check', text: 'CS eyeballs the screenshot before any code leaves — never auto-issued.' },
      { icon: 'i-lucide-ticket', text: 'Verified proof → Grab $10, same day.' },
      { icon: 'i-lucide-bell-ring', text: '48h reminder, twice at most — then we stop chasing.' }
    ]
  },
  {
    id: 'b2b-delayed',
    name: 'B2B delayed ask',
    short: 'B2B delayed',
    description: 'Big accounts get three quiet days first — the invoice and any short-shipment land before we ask.',
    icon: 'i-lucide-calendar-clock',
    color: 'info',
    audience: 'B2B accounts (PO jobs)',
    trigger: '3 days after delivery',
    delayDays: 3,
    reward: { value: 'SGD 20 off next booking', cost: 20, auto: 'manual' },
    rules: [
      { icon: 'i-lucide-calendar-clock', text: 'Ask waits 3 days — the invoice and any short-shipment land first.' },
      { icon: 'i-lucide-mail-check', text: 'One ask per PO job, never per drop — nobody wants five emails from us.' },
      { icon: 'i-lucide-badge-percent', text: 'Reward is SGD 20 off the next booking, credited to the account.' },
      { icon: 'i-lucide-user-check', text: 'No auto-issue — the account manager approves every credit.' },
      { icon: 'i-lucide-shield-alert', text: 'Open claim or fee dispute parks the ask until it is closed.' }
    ]
  }
]

export const DEFAULT_PROGRAMME_ID: ProgrammeId = 'auto5'

/** Programme by id — anything unknown falls back to the 5★ auto programme. */
export function programmeById(id?: string | null): ReviewProgramme {
  return (
    REVIEW_PROGRAMMES.find((p) => p.id === id) ??
    REVIEW_PROGRAMMES.find((p) => p.id === DEFAULT_PROGRAMME_ID)!
  )
}

/**
 * Which programme a job runs on. An explicit `programmeId` wins; otherwise B2B
 * jobs go on the delayed ask and everything else on the 5★ auto programme.
 */
export function programmeOf(s: Pick<Shipment, 'programmeId' | 'mode'>): ReviewProgramme {
  if (s.programmeId) return programmeById(s.programmeId)
  return programmeById(s.mode === 'b2b' ? 'b2b-delayed' : DEFAULT_PROGRAMME_ID)
}

/** One programme's numbers on the Reviews / Rewards boards — see programmeStats(). */
export interface ProgrammeStats {
  id: ProgrammeId
  name: string
  short: string
  icon: string
  color: ReviewProgramme['color']
  trigger: string
  rewardValue: string
  jobs: number
  asked: number
  reminders: number
  pending: number
  scheduled: number
  held: number
  received: number
  conversion: number | null
  avgRating: number | null
  fiveStar: number
  vouchers: number
  awaitingVerification: number
  cost: number
  costPerReview: number | null
}

// ---------------------------------------------------------------------------
// Comms, partner coordination and TradeNet declaration drafts
// ---------------------------------------------------------------------------

export type Channel = 'email' | 'whatsapp'
export type PartnerRole = 'shipping_line' | 'warehouse' | 'broker' | 'agent' | 'haulier'
export type PartnerState = 'ok' | 'waiting' | 'blocked' | 'done' | 'na'

export const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  shipping_line: 'Shipping line',
  warehouse: 'Warehouse / CFS',
  broker: 'Customs broker',
  agent: 'Overseas agent',
  haulier: 'Haulier'
}

export const PARTNER_STATE_LABELS: Record<PartnerState, string> = {
  ok: 'On track',
  waiting: 'Waiting on them',
  blocked: 'Blocked',
  done: 'Done',
  na: 'Not applicable'
}

export interface ThreadMessage {
  id: string
  direction: 'in' | 'out'
  from: string
  body: string
  at: string
  attachment?: { name: string; kind: 'pdf' | 'image' }
}

/** A WhatsApp conversation tied to a job (embedded in the shipment JSON → persists with it). */
export interface WaThread {
  id: string // 'wa-4471-melissa'
  contactName: string
  contactHandle: string // '+65 9123 4567'
  contactRole: 'customer' | PartnerRole | 'driver' | 'other'
  status: 'needs_reply' | 'waiting_on_them' | 'closed'
  messages: ThreadMessage[]
}

export interface PartnerStatus {
  role: PartnerRole
  name: string
  contact?: string
  state: PartnerState
  waitingFor?: string
  since?: string
  eta?: string
  channel?: Channel
}

/** TradeNet declaration draft — fillable client-side, missing fields = customs gap. */
export interface CustomsDeclaration {
  declarationType?: 'IN' | 'OUT' | 'TRANSHIPMENT'
  hsCode?: string
  cargoValue?: number
  currency?: string
  countryOfOrigin?: string
  importerUEN?: string
  importerName?: string
  permitType?: string
  vesselName?: string
  voyage?: string
  blNo?: string
  containerNo?: string
  portOfLoading?: string
  portOfDischarge?: string
  packages?: number
  grossWeightKg?: number
  description?: string
  incoterms?: string
  filedBy?: string
  filedAt?: string
  permitNo?: string // set by submit (demo)
}

export const DECLARATION_REQUIRED: Array<keyof CustomsDeclaration> = [
  'declarationType', 'hsCode', 'cargoValue', 'currency', 'countryOfOrigin', 'importerUEN',
  'vesselName', 'blNo', 'portOfLoading', 'portOfDischarge', 'packages', 'grossWeightKg', 'description'
]

export const DECLARATION_LABELS: Record<keyof CustomsDeclaration, string> = {
  declarationType: 'Declaration type',
  hsCode: 'HS code',
  cargoValue: 'Cargo value',
  currency: 'Currency',
  countryOfOrigin: 'Country of origin',
  importerUEN: 'Importer UEN',
  importerName: 'Importer name',
  permitType: 'Permit type',
  vesselName: 'Vessel name',
  voyage: 'Voyage',
  blNo: 'B/L number',
  containerNo: 'Container number',
  portOfLoading: 'Port of loading',
  portOfDischarge: 'Port of discharge',
  packages: 'Packages',
  grossWeightKg: 'Gross weight (kg)',
  description: 'Goods description',
  incoterms: 'Incoterms',
  filedBy: 'Filed by',
  filedAt: 'Filed at',
  permitNo: 'Permit number'
}

function declarationFieldFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return !Number.isNaN(v)
  return true
}

/**
 * What is still missing before an M&P customs officer can file on TradeNet:
 * required declaration fields plus any customs document that is not cleared.
 */
export function declarationGaps(s: Shipment): string[] {
  const gaps: string[] = []
  const d = s.customs?.declaration ?? {}
  for (const key of DECLARATION_REQUIRED) {
    if (!declarationFieldFilled(d[key])) gaps.push(DECLARATION_LABELS[key])
  }
  for (const doc of customsDocs(s)) {
    if (doc.required && doc.status !== 'approved' && doc.status !== 'waived') {
      gaps.push(`Document: ${doc.label}`)
    }
  }
  return gaps
}

// ---------------------------------------------------------------------------
// Prefill — suggestions only. The officer checks every line before filing.
// ---------------------------------------------------------------------------

/** HS shortlist offered on the key-in form; `match` keys off the cargo description. */
export const HS_HINTS: Array<{ code: string; label: string; match: RegExp }> = [
  { code: '8471.60.70', label: 'Keyboards & other input units', match: /keyboard|mouse|input unit/i },
  { code: '1108.19.00', label: 'Starches — other (konjac, oat fibre)', match: /konjac|oat fibre|starch/i },
  { code: '1106.20.00', label: 'Flour & meal of roots', match: /flour|meal of root/i },
  { code: '2007.99.90', label: 'Jellies, jams & fruit purée', match: /jelly|jellies|gumm|candy|snack/i }
]

export function guessHsCode(description: string): string {
  return HS_HINTS.find((h) => h.match.test(description))?.code ?? '3926.90.99'
}

export function guessCountryOfOrigin(place: string): string {
  const o = place.toLowerCase()
  if (/hong kong|kowloon|hkg/.test(o)) return 'HK — Hong Kong SAR'
  if (/shenzhen|yantian|shanghai|ningbo|china|cnsz/.test(o)) return 'CN — China'
  if (/busan|gyeonggi|korea|krpus/.test(o)) return 'KR — Republic of Korea'
  if (/taiwan|kaohsiung/.test(o)) return 'TW — Taiwan'
  if (/singapore|senoko|tuas|psa|keppel|tai seng/.test(o)) return 'SG — Singapore'
  return 'CN — China'
}

/** Free-text origin / destination → a UN/LOCODE-ish port string for the key-in. */
export function guessPort(place: string): string {
  const p = place.toLowerCase()
  if (/keppel/.test(p)) return 'SGSIN — Keppel Distripark'
  if (/psa|pasir panjang/.test(p)) return 'SGSIN — PSA Pasir Panjang'
  if (/singapore|senoko|tuas|tai seng|jurong|changi/.test(p)) return 'SGSIN — Singapore'
  if (/hong kong|kowloon|hkg/.test(p)) return 'HKHKG — Hong Kong'
  if (/yantian|shenzhen/.test(p)) return 'CNSZX — Shenzhen (Yantian)'
  if (/busan|gyeonggi/.test(p)) return 'KRPUS — Busan'
  if (/shanghai/.test(p)) return 'CNSHA — Shanghai'
  if (/kaohsiung/.test(p)) return 'TWKHH — Kaohsiung'
  const head = (place.split('→').pop() ?? place).split(',')[0] ?? place
  return head.trim()
}

/** Rough CIF value for the draft — the officer replaces it from the invoice. */
function guessCargoValue(s: Shipment): number {
  const lump = s.quote?.lumpSum?.amount
  if (lump) return Math.round(lump)
  return Math.max(1200, Math.round(((s.weightKg || 100) * 48) / 10) * 10)
}

/**
 * Where each prefilled value would have come from on the physical file — shown
 * next to the suggestion so the officer knows what to check it against.
 */
export const PREFILL_SOURCES: Partial<Record<keyof CustomsDeclaration, string>> = {
  declarationType: 'M&P standing instruction',
  permitType: 'M&P standing instruction',
  importerName: 'Booking — customer account',
  importerUEN: 'Booking — customer account',
  hsCode: 'Commercial invoice (cargo description)',
  countryOfOrigin: 'Commercial invoice',
  cargoValue: 'Commercial invoice / quotation',
  currency: 'Commercial invoice / quotation',
  vesselName: 'House bill of lading',
  voyage: 'House bill of lading',
  blNo: 'House bill of lading',
  containerNo: 'House bill of lading',
  portOfLoading: 'House bill of lading',
  portOfDischarge: 'House bill of lading',
  packages: 'Packing list',
  grossWeightKg: 'Packing list',
  description: 'Packing list / commercial invoice',
  incoterms: 'Booking — incoterms'
}

/**
 * Build a declaration draft from what the job already knows — booking, B/L
 * details in the cargo description, quotation and the saved draft.
 *
 * Pure and shared so the server can reuse it. It only *suggests*: the caller
 * decides which fields to write, and a person still files on TradeNet.
 */
export function prefillDeclaration(s: Shipment): Partial<CustomsDeclaration> {
  const d = s.customs?.declaration ?? {}
  const vessel = /\(([A-Z][A-Z \-]+?)\s+V\.?\s*([A-Z0-9]+)\)/.exec(s.description ?? '')
  const container = /\b[A-Z]{4}\s?\d{6}[- ]?\d\b/.exec(s.description ?? '')
  const events = s.events ?? []
  const fromEvents = events.map((e) => e.note ?? '').join(' ')
  const vesselFromEvents = /\b([A-Z][A-Z ]{3,})\s+V\.?\s*([A-Z0-9]{3,})\b/.exec(fromEvents)

  const out: Partial<CustomsDeclaration> = {
    declarationType: d.declarationType ?? 'IN',
    permitType: d.permitType ?? 'IN-PAYMENT (GST)',
    importerName: d.importerName ?? s.company ?? s.customerName,
    importerUEN: d.importerUEN ?? '201512345K',
    hsCode: d.hsCode ?? guessHsCode(s.description ?? ''),
    countryOfOrigin: d.countryOfOrigin ?? guessCountryOfOrigin(s.origin ?? ''),
    cargoValue: d.cargoValue ?? guessCargoValue(s),
    currency: d.currency ?? s.quote?.lumpSum?.currency ?? 'USD',
    vesselName: d.vesselName ?? vessel?.[1]?.trim() ?? vesselFromEvents?.[1]?.trim(),
    voyage: d.voyage ?? vessel?.[2] ?? vesselFromEvents?.[2],
    blNo: d.blNo ?? s.poNumber,
    containerNo: d.containerNo ?? container?.[0],
    portOfLoading: d.portOfLoading ?? guessPort(s.origin ?? ''),
    portOfDischarge: d.portOfDischarge ?? guessPort(s.destination ?? ''),
    packages: d.packages ?? s.pieces,
    grossWeightKg: d.grossWeightKg ?? Math.round(s.weightKg ?? 0),
    description: d.description ?? (s.description ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim(),
    incoterms: d.incoterms ?? s.incoterms
  }

  for (const key of Object.keys(out) as Array<keyof CustomsDeclaration>) {
    if (!declarationFieldFilled(out[key])) delete out[key]
  }
  return out
}

/** Unified inbox thread — computed by GET /api/comms, never stored. */
export interface CommsThread {
  id: string
  channel: Channel
  shipmentId: string | null
  contactName: string
  contactHandle: string
  contactRole: string
  subject: string
  lastAt: string
  status: 'needs_reply' | 'waiting_on_them' | 'closed'
  messages: ThreadMessage[]
}

/** Rate-card enquiry from the portal — in-memory only (server/utils/quotes.ts). */
export interface QuoteRequest {
  id: string
  ref: string
  at: string
  company: string
  contact: string
  email: string
  mode: 'FCL' | 'LCL' | 'AIR' | 'LAST_MILE'
  origin: string
  destination: string
  cargo: string
  readyDate?: string
  incoterms?: string
  status: 'new' | 'auto_quoted' | 'sent' | 'won' | 'lost'
  autoQuote?: {
    rateCardRef: string
    estimate: number
    currency: string
    validUntil: string
    lines: Array<{ label: string; amount: number; currency: string }>
  }
}

/** WhatsApp threads on this job still waiting for an M&P reply. */
export function waThreadsNeedingReply(s: Shipment): WaThread[] {
  return (s.whatsapp ?? []).filter((t) => t.status === 'needs_reply')
}

/** ISO timestamp of the newest timeline event (falls back to createdAt). */
export function lastEventAt(s: Shipment): string {
  let latest = s.createdAt
  for (const e of s.events ?? []) {
    if (e.at > latest) latest = e.at
  }
  return latest
}

/** Undelivered job with no movement for `hours` — the ops "stuck" alert. */
export function isStuck(s: Shipment, hours = 24): boolean {
  if (s.status === 'delivered') return false
  return Date.now() - new Date(lastEventAt(s)).getTime() > hours * 3600_000
}

/** ETA is in the past and the job is not delivered yet. */
export function etaPassed(s: Pick<Shipment, 'status' | 'eta'>): boolean {
  if (s.status === 'delivered') return false
  return new Date(s.eta).getTime() < Date.now()
}
