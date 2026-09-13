<script setup lang="ts">
import { STATUS_LABELS, statusIndex, type ShipmentStatus } from '#shared/utils/shipping'

definePageMeta({ layout: 'driver' })
useHead({ title: 'Driver — M&P International Freights' })

interface DriverJob {
  id: string
  status: ShipmentStatus
  origin: string
  destination: string
  eta: string
  vehicle: string
  description: string
  pieces: number
  weightKg: number
  signedOff: boolean
}

const DEMO_DRIVERS = [
  { name: 'Hafiz', phone: '91234567' },
  { name: 'Suresh', phone: '92345678' },
  { name: 'Azlan', phone: '93456789' }
]

const phone = ref('')
const driverName = ref('')
const jobs = ref<DriverJob[]>([])
const busy = ref(false)
const loginError = ref('')

async function login() {
  const digits = phone.value.replace(/\D/g, '')
  if (digits.length < 8) {
    loginError.value = 'Enter your 8-digit mobile number.'
    return
  }
  loginError.value = ''
  busy.value = true
  try {
    const res = await $fetch<{ driverName: string; jobs: DriverJob[] }>(`/api/driver/${digits}`)
    driverName.value = res.driverName
    jobs.value = res.jobs
    localStorage.setItem('mp-driver-phone', digits)
  } catch (e: unknown) {
    loginError.value =
      (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'No jobs found for this number.'
  } finally {
    busy.value = false
  }
}

function quickFill(p: string) {
  phone.value = p
  login()
}

function logout() {
  localStorage.removeItem('mp-driver-phone')
  driverName.value = ''
  jobs.value = []
  phone.value = ''
}

onMounted(() => {
  const saved = localStorage.getItem('mp-driver-phone')
  if (saved) {
    phone.value = saved
    login()
  }
})

/** Out for delivery first — that is what the driver is doing right now. */
const RANK: Record<ShipmentStatus, number> = {
  out_for_delivery: 0,
  in_transit: 1,
  picked_up: 2,
  booked: 3,
  delivered: 4
}
const sorted = computed(() =>
  [...jobs.value].sort((a, b) => RANK[a.status] - RANK[b.status] || a.eta.localeCompare(b.eta))
)
const open = computed(() => sorted.value.filter((j) => j.status !== 'delivered'))

function statusColor(status: ShipmentStatus): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'delivered') return 'success'
  if (status === 'out_for_delivery') return 'warning'
  if (status === 'booked') return 'neutral'
  return 'info'
}

function fmtEta(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  })
}
</script>

<template>
  <div class="px-4 pb-10 pt-5">
    <!-- Login -->
    <div v-if="!driverName">
      <div class="text-center">
        <span class="grid place-items-center mx-auto size-14 rounded-2xl bg-primary-100 text-primary-600">
          <UIcon name="i-lucide-truck" class="size-7" />
        </span>
        <h1 class="mt-3 text-xl font-bold tracking-tight">Driver login</h1>
        <p class="mt-1 text-sm text-zinc-500">No password, no app store — just your mobile number.</p>
      </div>

      <UCard class="mt-5" :ui="{ body: 'p-4' }">
        <form @submit.prevent="login">
          <UInput
            v-model="phone"
            size="xl"
            class="w-full"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="9123 4567"
            autofocus
            aria-label="Mobile number"
            :ui="{ base: 'text-center text-2xl font-bold tracking-[0.12em] tabular-nums py-4' }"
            @input="loginError = ''"
          />
          <p v-if="loginError" class="mt-2 text-center text-sm font-medium text-red-600">{{ loginError }}</p>
          <UButton
            type="submit"
            size="xl"
            block
            class="mt-3"
            icon="i-lucide-list-checks"
            :loading="busy"
          >View my jobs</UButton>
        </form>

        <USeparator class="my-4" label="Demo drivers" />

        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-for="d in DEMO_DRIVERS"
            :key="d.phone"
            color="neutral"
            variant="outline"
            size="lg"
            @click="quickFill(d.phone)"
          >
            {{ d.name }} · {{ d.phone }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Today's jobs -->
    <template v-else>
      <div class="rounded-2xl bg-[#221F1F] p-5 text-white">
        <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-400">Today</p>
        <p class="mt-1 text-2xl font-bold tracking-tight">Hi, {{ driverName }} 👋</p>
        <p class="mt-1 text-sm text-white/60">
          {{ open.length }} job{{ open.length === 1 ? '' : 's' }} to run
          <template v-if="jobs.length - open.length">
            · {{ jobs.length - open.length }} done
          </template>
        </p>
      </div>

      <div class="mt-4 space-y-3">
        <NuxtLink v-for="j in sorted" :key="j.id" :to="`/driver/${j.id}`" class="block">
          <UCard
            :ui="{
              root: j.status === 'out_for_delivery' ? 'ring-primary-300 bg-primary-50/40' : '',
              body: 'p-4'
            }"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm font-bold">{{ j.id }}</span>
              <UBadge :color="statusColor(j.status)" variant="subtle" size="sm">
                {{ STATUS_LABELS[j.status] }}
              </UBadge>
              <UBadge v-if="j.signedOff" color="success" variant="solid" size="sm" icon="i-lucide-signature">
                Signed off
              </UBadge>
              <UIcon name="i-lucide-chevron-right" class="ms-auto size-5 text-zinc-400" />
            </div>

            <p class="mt-2 text-base font-semibold leading-snug">{{ j.destination }}</p>
            <p class="text-xs text-zinc-500">from {{ j.origin }}</p>

            <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span class="inline-flex items-center gap-1 font-semibold">
                <UIcon name="i-lucide-clock" class="size-3.5 text-primary-500" /> {{ fmtEta(j.eta) }}
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-package" class="size-3.5" /> {{ j.pieces }} pcs · {{ j.weightKg }} kg
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-truck" class="size-3.5" /> {{ j.vehicle }}
              </span>
            </div>

            <p class="mt-2 line-clamp-2 text-xs text-zinc-500">{{ j.description }}</p>

            <div class="mt-3">
              <div class="flex gap-1">
                <div
                  v-for="n in 5"
                  :key="n"
                  class="h-1.5 flex-1 rounded-full"
                  :class="n - 1 <= statusIndex(j.status) ? 'bg-primary' : 'bg-zinc-200'"
                />
              </div>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <UButton class="mt-5" block size="lg" color="neutral" variant="ghost" icon="i-lucide-log-out" @click="logout">
        Log out
      </UButton>
    </template>
  </div>
</template>
