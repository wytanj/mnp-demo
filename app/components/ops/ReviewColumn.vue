<script setup lang="ts">
import { CLAIM_LABELS, type ClaimType } from '#shared/utils/shipping'

export interface ReviewRow {
  id: string
  client: string
  contact: string
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
}

/** One lane of the review board: asked, received or suppressed. */
const props = defineProps<{
  kind: 'asked' | 'received' | 'suppressed'
  rows: ReviewRow[]
  claims?: Record<string, ClaimType | undefined>
  busy?: string | null
}>()

const emit = defineEmits<{
  nudge: [row: ReviewRow]
  reward: [payload: { row: ReviewRow; code: string }]
  release: [row: ReviewRow]
  hold: [row: ReviewRow]
}>()

const codes = reactive<Record<string, string>>({})

const META = {
  asked: { title: 'Asked', icon: 'i-lucide-send', tone: 'text-sky-600', empty: 'No outstanding asks.' },
  received: { title: 'Received', icon: 'i-lucide-star', tone: 'text-amber-500', empty: 'No reviews in yet.' },
  suppressed: { title: 'Suppressed', icon: 'i-lucide-pause-circle', tone: 'text-zinc-500', empty: 'Nothing held back.' }
} as const

const meta = computed(() => META[props.kind])

function when(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function name(contact: string): string {
  return contact.replace(/\s*<.*>$/, '')
}

function claimLabel(id: string): string | null {
  const t = props.claims?.[id]
  return t ? CLAIM_LABELS[t] : null
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
        :class="kind === 'suppressed' ? 'bg-zinc-50' : 'bg-white'"
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

        <!-- ASKED -->
        <template v-if="kind === 'asked'">
          <dl class="mt-2 text-[11px] text-zinc-500 space-y-0.5">
            <div class="flex gap-2"><dt class="w-20 shrink-0">Delivered</dt><dd>{{ when(r.deliveredAt) }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0">Asked</dt><dd>{{ when(r.askAt) }}</dd></div>
          </dl>
          <div class="mt-2.5 flex gap-2">
            <UButton
              icon="i-lucide-bell-ring"
              size="xs"
              color="neutral"
              variant="outline"
              label="Nudge (demo)"
              :loading="busy === r.id"
              @click="emit('nudge', r)"
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

          <div v-if="r.reward" class="mt-2.5 flex items-center gap-1.5">
            <UBadge :label="r.reward.code" color="success" variant="subtle" size="sm" class="font-mono" />
            <span class="text-[11px] text-zinc-400">{{ r.reward.value ?? 'reward' }} sent {{ when(r.reward.at) }}</span>
          </div>
          <div v-else class="mt-2.5 flex gap-1.5">
            <UInput v-model="codes[r.id]" size="xs" placeholder="GRAB10" class="flex-1 min-w-0" />
            <UButton
              size="xs"
              color="primary"
              label="Approve reward"
              :disabled="!(codes[r.id] ?? '').trim()"
              :loading="busy === r.id"
              @click="emit('reward', { row: r, code: (codes[r.id] ?? '').trim() })"
            />
          </div>
        </template>

        <!-- SUPPRESSED -->
        <template v-else>
          <div class="mt-2 flex items-center gap-1.5 flex-wrap">
            <UBadge v-if="claimLabel(r.id)" :label="claimLabel(r.id)!" color="error" variant="subtle" size="sm" />
            <UBadge label="Ask held" color="neutral" variant="subtle" size="sm" />
          </div>
          <p class="mt-1.5 text-xs text-zinc-600 leading-relaxed">{{ r.reason ?? 'Held by CS' }}</p>
          <p class="mt-1 text-[11px] text-zinc-400">Delivered {{ when(r.deliveredAt) }}</p>
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
