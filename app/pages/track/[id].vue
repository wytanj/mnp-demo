<script setup lang="ts">
import {
  CUSTOMS_LABELS,
  STATUS_LABELS,
  customsDocs,
  docsDone,
  type Shipment,
  type ShipmentDocument
} from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

// Customer-safe payload only: no contacts, no internal CS/AI notes, no mail.
const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/track/${id}`)

const jobId = computed(() => shipment.value?.id ?? id.toUpperCase())

const now = ref(Date.now())
const mounted = ref(false)
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  mounted.value = true
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
    refresh()
  }, 4000)
})
onUnmounted(() => clearInterval(timer))

/* ---------------- sign-off ---------------- */

const signerName = ref('')
const sigPad = ref<{ hasInk: boolean; toDataURL: () => string; clear: () => void }>()
const signing = ref(false)
const signError = ref('')

const canSignOff = computed(
  () =>
    !!shipment.value &&
    !shipment.value.signoff &&
    ['out_for_delivery', 'delivered'].includes(shipment.value.status)
)

async function submitSignoff() {
  signError.value = ''
  if (!signerName.value.trim()) {
    signError.value = 'Please enter your name.'
    return
  }
  if (!sigPad.value?.hasInk) {
    signError.value = 'Please sign in the box first.'
    return
  }
  signing.value = true
  try {
    await $fetch(`/api/shipments/${jobId.value}/signoff`, {
      method: 'POST',
      body: { name: signerName.value.trim(), signature: sigPad.value.toDataURL() }
    })
    await refresh()
  } catch (e: any) {
    signError.value = e?.data?.statusMessage ?? 'Sign-off failed, please try again.'
  } finally {
    signing.value = false
  }
}

/* ---------------- time helpers ---------------- */

function fmtWhen(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function relFromNow(iso: string): string {
  const ms = new Date(iso).getTime() - now.value
  if (ms <= 0) return ''
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `in ${mins} min`
  const hours = Math.floor(mins / 60)
  const restMin = mins % 60
  if (hours < 24) return restMin ? `in ${hours} h ${restMin} min` : `in ${hours} h`
  const days = Math.floor(hours / 24)
  const restH = hours % 24
  return restH ? `in ${days} d ${restH} h` : `in ${days} d`
}

const events = computed(() => shipment.value?.events ?? [])

const latestEventAt = computed(() =>
  events.value.reduce((acc, e) => (e.at > acc ? e.at : acc), '')
)

/** Delivered time comes from the delivery itself, never from a stale ETA. */
const deliveredAt = computed(() => {
  const s = shipment.value
  if (!s) return ''
  const hit = events.value
    .filter((e) => (e.type === 'status' && e.status === 'delivered') || e.type === 'signoff')
    .sort((a, b) => b.at.localeCompare(a.at))[0]
  return hit?.at ?? s.signoff?.at ?? s.eta
})

const etaState = computed<'delivered' | 'future' | 'passed'>(() => {
  const s = shipment.value
  if (!s) return 'future'
  if (s.status === 'delivered') return 'delivered'
  return new Date(s.eta).getTime() > now.value ? 'future' : 'passed'
})

const etaRelative = computed(() => (shipment.value ? relFromNow(shipment.value.eta) : ''))

/* ---------------- claim / docs / customs ---------------- */

const openClaim = computed(() =>
  shipment.value?.claim?.status === 'open' ? shipment.value.claim : null
)

const docs = computed<ShipmentDocument[]>(() => shipment.value?.documents ?? [])
const docCount = computed(() => (shipment.value ? docsDone(shipment.value) : { done: 0, total: 0 }))
const customsDocList = computed(() => (shipment.value ? customsDocs(shipment.value) : []))
const hasCustomsDocs = computed(() => customsDocList.value.length > 0)

/** Required documents still sitting with the customer (the permit is ours). */
const pendingDocs = computed(() =>
  docs.value.filter((d) => d.required && d.status === 'pending' && d.key !== 'permit')
)
const pendingCustomsDocs = computed(() =>
  pendingDocs.value.filter((d) => d.category === 'customs')
)

const CUSTOMS_CHIPS = [
  'Documents',
  'Declaration — M&P files on TradeNet',
  'Permit',
  'Cleared'
]

const customsStage = computed(() => {
  switch (shipment.value?.customs?.status) {
    case 'ready_for_declaration': return 1
    case 'declared': return 2
    case 'cleared': return 3
    default: return 0
  }
})

const FILED_MANUALLY = "Filed manually by M&P's customs team on TradeNet"

const customsNote = computed(() => {
  const c = shipment.value?.customs
  if (!c) return ''
  const permit = c.permitNo ? ` · permit ${c.permitNo}` : ''
  const by = c.declaredBy ? ` by ${c.declaredBy}` : ''
  switch (c.status) {
    case 'docs_pending': {
      const n = pendingCustomsDocs.value.length
      const need = n
        ? `${n} document${n === 1 ? '' : 's'} still needed from you. `
        : 'Documents are being checked. '
      return `${need}Once everything is in, M&P's customs team files the declaration manually on TradeNet — nothing is auto-submitted.`
    }
    case 'ready_for_declaration':
      return "All documents checked. M&P's customs team files the declaration manually on TradeNet — nothing is auto-submitted."
    case 'declared':
      return `${FILED_MANUALLY}${by}${permit}.`
    case 'cleared':
      return `Cleared by Singapore Customs${permit}. ${FILED_MANUALLY}${by}.`
    default:
      return ''
  }
})

