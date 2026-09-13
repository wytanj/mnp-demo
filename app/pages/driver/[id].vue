<script setup lang="ts">
import { STATUS_FLOW, STATUS_LABELS, statusIndex, type Shipment, type ShipmentStatus } from '#shared/utils/shipping'

definePageMeta({ layout: 'driver' })

const route = useRoute()
const id = route.params.id as string
const toast = useToast()

const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/shipments/${id}`)

useHead({ title: `${id} — M&P driver` })

const note = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement>()

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => refresh(), 5000)
})
onUnmounted(() => clearInterval(timer))

function flash(title: string, description?: string) {
  toast.add({ title, description, icon: 'i-lucide-check-circle-2', color: 'success' })
}

const current = computed(() => (shipment.value ? statusIndex(shipment.value.status) : 0))

/** 'delivered' is set by the customer's sign-off, never by the driver. */
const steps = computed(() =>
  STATUS_FLOW.filter((s) => s !== 'delivered').map((s, i) => ({
    status: s as ShipmentStatus,
    label: STATUS_LABELS[s],
    done: i <= current.value,
    next: i === current.value + 1
  }))
)

async function setStatus(status: ShipmentStatus) {
  busy.value = true
  try {
    await $fetch(`/api/shipments/${id}/events`, {
      method: 'POST',
      body: { type: 'status', status, note: note.value || undefined, actor: 'driver' }
    })
    note.value = ''
    await refresh()
    flash(`Marked “${STATUS_LABELS[status]}”`, 'The customer can see it now.')
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
    toast.add({ title: 'Photo upload failed', description: 'Try again in a moment.', color: 'error' })
  } finally {
    busy.value = false
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  })
}
</script>

<template>
  <div class="px-4 pb-12 pt-4">
    <UCard v-if="error || !shipment" :ui="{ body: 'p-5' }">
      <h1 class="text-lg font-bold">Job not found</h1>
      <p class="mt-1 text-sm text-zinc-500">Check the link from dispatch.</p>
      <UButton to="/driver" class="mt-4" block size="lg" icon="i-lucide-arrow-left">My jobs</UButton>
    </UCard>

    <template v-else>
      <UButton
        to="/driver"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-arrow-left"
        class="-ms-2 mb-2"
      >My jobs</UButton>

      <div class="rounded-2xl bg-[#221F1F] p-5 text-white">
        <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-400">
          {{ shipment.id }} · {{ shipment.driverName }}
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">{{ STATUS_LABELS[shipment.status] }}</p>
        <p class="mt-1 text-sm text-white/60">{{ shipment.origin }} → {{ shipment.destination }}</p>
        <div class="mt-4 flex gap-1">
          <div
            v-for="(s, i) in STATUS_FLOW"
            :key="s"
            class="h-1.5 flex-1 rounded-full"
            :class="i <= current ? 'bg-primary' : 'bg-white/20'"
          />
        </div>
        <p class="mt-2 text-xs text-white/50">ETA {{ fmt(shipment.eta) }} · {{ shipment.vehicle }}</p>
      </div>

      <UCard class="mt-4" :ui="{ body: 'p-4' }">
        <h2 class="text-sm font-bold">Delivery info</h2>
        <dl class="mt-3 space-y-2.5 text-sm">
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Deliver to</dt>
            <dd class="font-semibold">
              {{ shipment.mode === 'b2c' ? shipment.customerName : (shipment.company ?? shipment.customerName) }}
            </dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Address</dt>
            <dd class="font-semibold">{{ shipment.destination }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Cargo</dt>
            <dd>{{ shipment.description }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Pieces / weight</dt>
            <dd>{{ shipment.pieces }} pcs · {{ shipment.weightKg }} kg</dd>
          </div>
        </dl>
      </UCard>

      <UCard class="mt-4" :ui="{ body: 'p-4' }">
        <h2 class="text-sm font-bold">Post an update</h2>
        <p class="mt-0.5 text-xs text-zinc-500">Visible to the customer instantly.</p>

        <UTextarea
          v-model="note"
          class="mt-3 w-full"
          :rows="2"
          size="lg"
          placeholder="Note (optional) — e.g. Heavy traffic on PIE, ETA +20 min"
        />

        <div class="mt-3 grid grid-cols-2 gap-2">
          <UButton
            size="xl"
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-camera"
            :disabled="busy"
            @click="fileInput?.click()"
          >Photo</UButton>
          <UButton
            size="xl"
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-message-square-plus"
            :disabled="busy || !note.trim()"
            @click="postNote"
          >Post note</UButton>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onPhoto"
        >

        <USeparator class="my-4" label="Status" />

        <div class="space-y-2">
          <UButton
            v-for="s in steps"
            :key="s.status"
            size="xl"
            block
            :color="s.next ? 'primary' : 'neutral'"
            :variant="s.next ? 'solid' : s.done ? 'soft' : 'outline'"
            :icon="s.done ? 'i-lucide-check' : 'i-lucide-circle'"
            :disabled="busy || s.done"
            class="justify-start"
            @click="setStatus(s.status)"
          >
            {{ s.done ? s.label : `Mark “${s.label}”` }}
          </UButton>
        </div>

        <UAlert
          v-if="shipment.signoff"
          class="mt-3"
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle-2"
          title="Job complete"
          :description="`Signed off by ${shipment.signoff.name}.`"
        />
        <UAlert
          v-else-if="shipment.status === 'out_for_delivery'"
          class="mt-3"
          color="primary"
          variant="subtle"
          icon="i-lucide-pen-line"
          title="Customer signs the delivery"
          description="Ask them to open their tracking link and sign off — that sets Delivered."
        />
      </UCard>

      <UCard class="mt-4" :ui="{ body: 'p-4' }">
        <h2 class="text-sm font-bold">Activity</h2>
        <EventTimeline :events="shipment.events" />
      </UCard>
    </template>
  </div>
</template>
