<script setup lang="ts">
import type { CommsThread, OutboxEmail } from '#shared/utils/shipping'

/**
 * Unified inbox — the staff-pain page. Email and WhatsApp in one list, every
 * thread attached to the job it belongs to. `?thread=<id>` deep-links straight
 * into a conversation (the job page links here).
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Inbox — M&P ops' })

const route = useRoute()
const router = useRouter()

const { data: threads, refresh, status } = await useFetch<CommsThread[]>('/api/comms', { default: () => [] })
const { data: emails, refresh: refreshEmails } = await useFetch<OutboxEmail[]>('/api/emails', { default: () => [] })

/** Shared clock so relative times match between SSR and hydration. */
const now = useState<number>('ops-now', () => Date.now())

const FILTERS = [
  { value: 'all', label: 'All', icon: 'i-lucide-inbox' },
  { value: 'needs_reply', label: 'Needs reply', icon: 'i-lucide-circle-dot' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'i-lucide-message-circle' },
  { value: 'email', label: 'Email', icon: 'i-lucide-mail' },
  { value: 'unassigned', label: 'Not on a job', icon: 'i-lucide-circle-slash' }
]

const filter = ref('all')
const search = ref('')
const selectedId = ref<string | null>(((route.query.thread as string) || '').trim() || null)

/**
 * Mail that never matched a job (newsletters, cold vendor pitches). /api/comms
 * drops it on purpose, so the inbox rebuilds it client-side as read-only
 * pseudo-threads — that noise is exactly what CS wades through today.
 */
const noiseThreads = computed<CommsThread[]>(() =>
  (emails.value ?? [])
    .filter((e) => !e.shipmentId?.trim())
    .map((e) => ({
      id: `noise-${e.id}`,
      channel: 'email' as const,
      shipmentId: null,
      contactName: (e.from ?? 'Unknown sender').replace(/\s*<.*>$/, ''),
      contactHandle: (e.from ?? '').replace(/^.*<|>$/g, ''),
      contactRole: 'other',
      subject: e.subject,
      lastAt: e.at,
      status: 'closed' as const,
      messages: [{ id: e.id, direction: 'in' as const, from: e.from ?? 'Unknown sender', body: e.body, at: e.at }]
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
)

const allThreads = computed(() => [...(threads.value ?? []), ...noiseThreads.value])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = threads.value ?? []
  if (filter.value === 'needs_reply') list = list.filter((t) => t.status === 'needs_reply')
  else if (filter.value === 'whatsapp') list = list.filter((t) => t.channel === 'whatsapp')
  else if (filter.value === 'email') list = list.filter((t) => t.channel === 'email')
  else if (filter.value === 'unassigned') list = []
  if (q) {
    list = list.filter((t) =>
      [t.contactName, t.contactHandle, t.subject, t.shipmentId ?? '', ...t.messages.map((m) => m.body)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }
  return list
})

/** In the "Not on a job" filter the noise becomes the main list. */
const noiseForList = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (filter.value === 'whatsapp') return []
  const list = q
    ? noiseThreads.value.filter((t) => `${t.contactName} ${t.subject} ${t.messages[0]?.body}`.toLowerCase().includes(q))
    : noiseThreads.value
  return list
})

const listThreads = computed(() => (filter.value === 'unassigned' ? noiseForList.value : filtered.value))
const listNoise = computed(() => (filter.value === 'unassigned' ? [] : noiseForList.value))

const selected = computed<CommsThread | null>(
  () => allThreads.value.find((t) => t.id === selectedId.value) ?? null
)

const needsReplyCount = computed(() => (threads.value ?? []).filter((t) => t.status === 'needs_reply').length)

function select(id: string) {
  selectedId.value = id
  router.replace({ query: { ...route.query, thread: id } })
}

function back() {
  selectedId.value = null
  const q = { ...route.query }
  delete q.thread
  router.replace({ query: q })
}

// Deep link can also change while the page is mounted (job page → inbox).
watch(() => route.query.thread, (v) => {
  const id = ((v as string) || '').trim()
  if (id && id !== selectedId.value) selectedId.value = id
})

async function onSent(updated: CommsThread | null) {
  await Promise.all([refresh(), refreshEmails()])
  if (updated?.id) selectedId.value = updated.id
}

// Live inbox: the demo reply lands within a beat, and MCP `send_whatsapp` from
// Claude/Grok shows up here too without a manual reload.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    refresh()
  }, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0 overflow-hidden' }">
    <template #header>
      <UDashboardNavbar title="Inbox" icon="i-lucide-inbox">
        <template #trailing>
          <UBadge
            v-if="needsReplyCount"
            :label="`${needsReplyCount} need a reply`"
            color="warning"
            variant="subtle"
            size="sm"
          />
        </template>
        <template #right>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search people, jobs, messages…"
            size="sm"
            class="hidden md:block w-64"
            :ui="{ base: 'ps-8!', trailing: 'pe-1' }"
          >
            <template v-if="search" #trailing>
              <UButton icon="i-lucide-x" color="neutral" variant="link" size="xs" @click="search = ''" />
            </template>
          </UInput>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="shrink-0 border-b border-zinc-200 bg-white px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <UTabs
          v-model="filter"
          :items="FILTERS"
          :content="false"
          color="primary"
          variant="pill"
          size="xs"
          :ui="{ list: 'bg-zinc-100' }"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search…"
          size="xs"
          class="md:hidden ms-auto w-36 shrink-0"
          :ui="{ base: 'ps-7!' }"
        />
      </div>

      <div class="flex-1 min-h-0 flex">
        <div
          class="w-full lg:w-[360px] shrink-0 border-e border-zinc-200 min-h-0"
          :class="selectedId ? 'hidden lg:block' : 'block'"
        >
          <OpsInboxThreadList
            :threads="listThreads"
            :noise="listNoise"
            :active-id="selectedId"
            :loading="status === 'pending'"
            @select="select"
          />
        </div>

        <div
          class="flex-1 min-w-0 min-h-0 bg-white"
          :class="selectedId ? 'block' : 'hidden lg:block'"
        >
          <OpsInboxThreadPane :thread="selected" @sent="onSent" @back="back" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
