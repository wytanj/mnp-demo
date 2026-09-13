<script setup lang="ts">
import type { OutboxEmail, ProgrammeId, ProgrammeStats, ReviewProgramme } from '#shared/utils/shipping'
import { mailKindOf, REVIEW_PROGRAMMES } from '#shared/utils/shipping'
import type { ReviewRow } from '~/components/ops/ReviewColumn.vue'

/**
 * Review programme — the read-only view of the reward loop, now per programme.
 * Every action (reminder / hold / release / approve a Google-Facebook proof)
 * lives on the Reviews board; this page shows what each programme produced:
 * codes issued, proof still to verify, and the emails that actually went out.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Review programme — M&P ops' })

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
  notAsked: [], asked: [], received: [], suppressed: [], programmes: [],
  counts: {
    notAsked: 0, asked: 0, received: 0, held: 0, heldByClaim: 0,
    reminded: 0, issued: 0, awaitingVerification: 0, avgRating: null
  }
}

const { data: board } = await useFetch<ReviewBoard>('/api/reviews', { default: () => EMPTY })

/** The flyer / voucher mail the programme actually sent — same outbox as /ops/inbox. */
const { data: outboxAll } = await useFetch<OutboxEmail[]>('/api/emails', {
  default: () => [],
  transform: (rows) =>
    ((rows ?? []) as OutboxEmail[])
      .filter((e) => ['review', 'reward'].includes(mailKindOf(e)))
      .sort((a, b) => b.at.localeCompare(a.at))
})

/* ------------------------------------------------------------------ *
 * Programme selection — 'all' or one programme, deep-linkable as ?programme=
 * ------------------------------------------------------------------ */

/** Rules / labels / icons come from the shared definitions, stats from the API. */
const definitions = computed<ReviewProgramme[]>(() => (REVIEW_PROGRAMMES ?? []) as ReviewProgramme[])

function definitionOf(id?: string | null): ReviewProgramme | null {
  return definitions.value.find((p) => p.id === id) ?? null
}

/** One card per programme even before the API has any stats to show. */
const programmes = computed<ProgrammeStats[]>(() => {
  const live = board.value?.programmes ?? []
  if (live.length) return live
  return definitions.value.map((p) => ({
    id: p.id,
    name: p.name,
    short: p.short,
    icon: p.icon,
    color: p.color,
    trigger: p.trigger,
    rewardValue: p.reward.value,
    jobs: 0, asked: 0, reminders: 0, pending: 0, scheduled: 0, held: 0, received: 0,
    conversion: null, avgRating: null, fiveStar: 0, vouchers: 0, awaitingVerification: 0,
    cost: 0, costPerReview: null
  }))
})

const route = useRoute()
const router = useRouter()

function readQuery(): 'all' | ProgrammeId {
  const q = route.query.programme
  const id = Array.isArray(q) ? q[0] : q
  return (id && id !== 'all' ? (id as ProgrammeId) : 'all')
}

const programmeId = ref<'all' | ProgrammeId>(readQuery())

watch(programmeId, (id) => {
  const query = { ...route.query }
  if (id === 'all') delete query.programme
  else query.programme = id
  router.replace({ query })
})

const selected = computed(() => (programmeId.value === 'all' ? null : definitionOf(programmeId.value)))
const selectedStats = computed(() => programmes.value.find((p) => p.id === programmeId.value) ?? null)
const selectedReward = computed(() => selected.value?.reward.value ?? selectedStats.value?.rewardValue ?? null)

const TABS = computed(() => [
  { value: 'all', label: 'All programmes', icon: 'i-lucide-layers' },
  ...programmes.value.map((p) => ({ value: p.id, label: p.short, icon: p.icon }))
])

/* ------------------------------------------------------------------ *
 * Everything below reads the selected programme only ('all' = no filter)
 * ------------------------------------------------------------------ */

function keep(r: ReviewRow): boolean {
  return programmeId.value === 'all' || r.programmeId === programmeId.value
}

const notAsked = computed(() => (board.value?.notAsked ?? []).filter(keep))
const asked = computed(() => (board.value?.asked ?? []).filter(keep))
const received = computed(() => (board.value?.received ?? []).filter(keep))
const suppressed = computed(() => (board.value?.suppressed ?? []).filter(keep))

/** Scheduled asks — a B2B delayed job whose ask is dated, not sent yet. */
const scheduled = computed(() => notAsked.value.filter((r) => r.scheduledFor))

