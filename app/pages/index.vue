<script setup lang="ts">
import {
  CLAIM_LABELS,
  CUSTOMS_LABELS,
  docsDone,
  isNoiseMail,
  mailDirectionOf,
  mailFromOf,
  mailKindOf,
  mailToOf,
  STATUS_LABELS,
  type OutboxEmail,
  type Shipment
} from '#shared/utils/shipping'

const { data: shipments, refresh: refreshShipments } = await useFetch<Shipment[]>('/api/shipments')
const { data: emails, refresh: refreshEmails } = await useFetch<OutboxEmail[]>('/api/emails')

const route = useRoute()
const showForm = ref(false)
const creating = ref(false)
const toast = ref('')
const openEmail = ref<string | null>(null)
const openMore = ref<string | null>(null)
const showNoise = ref(false)
const showAllMail = ref(false)
const showSecondary = ref(false)

// ?job=MP-4471-AF opens that job's panel on load; ?mail= is the old spelling.
const openJob = ref<string | null>(
  ((route.query.job as string) || (route.query.mail as string) || '').toUpperCase() || null
)

type AttnKey = 'customs_docs' | 'ready_decl' | 'signoff' | 'claims' | 'proof'
const filter = ref<AttnKey | null>(null)

const form = reactive({
  mode: 'b2c',
  customerName: '',
  customerEmail: '',
  company: '',
  poNumber: '',
  incoterms: 'DAP',
  origin: '',
  destination: '',
  eta: '',
  driverName: '',
  driverPhone: '',
  vehicle: '',
  pieces: 1,
  weightKg: 10,
  description: ''
})

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    refreshShipments()
    refreshEmails()
  }, 5000)
  if (openJob.value) {
    nextTick(() => {
      document.getElementById(`job-${openJob.value}`)?.scrollIntoView({ block: 'center' })
    })
  }
})
onUnmounted(() => clearInterval(timer))

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2400)
}

async function copyLink(id: string) {
  const url = `${location.origin}/track/${id}`
  await navigator.clipboard.writeText(url)
  flash('Tracking link copied — paste it into WhatsApp or email')
}

async function refreshAll() {
  await Promise.all([refreshShipments(), refreshEmails()])
}

async function createShipment() {
  creating.value = true
  try {
    await $fetch('/api/shipments', { method: 'POST', body: { ...form } })
    showForm.value = false
    Object.assign(form, {
      customerName: '', customerEmail: '', company: '', poNumber: '',
      origin: '', destination: '', eta: '', driverName: '', driverPhone: '', vehicle: '',
      pieces: 1, weightKg: 10, description: ''
    })
    await refreshAll()
    flash('Shipment created — tracking email sent to customer')
  } catch (e: unknown) {
    const anyErr = e as { data?: { statusMessage?: string } }
    flash(anyErr?.data?.statusMessage ?? 'Could not create shipment')
  } finally {
    creating.value = false
  }
}

/* ── job classification ─────────────────────────────────── */

function hasOpenClaim(s: Shipment) {
  return s.claim?.status === 'open'
}
function customsDocsOutstanding(s: Shipment) {
  return s.customs?.status === 'docs_pending'
}
function readyForDeclaration(s: Shipment) {
  return s.customs?.status === 'ready_for_declaration'
}
function awaitingSignoff(s: Shipment) {
  return !s.signoff && (s.status === 'out_for_delivery' || s.status === 'delivered')
}
function proofToVerify(s: Shipment) {
  return !!s.review?.screenshot && !s.review?.reward
}

const MATCH: Record<AttnKey, (s: Shipment) => boolean> = {
  customs_docs: customsDocsOutstanding,
  ready_decl: readyForDeclaration,
  signoff: awaitingSignoff,
  claims: hasOpenClaim,
  proof: proofToVerify
}

const TILES: Array<{ key: AttnKey; label: string; hint: string }> = [
  { key: 'claims', label: 'Open claims', hint: 'review ask held' },
  { key: 'customs_docs', label: 'Customs docs outstanding', hint: 'cannot declare yet' },
  { key: 'ready_decl', label: 'Ready for declaration', hint: 'officer files on TradeNet' },
  { key: 'signoff', label: 'Awaiting sign-off', hint: 'no POD yet' },
  { key: 'proof', label: 'Proof to verify', hint: 'voucher waiting' }
]

