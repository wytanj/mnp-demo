import type { Shipment } from './shipping'

/**
 * Billing / SOA — statements of account are generated from the job book.
 *
 * One statement per *customer account* (not per trade partner, not per job):
 * everything accounts needs to print a statement is derived here so the ops
 * page and the printable /statement/[id] page agree on every number.
 *
 * Pure functions only — no Nuxt/runtime imports, safe on server and client.
 */

export type AgingLabel = 'Current' | '30 days' | '60 days' | '90 days' | '120 days' | 'Overdue'

export const AGING_LABELS: AgingLabel[] = ['Current', '30 days', '60 days', '90 days', '120 days', 'Overdue']

export interface StatementLine {
  date: string
  docType: 'IV' | 'DN' | 'CN'
  docNo: string
  remark: string
  /** Job the document came from — links back into the job book. */
  job: string
  debit: number
  credit: number
  /** Running balance down the statement. */
  balance: number
  status: 'Invoiced' | 'Draft'
  bucket: AgingLabel
  /** True when the amount is a placeholder because no quote exists yet. */
  indicative?: boolean
}

export interface AgingBucket {
  label: AgingLabel
  amount: number
}

export interface StatementCustomer {
  name: string
  address: string[]
  tel: string
}

export interface Statement {
  accountNo: string
  customer: StatementCustomer
  endedDate: string
  preparedBy: string
  preparedAt: string
  currency: string
  lines: StatementLine[]
  aging: AgingBucket[]
  /** Worst non-empty bucket — drives the badge on the SOA card. */
  agingLabel: AgingLabel
  outstanding: number
  /** Alias of `outstanding`, kept for the legacy print template. */
  total: number
  jobIds: string[]
  jobCount: number
  /** Jobs on the account that have not been delivered yet. */
  openJobs: number
}

/* ------------------------------------------------------------------ money */

