<script setup lang="ts">
import type { DocumentStatus, Shipment } from '#shared/utils/shipping'

/** Docs vault — every document M&P holds, across every job, in one table. */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Docs vault — M&P ops' })

const { data: shipments } = await useFetch<Shipment[]>('/api/shipments', { default: () => [] })

const filter = ref('all')

const rows = computed(() =>
  (shipments.value ?? []).flatMap((s) =>
    (s.documents ?? []).map((d) => ({
      id: `${s.id}-${d.key}`,
      job: s.id,
      client: s.company ?? s.customerName,
      label: d.label,
      required: d.required,
      category: d.category ?? 'commercial',
      status: d.status,
      fileName: d.fileName,
      uploadedBy: d.uploadedBy ?? d.verifiedBy,
      deadline: d.deadline,
      note: d.note
    }))
  )
)

const filtered = computed(() => (filter.value === 'all' ? rows.value : rows.value.filter((r) => r.status === filter.value)))

const counts = computed(() => {
  const by = (s: DocumentStatus) => rows.value.filter((r) => r.status === s).length
  return { all: rows.value.length, pending: by('pending'), uploaded: by('uploaded'), approved: by('approved') }
})

const FILTERS = computed(() => [
  { value: 'all', label: `All (${counts.value.all})` },
  { value: 'pending', label: `Pending (${counts.value.pending})` },
  { value: 'uploaded', label: `To verify (${counts.value.uploaded})` },
  { value: 'approved', label: `Approved (${counts.value.approved})` }
])

const STATUS_META: Record<string, { label: string; color: 'neutral' | 'warning' | 'info' | 'success' }> = {
  pending: { label: 'Pending', color: 'warning' },
  uploaded: { label: 'To verify', color: 'info' },
  approved: { label: 'Approved', color: 'success' },
  waived: { label: 'Waived', color: 'neutral' }
}

const CATEGORY_LABEL: Record<string, string> = {
  customs: 'Customs',
  commercial: 'Commercial',
  delivery: 'Delivery',
  payment: 'Payment'
}

const columns = [
  { accessorKey: 'job', header: 'Job' },
  { accessorKey: 'label', header: 'Document' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'uploadedBy', header: 'Uploaded by' },
  { accessorKey: 'deadline', header: 'Deadline' }
]

function when(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Docs vault" icon="i-lucide-folder-open">
        <template #right>
          <UTabs
            v-model="filter"
            :items="FILTERS"
            :content="false"
            color="primary"
            variant="pill"
            size="xs"
            :ui="{ list: 'bg-zinc-100' }"
          />
          <DemoHowTo page="ops-docs" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-xs text-zinc-500">
        Commercial invoices, packing lists, B/Ls, permits, authorisation letters and payment slips —
        held against the job instead of scattered across mailboxes.
      </p>

      <div class="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <UTable :data="filtered" :columns="columns" :ui="{ td: 'py-2.5' }">
          <template #job-cell="{ row }">
            <NuxtLink :to="`/ops/jobs/${row.original.job}`" class="font-mono text-xs font-bold text-zinc-800 hover:text-primary-600">
              {{ row.original.job }}
            </NuxtLink>
            <p class="text-[11px] text-zinc-400 truncate max-w-40">{{ row.original.client }}</p>
          </template>

          <template #label-cell="{ row }">
            <p class="text-xs font-medium text-zinc-800">
              {{ row.original.label }}
              <span v-if="!row.original.required" class="text-[10px] text-zinc-400 font-normal">optional</span>
            </p>
            <p v-if="row.original.fileName" class="text-[11px] text-zinc-400 font-mono truncate max-w-48">{{ row.original.fileName }}</p>
            <p v-else-if="row.original.note" class="text-[11px] text-zinc-400 truncate max-w-56">{{ row.original.note }}</p>
          </template>

          <template #category-cell="{ row }">
            <UBadge :label="CATEGORY_LABEL[row.original.category] ?? row.original.category" color="neutral" variant="subtle" size="sm" />
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :label="STATUS_META[row.original.status]?.label ?? row.original.status"
              :color="STATUS_META[row.original.status]?.color ?? 'neutral'"
              variant="subtle"
              size="sm"
            />
          </template>

          <template #uploadedBy-cell="{ row }">
            <span class="text-xs text-zinc-600">{{ row.original.uploadedBy ?? '—' }}</span>
          </template>

          <template #deadline-cell="{ row }">
            <span class="text-xs" :class="row.original.deadline ? 'text-amber-700' : 'text-zinc-400'">
              {{ when(row.original.deadline) }}
            </span>
          </template>
        </UTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
