<script setup lang="ts">
import { STATUS_FLOW, STATUS_LABELS, statusIndex, type Shipment, type ShipmentStatus } from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/shipments/${id}`)

const note = ref('')
const busy = ref(false)
const toast = ref('')
const fileInput = ref<HTMLInputElement>()

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => refresh(), 5000)
})
onUnmounted(() => clearInterval(timer))

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2200)
}

const nextStatus = computed<ShipmentStatus | null>(() => {
  if (!shipment.value) return null
  const i = statusIndex(shipment.value.status)
  const next = STATUS_FLOW[i + 1]
  // 'delivered' is set by the customer's sign-off, not the driver
  return next && next !== 'delivered' ? next : null
})

async function advanceStatus() {
  if (!nextStatus.value) return
  busy.value = true
  try {
    await $fetch(`/api/shipments/${id}/events`, {
      method: 'POST',
      body: { type: 'status', status: nextStatus.value, note: note.value || undefined, actor: 'driver' }
    })
    note.value = ''
    await refresh()
    flash('Status updated — customer can see it now')
  } finally {
    busy.value = false
  }
}

async function postNote() {
  if (!note.value.trim()) return
  busy.value = true
  try {
    await $fetch(`/api/shipments/${id}/events`, {
      method: 'POST',
      body: { type: 'note', note: note.value.trim(), actor: 'driver' }
    })
    note.value = ''
    await refresh()
    flash('Update posted')
  } finally {
    busy.value = false
  }
}

async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  try {
    const photo = await compressImage(file)
    await $fetch(`/api/shipments/${id}/events`, {
      method: 'POST',
      body: { type: 'photo', photo, note: note.value || undefined }
    })
    note.value = ''
    if (fileInput.value) fileInput.value.value = ''
    await refresh()
    flash('Photo shared with customer')
  } catch {
    flash('Photo upload failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <TopBar role="Driver view" />
    <main class="page">
      <div v-if="error || !shipment" class="card">
        <h2>Job not found</h2>
        <p class="sub">Check the link from dispatch.</p>
      </div>

      <template v-else>
        <NuxtLink to="/driver" class="muted" style="display: inline-block; margin-bottom: 10px; text-decoration: none">← My jobs</NuxtLink>
        <div class="hero-status">
          <div class="eyebrow">Job {{ shipment.id }} · {{ shipment.driverName }}</div>
          <div class="big">{{ STATUS_LABELS[shipment.status] }}</div>
          <div class="eta">{{ shipment.origin }} → {{ shipment.destination }}</div>
          <StatusSteps :status="shipment.status" />
        </div>

        <div class="card">
          <h2>Delivery info</h2>
          <div class="detail-grid" style="margin-top: 12px">
            <div><div class="k">Deliver to</div><div class="v">{{ shipment.mode === 'b2c' ? shipment.customerName : (shipment.company ?? shipment.customerName) }}</div></div>
            <div><div class="k">Address</div><div class="v">{{ shipment.destination }}</div></div>
            <div><div class="k">Cargo</div><div class="v">{{ shipment.description }}</div></div>
            <div><div class="k">Pieces / weight</div><div class="v">{{ shipment.pieces }} pcs · {{ shipment.weightKg }} kg</div></div>
          </div>
        </div>

        <div class="card">
          <h2>Post an update <span class="pill pill-blue">Phase 2 preview</span></h2>
          <p class="sub">Visible to the customer instantly.</p>

          <label class="field"><span>Note (optional)</span>
            <textarea v-model="note" rows="2" placeholder="e.g. Heavy traffic on PIE, ETA +20 min" />
          </label>

          <div class="row" style="margin-bottom: 10px">
            <button
              v-if="nextStatus"
              class="btn btn-primary btn-lg"
              :disabled="busy"
              @click="advanceStatus"
            >
              Mark “{{ STATUS_LABELS[nextStatus] }}”
            </button>
            <p v-else-if="!shipment.signoff" class="muted" style="margin: 0">
              You've arrived — ask the customer to open their tracking link and sign off the delivery.
            </p>
            <p v-else class="muted" style="margin: 0">
              ✅ Delivery signed off by {{ shipment.signoff.name }}. Job complete!
            </p>
          </div>

          <div class="row">
            <button class="btn btn-outline btn-lg" :disabled="busy" @click="fileInput?.click()">
              📷 Take / upload photo
            </button>
            <button class="btn btn-outline btn-lg" :disabled="busy || !note.trim()" @click="postNote">
              Post note only
            </button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            capture="environment"
            style="display: none"
            @change="onPhoto"
          />
        </div>

        <div class="card">
          <h2>Activity</h2>
          <EventTimeline :events="shipment.events" />
        </div>
      </template>
    </main>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