/* ---------------- "what's next" ---------------- */

/** "Commercial invoice" → "commercial invoice", but "GST advice" keeps its caps. */
function softLower(label: string): string {
  const first = label.split(' ')[0] ?? ''
  if (first.length > 1 && first === first.toUpperCase()) return label
  return label.charAt(0).toLowerCase() + label.slice(1)
}

function docList(list: ShipmentDocument[]): string {
  return list.map((d) => softLower(d.label)).join(', ')
}

/** Latest driver/status note — "3 stops away, Bedok North area". */
const latestStatusNote = computed(() => {
  const hit = events.value
    .filter((e) => e.type === 'status' && e.note)
    .sort((a, b) => b.at.localeCompare(a.at))[0]
  return hit?.note ?? ''
})

const whatsNext = computed(() => {
  const s = shipment.value
  if (!s) return ''

  if (openClaim.value) {
    return "We're resolving your claim first — a CS colleague will follow up by email."
  }

  const pc = pendingCustomsDocs.value
  if (pc.length) {
    return `${pc.length} document${pc.length === 1 ? '' : 's'} needed from you before we can declare customs — ${docList(pc)}.`
  }

  if (canSignOff.value && s.status === 'out_for_delivery') {
    const detail = latestStatusNote.value ? `${latestStatusNote.value} — ` : ''
    return `Driver ${s.driverName} is on the way. ${detail}please be ready to sign.`
  }

  if (s.status === 'delivered') {
    if (!s.signoff) return 'Delivered — please confirm receipt with a signature below.'
    if (s.review) return 'Delivered and signed off. Thank you for the review.'
    if (s.reviewAsk?.state === 'sent') {
      return 'Delivered and signed off — tell us how we did when you have a minute.'
    }
    return 'Delivered and signed off. Nothing further needed from you.'
  }

  const c = s.customs
  if (c?.status === 'declared') {
    return `Customs declared by M&P · onward to ${s.destination}.`
  }
  if (c?.status === 'cleared') {
    return `Customs cleared · onward to ${s.destination}.`
  }
  if (c?.status === 'ready_for_declaration') {
    return "All documents are in — M&P's customs team files the declaration on TradeNet next."
  }

  if (pendingDocs.value.length) {
    const n = pendingDocs.value.length
    return `${n} document${n === 1 ? '' : 's'} still needed from you — ${docList(pendingDocs.value)}.`
  }

  if (s.status === 'in_transit') return `In transit to ${s.destination}.`
  if (s.status === 'picked_up') return `Collected — on the way to ${s.destination}.`
  return 'Booking confirmed — we will update you the moment the cargo moves.'
})

/* ---------------- action-needed uploads ---------------- */

const actionInput = ref<HTMLInputElement>()
const uploadKey = ref('')
const uploading = ref(false)

function pickDoc(key: string) {
  uploadKey.value = key
  actionInput.value?.click()
}

async function onActionFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !uploadKey.value) return
  uploading.value = true
  try {
    let dataUrl: string
    if (file.type.startsWith('image/')) {
      dataUrl = await compressImage(file)
    } else {
      if (file.size > 3_000_000) {
        alert('File too large for the demo (max 3 MB)')
        return
      }
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(file)
      })
    }
    await $fetch(`/api/shipments/${jobId.value}/documents`, {
      method: 'POST',
      body: { key: uploadKey.value, action: 'upload', file: dataUrl, fileName: file.name }
    })
    await refresh()
  } finally {
    uploading.value = false
    if (actionInput.value) actionInput.value.value = ''
  }
}

const showActionCard = computed(() => pendingDocs.value.length > 0 || canSignOff.value)

