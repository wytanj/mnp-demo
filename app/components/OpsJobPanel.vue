<script setup lang="ts">
import {
  CLAIM_LABELS,
  CLAIM_TYPES,
  CUSTOMS_LABELS,
  customsDocs,
  customsReady,
  docsDone,
  type ClaimType,
  type OutboxEmail,
  type Shipment
} from '#shared/utils/shipping'

const props = defineProps<{ shipment: Shipment; emails: OutboxEmail[] }>()
const emit = defineEmits<{ refresh: [] }>()

const s = computed(() => props.shipment)
const customs = computed(() => s.value.customs)
const docs = computed(() => docsDone(s.value))
const ready = computed(() => customsReady(s.value))
const outstanding = computed(() =>
  customsDocs(s.value).filter((d) => d.required && d.status !== 'approved')
)

const busy = ref('')
const err = ref('')
const note = ref('')

const officer = ref('Joreen (M&P Customs)')
const permitNo = ref('')
const declareForm = ref(false)
const clearForm = ref(false)

const claimForm = ref(false)
const claimType = ref<ClaimType>('damage')
const claimNote = ref('')
const resolveNote = ref('')

const openClaim = computed(() => (s.value.claim?.status === 'open' ? s.value.claim : null))

async function post(url: string, body: Record<string, unknown>, tag: string, ok: string) {
  busy.value = tag
  err.value = ''
  note.value = ''
  try {
    await $fetch(url, { method: 'POST', body })
    note.value = ok
    emit('refresh')
    return true
  } catch (e: unknown) {
    const anyErr = e as { data?: { statusMessage?: string }; statusMessage?: string }
    err.value = anyErr?.data?.statusMessage ?? anyErr?.statusMessage ?? 'Could not save — try again'
    return false
  } finally {
    busy.value = ''
  }
}

function customsUrl() {
  return `/api/shipments/${s.value.id}/customs`
}
function claimUrl() {
  return `/api/shipments/${s.value.id}/claim`
}

async function markReady() {
  await post(customsUrl(), { action: 'mark_ready', by: officer.value }, 'ready', 'Marked ready — our customs officer files it on TradeNet next.')
}
async function markDeclared() {
  const done = await post(
    customsUrl(),
    { action: 'mark_declared', by: officer.value.trim(), permitNo: permitNo.value.trim() },
    'declared',
    `Recorded: declaration filed on TradeNet by ${officer.value.trim()}.`
  )
  if (done) {
    declareForm.value = false
    permitNo.value = ''
  }
}
async function markCleared() {
  const done = await post(
    customsUrl(),
    { action: 'mark_cleared', by: officer.value.trim() },
    'cleared',
    'Customs cleared — clearance notice emailed to the customer.'
  )
  if (done) clearForm.value = false
}

async function openAClaim() {
  const done = await post(
    claimUrl(),
    { action: 'open', type: claimType.value, note: claimNote.value.trim(), by: 'cs' },
    'claim-open',
    'Claim opened — the review request is held while it is open.'
  )
  if (done) {
    claimForm.value = false
    claimNote.value = ''
  }
}
async function resolveClaim() {
  const done = await post(
    claimUrl(),
    { action: 'resolve', note: resolveNote.value.trim() },
    'claim-resolve',
    'Claim resolved.'
  )
  if (done) resolveNote.value = ''
}

const CUSTOMS_PILL: Record<string, string> = {
  docs_pending: 'pill-amber',
  ready_for_declaration: 'pill-blue',
  declared: 'pill-green',
  cleared: 'pill-green'
}

const REVIEW_ASK_COPY: Record<string, { label: string; cls: string }> = {
  not_yet: { label: 'No review request yet', cls: 'pill-gray' },
  sent: { label: 'Review request sent', cls: 'pill-gray' },
  held: { label: 'Review request held', cls: 'pill-amber' },
  answered: { label: 'Review answered', cls: 'pill-green' }
}