/** Codes actually issued — auto for 5★, manual after CS verifies a screenshot. */
const issued = computed(() => received.value.filter((r) => r.reward))

/** Proof is in but no voucher yet — the customer is waiting on their thank-you. */
const awaiting = computed(() =>
  received.value.filter((r) => !r.reward && (r.screenshot || (r.platforms?.length ?? 0) > 0))
)

const avgRating = computed(() => {
  const rated = received.value.filter((r) => r.rating)
  if (!rated.length) return null
  return Math.round((rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length) * 10) / 10
})

const stats = computed<Array<{ key: string; label: string; n: number; icon: string; cls: string; sub?: string | null }>>(() => [
  { key: 'asked', label: 'Pending asks', n: asked.value.length, icon: 'i-lucide-send', cls: 'text-sky-600' },
  { key: 'held', label: 'Held', n: suppressed.value.length, icon: 'i-lucide-pause-circle', cls: 'text-zinc-600' },
  {
    key: 'received',
    label: 'Reviews received',
    n: received.value.length,
    icon: 'i-lucide-star',
    cls: 'text-amber-500',
    sub: avgRating.value ? `avg ${avgRating.value}★` : null
  },
  { key: 'issued', label: 'Vouchers issued', n: issued.value.length, icon: 'i-lucide-gift', cls: 'text-emerald-600' }
])

/** Job id → client name / programme, so the outbox can name and filter its rows. */
const rowsById = computed(() => {
  const m: Record<string, ReviewRow> = {}
  for (const lane of [board.value?.notAsked, board.value?.asked, board.value?.received, board.value?.suppressed])
    for (const r of lane ?? []) m[r.id] = r
  return m
})

const clientById = computed(() => {
  const m: Record<string, string> = {}
  for (const [id, r] of Object.entries(rowsById.value)) m[id] = r.client
  return m
})

const outbox = computed(() =>
  (outboxAll.value ?? [])
    .filter((e) => programmeId.value === 'all' || rowsById.value[e.shipmentId]?.programmeId === programmeId.value)
    .slice(0, 10)
)

const alertLine = computed(() => {
  const heldByClaim = suppressed.value.filter((r) => r.claimOpen).length
  const reminded = asked.value.filter((r) => r.reaskCount).length
  const bits = [
    `${notAsked.value.length} delivery awaiting an ask`,
    `${heldByClaim} held by an open claim`,
    `${reminded} reminded`,
    `${awaiting.value.length} proof awaiting verification`
  ]
  if (scheduled.value.length) bits.splice(1, 0, `${scheduled.value.length} ask scheduled for later`)
  return `${bits.join(' · ')}.`
})

/** One line the demo can read out: who converts best, who buys reviews cheapest. */
const winner = computed(() => {
  const converting = programmes.value.filter((p) => p.conversion !== null)
  const priced = programmes.value.filter((p) => p.costPerReview !== null)
  if (!converting.length && !priced.length) return null
  const best = converting.slice().sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0]
  const cheapest = priced.slice().sort((a, b) => (a.costPerReview ?? 0) - (b.costPerReview ?? 0))[0]
  const bits: string[] = []
  if (best) bits.push(`${best.short} converts best — ${best.conversion}% of asks come back as a review`)
  if (cheapest && cheapest.vouchers) bits.push(`${cheapest.short} buys the cheapest review at SGD ${cheapest.costPerReview!.toFixed(2)}`)
  else if (cheapest) bits.push(`${cheapest.short} has not paid for a review yet — SGD 0 so far`)
  return bits.join(' · ') + '.'
})

/** Pending asks / Held read either as one row per job or folded under the client. */
const groupBy = ref<'job' | 'client'>('job')

const askedByClient = computed(() => {
  const g: Record<string, ReviewRow[]> = {}
  for (const r of asked.value) (g[r.title ?? r.client] ??= []).push(r)
  return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
})

const suppressedByClient = computed(() => {
  const g: Record<string, ReviewRow[]> = {}
  for (const r of suppressed.value) (g[r.title ?? r.client] ??= []).push(r)
  return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
})

