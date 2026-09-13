<script setup lang="ts">
import type { OutboxEmail } from '#shared/utils/shipping'
import { mailKindOf } from '#shared/utils/shipping'
import type { ReviewRow } from '~/components/ops/ReviewColumn.vue'

/**
 * Review programme — the read-only view of the reward loop.
 * Every action (reminder / hold / release / approve a Google-Facebook proof)
 * lives on the Reviews board; this page shows what the programme produced:
 * codes issued, proof still to verify, and the emails that actually went out.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Review programme — M&P ops' })

interface ReviewBoard {
  notAsked: ReviewRow[]
  asked: ReviewRow[]
  received: ReviewRow[]
  suppressed: ReviewRow[]
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
  notAsked: [], asked: [], received: [], suppressed: [],
  counts: {
    notAsked: 0, asked: 0, received: 0, held: 0, heldByClaim: 0,
    reminded: 0, issued: 0, awaitingVerification: 0, avgRating: null
  }
}

const { data: board } = await useFetch<ReviewBoard>('/api/reviews', { default: () => EMPTY })

/** The flyer / voucher mail the programme actually sent — same outbox as /ops/inbox. */
const { data: outbox } = await useFetch<OutboxEmail[]>('/api/emails', {
  default: () => [],
  transform: (rows) =>
    ((rows ?? []) as OutboxEmail[])
      .filter((e) => ['review', 'reward'].includes(mailKindOf(e)))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10)
})

const asked = computed(() => board.value?.asked ?? [])
const received = computed(() => board.value?.received ?? [])
const suppressed = computed(() => board.value?.suppressed ?? [])
const counts = computed(() => board.value?.counts ?? EMPTY.counts)

/** Codes actually issued — auto for 5★, manual after CS verifies a screenshot. */
const issued = computed(() => received.value.filter((r) => r.reward))

/** Proof is in but no voucher yet — CS approves it on the Reviews board. */
const awaiting = computed(() =>
  received.value.filter((r) => !r.reward && (r.screenshot || (r.platforms?.length ?? 0) > 0))
)

const stats = computed(() => [
  { key: 'asked', label: 'Pending asks', n: asked.value.length, icon: 'i-lucide-send', cls: 'text-sky-600' },
  { key: 'held', label: 'Held', n: suppressed.value.length, icon: 'i-lucide-pause-circle', cls: 'text-zinc-600' },
  { key: 'received', label: 'Received', n: received.value.length, icon: 'i-lucide-star', cls: 'text-amber-500' },
  { key: 'issued', label: 'Vouchers issued', n: issued.value.length, icon: 'i-lucide-gift', cls: 'text-emerald-600' }
])

const RULES = [
  { icon: 'i-lucide-package-check', text: 'Ask goes out on delivery — the moment the customer signs off.' },
  { icon: 'i-lucide-shield-alert', text: 'Held automatically while a claim is open; CS releases it once the claim closes.' },
  { icon: 'i-lucide-bell-ring', text: '48h reminder, twice at most — then we stop chasing.' },
  { icon: 'i-lucide-star', text: '5★ earns a Grab $10 thank-you code instantly, no CS step.' },
  { icon: 'i-lucide-shield-check', text: 'Google / Facebook proof → CS verifies the screenshot → Grab $10.' }
]