function when(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function stars(n: number) {
  return [1, 2, 3, 4, 5].map((i) => ({ i, on: i <= n }))
}
</script>

<template>
  <div class="ops-panel">
    <p v-if="err" class="ops-msg err">{{ err }}</p>
    <p v-else-if="note" class="ops-msg ok">{{ note }}</p>

    <!-- ── Customs & documents ─────────────────────────────── -->
    <section v-if="s.documents?.length || customs" class="ops-sec">
      <div class="ops-sec-head">
        <h3>Customs &amp; documents</h3>
        <span class="pill" :class="docs.done === docs.total ? 'pill-green' : 'pill-amber'">
          Docs {{ docs.done }}/{{ docs.total }}
        </span>
        <span v-if="customs" class="pill" :class="CUSTOMS_PILL[customs.status]">
          {{ CUSTOMS_LABELS[customs.status] }}
        </span>
      </div>

      <div v-if="customs" class="ops-customs">
        <p class="ops-line">
          <template v-if="customs.status === 'docs_pending'">
            <strong>{{ outstanding.length }}</strong>
            document{{ outstanding.length === 1 ? '' : 's' }} still needed before we can declare<template v-if="outstanding.length">: {{ outstanding.map(d => d.label).join(', ') }}</template>.
          </template>
          <template v-else-if="customs.status === 'ready_for_declaration'">
            Documents checked. Waiting for an M&amp;P customs officer to file the declaration on TradeNet.
          </template>
          <template v-else-if="customs.status === 'declared'">
            Filed on TradeNet by <strong>{{ customs.declaredBy }}</strong> ({{ when(customs.declaredAt) }})<template v-if="customs.permitNo"> · permit <strong>{{ customs.permitNo }}</strong></template>.
          </template>
          <template v-else>
            Cleared {{ when(customs.clearedAt) }}<template v-if="customs.permitNo"> · permit {{ customs.permitNo }}</template>.
          </template>
        </p>
        <p class="ops-hint">
          TradeNet is filed by hand: M&amp;P's customs officer submits the declaration and records the permit here. Nothing is auto-submitted.
        </p>

        <div class="row ops-acts">
          <button
            v-if="customs.status === 'docs_pending'"
            class="btn btn-primary"
            :disabled="!ready || busy === 'ready'"
            :title="ready ? '' : 'All customs documents must be verified first'"
            @click="markReady()"
          >
            {{ busy === 'ready' ? 'Saving…' : 'Mark ready for declaration' }}
          </button>
          <button
            v-if="customs.status === 'docs_pending' || customs.status === 'ready_for_declaration'"
            class="btn"
            :class="customs.status === 'ready_for_declaration' ? 'btn-primary' : 'btn-outline'"
            :disabled="!ready"
            :title="ready ? '' : 'All customs documents must be verified first'"
            @click="declareForm = !declareForm"
          >
            Mark declared on TradeNet (manual)
          </button>
          <button
            v-if="customs.status === 'declared'"
            class="btn btn-primary"
            @click="clearForm = !clearForm"
          >
            Mark customs cleared
          </button>
        </div>

        <div v-if="declareForm" class="ops-form">
          <p class="ops-hint" style="margin-top: 0">
            Record who filed it. The permit number is typed in from TradeNet after our officer submits.
          </p>
          <div class="ops-form-grid">
            <label class="field"><span>M&amp;P customs officer *</span>
              <input v-model="officer" type="text" placeholder="Joreen (M&P Customs)" />
            </label>
            <label class="field"><span>Permit no (optional)</span>
              <input v-model="permitNo" type="text" placeholder="IN-2026-09-1147" />
            </label>
          </div>
          <div class="row">
            <button class="btn btn-primary" :disabled="!officer.trim() || busy === 'declared'" @click="markDeclared()">
              {{ busy === 'declared' ? 'Saving…' : 'Record declaration' }}
            </button>
            <button class="btn btn-ghost" @click="declareForm = false">Cancel</button>
          </div>
        </div>

        <div v-if="clearForm" class="ops-form">
          <p class="ops-hint" style="margin-top: 0">
            Clearance notice emails the customer once you confirm.
          </p>
          <label class="field"><span>Confirmed by *</span>
            <input v-model="officer" type="text" placeholder="Joreen (M&P Customs)" />
          </label>
          <div class="row">
            <button class="btn btn-primary" :disabled="!officer.trim() || busy === 'cleared'" @click="markCleared()">
              {{ busy === 'cleared' ? 'Saving…' : 'Confirm cleared' }}
            </button>
            <button class="btn btn-ghost" @click="clearForm = false">Cancel</button>
          </div>
        </div>
      </div>

      <DocumentChecklist
        v-if="s.documents?.length"
        :shipment="s"
        mode="cs"
        @refresh="emit('refresh')"
      />
    </section>

    <!-- ── Claims ──────────────────────────────────────────── -->
    <section class="ops-sec">
      <div class="ops-sec-head">
        <h3>Claims</h3>
        <span v-if="openClaim" class="pill ops-pill-red">{{ CLAIM_LABELS[openClaim.type] }} open</span>
        <span v-else-if="s.claim" class="pill pill-green">Resolved</span>
        <span v-else class="pill pill-gray">None</span>
      </div>

      <div v-if="openClaim" class="ops-claim">
        <div class="ops-claim-head">
          {{ CLAIM_LABELS[openClaim.type] }} · opened by {{ openClaim.openedBy }} · {{ when(openClaim.openedAt) }}
        </div>
        <p v-if="openClaim.note" class="ops-line">{{ openClaim.note }}</p>
        <p v-if="s.reviewAsk?.state === 'held'" class="ops-hint">
          Review request held while this claim is open — it sits with CS/claims, not with the review programme.
        </p>
        <div class="ops-form-grid">
          <label class="field full"><span>Resolution note (optional)</span>
            <input v-model="resolveNote" type="text" placeholder="Replacement cartons delivered, customer happy" />
          </label>
        </div>
        <button class="btn btn-success" :disabled="busy === 'claim-resolve'" @click="resolveClaim()">
          {{ busy === 'claim-resolve' ? 'Saving…' : 'Resolve claim' }}
        </button>
      </div>

      <template v-else>
        <p v-if="s.claim" class="ops-line">
          {{ CLAIM_LABELS[s.claim.type] }} resolved {{ when(s.claim.resolvedAt) }}<template v-if="s.claim.resolvedNote"> — {{ s.claim.resolvedNote }}</template>
        </p>
        <p v-else class="ops-empty">No claims on this job.</p>

        <button v-if="!claimForm" class="btn btn-outline" @click="claimForm = true">Open a claim</button>
        <div v-else class="ops-form">
          <div class="ops-form-grid">
            <label class="field"><span>Type</span>
              <select v-model="claimType">
                <option v-for="t in CLAIM_TYPES" :key="t" :value="t">{{ CLAIM_LABELS[t] }}</option>
              </select>
            </label>
            <label class="field"><span>What happened</span>
              <input v-model="claimNote" type="text" placeholder="2 of 8 cartons dented at corner" />
            </label>
          </div>
          <div class="row">
            <button class="btn btn-primary" :disabled="busy === 'claim-open'" @click="openAClaim()">
              {{ busy === 'claim-open' ? 'Saving…' : 'Open claim' }}
            </button>
            <button class="btn btn-ghost" @click="claimForm = false">Cancel</button>
          </div>
          <p class="ops-hint">Opening a claim stops any future review request on this job.</p>
        </div>
      </template>
    </section>

    <!-- ── Review & reward ─────────────────────────────────── -->
    <section class="ops-sec">
      <div class="ops-sec-head">
        <h3>Review &amp; reward</h3>
        <span
          class="pill"
          :class="REVIEW_ASK_COPY[s.reviewAsk?.state ?? 'not_yet']!.cls"
        >{{ REVIEW_ASK_COPY[s.reviewAsk?.state ?? 'not_yet']!.label }}</span>
      </div>

      <p class="ops-line">
        <template v-if="s.reviewAsk?.reason">{{ s.reviewAsk.reason }}.</template>
        <template v-else-if="s.reviewAsk?.state === 'sent'">
          Sent {{ when(s.reviewAsk.at) }} on {{ s.reviewAsk.trigger === 'customs_cleared' ? 'customs clearance' : 'delivery' }} — waiting on the customer.
        </template>
        <template v-else-if="s.reviewAsk?.state === 'answered'">Customer replied {{ when(s.reviewAsk.at) }}.</template>
        <template v-else>Goes out automatically once the job is delivered — unless a claim is open.</template>
      </p>

      <div v-if="s.review" class="ops-review">
        <div class="row" style="gap: 8px">
          <span class="star-row"><span v-for="st in stars(s.review.rating)" :key="st.i" :class="{ on: st.on }">★</span></span>
          <span v-for="p in s.review.platforms ?? []" :key="p" class="pill pill-gray">{{ p === 'google' ? 'Google' : 'Facebook' }}</span>
          <span v-if="s.review.reward" class="pill pill-green">Voucher {{ s.review.reward.code }}</span>
          <span v-else-if="s.review.screenshot" class="pill pill-amber">Proof to verify</span>
          <span v-else class="pill pill-gray">In-app only — no voucher</span>
        </div>
        <p v-if="s.review.comment" class="ops-line">“{{ s.review.comment }}”</p>
        <p v-if="s.review.helpedBy" class="ops-line"><strong>Named staff:</strong> {{ s.review.helpedBy }}</p>
      </div>

      <NuxtLink class="btn btn-outline" to="/rewards">Open rewards dashboard</NuxtLink>
    </section>

    <!-- ── Mail ────────────────────────────────────────────── -->
    <section class="ops-sec">
      <div class="ops-sec-head">
        <h3>Mail on this job</h3>
        <span class="pill pill-gray">{{ emails.length }}</span>
      </div>
      <ShipmentEmailLog :shipment="s" :emails="emails" />
    </section>
  </div>
</template>

<style>
.ops-panel {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-bottom: 14px;
}
.ops-panel .ops-sec {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  background: #fbfcfe;
}
.ops-panel .ops-sec:last-child { margin-bottom: 0; }
.ops-panel .ops-sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ops-panel .ops-sec-head h3 { margin: 0; font-size: 14px; }
.ops-panel .ops-line { font-size: 13px; margin: 0 0 8px; }
.ops-panel .ops-hint { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
.ops-panel .ops-empty { font-size: 13px; color: var(--muted); margin: 0 0 10px; }
.ops-panel .ops-acts { gap: 8px; margin-bottom: 4px; }
.ops-panel .ops-form {
  border: 1px dashed var(--line);
  border-radius: 10px;
  padding: 12px;
  margin-top: 10px;
  background: #fff;
}
.ops-panel .ops-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
.ops-panel .ops-form-grid .full { grid-column: 1 / -1; }
@media (max-width: 700px) {
  .ops-panel .ops-form-grid { grid-template-columns: 1fr; }
}
.ops-panel .ops-customs { margin-bottom: 12px; }
/* the checklist is already a card — flatten it inside the panel */
.ops-panel .ops-sec > .card {
  box-shadow: none;
  margin-bottom: 0;
  padding: 12px 14px;
}
.ops-panel .ops-claim {
  border: 1px solid #fecaca;
  background: #fef2f2;
  border-radius: 10px;
  padding: 12px 14px;
}
.ops-panel .ops-claim-head { font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #b91c1c; }
.ops-panel .ops-review {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  margin-bottom: 10px;
}
.ops-panel .ops-msg {
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  padding: 8px 12px;
  margin: 0 0 10px;
}
.ops-panel .ops-msg.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.ops-panel .ops-msg.ok { background: var(--green-soft); color: var(--green); border: 1px solid #bbf7d0; }
/* long addresses must not push the drawer sideways on a phone */
.ops-panel .mail-msg .meta,
.ops-panel .mail-log .pill { word-break: break-word; white-space: normal; }
.pill.ops-pill-red { background: #fee2e2; color: #b91c1c; }
</style>
