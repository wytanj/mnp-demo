<script setup lang="ts">
definePageMeta({ layout: 'ops' })

type ExceptionKind =
  | 'stuck' | 'eta_passed' | 'customs_gap' | 'claim_open'
  | 'partner_blocked' | 'permit_blocked' | 'needs_reply' | 'signoff_pending'

interface OpsException {
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

const { data: exceptions, refresh } = await useFetch<OpsException[]>('/api/exceptions', {
  default: () => [] as OpsException[]
})

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(refresh, 5000)
})
onUnmounted(() => clearInterval(timer))

const KIND_META: Record<ExceptionKind, { label: string; icon: string }> = {
  stuck: { label: 'Stuck', icon: 'i-lucide-pause-circle' },
  eta_passed: { label: 'ETA passed', icon: 'i-lucide-clock-alert' },
  customs_gap: { label: 'Customs gap', icon: 'i-lucide-stamp' },
  claim_open: { label: 'Claim', icon: 'i-lucide-shield-alert' },
  partner_blocked: { label: 'Partner blocked', icon: 'i-lucide-handshake' },
  permit_blocked: { label: 'Blocked on permit', icon: 'i-lucide-file-lock-2' },
  needs_reply: { label: 'Needs reply', icon: 'i-lucide-message-square-dot' },
  signoff_pending: { label: 'Sign-off pending', icon: 'i-lucide-signature' }
}

const SEVERITY_COLOR: Record<string, 'error' | 'warning' | 'neutral'> = {
  high: 'error',
  medium: 'warning',
  low: 'neutral'
}

const severity = ref<'all' | 'high' | 'medium' | 'low'>('all')

const tabItems = computed(() => {
  const all = exceptions.value ?? []
  const count = (sev: string) => all.filter((e) => e.severity === sev).length
  return [
    { label: `All (${all.length})`, value: 'all' },
    { label: `High (${count('high')})`, value: 'high' },
    { label: `Medium (${count('medium')})`, value: 'medium' },
    { label: `Low (${count('low')})`, value: 'low' }
  ]
})

const rows = computed(() => {
  const all = exceptions.value ?? []
  return severity.value === 'all' ? all : all.filter((e) => e.severity === severity.value)
})

const kindChips = computed(() => {
  const all = exceptions.value ?? []
  return (Object.keys(KIND_META) as ExceptionKind[])
    .map((kind) => ({ kind, ...KIND_META[kind], n: all.filter((e) => e.kind === kind).length }))
    .filter((c) => c.n > 0)
})

/**
 * The server writes raw ISO timestamps into some exception details
 * (`server/utils/exceptions.ts`). Nobody reads those on a projector — swap them
 * for a human date on the way to the screen.
 */
function pretty(detail: string): string {
  return detail.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, (iso) =>
    new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  )
}

function rel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(ms)
  const h = Math.round(abs / 3600_000)
  const d = Math.round(abs / 86400_000)
  const label = abs < 3600_000 ? '<1h' : h < 36 ? `${h}h` : `${d}d`
  return ms >= 0 ? `${label} ago` : `in ${label}`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Exceptions" icon="i-lucide-triangle-alert">
        <template #trailing>
          <UBadge v-if="exceptions.length" color="error" variant="subtle" class="ms-1">
            {{ exceptions.length }} open
          </UBadge>
        </template>
        <template #right>
          <UButton to="/ops/jobs" color="neutral" variant="outline" size="sm" icon="i-lucide-boxes">
            <span class="hidden sm:inline">All jobs</span>
          </UButton>
          <DemoHowTo page="ops-exceptions" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-zinc-500">
          Derived live from the jobs — nothing here is stored. Fix the job and the alert disappears.
        </p>

        <div v-if="kindChips.length" class="flex flex-wrap gap-2">
          <div
            v-for="c in kindChips"
            :key="c.kind"
            class="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1"
          >
            <UIcon :name="c.icon" class="size-3.5 text-zinc-500" />
            <span class="text-[12px] font-semibold text-zinc-800">{{ c.label }}</span>
            <span class="text-[12px] font-bold tabular-nums text-primary">{{ c.n }}</span>
          </div>
        </div>

        <UTabs
          v-model="severity"
          :items="tabItems"
          :content="false"
          color="primary"
          variant="pill"
          class="w-full"
        />

        <div v-if="!rows.length" class="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <UIcon name="i-lucide-party-popper" class="size-8 text-green-600 mx-auto" />
          <p class="mt-2 text-sm font-semibold text-zinc-800">Nothing needs a person right now.</p>
          <p class="text-xs text-zinc-500">Every job is moving, every message is answered.</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="e in rows"
            :key="e.id"
            class="rounded-xl border bg-white p-3 sm:p-4 flex items-start gap-3"
            :class="e.severity === 'high' ? 'border-red-200' : 'border-zinc-200'"
          >
            <div
              class="shrink-0 grid place-items-center size-9 rounded-lg"
              :class="e.severity === 'high' ? 'bg-red-50 text-red-600' : e.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'"
            >
              <UIcon :name="KIND_META[e.kind].icon" class="size-5" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <UBadge :color="SEVERITY_COLOR[e.severity]" variant="subtle" size="sm">
                  {{ e.severity }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">{{ KIND_META[e.kind].label }}</UBadge>
                <NuxtLink
                  v-if="e.shipmentId"
                  :to="`/ops/jobs/${e.shipmentId}`"
                  class="text-[12px] font-bold text-zinc-800 hover:text-primary"
                >{{ e.shipmentId }}</NuxtLink>
                <span class="text-[12px] text-zinc-500">{{ e.client }}</span>
                <span class="text-[11px] text-zinc-400 ms-auto whitespace-nowrap">{{ rel(e.since) }}</span>
              </div>
              <div class="mt-1 text-sm font-semibold text-zinc-900">{{ e.title }}</div>
              <p class="text-[12px] text-zinc-600 break-words">{{ pretty(e.detail) }}</p>
            </div>

            <UButton
              :to="e.link"
              size="sm"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-chevron-right"
              class="shrink-0"
            >
              Open
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
