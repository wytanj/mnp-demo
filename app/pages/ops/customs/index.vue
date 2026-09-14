<script setup lang="ts">
import type { CustomsDeclaration, CustomsStatus } from '#shared/utils/shipping'

definePageMeta({ layout: 'ops' })

interface QueuePartner {
  name: string
  state: 'ok' | 'waiting' | 'blocked' | 'done' | 'na'
  waitingFor?: string
}

interface QueueRow {
  id: string
  client: string
  route: string
  status: CustomsStatus
  statusLabel: string
  docsDone: number
  docsTotal: number
  gaps: string[]
  eta: string
  permitNo?: string
  declaredBy?: string
  queryNote?: string
  queriedAt?: string
  broker?: QueuePartner | null
  warehouse?: QueuePartner | null
  declaration: CustomsDeclaration
}

const { data: queue, refresh } = await useFetch<QueueRow[]>('/api/customs/queue', {
  default: () => [] as QueueRow[]
})

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(refresh, 5000)
})
onUnmounted(() => clearInterval(timer))

const all = computed(() => queue.value ?? [])

/** Tile → the statuses it covers. Clicking a tile filters the table below. */
const TILES: Array<{
  key: CustomsStatus
  label: string
  hint: string
  icon: string
  color: string
}> = [
  { key: 'docs_pending', label: 'Needs data', hint: 'documents or fields missing', icon: 'i-lucide-file-clock', color: 'text-amber-600' },
  { key: 'ready_for_declaration', label: 'Draft declaration', hint: 'officer keys into TradeNet', icon: 'i-lucide-file-check', color: 'text-blue-600' },
  { key: 'declared', label: 'Submitted', hint: 'filed by an officer, permit recorded', icon: 'i-lucide-stamp', color: 'text-green-600' },
  { key: 'queried', label: 'Queried', hint: 'Customs asked a question', icon: 'i-lucide-message-square-warning', color: 'text-red-600' },
  { key: 'cleared', label: 'Cleared', hint: 'through Singapore Customs', icon: 'i-lucide-badge-check', color: 'text-emerald-600' }
]

const filter = ref<CustomsStatus | null>(null)

const stats = computed(() =>
  TILES.map((t) => ({ ...t, n: all.value.filter((r) => r.status === t.key).length }))
)

const rows = computed(() =>
  filter.value ? all.value.filter((r) => r.status === filter.value) : all.value
)

function toggleFilter(key: CustomsStatus) {
  filter.value = filter.value === key ? null : key
}

const columns = [
  { accessorKey: 'id', header: 'Job' },
  { accessorKey: 'client', header: 'Client' },
  { accessorKey: 'route', header: 'Route' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'docs', header: 'Docs' },
  { accessorKey: 'gaps', header: 'Gaps' },
  { accessorKey: 'eta', header: 'ETA' },
  { accessorKey: 'officer', header: 'Officer' },
  { accessorKey: 'broker', header: 'Broker' },
  { accessorKey: 'actions', header: '' }
]

const STATUS_COLOR: Record<CustomsStatus, 'warning' | 'info' | 'success' | 'error'> = {
  docs_pending: 'warning',
  ready_for_declaration: 'info',
  declared: 'success',
  queried: 'error',
  cleared: 'success'
}

const PARTNER_DOT: Record<string, string> = {
  ok: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  blocked: 'bg-red-500',
  done: 'bg-zinc-400',
  na: 'bg-zinc-300'
}

