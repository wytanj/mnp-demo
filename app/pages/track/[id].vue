<script setup lang="ts">
import { STATUS_LABELS, type Shipment } from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/shipments/${id}`)

const signerName = ref('')
const sigPad = ref<{ hasInk: boolean; toDataURL: () => string; clear: () => void }>()
const signing = ref(false)
const signError = ref('')

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => refresh(), 4000)
})
onUnmounted(() => clearInterval(timer))

const canSignOff = computed(() =>
  shipment.value &&
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
    await $fetch(`/api/shipments/${id}/signoff`, {
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

function fmtEta(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div>
    <TopBar role="Customer view" />
    <main class="page mid">
      <div v-if="error || !shipment" class="card">
        <h2>Shipment not found</h2>
        <p class="sub">Check the tracking link or contact your customer service rep.</p>
      </div>

      <template v-else>
        <div class="hero-status">
          <div class="eyebrow">Shipment {{ shipment.id }}</div>
          <div class="big">{{ STATUS_LABELS[shipment.status] }}</div>
          <div class="eta">
            {{ shipment.status === 'delivered'
              ? `Delivered — thank you for shipping with M&P`
              : `Estimated arrival ${fmtEta(shipment.eta)}` }}
          </div>
          <StatusSteps :status="shipment.status" />
        </div>

        <div class="layout cols-2 even">
        <div>
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

        <DocumentChecklist v-if="shipment.documents" :shipment="shipment" @refresh="refresh()" />

        <div v-if="canSignOff" class="card" style="border-color: #86efac">
          <h2>✍️ Confirm delivery <span class="pill pill-blue">Phase 3 preview</span></h2>
          <p class="sub">Sign below — this becomes your digital proof of delivery.</p>
          <label class="field"><span>Your name</span>
            <input v-model="signerName" type="text" :placeholder="shipment.customerName" />
          </label>
          <SignaturePad ref="sigPad" />
          <p v-if="signError" style="color: #b91c1c; font-size: 13px">{{ signError }}</p>
          <button class="btn btn-success btn-lg" style="margin-top: 12px" :disabled="signing" @click="submitSignoff">
            {{ signing ? 'Submitting…' : 'Sign off delivery' }}
          </button>
        </div>

        <div v-if="shipment.signoff" class="card" style="border-color: #86efac">
          <h2>✅ Proof of delivery</h2>
          <p class="sub">
            Signed by <strong>{{ shipment.signoff.name }}</strong>
            on {{ new Date(shipment.signoff.at).toLocaleString() }}
          </p>
          <img :src="shipment.signoff.signature" alt="Signature" style="max-width: 280px; border: 1px solid var(--line); border-radius: 10px; background: #fff" />
          <template v-if="!shipment.review">
            <hr class="divider" />
            <p class="muted" style="margin-top: 0">A review request has been emailed to you. You can also leave one right now:</p>
            <NuxtLink class="btn btn-primary" :to="`/review/${shipment.id}`">Rate this delivery</NuxtLink>
          </template>
          <template v-else>
            <hr class="divider" />
            <p style="margin: 0">You rated this delivery <strong>{{ '★'.repeat(shipment.review.rating) }}</strong> — thank you!</p>
          </template>
        </div>

        </div>
        <div>
        <div class="card">
          <h2>Live updates</h2>
          <EventTimeline :events="shipment.events" />
        </div>
        </div>
        </div>
      </template>
    </main>
  </div>
</template>
