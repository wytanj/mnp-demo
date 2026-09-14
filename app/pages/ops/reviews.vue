<script setup lang="ts">
import type { ProgrammeId, ProgrammeStats } from '#shared/utils/shipping'
import { REVIEW_PROGRAMMES } from '#shared/utils/shipping'
import type { ReviewRow } from '~/components/ops/ReviewColumn.vue'

/**
 * Review programme board. The ask fires on delivery and holds itself when a
 * claim is open — this page is where CS sees all four states at once (never
 * asked / asked / received / held) and can override any of them.
 *
 * One feed: `/api/reviews` carries the rows, the claim gate and the counts.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Reviews — M&P ops' })

interface ReviewBoard {
  notAsked: ReviewRow[]
  asked: ReviewRow[]
  received: ReviewRow[]
  suppressed: ReviewRow[]
  programmes: ProgrammeStats[]
  counts: {
    notAsked: number
    asked: number
    received: number
    held: number
    heldByClaim: number
    reminded: number
    issued: number
    awaitingVerification: number
    avgRating: number | null
  }
}

const EMPTY: ReviewBoard = {
  notAsked: [],
  asked: [],
  received: [],
  suppressed: [],
  programmes: [],
  counts: {
    notAsked: 0, asked: 0, received: 0, held: 0, heldByClaim: 0,
    reminded: 0, issued: 0, awaitingVerification: 0, avgRating: null
  }
}

const { data: board, refresh } = await useFetch<ReviewBoard>('/api/reviews', { default: () => EMPTY })

const toast = useToast()
const busy = ref<string | null>(null)
const tab = ref('asked')

const counts = computed(() => board.value?.counts ?? EMPTY.counts)

/**
 * Programme filter — the same three programmes as /ops/rewards, applied to the
 * four lanes client-side. Labels come from the API when it has stats, from the
 * shared definitions otherwise.
 */
const programmes = computed(() => {
  const live = board.value?.programmes ?? []
  if (live.length) return live.map((p) => ({ id: p.id as ProgrammeId, short: p.short, icon: p.icon }))
  return ((REVIEW_PROGRAMMES ?? []) as Array<{ id: ProgrammeId; short: string; icon: string }>)
    .map((p) => ({ id: p.id, short: p.short, icon: p.icon }))
})

const programmeId = ref<'all' | ProgrammeId>('all')

function inProgramme(rows: ReviewRow[]): ReviewRow[] {
  if (programmeId.value === 'all') return rows
  return rows.filter((r) => r.programmeId === programmeId.value)
}

const lanes = computed(() => ({
  notAsked: inProgramme(board.value?.notAsked ?? []),
  asked: inProgramme(board.value?.asked ?? []),
  received: inProgramme(board.value?.received ?? []),
  suppressed: inProgramme(board.value?.suppressed ?? [])
}))

const stats = computed(() => [
  { key: 'notAsked', label: 'Not asked yet', n: counts.value.notAsked, icon: 'i-lucide-inbox', cls: 'text-zinc-600' },
  { key: 'asked', label: 'Asked', n: counts.value.asked, icon: 'i-lucide-send', cls: 'text-sky-600' },
  { key: 'received', label: 'Received', n: counts.value.received, icon: 'i-lucide-star', cls: 'text-amber-500' },
  { key: 'held', label: 'Held', n: counts.value.held, icon: 'i-lucide-pause-circle', cls: 'text-zinc-600' },
  { key: 'avg', label: 'Average rating', n: counts.value.avgRating ?? '—', icon: 'i-lucide-trending-up', cls: 'text-emerald-600' }
])

const TABS = computed(() => [
  { value: 'notAsked', label: `Not asked yet (${lanes.value.notAsked.length})` },
  { value: 'asked', label: `Asked (${lanes.value.asked.length})` },
  { value: 'received', label: `Received (${lanes.value.received.length})` },
  { value: 'held', label: `Held (${lanes.value.suppressed.length})` }
])

/** Live line under the gate rule — what the rule is actually doing right now. */
const gateLine = computed(() => {
  const n = counts.value.heldByClaim
  const reminded = counts.value.reminded
  const bits = [
    n === 0
      ? 'No ask is held by a claim right now.'
      : `${n} ask${n === 1 ? '' : 's'} currently held by an open claim.`
  ]
  if (reminded) bits.push(`${reminded} ask${reminded === 1 ? ' has' : 's have'} had a 48h reminder.`)
  return bits.join(' ')
})

