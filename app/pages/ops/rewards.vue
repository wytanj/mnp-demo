<script setup lang="ts">
import type { ReviewRow } from '~/components/ops/ReviewColumn.vue'

/**
 * Review programme — the thin read-only view of the reward loop.
 * Every action (nudge / release / approve a Google-Facebook proof) lives on the
 * Reviews board; this page just shows what the programme has produced.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Review programme — M&P ops' })

interface ReviewBoard {
  asked: ReviewRow[]
  received: ReviewRow[]
  suppressed: ReviewRow[]
}

const { data: board } = await useFetch<ReviewBoard>('/api/reviews', {
  default: () => ({ asked: [], received: [], suppressed: [] })
})

const asked = computed(() => board.value?.asked ?? [])
const received = computed(() => board.value?.received ?? [])
const suppressed = computed(() => board.value?.suppressed ?? [])

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

function when(at?: string): string {
  if (!at) return '—'
  return new Date(at).toLocaleString('en-SG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function stars(n?: number): string {
  return n ? '★'.repeat(n) : '—'
}

const PLATFORM_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook' }
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
        title="How it works"
        description="Ask goes out on delivery, held while a claim is open, 5★ earns a thank-you voucher automatically, Google/Facebook proof is verified by CS before a Grab voucher is sent."
        :ui="{ title: 'text-sm', description: 'text-xs' }"
      />

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
                <td class="px-5 py-2.5 text-right">
                  <NuxtLink :to="`/review/${r.id}`" class="text-xs font-medium text-zinc-500 hover:text-primary-600 hover:underline">Customer view</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <li v-for="r in asked" :key="r.id" class="flex items-baseline gap-2 text-sm">
              <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
              <span class="text-zinc-700 truncate">{{ r.client }}</span>
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
              <div class="flex items-baseline gap-2">
                <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-xs font-semibold text-primary-600 hover:underline">{{ r.id }}</NuxtLink>
                <span class="text-zinc-700 truncate">{{ r.client }}</span>
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
        Demo — codes are generated locally; the voucher email lands in the ops Inbox outbox.
      </p>
    </template>
  </UDashboardPanel>
</template>
