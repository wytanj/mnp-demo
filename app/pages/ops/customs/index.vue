<script setup lang="ts">
import type { CustomsDeclaration, CustomsStatus } from '#shared/utils/shipping'

definePageMeta({ layout: 'ops' })

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

const rows = computed(() => queue.value ?? [])

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const stats = computed(() => {
  const list = rows.value
  return [
    {
      key: 'waiting',
      n: list.filter((r) => r.status === 'docs_pending').length,
      label: 'Waiting on documents',
      hint: 'cannot file yet',
      icon: 'i-lucide-file-clock',
      color: 'text-amber-600'
    },
    {
      key: 'ready',
      n: list.filter((r) => r.status === 'ready_for_declaration').length,
      label: 'Ready for declaration',
      hint: 'officer keys into TradeNet',
      icon: 'i-lucide-file-check',
      color: 'text-blue-600'
    },
    {
      key: 'declared',
      n: list.filter(
        (r) =>
          (r.status === 'declared' || r.status === 'cleared')
          && r.declaration?.filedAt
          && new Date(r.declaration.filedAt).getTime() >= startOfToday()
      ).length,
      label: 'Declared today',
      hint: 'permit recorded',
      icon: 'i-lucide-stamp',
      color: 'text-green-600'
    }
  ]
})

const columns = [
  { accessorKey: 'id', header: 'Job' },
  { accessorKey: 'client', header: 'Client' },
  { accessorKey: 'route', header: 'Route' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'docs', header: 'Docs' },
  { accessorKey: 'gaps', header: 'Gaps' },
  { accessorKey: 'eta', header: 'ETA' },
  { accessorKey: 'officer', header: 'Officer / permit' },
  { accessorKey: 'actions', header: '' }
]

const STATUS_COLOR: Record<CustomsStatus, 'warning' | 'info' | 'success'> = {
  docs_pending: 'warning',
  ready_for_declaration: 'info',
  declared: 'success',
  cleared: 'success'
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
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="lg:hidden text-[12px] text-zinc-500">
          M&amp;P checks documents; an M&amp;P customs officer files on TradeNet. Nothing auto-files.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            v-for="st in stats"
            :key="st.key"
            class="rounded-xl border border-zinc-200 bg-white px-4 py-3"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="st.icon" class="size-4 shrink-0" :class="st.color" />
              <span class="text-2xl font-bold leading-none tabular-nums">{{ st.n }}</span>
            </div>
            <div class="mt-1.5 text-[13px] font-semibold leading-tight text-zinc-800">{{ st.label }}</div>
            <div class="text-[11px] text-zinc-500 leading-tight">{{ st.hint }}</div>
          </div>
        </div>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold">
                Declarations
                <UBadge color="neutral" variant="subtle" class="ms-1">{{ rows.length }}</UBadge>
              </h2>
              <p class="text-xs text-zinc-500 flex-1 min-w-[12rem]">Most gaps first, then earliest ETA.</p>
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
