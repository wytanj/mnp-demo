<script setup lang="ts">
import type { ClaimType } from '#shared/utils/shipping'

export interface ReviewRow {
  id: string
  client: string
  contact: string
  title?: string
  description?: string
  customerName?: string
  customerEmail?: string
  deliveredAt?: string
  askAt?: string
  state: string
  rating?: number
  comment?: string
  helpedBy?: string
  reason?: string
  reward?: { code: string; at: string; value?: string }
  platforms?: Array<'google' | 'facebook'>
  screenshot?: string
  reaskAt?: string
  reaskCount?: number
  reaskDueAt?: string
  claimType?: ClaimType
  claimLabel?: string
  claimOpen?: boolean
  gate?: string
}

export type ReviewLane = 'not_asked' | 'asked' | 'received' | 'held'

/** Reasons CS picks from when holding an ask by hand. */
const HOLD_REASONS = [
  'Damage',
  'Missing item',
  'Destination fee dispute',
  'Unhappy on call',
  'Other'
] as const

/** Max reminders — mirrors REASK_MAX in server/utils/review.ts. */
const REASK_MAX = 2

/** One lane of the review board: not asked, asked, received or held. */
const props = defineProps<{
  kind: ReviewLane
  rows: ReviewRow[]
  busy?: string | null
}>()

const emit = defineEmits<{
  send: [row: ReviewRow]
  reask: [row: ReviewRow]
  suppress: [payload: { row: ReviewRow; reason: string }]
  reward: [payload: { row: ReviewRow; code: string }]
  release: [row: ReviewRow]
  hold: [row: ReviewRow]
}>()

const codes = reactive<Record<string, string>>({})
const reasons = reactive<Record<string, string>>({})
const holding = reactive<Record<string, boolean>>({})

const META: Record<ReviewLane, { title: string; icon: string; tone: string; empty: string }> = {
  not_asked: {
    title: 'Not asked yet',
    icon: 'i-lucide-inbox',
    tone: 'text-zinc-500',
    empty: 'Every finished delivery has had its ask — this fills the moment one signs off.'
  },
  asked: { title: 'Asked', icon: 'i-lucide-send', tone: 'text-sky-600', empty: 'No outstanding asks.' },
  received: { title: 'Received', icon: 'i-lucide-star', tone: 'text-amber-500', empty: 'No reviews in yet.' },
  held: { title: 'Held', icon: 'i-lucide-pause-circle', tone: 'text-zinc-500', empty: 'Nothing held back.' }
}

const meta = computed(() => {
  const base = META[props.kind]
  if (props.kind !== 'held') return base
  // Name the actual reason the lane exists when a claim is what is holding it.
  const byClaim = props.rows.some((r) => r.claimOpen)
  return { ...base, title: byClaim ? 'Held (claim open)' : 'Held' }
})