/* ---------------- review ---------------- */

const reviewHeld = computed(
  () => !!openClaim.value || shipment.value?.reviewAsk?.state === 'held'
)
const showReviewAsk = computed(
  () =>
    !!shipment.value &&
    shipment.value.status === 'delivered' &&
    !shipment.value.review &&
    !reviewHeld.value &&
    (shipment.value.reviewAsk?.state === 'sent' || !!shipment.value.signoff)
)

/* ---------------- misc ---------------- */

function scrollTo(sel: string) {
  document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const supportMailto = computed(
  () => `mailto:cs@mp.com.sg?subject=${encodeURIComponent(`${jobId.value} — question`)}`
)
</script>

<template>
  <div>
    <TopBar role="Customer view" />
    <main class="page mid">
      <NuxtLink to="/portal" style="display:inline-block;margin-bottom:10px;font-size:13px;font-weight:700;color:var(--muted);text-decoration:none">&larr; My shipments</NuxtLink>
      <div v-if="error || !shipment" class="card">
        <h2>Shipment not found</h2>
        <p class="sub">
          Check the tracking link — it looks like <strong>MP-1234-AF</strong>. If the link came from
          us and still does not open, email
          <a href="mailto:cs@mp.com.sg" style="color: var(--blue); font-weight: 700">cs@mp.com.sg</a>
          and quote the job number.
        </p>
      </div>

      <template v-else>
        <div class="hero-status">
          <div class="eyebrow">Shipment {{ shipment.id }}<span v-if="shipment.service"> · {{ shipment.service }}</span></div>
          <div class="big">{{ STATUS_LABELS[shipment.status] }}</div>

          <div class="eta">
            <template v-if="etaState === 'delivered'">Delivered {{ fmtWhen(deliveredAt) }}</template>
            <template v-else-if="etaState === 'future'">
              Estimated arrival {{ fmtWhen(shipment.eta) }}<span v-if="mounted && etaRelative"> · {{ etaRelative }}</span>
            </template>
            <template v-else>ETA passed — revised arrival pending from M&P</template>
          </div>
          <div v-if="etaState === 'passed' && latestEventAt" class="trk-eta-sub">
            Last update {{ fmtWhen(latestEventAt) }}
          </div>

          <div v-if="openClaim" class="trk-hero-claim">
            Claim open — CS is on it. We will not close this job until it is sorted.
          </div>

          <div v-if="whatsNext" class="trk-next">
            <span class="trk-next-k">What's next</span>
            <span class="trk-next-v">{{ whatsNext }}</span>
          </div>

          <StatusSteps :status="shipment.status" />
        </div>

        <!-- customs: human-in-the-loop, always -->
        <div v-if="shipment.customs" class="card trk-customs">
          <div class="trk-cx-head">
            <h2>Customs</h2>
            <span class="pill" :class="shipment.customs.status === 'cleared' ? 'pill-green' : 'pill-blue'">
              {{ CUSTOMS_LABELS[shipment.customs.status] }}
            </span>
          </div>
          <div class="trk-cx-chips">
            <div
              v-for="(c, i) in CUSTOMS_CHIPS"
              :key="c"
              class="trk-cx"
              :class="{ done: i <= customsStage, on: i === customsStage }"
            >
              <span class="trk-cx-n">{{ i + 1 }}</span>
              <span class="trk-cx-l">{{ c }}</span>
            </div>
          </div>
          <p class="trk-cx-note">{{ customsNote }}</p>
        </div>

        <div class="layout cols-2 even">
          <div>
            <!-- 1. what we need from you -->
            <div v-if="showActionCard" class="card trk-action">
              <h2>Action needed from you</h2>
              <p class="sub">Everything else is on us — these are the bits only you can do.</p>
              <ul class="trk-todo">
                <li v-for="d in pendingDocs" :key="d.key">
                  <div class="trk-todo-t">
                    {{ d.label }}
                    <span v-if="d.category === 'customs'" class="pill pill-amber">needed to declare customs</span>
                  </div>
                  <div v-if="d.note" class="trk-todo-n">{{ d.note }}</div>
                  <button class="btn btn-outline" :disabled="uploading" @click="pickDoc(d.key)">
                    {{ uploading && uploadKey === d.key ? 'Uploading…' : `Upload ${softLower(d.label)}` }}
                  </button>
                </li>
                <li v-if="canSignOff">
                  <div class="trk-todo-t">Confirm delivery</div>
                  <div class="trk-todo-n">Sign once the cargo is with you — that becomes your proof of delivery.</div>
                  <button class="btn btn-primary" @click="scrollTo('#signoff')">Sign off</button>
                </li>
              </ul>
              <input ref="actionInput" type="file" accept="image/*,.pdf" style="display: none" @change="onActionFile" />
            </div>

            <!-- sign-off -->
            <div v-if="canSignOff" id="signoff" class="card" style="border-color: #86efac">
              <h2>✍️ Confirm delivery</h2>
              <p class="sub">Sign below — this becomes your digital proof of delivery.</p>
              <label class="field"><span>Your name</span>
                <input v-model="signerName" type="text" :placeholder="shipment.customerName" />
              </label>
              <SignaturePad ref="sigPad" />
              <p v-if="signError" class="trk-err">{{ signError }}</p>
              <button class="btn btn-success btn-lg" style="margin-top: 12px" :disabled="signing" @click="submitSignoff">
                {{ signing ? 'Submitting…' : 'Sign off delivery' }}
              </button>
            </div>

            <!-- 2. documents -->
            <div v-if="docs.length" id="docs" class="trk-docs-wrap">
              <div class="trk-docs-head">
                <h2>
                  Documents
                  <span class="pill" :class="docCount.done === docCount.total ? 'pill-green' : 'pill-amber'">
                    Docs {{ docCount.done }}/{{ docCount.total }}
                  </span>
                </h2>
                <p v-if="hasCustomsDocs" class="sub">
                  Customs declaration — needed before M&P can file on TradeNet. Upload here and our
                  team checks each one before the declaration is filed.
                </p>
                <p v-else class="sub">
                  Everything this shipment needs, in one place — no chasing attachments by email.
                </p>
              </div>
              <DocumentChecklist :shipment="shipment" mode="customer" @refresh="refresh()" />
            </div>

            <!-- 3. details -->
            <div class="card">
              <h2>Shipment details</h2>
              <div class="detail-grid" style="margin-top: 12px">
                <div v-if="shipment.service"><div class="k">Service</div><div class="v">{{ shipment.service }}</div></div>
                <div><div class="k">From</div><div class="v">{{ shipment.origin }}</div></div>
                <div><div class="k">To</div><div class="v">{{ shipment.destination }}</div></div>
                <div><div class="k">Cargo</div><div class="v">{{ shipment.description }}</div></div>
                <div><div class="k">Pieces / weight</div><div class="v">{{ shipment.pieces }} pcs · {{ shipment.weightKg }} kg</div></div>
                <div><div class="k">Driver</div><div class="v">{{ shipment.driverName }}</div></div>
                <div><div class="k">Vehicle</div><div class="v">{{ shipment.vehicle }}</div></div>
                <template v-if="shipment.mode === 'b2b'">
                  <div><div class="k">Company</div><div class="v">{{ shipment.company ?? '—' }}</div></div>
                  <div><div class="k">PO number</div><div class="v">{{ shipment.poNumber ?? '—' }}</div></div>
                  <div><div class="k">Incoterms</div><div class="v">{{ shipment.incoterms ?? '—' }}</div></div>
                </template>
                <template v-else-if="shipment.mode === 'b2self'">
                  <div><div class="k">Brand</div><div class="v">{{ shipment.company ?? '—' }}</div></div>
                  <div><div class="k">Transfer ref</div><div class="v">{{ shipment.poNumber ?? '—' }}</div></div>
                  <div><div class="k">Type</div><div class="v">Internal transfer</div></div>
                </template>
                <div v-if="shipment.quote">
                  <div class="k">Quotation</div>
                  <div class="v"><NuxtLink :to="`/quote/${shipment.id}`" style="color: var(--blue)">{{ shipment.quote.ref }} →</NuxtLink></div>
                </div>
              </div>
            </div>

            <!-- 4. proof of delivery -->
            <div v-if="shipment.signoff" class="card" style="border-color: #86efac">
              <h2>✅ Proof of delivery</h2>
              <p class="sub">
                Signed by <strong>{{ shipment.signoff.name }}</strong>
                on {{ new Date(shipment.signoff.at).toLocaleString() }}
              </p>
              <img :src="shipment.signoff.signature" alt="Signature" style="max-width: 280px; border: 1px solid var(--line); border-radius: 10px; background: #fff" />
            </div>

            <!-- 4b. review path -->
            <div v-if="shipment.review" class="card trk-review">
              <h2>Thank you</h2>
              <p style="margin: 0 0 6px">
                You rated this delivery <strong class="trk-stars">{{ '★'.repeat(shipment.review.rating) }}</strong>
              </p>
              <p v-if="shipment.review.comment" class="muted" style="margin: 0 0 6px">"{{ shipment.review.comment }}"</p>
              <p v-if="shipment.review.helpedBy" class="muted" style="margin: 0 0 6px">
                Shout-out passed on to {{ shipment.review.helpedBy }}.
              </p>
              <p v-if="shipment.review.reward" style="margin: 0; font-weight: 700">
                🎁 Reward code <span style="color: var(--blue)">{{ shipment.review.reward.code }}</span>
              </p>
              <p v-else-if="shipment.review.screenshot" class="muted" style="margin: 0">
                Proof received — voucher on its way once verified.
              </p>
            </div>

            <div v-else-if="reviewHeld" class="card trk-held">
              <h2>Your claim comes first</h2>
              <p class="sub" style="margin: 0">
                We're resolving your claim first — a CS colleague will follow up. No review request
                goes out while a claim is open.
              </p>
            </div>

            <div v-else-if="showReviewAsk" class="card trk-review">
              <h2>How did we do?</h2>
              <p class="sub">Two taps, and it helps the driver and the team who handled this job.</p>
              <NuxtLink class="btn btn-primary" :to="`/review/${shipment.id}`">Rate this delivery</NuxtLink>
            </div>
          </div>

          <div>
            <AskAboutShipment :shipment="shipment" @refresh="refresh()" />

            <div class="card">
              <h2>Live updates</h2>
              <EventTimeline :events="shipment.events" mode="customer" />
            </div>
          </div>
        </div>

        <button class="trk-fab" type="button" @click="scrollTo('#ask')">💬 Ask about this shipment</button>
      </template>
    </main>
  </div>
</template>

<style>
/* ---- hero ---- */
.hero-status .trk-eta-sub { font-size: 13px; opacity: 0.72; margin-top: 2px; }

.hero-status .trk-hero-claim {
  margin-top: 10px;
  background: rgba(248, 113, 113, 0.16);
  border: 1px solid rgba(252, 165, 165, 0.55);
  color: #ffd9d9;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
}

.hero-status .trk-next {
  margin-top: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}
.hero-status .trk-next-k {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #f9b27e;
  white-space: nowrap;
}
.hero-status .trk-next-v { font-size: 14px; color: #fff; font-weight: 600; }

/* ---- customs strip ---- */
.trk-cx-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.trk-cx-head h2 { margin: 0; }
.trk-cx-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.trk-cx {
  flex: 1 1 150px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  background: #fafafa;
}
.trk-cx-n {
  display: inline-grid;
  place-items: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #e5e7eb;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}
.trk-cx.done { color: var(--ink); border-color: #fbbf8f; background: var(--blue-soft); }
.trk-cx.done .trk-cx-n { background: var(--blue); color: #fff; }
.trk-cx.on { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(241, 116, 33, 0.18); }
.trk-cx-note { margin: 12px 0 0; font-size: 13px; color: var(--muted); }

/* ---- action needed ---- */
.trk-action { border-color: #fbbf8f; background: #fffdf9; }
.trk-todo { list-style: none; margin: 0; padding: 0; }
.trk-todo li { padding: 12px 0; border-bottom: 1px solid var(--line); }
.trk-todo li:last-child { border-bottom: none; padding-bottom: 0; }
.trk-todo-t { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.trk-todo-n { font-size: 12.5px; color: var(--muted); margin: 2px 0 8px; }

/* ---- documents: one card, our header + the shared checklist body ---- */
.trk-docs-wrap {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px;
  margin-bottom: 16px;
}
.trk-docs-head h2 { margin: 0 0 4px; font-size: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.trk-docs-head .sub { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
.trk-docs-wrap > .card { border: none; box-shadow: none; padding: 0; margin: 0; background: transparent; }
.trk-docs-wrap > .card > h2,
.trk-docs-wrap > .card > .sub { display: none; }

/* ---- review / claim ---- */
.trk-review { border-color: #fbbf8f; }
.trk-stars { color: #f59e0b; }
.trk-held { border-color: #fca5a5; background: #fff8f8; }
.trk-held h2 { color: #b91c1c; }
.trk-err { color: #b91c1c; font-size: 13px; margin: 8px 0 0; }

/* ---- mobile: sticky ask affordance ---- */
.trk-fab { display: none; }
@media (max-width: 640px) {
  .trk-fab {
    display: block;
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 40;
    background: var(--blue);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 14px 18px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    box-shadow: 0 8px 24px -8px rgba(34, 31, 31, 0.5);
    cursor: pointer;
  }
  .page.mid { padding-bottom: 88px; }
  .trk-cx { flex: 1 1 100%; }
}
</style>