const tiles = computed(() =>
  TILES.map((t) => ({ ...t, n: (shipments.value ?? []).filter(MATCH[t.key]).length }))
)

/** Attention first: claims, then customs, then sign-off, then live jobs, then done. */
function attentionRank(s: Shipment): number {
  if (hasOpenClaim(s)) return 0
  if (customsDocsOutstanding(s) || readyForDeclaration(s)) return 1
  if (awaitingSignoff(s)) return 2
  if (s.status !== 'delivered' && s.customs) return 3
  if (s.status !== 'delivered') return 4
  return 5
}

const jobs = computed(() => {
  const list = [...(shipments.value ?? [])]
  const filtered = filter.value ? list.filter(MATCH[filter.value]) : list
  return filtered.sort(
    (a, b) => attentionRank(a) - attentionRank(b) || b.createdAt.localeCompare(a.createdAt)
  )
})

function toggleFilter(key: AttnKey) {
  filter.value = filter.value === key ? null : key
  if (import.meta.client) {
    document.getElementById('ops-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function statusPill(s: Shipment) {
  if (s.status === 'delivered') return 'pill-green'
  if (s.status === 'out_for_delivery') return 'pill-amber'
  return 'pill-blue'
}

function customsPill(s: Shipment): { label: string; cls: string } | null {
  const c = s.customs
  if (!c) return null
  if (c.status === 'docs_pending') return { label: 'Customs: docs pending', cls: 'pill-amber' }
  if (c.status === 'ready_for_declaration') return { label: 'Ready for declaration', cls: 'pill-blue' }
  if (c.status === 'declared') {
    const who = (c.declaredBy ?? '').split(' ')[0]
    return { label: `Declared on TradeNet${who ? ` · ${who}` : ''}`, cls: 'pill-green' }
  }
  return { label: CUSTOMS_LABELS.cleared, cls: 'pill-green' }
}

function reviewPill(s: Shipment): { label: string; cls: string } | null {
  if (s.review) return { label: `★ ${s.review.rating}/5`, cls: 'pill-amber' }
  const st = s.reviewAsk?.state
  if (st === 'sent') return { label: 'Review sent', cls: 'pill-gray' }
  if (st === 'held') return { label: 'Review held', cls: 'pill-amber' }
  return null
}

function clientLine(s: Shipment) {
  return s.mode === 'b2c' ? s.customerName : (s.company ?? s.customerName)
}

function toggleJob(id: string) {
  openJob.value = openJob.value === id ? null : id
  openMore.value = null
}

/* ── mail ───────────────────────────────────────────────── */

function mailFor(id: string): OutboxEmail[] {
  return (emails.value ?? []).filter((e) => e.shipmentId === id)
}

const byNewest = (a: OutboxEmail, b: OutboxEmail) => b.at.localeCompare(a.at)

const jobMail = computed(() =>
  (emails.value ?? []).filter((e) => e.shipmentId?.trim() && !isNoiseMail(e)).sort(byNewest)
)
const noiseMail = computed(() => (emails.value ?? []).filter(isNoiseMail).sort(byNewest))
const visibleMail = computed(() => (showAllMail.value ? jobMail.value : jobMail.value.slice(0, 8)))

const KIND_LABELS: Record<string, string> = {
  tracking: 'Tracking',
  review: 'Review request',
  reward: 'Voucher',
  inbound: 'Inbound',
  reply: 'Reply',
  message: 'Asked via tracking',
  status: 'Status',
  cs: 'CS'
}
function kindLabel(e: OutboxEmail) {
  return KIND_LABELS[mailKindOf(e)] ?? 'CS'
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function openJobFromMail(id: string) {
  openJob.value = id
  if (import.meta.client) {
    nextTick(() => document.getElementById(`job-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
}
</script>

<template>
  <div>
    <TopBar role="Customer Service view" nav="cs" />
    <main class="page wide">
      <div class="card ops-head">
        <div class="row spread">
          <div>
            <h2>Operations</h2>
            <p class="sub" style="margin-bottom: 0">
              Every job, its documents, its claims and its mail in one place.
            </p>
          </div>
          <button class="btn btn-primary" @click="showForm = !showForm">
            {{ showForm ? 'Close' : '+ New shipment' }}
          </button>
        </div>

        <div class="ops-attn">
          <button
            v-for="t in tiles"
            :key="t.key"
            class="kpi clickable"
            :class="{ on: filter === t.key, zero: t.n === 0 }"
            type="button"
            @click="toggleFilter(t.key)"
          >
            <div class="n">{{ t.n }}</div>
            <div class="l">{{ t.label }}</div>
            <div class="hint">{{ t.hint }}</div>
          </button>
        </div>

        <form v-if="showForm" style="margin-top: 18px" @submit.prevent="createShipment">
          <div class="row" style="margin-bottom: 14px">
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2c" /> B2C (consumer)
            </label>
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2b" /> B2B (business)
            </label>
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2self" /> B2SELF (own outlets / internal transfer)
            </label>
          </div>

          <div class="form-grid">
            <label class="field"><span>Customer name *</span>
              <input v-model="form.customerName" type="text" required placeholder="Daniel Wong" />
            </label>
            <label class="field"><span>Customer email *</span>
              <input v-model="form.customerEmail" type="email" required placeholder="daniel@example.com" />
            </label>
            <template v-if="form.mode === 'b2b'">
              <label class="field"><span>Company</span>
                <input v-model="form.company" type="text" placeholder="Allmighty Foods Pte Ltd" />
              </label>
              <label class="field"><span>PO number</span>
                <input v-model="form.poNumber" type="text" placeholder="PO-4471" />
              </label>
              <label class="field"><span>Incoterms</span>
                <select v-model="form.incoterms">
                  <option>EXW</option><option>FOB</option><option>CIF</option>
                  <option>DAP</option><option>DDP</option>
                </select>
              </label>
            </template>
            <template v-else-if="form.mode === 'b2self'">
              <label class="field"><span>Brand / company</span>
                <input v-model="form.company" type="text" placeholder="Hey Fran" />
              </label>
              <label class="field"><span>Transfer reference</span>
                <input v-model="form.poNumber" type="text" placeholder="TRF-0219" />
              </label>
            </template>
            <label class="field"><span>Origin *</span>
              <input v-model="form.origin" type="text" required placeholder="Senoko Food Hub, Singapore" />
            </label>
            <label class="field"><span>Destination *</span>
              <input v-model="form.destination" type="text" required placeholder="Tuas, Singapore" />
            </label>
            <label class="field"><span>ETA</span>
              <input v-model="form.eta" type="datetime-local" />
            </label>
            <label class="field"><span>Driver</span>
              <input v-model="form.driverName" type="text" placeholder="Hafiz Rahman" />
            </label>
            <label class="field"><span>Driver mobile (their portal login)</span>
              <input v-model="form.driverPhone" type="tel" placeholder="9123 4567" />
            </label>
            <label class="field"><span>Vehicle</span>
              <input v-model="form.vehicle" type="text" placeholder="14-ft lorry — GBC 4521 K" />
            </label>
            <label class="field"><span>Pieces</span>
              <input v-model.number="form.pieces" type="number" min="1" />
            </label>
            <label class="field"><span>Weight (kg)</span>
              <input v-model.number="form.weightKg" type="number" min="0" />
            </label>
            <label class="field full"><span>Cargo description *</span>
              <input v-model="form.description" type="text" required placeholder="Household goods — fragile" />
            </label>
          </div>
          <button class="btn btn-primary" type="submit" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create & send tracking link' }}
          </button>
        </form>
      </div>

      <div class="layout cols-2">
        <div>
          <div id="ops-jobs" class="card">
            <div class="row spread">
              <h2>
                Jobs
                <span class="pill pill-gray">{{ jobs.length }}</span>
              </h2>
              <div class="row" style="gap: 8px">
                <button v-if="filter" class="btn btn-ghost" @click="filter = null">Clear filter</button>
                <NuxtLink class="btn btn-outline" to="/driver">🚚 Driver portal</NuxtLink>
              </div>
            </div>
            <p class="sub">Sorted by what needs a person: claims, customs, sign-off, then everything running.</p>

            <p v-if="!jobs.length" class="dash-empty">No jobs match this filter.</p>

            <div v-for="s in jobs" :id="`job-${s.id}`" :key="s.id" class="shipment-block ops-job" :class="{ open: openJob === s.id }">
              <div class="shipment-row">
                <div class="ops-job-main">
                  <div class="row ops-pills">
                    <span class="id">{{ s.id }}</span>
                    <span class="pill" :class="statusPill(s)">{{ STATUS_LABELS[s.status] }}</span>
                    <span class="pill pill-gray">{{ s.mode.toUpperCase() }}</span>
                    <span
                      v-if="s.documents?.length"
                      class="pill"
                      :class="docsDone(s).done === docsDone(s).total ? 'pill-green' : 'pill-amber'"
                    >Docs {{ docsDone(s).done }}/{{ docsDone(s).total }}</span>
                    <span v-if="customsPill(s)" class="pill" :class="customsPill(s)!.cls">{{ customsPill(s)!.label }}</span>
                    <span v-if="s.claim?.status === 'open'" class="pill ops-pill-red">
                      {{ CLAIM_LABELS[s.claim.type] }}
                    </span>
                    <span v-if="reviewPill(s)" class="pill" :class="reviewPill(s)!.cls">{{ reviewPill(s)!.label }}</span>
                    <span
                      v-if="mailFor(s.id).length"
                      class="pill"
                      :class="openJob === s.id ? 'pill-blue' : 'pill-gray'"
                    >Mail {{ mailFor(s.id).length }}</span>
                  </div>
                  <div class="route">
                    {{ s.origin }} → {{ s.destination }} · {{ clientLine(s) }}
                    <template v-if="s.service"> · {{ s.service }}</template>
                  </div>
                </div>
                <div class="actions">
                  <button class="btn" :class="openJob === s.id ? 'btn-primary' : 'btn-outline'" @click="toggleJob(s.id)">
                    {{ openJob === s.id ? 'Close' : 'Open' }}
                  </button>
                  <button class="btn btn-outline" @click="copyLink(s.id)">Copy tracking link</button>
                  <button
                    class="btn btn-ghost ops-more-btn"
                    :aria-expanded="openMore === s.id"
                    :title="`More links for ${s.id}`"
                    @click="openMore = openMore === s.id ? null : s.id"
                  >More ▾</button>
                </div>
              </div>

              <div v-if="openMore === s.id" class="row ops-more">
                <NuxtLink class="btn btn-outline" :to="`/track/${s.id}`">Customer view</NuxtLink>
                <NuxtLink class="btn btn-outline" :to="`/driver/${s.id}`">Driver view</NuxtLink>
                <NuxtLink v-if="s.quote" class="btn btn-outline" :to="`/quote/${s.id}`">Quote</NuxtLink>
              </div>

              <OpsJobPanel
                v-if="openJob === s.id"
                :shipment="s"
                :emails="mailFor(s.id)"
                @refresh="refreshAll()"
              />
            </div>
          </div>
        </div>

        <div>
          <div class="card ops-inbox">
            <div class="row spread">
              <h2>Inbox <span class="pill pill-green">job-tied</span></h2>
              <button v-if="jobMail.length > 8" class="btn btn-ghost" @click="showAllMail = !showAllMail">
                {{ showAllMail ? 'Show latest' : `Show all ${jobMail.length}` }}
              </button>
            </div>
            <p class="sub">Every mail already attached to its job — no ticket to open, no thread to hunt for.</p>

            <p v-if="!jobMail.length" class="dash-empty">No job mail yet.</p>

            <div v-for="e in visibleMail" :key="e.id" class="ops-mail">
              <div class="ops-mail-head" @click="openEmail = openEmail === e.id ? null : e.id">
                <div class="ops-mail-body">
                  <div class="row ops-pills">
                    <span class="pill" :class="mailDirectionOf(e) === 'in' ? 'pill-amber' : 'pill-blue'">
                      {{ mailDirectionOf(e) === 'in' ? 'In' : 'Out' }}
                    </span>
                    <span class="pill pill-gray">{{ kindLabel(e) }}</span>
                    <button class="ops-joblink" @click.stop="openJobFromMail(e.shipmentId)">{{ e.shipmentId }}</button>
                  </div>
                  <div class="subject">{{ e.subject }}</div>
                  <div class="meta">
                    From {{ mailFromOf(e) }} · To {{ mailToOf(e) || '—' }} · {{ when(e.at) }}
                  </div>
                </div>
                <span class="muted">{{ openEmail === e.id ? '▲' : '▼' }}</span>
              </div>
              <pre v-if="openEmail === e.id">{{ e.body }}</pre>
            </div>

            <div v-if="noiseMail.length" class="ops-noise">
              <button class="ops-noise-head" @click="showNoise = !showNoise">
                <span>Not on a job · {{ noiseMail.length }}</span>
                <span class="muted">PickleSprout, newsletters, vendors {{ showNoise ? '▲' : '▼' }}</span>
              </button>
              <div v-if="showNoise" class="ops-noise-list">
                <div v-for="e in noiseMail" :key="e.id" class="ops-mail muted-row">
                  <div class="row ops-pills">
                    <span class="pill pill-gray">Not freight</span>
                    <span class="pill pill-amber">In</span>
                  </div>
                  <div class="subject">{{ e.subject }}</div>
                  <div class="meta">From {{ mailFromOf(e) }} · {{ when(e.at) }}</div>
                </div>
              </div>
            </div>
          </div>

          <RewardsDashboard compact />
        </div>
      </div>

      <div class="card ops-secondary">
        <div class="row spread">
          <div>
            <h2>Rate cards, billing, MCP &amp; rollout</h2>
            <p class="sub" style="margin-bottom: 0">Reference material — not day-to-day job work.</p>
          </div>
          <button class="btn btn-outline" @click="showSecondary = !showSecondary">
            {{ showSecondary ? 'Hide' : 'Show' }}
          </button>
        </div>

        <div v-if="showSecondary" class="layout cols-2" style="margin-top: 16px">
          <div>
            <div class="card">
              <h2>Frequent lanes <span class="pill pill-gray">rate cards</span></h2>
              <div class="shipment-row">
                <div>
                  <div class="id">Shanghai / Shenzhen → Singapore</div>
                  <div class="route">LCL consolidation · standing rate card</div>
                </div>
                <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-CN-LCL">View rates</NuxtLink></div>
              </div>
              <div class="shipment-row">
                <div>
                  <div class="id">Busan → Singapore</div>
                  <div class="route">LCL · last quoted for Allmighty Foods (QT-6220, under discussion)</div>
                </div>
                <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-6220">View quote</NuxtLink></div>
              </div>
              <div class="shipment-row">
                <div>
                  <div class="id">Busan → Singapore</div>
                  <div class="route">FCL 20' · last used by Allmighty Foods (QT-2481, shipment in transit)</div>
                </div>
                <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-2481">View quote</NuxtLink></div>
              </div>
              <div class="shipment-row">
                <div>
                  <div class="id">Hong Kong → Singapore</div>
                  <div class="route">LCL · last used by Mecha (QT-3318, shipment on the water)</div>
                </div>
                <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-3318">View quote</NuxtLink></div>
              </div>
            </div>

            <div class="card">
              <h2>Billing <span class="pill pill-gray">SOA</span></h2>
              <div class="shipment-row">
                <div>
                  <div class="id">Titan Associates Pte Ltd</div>
                  <div class="route">Statement of account · ended 08/12/2022 · SGD 1,294.02 outstanding</div>
                </div>
                <div class="actions"><NuxtLink class="btn btn-outline" to="/statement/12011">View statement</NuxtLink></div>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <h2>Ask AI about your shipments <span class="pill pill-blue">MCP</span></h2>
              <p class="sub">
                Connect Claude (or any MCP client) and ask "what's the status of my Busan container?"
                or "what documents am I still missing?" in plain English.
              </p>
              <pre class="ops-code">https://mnp-flow.vercel.app/mcp?key=mp-demo-2481</pre>
              <p class="muted" style="margin: 0">
                claude.ai → Settings → Connectors → Add custom connector → paste the URL.
                Tools: shipment list, full shipment status, outstanding actions.
              </p>
            </div>

            <div class="card">
              <h2>Rollout plan</h2>
              <p class="sub">Today CS types every update by email. We automate in phases:</p>
              <ul class="timeline" style="margin-top: 4px">
                <li>
                  <div class="what">Phase 1 — tracking link &amp; notifications <span class="pill pill-green">live</span></div>
                  <div class="note">Booking sends the email and the live tracking link. No more manual "here are your shipping details".</div>
                </li>
                <li>
                  <div class="what">Phase 2 — driver updates <span class="pill pill-green">live</span></div>
                  <div class="note">Photos and status from the driver's phone, straight onto the customer's timeline.</div>
                </li>
                <li>
                  <div class="what">Phase 3 — e-sign POD &amp; reviews <span class="pill pill-green">live</span></div>
                  <div class="note">Customer signs off on their phone; the review request sends itself, and holds if a claim is open.</div>
                </li>
                <li>
                  <div class="what">Phase 4 — customs intake, human TradeNet filing <span class="pill pill-blue">this demo</span></div>
                  <div class="note">Document checklist per job, "ready for declaration", then an M&amp;P customs officer files on TradeNet and records the permit.</div>
                </li>
                <li class="minor">
                  <div class="what">Phase 5 — planned</div>
                  <div class="note">48-hour review reminder for customers who did not reply the first time.</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style>
/* ── attention strip ── */
.ops-attn {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 16px;
}
@media (max-width: 1023px) { .ops-attn { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 560px) { .ops-attn { grid-template-columns: repeat(2, 1fr); } }
.ops-attn .kpi.zero { opacity: 0.55; }
.ops-attn .kpi.zero:hover { opacity: 1; }
.ops-attn .kpi .l { line-height: 1.3; }

/* ── job rows ── */
.ops-job.open { background: #fffaf6; margin: 0 -8px; padding: 0 8px; border-radius: 10px; }
.ops-job .ops-job-main { flex: 1; min-width: 0; }
.ops-job .ops-pills { gap: 6px; row-gap: 6px; }
.ops-more { gap: 8px; padding: 0 0 12px; }
.ops-more-btn { border: 1px solid var(--line); }
.pill.ops-pill-red { background: #fee2e2; color: #b91c1c; }

/* ── inbox ── */
.ops-inbox .ops-mail {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 11px;
  margin-bottom: 8px;
  background: #fbfcfe;
}
.ops-inbox .ops-mail-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: space-between;
  cursor: pointer;
}
.ops-inbox .ops-mail-body { min-width: 0; }
.ops-inbox .ops-pills { gap: 6px; margin-bottom: 3px; }
.ops-inbox .subject { font-weight: 600; font-size: 13px; }
.ops-inbox .meta { font-size: 12px; color: var(--muted); word-break: break-word; }
.ops-inbox pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 12px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 11px;
  margin: 9px 0 0;
}
.ops-joblink {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--blue);
  cursor: pointer;
  text-decoration: underline;
}
.ops-noise { margin-top: 12px; }
.ops-noise-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: #f7f8fa;
  padding: 9px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
  text-align: left;
}
.ops-noise-list { margin-top: 8px; }
.ops-inbox .ops-mail.muted-row { background: #f7f8fa; }
.ops-inbox .ops-mail.muted-row .subject { font-weight: 600; color: var(--muted); }

/* ── secondary strip ── */
.ops-secondary > .layout > div > .card:last-child { margin-bottom: 0; }
.ops-code {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  background: #fbfcfe;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 10px;
}

@media (max-width: 640px) {
  .ops-job .shipment-row .actions { margin-left: 0; width: 100%; }
  .ops-job .shipment-row .actions .btn { flex: 1; }
}
</style>