/** Used until the shared programme definitions land — the original global rules. */
const FALLBACK_RULES = [
  { icon: 'i-lucide-package-check', text: 'Ask goes out on delivery — the moment the customer signs off.' },
  { icon: 'i-lucide-shield-alert', text: 'Held automatically while a claim is open; CS releases it once the claim closes.' },
  { icon: 'i-lucide-bell-ring', text: '48h reminder, twice at most — then we stop chasing.' },
  { icon: 'i-lucide-star', text: '5★ earns the thank-you code instantly, no CS step.' },
  { icon: 'i-lucide-shield-check', text: 'Google / Facebook proof → CS verifies the screenshot → voucher.' }
]

const rules = computed(() => selected.value?.rules ?? definitions.value[0]?.rules ?? FALLBACK_RULES)
const rulesTitle = computed(() => selected.value?.name ?? 'Programme rules')

/** Nuxt UI colour → the few utility classes the strip paints by hand. */
const BAR: Record<string, string> = {
  primary: 'bg-primary-500', success: 'bg-emerald-500', info: 'bg-sky-500',
  warning: 'bg-amber-500', neutral: 'bg-zinc-400', error: 'bg-rose-500'
}
const TONE: Record<string, string> = {
  primary: 'text-primary-600', success: 'text-emerald-600', info: 'text-sky-600',
  warning: 'text-amber-600', neutral: 'text-zinc-600', error: 'text-rose-600'
}

function colourOf(id?: string | null): ReviewProgramme['color'] {
  return programmes.value.find((p) => p.id === id)?.color ?? definitionOf(id)?.color ?? 'neutral'
}