async function act(row: ReviewRow, body: Record<string, unknown>, ok: { title: string; description: string }) {
  busy.value = row.id
  try {
    await $fetch(`/api/shipments/${row.id}/review-ask`, { method: 'POST', body })
    await refresh()
    toast.add({ ...ok, color: 'success', icon: 'i-lucide-star' })
  } catch (e: any) {
    toast.add({
      title: 'Could not do that',
      description: e?.data?.statusMessage ?? 'Try again',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    busy.value = null
  }
}

function send(row: ReviewRow) {
  return act(row, { action: 'send' }, {
    title: 'Review ask sent',
    description: `${row.client} · ${row.id} — the email is in the outbox.`
  })
}

function reask(row: ReviewRow) {
  return act(row, { action: 'reask' }, {
    title: 'Reminder sent',
    description: `Re-ask #${(row.reaskCount ?? 0) + 1} to ${row.client} on ${row.id} — next one due in 48h.`
  })
}

function suppress({ row, reason }: { row: ReviewRow; reason: string }) {
  return act(row, { action: 'suppress', reason }, {
    title: 'Ask held',
    description: `${row.id} held — ${reason}. It stays out of the programme until CS releases it.`
  })
}

function release(row: ReviewRow) {
  return act(row, { action: 'release' }, {
    title: 'Review ask released',
    description: `Sent to ${row.client} · ${row.id}`
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

async function reward({ row, code }: { row: ReviewRow; code: string }) {
  busy.value = row.id
  try {
    // No hardcoded value — the server falls back to the programme's own reward.
    const body: Record<string, unknown> = {}
    if (row.rewardValue) body.value = row.rewardValue
    if (code) body.code = code
    await $fetch(`/api/shipments/${row.id}/reward`, { method: 'POST', body })
    await refresh()
    toast.add({
      title: 'Reward approved',
      description: `Voucher emailed to ${row.client} · ${row.id}`,
      color: 'success',
      icon: 'i-lucide-gift'
    })
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
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
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
        title="Gate rule — ask on delivery, hold while a claim is open, remind twice, then stop."
        :ui="{ title: 'text-sm', description: 'text-xs' }"
      >
        <template #description>
          <span class="block">
            Nobody chases reviews by hand, and an unhappy customer never gets asked to rate us mid-complaint.
          </span>
          <span class="mt-1 block font-medium text-primary-700">{{ gateLine }}</span>
        </template>
      </UAlert>

      <!-- Programme filter — All, or one of the review programmes -->
      <div v-if="programmes.length" class="shrink-0 flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-medium text-zinc-500 me-1">Programme</span>
        <UButton
          size="xs"
          color="neutral"
          :variant="programmeId === 'all' ? 'solid' : 'outline'"
          label="All"
          @click="programmeId = 'all'"
        />
        <UButton
          v-for="p in programmes"
          :key="p.id"
          size="xs"
          color="neutral"
          :variant="programmeId === p.id ? 'solid' : 'outline'"
          :icon="p.icon"
          :label="p.short"
          @click="programmeId = p.id"
        />
        <NuxtLink
          v-if="programmeId !== 'all'"
          :to="`/ops/rewards?programme=${programmeId}`"
          class="text-xs font-medium text-primary-600 hover:underline ms-1"
        >
          Compare programmes →
        </NuxtLink>
      </div>

      <!-- phone: tabs -->
      <div class="lg:hidden">
        <UTabs
          v-model="tab"
          :items="TABS"
          :content="false"
          color="primary"
          variant="pill"
          size="sm"
          class="mb-3"
          :ui="{ list: 'bg-zinc-100 w-full', trigger: 'flex-1' }"
        />
        <OpsReviewColumn v-if="tab === 'notAsked'" kind="not_asked" :rows="lanes.notAsked" :busy="busy" @send="send" />
        <OpsReviewColumn
          v-else-if="tab === 'asked'"
          kind="asked"
          :rows="lanes.asked"
          :busy="busy"
          @reask="reask"
          @suppress="suppress"
        />
        <OpsReviewColumn v-else-if="tab === 'received'" kind="received" :rows="lanes.received" :busy="busy" @reward="reward" />
        <OpsReviewColumn v-else kind="held" :rows="lanes.suppressed" :busy="busy" @release="release" @hold="hold" />
      </div>

      <!-- desktop: four lanes -->
      <div class="hidden lg:grid lg:grid-cols-4 gap-4 items-start">
        <OpsReviewColumn kind="not_asked" :rows="lanes.notAsked" :busy="busy" @send="send" />
        <OpsReviewColumn kind="asked" :rows="lanes.asked" :busy="busy" @reask="reask" @suppress="suppress" />
        <OpsReviewColumn kind="received" :rows="lanes.received" :busy="busy" @reward="reward" />
        <OpsReviewColumn kind="held" :rows="lanes.suppressed" :busy="busy" @release="release" @hold="hold" />
      </div>
    </template>
  </UDashboardPanel>
</template>