function when(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function day(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function name(contact: string): string {
  return contact.replace(/\s*<.*>$/, '')
}

function maxedOut(r: ReviewRow): boolean {
  return (r.reaskCount ?? 0) >= REASK_MAX
}

function confirmHold(r: ReviewRow) {
  const reason = reasons[r.id] || HOLD_REASONS[0]
  emit('suppress', { row: r, reason })
  holding[r.id] = false
}
</script>

<template>
  <section class="rounded-xl border border-zinc-200 bg-white flex flex-col min-h-0">
    <header class="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100">
      <UIcon :name="meta.icon" class="size-4" :class="meta.tone" />
      <h3 class="text-xs font-bold uppercase tracking-wide text-zinc-600">{{ meta.title }}</h3>
      <UBadge :label="String(rows.length)" color="neutral" variant="subtle" size="sm" class="ms-auto" />
    </header>

    <div class="p-2.5 space-y-2.5">
      <p v-if="!rows.length" class="text-xs text-zinc-400 px-1 py-3 text-center">{{ meta.empty }}</p>

      <article
        v-for="r in rows"
        :key="r.id"
        class="rounded-lg border border-zinc-200 p-3"
        :class="kind === 'held' ? 'bg-zinc-50' : 'bg-white'"
      >
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-zinc-900 truncate">{{ r.client }}</p>
            <p class="text-[11px] text-zinc-500 truncate">{{ name(r.contact) }}</p>
          </div>
          <NuxtLink :to="`/ops/jobs/${r.id}`" class="font-mono text-[11px] font-bold text-zinc-500 hover:text-primary-600 shrink-0">
            {{ r.id }}
          </NuxtLink>
        </div>

        <!-- NOT ASKED YET -->
        <template v-if="kind === 'not_asked'">
          <dl class="mt-2 text-[11px] text-zinc-500 space-y-0.5">
            <div class="flex gap-2"><dt class="w-20 shrink-0">Delivered</dt><dd>{{ when(r.deliveredAt) }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0">Ask</dt><dd>never sent</dd></div>
          </dl>
          <div class="mt-2.5 flex gap-2">
            <UButton
              icon="i-lucide-send"
              size="xs"
              color="primary"
              label="Send ask now"
              :loading="busy === r.id"
              @click="emit('send', r)"
            />
            <UButton
              :to="`/ops/jobs/${r.id}`"
              icon="i-lucide-arrow-up-right"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Open job"
            />
          </div>
        </template>

        <!-- ASKED -->
        <template v-else-if="kind === 'asked'">
          <dl class="mt-2 text-[11px] text-zinc-500 space-y-0.5">
            <div class="flex gap-2"><dt class="w-20 shrink-0">Delivered</dt><dd>{{ when(r.deliveredAt) }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0">Asked</dt><dd>{{ when(r.askAt) }}</dd></div>
          </dl>

          <p v-if="r.reaskCount" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <UBadge
              :label="`Reminded ×${r.reaskCount}`"
              :color="maxedOut(r) ? 'neutral' : 'info'"
              variant="subtle"
              size="sm"
              icon="i-lucide-bell-ring"
            />
            <span class="text-zinc-500">
              <template v-if="maxedOut(r)">no more reminders — we stop at {{ REASK_MAX }}</template>
              <template v-else>next due {{ day(r.reaskDueAt) }}</template>
            </span>
          </p>

          <div v-if="!holding[r.id]" class="mt-2.5 flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-bell-ring"
              size="xs"
              color="primary"
              variant="subtle"
              :label="maxedOut(r) ? 'Max reminders reached' : 'Send 48h reminder'"
              :disabled="maxedOut(r)"
              :loading="busy === r.id"
              @click="emit('reask', r)"
            />
            <UButton
              icon="i-lucide-pause"
              size="xs"
              color="neutral"
              variant="outline"
              label="Hold"
              @click="holding[r.id] = true"
            />
            <UButton
              :to="`/review/${r.id}`"
              target="_blank"
              icon="i-lucide-external-link"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Review page"
            />
          </div>

          <div v-else class="mt-2.5 space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <p class="text-[11px] font-medium text-zinc-600">Hold this ask — reason</p>
            <USelect
              v-model="reasons[r.id]"
              :items="[...HOLD_REASONS]"
              size="xs"
              placeholder="Damage"
              class="w-full"
            />
            <div class="flex gap-1.5">
              <UButton size="xs" color="primary" label="Hold ask" :loading="busy === r.id" @click="confirmHold(r)" />
              <UButton size="xs" color="neutral" variant="ghost" label="Cancel" @click="holding[r.id] = false" />
            </div>
          </div>
        </template>

        <!-- RECEIVED -->
        <template v-else-if="kind === 'received'">
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <span class="text-amber-500 text-sm tracking-tight" :aria-label="`${r.rating} out of 5`">
              {{ '★'.repeat(r.rating ?? 0) }}<span class="text-zinc-200">{{ '★'.repeat(5 - (r.rating ?? 0)) }}</span>
            </span>
            <UBadge
              v-for="p in r.platforms ?? []"
              :key="p"
              :label="p === 'google' ? 'Google' : 'Facebook'"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </div>
          <p v-if="r.comment" class="mt-1.5 text-xs text-zinc-700 leading-relaxed">“{{ r.comment }}”</p>
          <p v-if="r.helpedBy" class="mt-1 text-[11px] text-zinc-500">
            <UIcon name="i-lucide-user-round-check" class="size-3 align-[-2px]" /> Praised {{ r.helpedBy }}
          </p>

          <div v-if="r.reward" class="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <UBadge :label="r.reward.code" color="success" variant="subtle" size="sm" class="font-mono" />
            <span class="text-[11px] text-zinc-400">{{ r.reward.value ?? 'reward' }} sent {{ when(r.reward.at) }}</span>
          </div>
          <div v-else class="mt-2.5 flex gap-1.5">
            <UInput v-model="codes[r.id]" size="xs" placeholder="auto MP-THANKS-…" class="flex-1 min-w-0" />
            <UButton
              size="xs"
              color="primary"
              label="Approve reward"
              :loading="busy === r.id"
              @click="emit('reward', { row: r, code: (codes[r.id] ?? '').trim() })"
            />
          </div>
        </template>

        <!-- HELD -->
        <template v-else>
          <div class="mt-2 flex items-center gap-1.5 flex-wrap">
            <UBadge v-if="r.claimLabel" :label="r.claimLabel" color="error" variant="subtle" size="sm" />
            <UBadge label="Ask held" color="neutral" variant="subtle" size="sm" />
          </div>
          <p class="mt-1.5 text-xs text-zinc-600 leading-relaxed">{{ r.reason ?? r.gate ?? 'Held by CS' }}</p>
          <p class="mt-1 text-[11px] text-zinc-400">Delivered {{ when(r.deliveredAt) }}</p>
          <NuxtLink
            v-if="r.claimOpen"
            :to="`/ops/jobs/${r.id}`"
            class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
          >
            <UIcon name="i-lucide-file-warning" class="size-3" /> Open claim on job
          </NuxtLink>
          <div class="mt-2.5 flex gap-2">
            <UButton
              icon="i-lucide-play"
              size="xs"
              color="primary"
              variant="subtle"
              label="Release ask"
              :loading="busy === r.id"
              @click="emit('release', r)"
            />
            <UButton
              icon="i-lucide-pause"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Keep held"
              @click="emit('hold', r)"
            />
          </div>
        </template>
      </article>
    </div>
  </section>
</template>