function when(at?: string): string {
  if (!at) return '—'
  return new Date(at).toLocaleString('en-SG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function day(at?: string): string {
  if (!at) return '—'
  return new Date(at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function stars(n?: number): string {
  return n ? '★'.repeat(n) : '—'
}

function to(addr: string): string {
  return addr.replace(/\s*<.*>$/, '')
}

function money(n?: number | null): string {
  return n === null || n === undefined ? '—' : `SGD ${n.toFixed(2)}`
}

const PLATFORM_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook' }
const KIND_LABEL: Record<string, string> = { review: 'Review ask', reward: 'Voucher' }
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Review programme" icon="i-lucide-gift">
        <template #right>
          <UButton to="/ops/reviews" icon="i-lucide-star" color="neutral" variant="outline" size="sm" label="Reviews board" />
          <DemoHowTo page="ops-rewards" />
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
          <div v-if="s.sub" class="text-[11px] text-zinc-400">{{ s.sub }}</div>
        </UPageCard>
      </div>

      <!-- Programme switcher — everything below reads the selection -->
      <div v-if="programmes.length" class="shrink-0 flex flex-wrap items-center gap-3">
        <UTabs
          v-model="programmeId"
          :items="TABS"
          :content="false"
          color="primary"
          variant="pill"
          size="sm"
          :ui="{ list: 'bg-zinc-100' }"
        />
        <span class="text-[11px] text-zinc-400">
          {{ selected ? `${selected.audience} · ${selected.trigger}` : 'Three programmes running side by side' }}
        </span>
      </div>

      <!-- Comparison strip — all three, always, the selected one ringed -->
      <div v-if="programmes.length" class="shrink-0 space-y-2">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="p in programmes"
            :key="p.id"
            type="button"
            class="rounded-xl border bg-white p-3 sm:p-4 text-left transition"
            :class="programmeId === p.id
              ? 'border-primary-300 ring-2 ring-primary-500/40'
              : 'border-zinc-200 hover:border-zinc-300'"
            @click="programmeId = p.id"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="p.icon" class="size-4 shrink-0" :class="TONE[p.color] ?? 'text-zinc-600'" />
              <span class="text-sm font-semibold text-zinc-900 truncate">{{ p.short }}</span>
              <UBadge :label="p.rewardValue" :color="p.color" variant="subtle" size="sm" class="ms-auto shrink-0" />
            </div>
            <p class="mt-0.5 text-[11px] text-zinc-400 truncate">{{ p.trigger }}</p>

            <div class="mt-3 flex items-baseline gap-1.5">
              <span class="text-2xl font-bold tabular-nums text-zinc-900">{{ p.conversion ?? '—' }}</span>
              <span v-if="p.conversion !== null" class="text-sm font-semibold text-zinc-500">%</span>
              <span class="text-[11px] text-zinc-500">ask → review</span>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                class="h-full rounded-full transition-all"
                :class="BAR[p.color] ?? 'bg-zinc-400'"
                :style="{ width: `${p.conversion ?? 0}%` }"
              />
            </div>

            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-zinc-500">Asks sent</dt>
                <dd class="font-semibold tabular-nums text-zinc-800">{{ p.asked }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-zinc-500">Reviews</dt>
                <dd class="font-semibold tabular-nums text-zinc-800">{{ p.received }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-zinc-500">Avg rating</dt>
                <dd class="font-semibold tabular-nums text-amber-500">{{ p.avgRating ? `${p.avgRating}★` : '—' }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-zinc-500">Vouchers</dt>
                <dd class="font-semibold tabular-nums text-emerald-600">{{ p.vouchers }}</dd>
              </div>
              <div class="col-span-2 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-1.5">
                <dt class="text-zinc-500">Cost per review</dt>
                <dd class="font-semibold tabular-nums text-zinc-900">{{ money(p.costPerReview) }}</dd>
              </div>
            </dl>
          </button>
        </div>

        <p v-if="winner" class="flex items-start gap-1.5 text-[11px] text-zinc-500">
          <UIcon name="i-lucide-trophy" class="size-3.5 shrink-0 text-amber-500 mt-px" />
          <span>{{ winner }}</span>
        </p>
      </div>

      <UAlert
        class="shrink-0"
        color="primary"
        variant="subtle"
        icon="i-lucide-info"
        title="The programme runs itself — CS only steps in to verify a public review or release a held ask."
        :description="alertLine"
        :ui="{ title: 'text-sm', description: 'text-xs' }"
      />

      <!-- Programme rules — the selected programme, or all three side by side -->
      <UCard class="shrink-0" :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <UIcon :name="selected?.icon ?? 'i-lucide-list-checks'" class="size-4 text-primary-600" />
            <h2 class="text-sm font-semibold text-zinc-900">{{ rulesTitle }}</h2>
            <UBadge
              v-if="selected"
              :label="selected.reward.value"
              :color="selected.color"
              variant="subtle"
              size="sm"
            />
            <UBadge label="Automatic" color="primary" variant="subtle" size="sm" class="ms-auto" />
          </div>
        </template>

        <!-- one programme selected -->
        <template v-if="selected">
          <p class="mb-3 text-xs text-zinc-500">{{ selected.description }} · {{ selected.audience }}</p>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="r in rules" :key="r.text" class="flex items-start gap-2">
              <UIcon :name="r.icon" class="size-4 text-primary-500 mt-0.5 shrink-0" />
              <span class="text-xs text-zinc-600 leading-relaxed">{{ r.text }}</span>
            </li>
          </ul>
        </template>

        <!-- all three, compact -->
        <div v-else-if="definitions.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="p in definitions" :key="p.id" class="min-w-0">
            <div class="flex items-center gap-2">
              <UIcon :name="p.icon" class="size-4 shrink-0" :class="TONE[p.color] ?? 'text-zinc-600'" />
              <h3 class="text-xs font-semibold text-zinc-900 truncate">{{ p.name }}</h3>
            </div>
            <p class="mt-1 text-[11px] text-zinc-500">{{ p.trigger }} · {{ p.reward.value }}</p>
            <ul class="mt-2 space-y-1.5">
              <li v-for="r in p.rules.slice(0, 2)" :key="r.text" class="flex items-start gap-2">
                <UIcon :name="r.icon" class="size-3.5 text-primary-500 mt-0.5 shrink-0" />
                <span class="text-[11px] text-zinc-600 leading-relaxed">{{ r.text }}</span>
              </li>
            </ul>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              label="See all rules"
              class="mt-1 -ms-2"
              @click="programmeId = p.id"
            />
          </div>
        </div>

        <ul v-else class="grid gap-2 sm:grid-cols-2">
          <li v-for="r in rules" :key="r.text" class="flex items-start gap-2">
            <UIcon :name="r.icon" class="size-4 text-primary-500 mt-0.5 shrink-0" />
            <span class="text-xs text-zinc-600 leading-relaxed">{{ r.text }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Codes issued -->
      <UCard class="shrink-0" :ui="{ header: 'p-4 sm:px-5', body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-ticket" class="size-4 text-emerald-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Reward codes issued</h2>
            <UBadge v-if="issued.length" :label="String(issued.length)" color="neutral" variant="subtle" size="sm" />
          </div>
        </template>

        <p v-if="!issued.length" class="px-5 py-6 text-sm text-zinc-500">
          No voucher codes issued yet — they appear here the moment a 5★ review lands or CS approves a screenshot.
        </p>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs font-medium text-zinc-500 border-b border-zinc-200">
              <tr>
                <th class="px-5 py-2.5 font-medium">Code</th>
                <th class="px-3 py-2.5 font-medium">Value</th>
                <th v-if="programmeId === 'all'" class="px-3 py-2.5 font-medium">Programme</th>
                <th class="px-3 py-2.5 font-medium">Job</th>
                <th class="px-3 py-2.5 font-medium">Customer</th>
                <th class="px-3 py-2.5 font-medium">Rating</th>
                <th class="px-3 py-2.5 font-medium">Issued</th>
                <th class="px-3 py-2.5 font-medium">Claimed</th>
                <th class="px-5 py-2.5 font-medium text-right">Customer view</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100">
              <tr v-for="r in issued" :key="r.id" class="hover:bg-zinc-50">
                <td class="px-5 py-2.5 font-mono text-xs font-semibold text-zinc-900">{{ r.reward!.code }}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <UBadge :label="r.reward!.value ?? r.rewardValue ?? 'Voucher'" color="success" variant="subtle" size="sm" />
                </td>
                <td v-if="programmeId === 'all'" class="px-3 py-2.5 whitespace-nowrap">
                  <UBadge v-if="r.programme" :label="r.programme" :color="colourOf(r.programmeId)" variant="subtle" size="sm" />
                </td>
                <td class="px-3 py-2.5">
                  <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                </td>
                <td class="px-3 py-2.5 text-zinc-700">
                  {{ r.client }}
                  <span v-if="r.customerName && r.customerName !== r.client" class="block text-xs text-zinc-500">{{ r.customerName }}</span>
                </td>
                <td class="px-3 py-2.5 text-amber-500 whitespace-nowrap">{{ stars(r.rating) }}</td>
                <td class="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs">{{ when(r.reward!.at) }}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <UBadge label="Voucher email sent" color="info" variant="subtle" size="sm" icon="i-lucide-mail-check" />
                </td>
                <td class="px-5 py-2.5 text-right">
                  <NuxtLink :to="`/review/${r.id}`" class="text-xs font-medium text-zinc-500 hover:text-primary-600 hover:underline">Customer view</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Pending claim of reward — proof is in, the voucher is not out yet -->
      <UCard class="shrink-0" :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-hourglass" class="size-4 text-primary-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Pending claim of reward</h2>
            <UBadge v-if="awaiting.length" :label="String(awaiting.length)" color="warning" variant="subtle" size="sm" />
          </div>
        </template>

        <p v-if="!awaiting.length" class="text-sm text-zinc-500">
          Nothing pending — every public-review proof has been verified and paid.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="r in awaiting"
            :key="r.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
          >
            <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
            <span class="text-sm text-zinc-700">{{ r.title ?? r.client }}</span>
            <span
              v-if="r.customerName && r.customerName !== (r.title ?? r.client)"
              class="text-xs text-zinc-400 truncate"
            >{{ r.customerName }}</span>
            <UBadge
              v-if="programmeId === 'all' && r.programme"
              :label="r.programme"
              :color="colourOf(r.programmeId)"
              variant="subtle"
              size="sm"
            />
            <span class="text-amber-500 text-sm">{{ stars(r.rating) }}</span>
            <span class="flex items-center gap-1.5">
              <UBadge
                v-for="p in r.platforms ?? []"
                :key="p"
                :label="PLATFORM_LABEL[p] ?? p"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge v-if="r.screenshot" label="Screenshot" color="info" variant="subtle" size="sm" icon="i-lucide-image" />
            </span>
            <UButton
              to="/ops/reviews"
              size="xs"
              color="neutral"
              variant="outline"
              label="Open on Reviews board"
              icon="i-lucide-external-link"
              class="ms-auto"
            />
          </li>
        </ul>
        <p class="mt-3 text-[11px] text-zinc-400">
          Customer sent proof of a public review and is waiting on the {{ selectedReward ?? 'thank-you voucher' }} — CS verifies the screenshot on the Reviews board.
        </p>
      </UCard>

      <!-- Outbox strip -->
      <UCard class="shrink-0" :ui="{ header: 'p-4 sm:px-5', body: 'p-0 sm:p-0', footer: 'p-3 sm:px-5' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-mail" class="size-4 text-sky-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Programme outbox</h2>
            <UBadge v-if="outbox.length" :label="String(outbox.length)" color="neutral" variant="subtle" size="sm" />
            <span class="ms-auto text-[11px] text-zinc-400">last 10 review + voucher emails</span>
          </div>
        </template>

        <p v-if="!outbox.length" class="px-5 py-6 text-sm text-zinc-500">
          Nothing sent yet — the review ask and the voucher email both land here.
        </p>

        <ul v-else class="divide-y divide-zinc-100">
          <li v-for="e in outbox" :key="e.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 hover:bg-zinc-50">
            <UBadge
              :label="KIND_LABEL[mailKindOf(e)] ?? mailKindOf(e)"
              :color="mailKindOf(e) === 'reward' ? 'success' : 'info'"
              variant="subtle"
              size="sm"
              class="shrink-0"
            />
            <NuxtLink
              v-if="e.shipmentId"
              :to="`/ops/jobs/${e.shipmentId}`"
              class="font-mono text-xs font-semibold text-primary-600 hover:underline shrink-0"
            >
              {{ e.shipmentId }}
            </NuxtLink>
            <span class="min-w-0 flex-1 truncate text-sm text-zinc-800">{{ e.subject }}</span>
            <span class="text-xs text-zinc-500 truncate">{{ clientById[e.shipmentId] ? clientById[e.shipmentId] + ' · ' : '' }}{{ to(e.to) }}</span>
            <span class="text-xs text-zinc-400 whitespace-nowrap">{{ when(e.at) }}</span>
          </li>
        </ul>

        <template #footer>
          <NuxtLink to="/ops/inbox" class="text-xs font-medium text-primary-600 hover:underline">Open the full outbox in Inbox →</NuxtLink>
        </template>
      </UCard>

      <!-- Pending / held -->
      <div class="grid gap-4 lg:grid-cols-2 items-start shrink-0">
        <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5', footer: 'p-3 sm:px-5' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-send" class="size-4 text-sky-600" />
              <h2 class="text-sm font-semibold text-zinc-900">Pending asks</h2>
              <UBadge v-if="asked.length" :label="String(asked.length)" color="neutral" variant="subtle" size="sm" />
              <!-- Shared with the Held card — one job per line, or folded under the client. -->
              <div class="ms-auto flex items-center gap-1">
                <UButton
                  size="xs"
                  color="neutral"
                  :variant="groupBy === 'job' ? 'solid' : 'ghost'"
                  label="By job"
                  @click="groupBy = 'job'"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  :variant="groupBy === 'client' ? 'solid' : 'ghost'"
                  label="By client"
                  @click="groupBy = 'client'"
                />
              </div>
            </div>
          </template>

          <!-- B2B delayed: the ask is dated, not sent — it waits three days after delivery. -->
          <div v-if="scheduled.length" class="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Scheduled asks</p>
            <ul class="mt-1.5 space-y-1.5">
              <li v-for="r in scheduled" :key="r.id" class="flex flex-wrap items-baseline gap-2 text-sm">
                <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                <span class="text-zinc-700 truncate">{{ r.title ?? r.client }}</span>
                <UBadge
                  v-if="programmeId === 'all' && r.programme"
                  :label="r.programme"
                  :color="colourOf(r.programmeId)"
                  variant="subtle"
                  size="sm"
                />
                <span class="ms-auto shrink-0 text-xs text-zinc-500">due {{ day(r.scheduledFor) }}</span>
              </li>
            </ul>
          </div>

          <p v-if="!asked.length" class="text-sm text-zinc-500">No review asks are waiting on a reply.</p>
          <ul v-else-if="groupBy === 'job'" class="space-y-2">
            <li v-for="r in asked" :key="r.id" class="flex flex-wrap items-baseline gap-2 text-sm">
              <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
              <span class="text-zinc-700 truncate">{{ r.title ?? r.client }}</span>
              <span
                v-if="r.customerName && r.customerName !== (r.title ?? r.client)"
                class="text-xs text-zinc-400 truncate"
              >{{ r.customerName }}</span>
              <UBadge
                v-if="programmeId === 'all' && r.programme"
                :label="r.programme"
                :color="colourOf(r.programmeId)"
                variant="subtle"
                size="sm"
              />
              <UBadge v-if="r.reaskCount" :label="`Reminded ×${r.reaskCount}`" color="info" variant="subtle" size="sm" />
              <span class="ms-auto shrink-0 text-xs text-zinc-500">asked {{ when(r.askAt) }}</span>
            </li>
          </ul>
          <ul v-else class="space-y-3">
            <li v-for="[client, rows] in askedByClient" :key="client">
              <p class="text-xs font-semibold text-zinc-700">{{ client }}</p>
              <ul class="mt-1 space-y-2">
                <li v-for="r in rows" :key="r.id" class="flex flex-wrap items-baseline gap-2 text-sm">
                  <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                  <span
                    v-if="r.customerName && r.customerName !== (r.title ?? r.client)"
                    class="text-xs text-zinc-400 truncate"
                  >{{ r.customerName }}</span>
                  <UBadge
                    v-if="programmeId === 'all' && r.programme"
                    :label="r.programme"
                    :color="colourOf(r.programmeId)"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge v-if="r.reaskCount" :label="`Reminded ×${r.reaskCount}`" color="info" variant="subtle" size="sm" />
                  <span class="ms-auto shrink-0 text-xs text-zinc-500">asked {{ when(r.askAt) }}</span>
                </li>
              </ul>
            </li>
          </ul>

          <template #footer>
            <NuxtLink to="/ops/reviews" class="text-xs font-medium text-primary-600 hover:underline">Manage on Reviews board →</NuxtLink>
          </template>
        </UCard>

        <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5', footer: 'p-3 sm:px-5' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-pause-circle" class="size-4 text-zinc-600" />
              <h2 class="text-sm font-semibold text-zinc-900">Held</h2>
              <UBadge v-if="suppressed.length" :label="String(suppressed.length)" color="neutral" variant="subtle" size="sm" />
            </div>
          </template>

          <p v-if="!suppressed.length" class="text-sm text-zinc-500">Nothing held — no open claims or CS holds blocking an ask.</p>
          <ul v-else-if="groupBy === 'job'" class="space-y-2.5">
            <li v-for="r in suppressed" :key="r.id" class="text-sm">
              <div class="flex flex-wrap items-baseline gap-2">
                <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                <span class="text-zinc-700 truncate">{{ r.title ?? r.client }}</span>
                <span
                  v-if="r.customerName && r.customerName !== (r.title ?? r.client)"
                  class="text-xs text-zinc-400 truncate"
                >{{ r.customerName }}</span>
                <UBadge
                  v-if="programmeId === 'all' && r.programme"
                  :label="r.programme"
                  :color="colourOf(r.programmeId)"
                  variant="subtle"
                  size="sm"
                />
                <UBadge v-if="r.claimLabel" :label="r.claimLabel" color="error" variant="subtle" size="sm" />
                <span class="ms-auto shrink-0 text-xs text-zinc-500">{{ when(r.deliveredAt) }}</span>
              </div>
              <p class="text-xs text-zinc-500 mt-0.5">{{ r.reason ?? r.gate ?? 'Held by CS' }}</p>
            </li>
          </ul>
          <ul v-else class="space-y-3">
            <li v-for="[client, rows] in suppressedByClient" :key="client">
              <p class="text-xs font-semibold text-zinc-700">{{ client }}</p>
              <ul class="mt-1 space-y-2.5">
                <li v-for="r in rows" :key="r.id" class="text-sm">
                  <div class="flex flex-wrap items-baseline gap-2">
                    <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                    <span
                      v-if="r.customerName && r.customerName !== (r.title ?? r.client)"
                      class="text-xs text-zinc-400 truncate"
                    >{{ r.customerName }}</span>
                    <UBadge
                      v-if="programmeId === 'all' && r.programme"
                      :label="r.programme"
                      :color="colourOf(r.programmeId)"
                      variant="subtle"
                      size="sm"
                    />
                    <UBadge v-if="r.claimLabel" :label="r.claimLabel" color="error" variant="subtle" size="sm" />
                    <span class="ms-auto shrink-0 text-xs text-zinc-500">{{ when(r.deliveredAt) }}</span>
                  </div>
                  <p class="text-xs text-zinc-500 mt-0.5">{{ r.reason ?? r.gate ?? 'Held by CS' }}</p>
                </li>
              </ul>
            </li>
          </ul>

          <template #footer>
            <NuxtLink to="/ops/reviews" class="text-xs font-medium text-primary-600 hover:underline">Manage on Reviews board →</NuxtLink>
          </template>
        </UCard>
      </div>

      <p class="text-xs text-zinc-400 shrink-0">
        Demo — codes are generated locally; every review ask and voucher email lands in the ops Inbox outbox.
      </p>
    </template>
  </UDashboardPanel>
</template>
