<script setup lang="ts">
import type { ClaimType, Shipment } from '#shared/utils/shipping'
import type { ReviewRow } from '~/components/ops/ReviewColumn.vue'

/**
 * Review programme board. The ask fires on delivery and holds itself when a
 * claim is open — this page is where CS sees all three states at once and can
 * override either way.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Reviews — M&P ops' })

interface ReviewBoard {
  asked: ReviewRow[]
  received: ReviewRow[]
  suppressed: ReviewRow[]
}

const { data: board, refresh } = await useFetch<ReviewBoard>('/api/reviews', {
  default: () => ({ asked: [], received: [], suppressed: [] })
})
const { data: shipments } = await useFetch<Shipment[]>('/api/shipments', { default: () => [] })

const toast = useToast()
const busy = ref<string | null>(null)
const tab = ref('asked')

/** /api/reviews returns the hold reason but not the claim type — join it here. */
const claims = computed<Record<string, ClaimType | undefined>>(() =>
  Object.fromEntries((shipments.value ?? []).map((s) => [s.id, s.claim?.type]))
)

const avgRating = computed(() => {
  const rated = (board.value?.received ?? []).filter((r) => typeof r.rating === 'number')
  if (!rated.length) return '—'
  return (rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length).toFixed(1)
})

const stats = computed(() => [
  { key: 'asked', label: 'Asked', n: board.value?.asked.length ?? 0, icon: 'i-lucide-send', cls: 'text-sky-600' },
  { key: 'received', label: 'Received', n: board.value?.received.length ?? 0, icon: 'i-lucide-star', cls: 'text-amber-500' },
  { key: 'suppressed', label: 'Suppressed', n: board.value?.suppressed.length ?? 0, icon: 'i-lucide-pause-circle', cls: 'text-zinc-600' },
  { key: 'avg', label: 'Average rating', n: avgRating.value, icon: 'i-lucide-trending-up', cls: 'text-emerald-600' }
])

const TABS = computed(() => [
  { value: 'asked', label: `Asked (${board.value?.asked.length ?? 0})` },
  { value: 'received', label: `Received (${board.value?.received.length ?? 0})` },
  { value: 'suppressed', label: `Suppressed (${board.value?.suppressed.length ?? 0})` }
])

function nudge(row: ReviewRow) {
  toast.add({
    title: 'Reminder queued (demo)',
    description: `A second review ask goes to ${row.client} on ${row.id} in 48h.`,
    color: 'info',
    icon: 'i-lucide-bell-ring'
  })
}

function hold(row: ReviewRow) {
  toast.add({
    title: 'Still held',
    description: `${row.id} stays out of the review programme until the claim closes.`,
    color: 'neutral',
    icon: 'i-lucide-pause'
  })
}

async function release(row: ReviewRow) {
  busy.value = row.id
  try {
    await $fetch(`/api/shipments/${row.id}/review-ask`, { method: 'POST', body: { action: 'release' } })
    await refresh()
    toast.add({ title: 'Review ask released', description: `Sent to ${row.client} · ${row.id}`, color: 'success', icon: 'i-lucide-star' })
  } catch (e: any) {
    toast.add({ title: 'Could not release', description: e?.data?.statusMessage ?? 'Try again', color: 'error' })
  } finally {
    busy.value = null
  }
}

async function reward({ row, code }: { row: ReviewRow; code: string }) {
  if (!code) return
  busy.value = row.id
  try {
    await $fetch(`/api/shipments/${row.id}/reward`, { method: 'POST', body: { code, value: 'Grab $10' } })
    await refresh()
    toast.add({ title: 'Reward approved', description: `${code} emailed to ${row.client}`, color: 'success', icon: 'i-lucide-gift' })
  } catch (e: any) {
    toast.add({ title: 'Could not approve reward', description: e?.data?.statusMessage ?? 'Try again', color: 'error' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Reviews" icon="i-lucide-star">
        <template #right>
          <UButton to="/ops/rewards" icon="i-lucide-gift" color="neutral" variant="outline" size="sm" label="Review programme" />
          <DemoHowTo page="ops-reviews" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <UPageCard v-for="s in stats" :key="s.key" variant="subtle" :ui="{ container: 'p-3 sm:p-4 gap-1' }">
          <div class="flex items-center gap-2">
            <UIcon :name="s.icon" class="size-4" :class="s.cls" />
            <span class="text-xs font-medium text-zinc-500">{{ s.label }}</span>
          </div>
          <div class="text-2xl font-bold tabular-nums" :class="s.cls">{{ s.n }}</div>
        </UPageCard>
      </div>

      <UAlert
        class="shrink-0"
        color="primary"
        variant="subtle"
        icon="i-lucide-info"
        title="Ask goes out on delivery; held automatically when a claim is open."
        description="Nobody chases reviews by hand, and an unhappy customer never gets asked to rate us mid-complaint."
        :ui="{ title: 'text-sm', description: 'text-xs' }"
      />

      <!-- phone: tabs -->
      <div class="lg:hidden">
        <UTabs v-model="tab" :items="TABS" :content="false" color="primary" variant="pill" size="sm" class="mb-3" :ui="{ list: 'bg-zinc-100 w-full', trigger: 'flex-1' }" />
        <OpsReviewColumn
          v-if="tab === 'asked'"
          kind="asked"
          :rows="board.asked"
          :busy="busy"
          @nudge="nudge"
        />
        <OpsReviewColumn
          v-else-if="tab === 'received'"
          kind="received"
          :rows="board.received"
          :busy="busy"
          @reward="reward"
        />
        <OpsReviewColumn
          v-else
          kind="suppressed"
          :rows="board.suppressed"
          :claims="claims"
          :busy="busy"
          @release="release"
          @hold="hold"
        />
      </div>

      <!-- desktop: three lanes -->
      <div class="hidden lg:grid grid-cols-3 gap-4 items-start">
        <OpsReviewColumn kind="asked" :rows="board.asked" :busy="busy" @nudge="nudge" />
        <OpsReviewColumn kind="received" :rows="board.received" :busy="busy" @reward="reward" />
        <OpsReviewColumn kind="suppressed" :rows="board.suppressed" :claims="claims" :busy="busy" @release="release" @hold="hold" />
      </div>
    </template>
  </UDashboardPanel>
</template>