export function moneySGD(n: number, currency = 'SGD'): string {
  return `${currency} ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** dd/mm/yyyy in Asia/Singapore — the format accounts already prints. */
export function formatSgDate(input: string | Date = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d)
}

/* ----------------------------------------------------------- account keys */

/** Small stable hash so unknown companies still get deterministic numbers. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Seeded accounts keep the numbers accounts already recognise. */
const ACCOUNT_NOS: Record<string, string> = {
  'Titan Associates Pte Ltd': '12011',
  'Allmighty Foods Pte Ltd': '12034',
  'Hey Fran': '12047',
  Mecha: '12052'
}

export function accountNoFor(name: string): string {
  return ACCOUNT_NOS[name] ?? String(12060 + (hash(name) % 900))
}

const ADDRESSES: Record<string, StatementCustomer> = {
  'Titan Associates Pte Ltd': {
    name: 'Titan Associates Pte Ltd',
    address: ['201 Henderson Road', '#07-25 Apex@Henderson', 'Singapore 159545'],
    tel: '9339 9151'
  },
  'Allmighty Foods Pte Ltd': {
    name: 'Allmighty Foods Pte Ltd',
    address: ['6 Senoko South Road', '#03-11 Senoko Food Hub', 'Singapore 758097'],
    tel: '6752 4180'
  },
  'Hey Fran': {
    name: 'Hey Fran',
    address: ['18 Kaki Bukit Avenue 1', '#05-12 Scitech Building', 'Singapore 417941'],
    tel: '8123 4470'
  },
  Mecha: {
    name: 'Mecha',
    address: ['994 Bendemeer Road', '#04-05 B-Central', 'Singapore 339943'],
    tel: '6291 8822'
  }
}

function customerFor(name: string): StatementCustomer {
  return ADDRESSES[name] ?? { name, address: ['Singapore'], tel: '6221 2218' }
}

/**
 * The account a job belongs to. B2C last-mile legs are booked *by* an account
 * (the job id carries its suffix, e.g. MP-7302-AF) but carry the consignee as
 * the contact, so fall back to the suffix before inventing an account for a
 * private recipient.
 */
function jobSuffix(id: string): string {
  const parts = id.split('-')
  return parts.length > 2 ? parts[parts.length - 1]! : ''
}

export function accountKeyOf(s: Shipment, suffixOwners: Record<string, string> = {}): string {
  if (s.company) return s.company
  const owner = suffixOwners[jobSuffix(s.id)]
  return owner ?? s.customerName
}

/* ------------------------------------------------------------- statements */

/** "MP-6220-AF · Busan CFS → Senoko Food Hub" — kept short enough to print. */
function remarkFor(s: Shipment): string {
  const short = (place: string) => {
    const parts = place.split(/[,→]/).map((p) => p.trim()).filter(Boolean)
    const last = parts[parts.length - 1] ?? place
    return last.length > 28 ? `${last.slice(0, 27)}…` : last
  }
  return `${s.id} · ${short(s.origin)} → ${short(s.destination)}`
}

/** No quote yet — show a plausible indicative figure so the account isn't blank. */
function indicativeAmount(s: Shipment): number {
  return 280 + (hash(s.id) % 10) * 40
}

const TITAN = 'Titan Associates Pte Ltd'

/** The two documents already on Titan's printed statement. */
function titanLegacyLines(): StatementLine[] {
  return [
    { date: '30/11/2022', docType: 'DN', docNo: '20356', remark: 'HYUNDAI DYNASTY/0110S', job: 'MP-9032-TA', debit: 289.02, credit: 0, balance: 289.02, status: 'Invoiced', bucket: '30 days' },
    { date: '30/11/2022', docType: 'IV', docNo: '291919', remark: 'HYUNDAI DYNASTY/0110S', job: 'MP-9032-TA', debit: 1005.00, credit: 0, balance: 1294.02, status: 'Invoiced', bucket: '30 days' }
  ]
}

export function buildStatements(shipments: Shipment[]): Statement[] {
  const list = shipments ?? []

  // job-id suffix -> account that books under it (MP-8102-AF -> Allmighty Foods)
  const suffixOwners: Record<string, string> = {}
  for (const s of list) {
    const suffix = jobSuffix(s.id)
    if (s.company && suffix && !suffixOwners[suffix]) suffixOwners[suffix] = s.company
  }

  const groups = new Map<string, Shipment[]>()
  for (const s of list) {
    const key = accountKeyOf(s, suffixOwners)
    const bucket = groups.get(key)
    if (bucket) bucket.push(s)
    else groups.set(key, [s])
  }

  const endedDate = formatSgDate()
  let docSeq = 0

  const statements: Statement[] = []

  for (const [name, jobs] of groups) {
    const sorted = [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const lines: StatementLine[] = name === TITAN ? titanLegacyLines() : []

    for (const s of sorted) {
      const lump = s.quote?.lumpSum
      if (!lump) continue
      lines.push({
        date: formatSgDate(s.createdAt),
        docType: 'IV',
        docNo: String(29200 + docSeq++ * 7),
        remark: remarkFor(s),
        job: s.id,
        debit: lump.amount,
        credit: 0,
        balance: 0,
        status: s.status === 'delivered' ? 'Invoiced' : 'Draft',
        bucket: 'Current'
      })
    }

    // Every account on the job book gets a statement, even before a quote lands.
    if (!lines.length && sorted.length) {
      const s = sorted[sorted.length - 1]!
      lines.push({
        date: formatSgDate(s.createdAt),
        docType: 'IV',
        docNo: String(29200 + docSeq++ * 7),
        remark: `${s.id} · Indicative — quote pending`,
        job: s.id,
        debit: indicativeAmount(s),
        credit: 0,
        balance: 0,
        status: 'Draft',
        bucket: 'Current',
        indicative: true
      })
    }

    let running = 0
    for (const l of lines) {
      running = Math.round((running + l.debit - l.credit) * 100) / 100
      l.balance = running
    }

    const aging: AgingBucket[] = AGING_LABELS.map((label) => ({
      label,
      amount: Math.round(lines.filter((l) => l.bucket === label).reduce((sum, l) => sum + l.debit - l.credit, 0) * 100) / 100
    }))
    const worst = [...aging].reverse().find((b) => b.amount > 0)
    const outstanding = running

    statements.push({
      accountNo: accountNoFor(name),
      customer: customerFor(name),
      endedDate,
      preparedBy: 'ROBOT',
      preparedAt: `${endedDate} 09:05`,
      currency: sorted.find((s) => s.quote?.lumpSum)?.quote?.lumpSum?.currency ?? 'SGD',
      lines,
      aging,
      agingLabel: worst?.label ?? 'Current',
      outstanding,
      total: outstanding,
      jobIds: sorted.map((s) => s.id),
      jobCount: sorted.length,
      openJobs: sorted.filter((s) => s.status !== 'delivered').length
    })
  }

  return statements.sort((a, b) => b.outstanding - a.outstanding)
}

export function findStatement(shipments: Shipment[], id: string): Statement | undefined {
  return buildStatements(shipments).find((s) => s.accountNo === String(id))
}