function when(at?: string): string {
  if (!at) return '—'
  return new Date(at).toLocaleString('en-SG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function stars(n?: number): string {
  return n ? '★'.repeat(n) : '—'
}

function to(addr: string): string {
  return addr.replace(/\s*<.*>$/, '')
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
        </UPageCard>
      </div>

      <UAlert
        class="shrink-0"
        color="primary"
        variant="subtle"
        icon="i-lucide-info"
        title="The programme runs itself — CS only steps in to verify a public review or release a held ask."
        :description="`${counts.notAsked} delivery awaiting an ask · ${counts.heldByClaim} held by an open claim · ${counts.reminded} reminded · ${counts.awaitingVerification} proof awaiting verification.`"
        :ui="{ title: 'text-sm', description: 'text-xs' }"
      />

      <!-- Programme rules -->
      <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-list-checks" class="size-4 text-primary-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Programme rules</h2>
            <UBadge label="Automatic" color="primary" variant="subtle" size="sm" class="ms-auto" />
          </div>
        </template>

        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="r in RULES" :key="r.text" class="flex items-start gap-2">
            <UIcon :name="r.icon" class="size-4 text-primary-500 mt-0.5 shrink-0" />
            <span class="text-xs text-zinc-600 leading-relaxed">{{ r.text }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Codes issued -->
      <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-0 sm:p-0' }">
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
                  <UBadge :label="r.reward!.value ?? 'Grab $10'" color="success" variant="subtle" size="sm" />
                </td>
                <td class="px-3 py-2.5">
                  <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                </td>
                <td class="px-3 py-2.5 text-zinc-700">{{ r.client }}</td>
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

      <!-- Pending claim of reward -->
      <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-hourglass" class="size-4 text-primary-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Pending claim of reward</h2>
            <UBadge v-if="issued.length" :label="String(issued.length)" color="primary" variant="subtle" size="sm" />
          </div>
        </template>

        <p v-if="!issued.length" class="text-sm text-zinc-500">
          Nothing out yet — issued codes sit here until the customer redeems them.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="r in issued"
            :key="r.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
          >
            <span class="font-mono text-xs font-semibold text-zinc-900">{{ r.reward!.code }}</span>
            <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
            <span class="text-sm text-zinc-700 truncate">{{ r.client }}</span>
            <UBadge label="Voucher email sent" color="info" variant="subtle" size="sm" icon="i-lucide-mail-check" />
            <span class="ms-auto text-xs text-zinc-400">issued {{ when(r.reward!.at) }}</span>
          </li>
        </ul>
        <p class="mt-3 text-[11px] text-zinc-400">
          Demo — redemption happens at Grab, so a code stays here until the customer tells us they used it.
        </p>
      </UCard>

      <!-- Awaiting verification -->
      <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="size-4 text-amber-600" />
            <h2 class="text-sm font-semibold text-zinc-900">Awaiting verification</h2>
            <UBadge v-if="awaiting.length" :label="String(awaiting.length)" color="warning" variant="subtle" size="sm" />
          </div>
        </template>

        <p v-if="!awaiting.length" class="text-sm text-zinc-500">
          Nothing waiting — every public-review proof has been checked.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="r in awaiting"
            :key="r.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
          >
            <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
            <span class="text-sm text-zinc-700">{{ r.client }}</span>
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
      </UCard>

      <!-- Outbox strip -->
      <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-0 sm:p-0', footer: 'p-3 sm:px-5' }">
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
            <span class="text-xs text-zinc-500 truncate">{{ to(e.to) }}</span>
            <span class="text-xs text-zinc-400 whitespace-nowrap">{{ when(e.at) }}</span>
          </li>
        </ul>

        <template #footer>
          <NuxtLink to="/ops/inbox" class="text-xs font-medium text-primary-600 hover:underline">Open the full outbox in Inbox →</NuxtLink>
        </template>
      </UCard>

      <!-- Pending / held -->
      <div class="grid gap-4 lg:grid-cols-2 items-start">
        <UCard :ui="{ header: 'p-4 sm:px-5', body: 'p-4 sm:p-5', footer: 'p-3 sm:px-5' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-send" class="size-4 text-sky-600" />
              <h2 class="text-sm font-semibold text-zinc-900">Pending asks</h2>
              <UBadge v-if="asked.length" :label="String(asked.length)" color="neutral" variant="subtle" size="sm" />
            </div>
          </template>

          <p v-if="!asked.length" class="text-sm text-zinc-500">No review asks are waiting on a reply.</p>
          <ul v-else class="space-y-2">
            <li v-for="r in asked" :key="r.id" class="flex flex-wrap items-baseline gap-2 text-sm">
              <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
              <span class="text-zinc-700 truncate">{{ r.client }}</span>
              <UBadge v-if="r.reaskCount" :label="`Reminded ×${r.reaskCount}`" color="info" variant="subtle" size="sm" />
              <span class="ms-auto shrink-0 text-xs text-zinc-500">asked {{ when(r.askAt) }}</span>
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

          <p v-if="!suppressed.length" class="text-sm text-zinc-500">Nothing held — no open claims blocking an ask.</p>
          <ul v-else class="space-y-2.5">
            <li v-for="r in suppressed" :key="r.id" class="text-sm">
              <div class="flex flex-wrap items-baseline gap-2">
                <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                <span class="text-zinc-700 truncate">{{ r.client }}</span>
                <UBadge v-if="r.claimLabel" :label="r.claimLabel" color="error" variant="subtle" size="sm" />
                <span class="ms-auto shrink-0 text-xs text-zinc-500">{{ when(r.deliveredAt) }}</span>
              </div>
              <p v-if="r.reason" class="text-xs text-zinc-500 mt-0.5">{{ r.reason }}</p>
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
