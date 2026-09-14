<script setup lang="ts">
import type { CommsThread } from '#shared/utils/shipping'

/**
 * Left rail of the ops inbox: one row per conversation, WhatsApp and email
 * side by side. "Not on a job" (newsletters, vendor spam) is folded away at the
 * bottom so the real work stays at the top.
 */
const props = defineProps<{
  threads: CommsThread[]
  noise?: CommsThread[]
  activeId?: string | null
  loading?: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()

const showNoise = ref(false)

/** Shared clock so SSR and hydration agree on "12m ago". */
const now = useState<number>('ops-now', () => Date.now())

function relTime(iso?: string): string {
  if (!iso) return '—'
  const mins = Math.round((now.value - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function preview(t: CommsThread): string {
  const last = t.messages[t.messages.length - 1]
  if (!last) return '—'
  const who = last.direction === 'out' ? 'You: ' : ''
  return `${who}${last.body.replace(/\s+/g, ' ').trim()}`
}

const noiseList = computed(() => props.noise ?? [])
</script>

<template>
  <div class="flex flex-col h-full min-h-0 bg-white">
    <div v-if="loading && !threads.length" class="p-4 space-y-3">
      <USkeleton v-for="i in 6" :key="i" class="h-14 w-full" />
    </div>

    <div v-else-if="!threads.length && !noiseList.length" class="p-6 text-center">
      <UIcon name="i-lucide-inbox" class="size-8 text-zinc-300 mx-auto" />
      <p class="mt-2 text-sm font-medium text-zinc-600">Nothing here</p>
      <p class="text-xs text-zinc-400">Every thread in this filter is handled.</p>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-100">
      <button
        v-for="t in threads"
        :key="t.id"
        type="button"
        class="w-full text-left px-3 py-3 flex gap-3 transition-colors hover:bg-zinc-50"
        :class="activeId === t.id ? 'bg-primary-50/70 hover:bg-primary-50' : ''"
        @click="emit('select', t.id)"
      >
        <span
          class="shrink-0 grid place-items-center size-9 mt-0.5"
          :class="t.channel === 'whatsapp'
            ? 'rounded-full bg-[#25D366] text-white'
            : 'rounded-lg bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200'"
        >
          <UIcon :name="t.channel === 'whatsapp' ? 'i-lucide-message-circle' : 'i-lucide-mail'" class="size-4.5" />
        </span>

        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5">
            <span class="text-sm font-semibold text-zinc-900 truncate">{{ t.contactName }}</span>
            <UBadge
              v-if="t.shipmentId"
              :label="t.shipmentId"
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0 font-mono text-[10px]"
            />
            <span v-else class="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">Not on a job</span>
            <span class="ms-auto shrink-0 flex items-center gap-1.5">
              <span class="text-[11px] text-zinc-400 tabular-nums">{{ relTime(t.lastAt) }}</span>
              <span
                v-if="t.status === 'needs_reply'"
                class="size-2 rounded-full bg-[#F17421]"
                title="Needs a reply"
              />
            </span>
          </span>
          <span class="block text-xs text-zinc-500 truncate mt-0.5">{{ t.subject }}</span>
          <span class="block text-xs text-zinc-400 truncate mt-0.5">{{ preview(t) }}</span>
        </span>
      </button>
    </div>

    <div v-if="noiseList.length" class="shrink-0 border-t border-zinc-200 bg-zinc-50/70">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"
        @click="showNoise = !showNoise"
      >
        <UIcon :name="showNoise ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
        Not on a job
        <UBadge :label="String(noiseList.length)" color="neutral" variant="subtle" size="sm" class="ms-1" />
        <span class="ms-auto text-[11px] text-zinc-400">newsletters · vendors</span>
      </button>

      <div v-if="showNoise" class="divide-y divide-zinc-100 border-t border-zinc-200 max-h-56 overflow-y-auto">
        <button
          v-for="t in noiseList"
          :key="t.id"
          type="button"
          class="w-full text-left px-3 py-2.5 flex gap-3 hover:bg-white"
          :class="activeId === t.id ? 'bg-white' : ''"
          @click="emit('select', t.id)"
        >
          <span class="shrink-0 grid place-items-center size-7 rounded-lg bg-zinc-200 text-zinc-500">
            <UIcon name="i-lucide-mail" class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-medium text-zinc-600 truncate">{{ t.contactName }}</span>
            <span class="block text-[11px] text-zinc-400 truncate">{{ t.subject }}</span>
          </span>
          <span class="shrink-0 text-[11px] text-zinc-400">{{ relTime(t.lastAt) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