function rel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const h = Math.round(abs / 3600_000)
  const d = Math.round(abs / 86400_000)
  const label = abs < 3600_000 ? '<1h' : h < 36 ? `${h}h` : `${d}d`
  return ms >= 0 ? `in ${label}` : `${label} ago`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Customs queue" icon="i-lucide-stamp">
        <template #trailing>
          <span class="hidden lg:inline text-[11px] text-zinc-500 ms-2 leading-tight max-w-md">
            M&amp;P checks documents; an M&amp;P customs officer files on TradeNet. Nothing auto-files.
          </span>
        </template>
        <template #right>
          <UButton to="/ops/exceptions" color="neutral" variant="outline" size="sm" icon="i-lucide-triangle-alert">
            <span class="hidden sm:inline">Exceptions</span>
          </UButton>
          <DemoHowTo page="ops-customs" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="lg:hidden text-[12px] text-zinc-500">
          M&amp;P checks documents; an M&amp;P customs officer files on TradeNet. Nothing auto-files.
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            v-for="st in stats"
            :key="st.key"
            type="button"
            class="text-left rounded-xl border bg-white px-4 py-3 transition-colors"
            :class="filter === st.key
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'"
            :aria-pressed="filter === st.key"
            @click="toggleFilter(st.key)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="st.icon" class="size-4 shrink-0" :class="st.color" />
              <span class="text-2xl font-bold leading-none tabular-nums">{{ st.n }}</span>
            </div>
            <div class="mt-1.5 text-[13px] font-semibold leading-tight text-zinc-800">{{ st.label }}</div>
            <div class="text-[11px] text-zinc-500 leading-tight">{{ st.hint }}</div>
          </button>
        </div>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold">
                Declarations
                <UBadge color="neutral" variant="subtle" class="ms-1">{{ rows.length }}</UBadge>
              </h2>
              <p class="text-xs text-zinc-500 flex-1 min-w-[12rem]">Most gaps first, then earliest ETA.</p>
              <UButton
                v-if="filter"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-x"
                @click="filter = null"
              >
                {{ stats.find((s) => s.key === filter)?.label }} only
              </UButton>
            </div>
          </template>

          <UTable
            :data="rows"
            :columns="columns"
            empty="No jobs need a declaration right now."
            :on-select="(_e: Event, row: any) => navigateTo(`/ops/customs/${row.original.id}`)"
            :ui="{ td: 'align-top py-2.5', th: 'py-2' }"
          >
            <template #id-cell="{ row }">
              <div class="font-bold text-sm whitespace-nowrap">{{ row.original.id }}</div>
            </template>

            <template #client-cell="{ row }">
              <div class="w-40 max-w-40 text-sm truncate">{{ row.original.client }}</div>
            </template>

            <template #route-cell="{ row }">
              <div class="w-56 max-w-56 text-[12px] text-zinc-600 truncate">{{ row.original.route }}</div>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="STATUS_COLOR[row.original.status as 'docs_pending']" variant="subtle" class="whitespace-nowrap">
                {{ row.original.statusLabel }}
              </UBadge>
              <p
                v-if="row.original.status === 'queried' && row.original.queryNote"
                class="mt-1 text-[11px] text-red-700 leading-snug max-w-[14rem] line-clamp-2"
              >
                {{ row.original.queryNote }}
              </p>
            </template>

            <template #docs-cell="{ row }">
              <div class="text-xs font-semibold tabular-nums">
                {{ row.original.docsDone }}/{{ row.original.docsTotal }}
              </div>
              <UProgress
                size="xs"
                class="w-14 mt-1"
                :model-value="row.original.docsDone"
                :max="Math.max(row.original.docsTotal, 1)"
                :color="row.original.docsDone === row.original.docsTotal ? 'success' : 'warning'"
              />
            </template>

            <template #gaps-cell="{ row }">
              <div v-if="row.original.gaps.length" class="flex flex-wrap gap-1 max-w-[13rem]">
                <UBadge
                  v-for="g in row.original.gaps.slice(0, 3)"
                  :key="g"
                  color="warning"
                  variant="subtle"
                  size="sm"
                >{{ g }}</UBadge>
                <UBadge v-if="row.original.gaps.length > 3" color="neutral" variant="subtle" size="sm">
                  +{{ row.original.gaps.length - 3 }}
                </UBadge>
              </div>
              <UBadge v-else color="success" variant="subtle" size="sm">No gaps</UBadge>
            </template>

            <template #eta-cell="{ row }">
              <div class="text-xs whitespace-nowrap text-zinc-600">{{ rel(row.original.eta) }}</div>
            </template>

            <template #officer-cell="{ row }">
              <div v-if="row.original.declaredBy" class="text-[12px]">
                <div class="font-medium text-zinc-800">{{ row.original.declaredBy }}</div>
                <div class="text-zinc-500">{{ row.original.permitNo ?? '—' }}</div>
              </div>
              <span v-else class="text-xs text-zinc-400">Not filed yet</span>
            </template>

            <template #broker-cell="{ row }">
              <div
                v-if="row.original.broker"
                class="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 py-0.5 max-w-[11rem]"
                :title="row.original.broker.waitingFor ?? ''"
              >
                <span class="size-2 rounded-full shrink-0" :class="PARTNER_DOT[row.original.broker.state]" />
                <span class="text-[11px] font-medium text-zinc-700 truncate">{{ row.original.broker.name }}</span>
              </div>
              <span v-else class="text-xs text-zinc-400">—</span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UButton
                  :to="`/ops/customs/${row.original.id}`"
                  size="sm"
                  color="primary"
                  variant="soft"
                  trailing-icon="i-lucide-chevron-right"
                >
                  Open declaration
                </UButton>
              </div>
            </template>
          </UTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
