<script setup lang="ts">
import {
  CLAIM_LABELS,
  CUSTOMS_LABELS,
  declarationGaps,
  docsDone,
  etaPassed,
  MODE_LABELS,
  STATUS_LABELS,
  type CommsThread,
  type Shipment,
  type ShipmentStatus
} from '#shared/utils/shipping'

definePageMeta({ layout: 'ops' })

const toast = useToast()

const { data: shipments, refresh: refreshShipments } = await useFetch<Shipment[]>('/api/shipments', {
  default: () => [] as Shipment[]
})
const { data: threads, refresh: refreshThreads } = await useFetch<CommsThread[]>('/api/comms', {
  default: () => [] as CommsThread[]
})

async function refreshAll() {
  await Promise.all([refreshShipments(), refreshThreads()])
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(refreshAll, 5000)
})
onUnmounted(() => clearInterval(timer))

/* ── attention model ─────────────────────────────────────── */

type AttnKey = 'claims' | 'customs_gaps' | 'ready_decl' | 'signoff' | 'needs_reply'

const needsReplyIds = computed(() => {
  const set = new Set<string>()
  for (const t of threads.value ?? []) {
    if (t.status === 'needs_reply' && t.shipmentId) set.add(t.shipmentId)
  }
  return set
})

function hasOpenClaim(s: Shipment) {
  return s.claim?.status === 'open'
}
function customsGaps(s: Shipment): string[] {
  if (!s.customs) return []
  if (s.customs.status === 'declared' || s.customs.status === 'cleared') return []
  return declarationGaps(s)
}
function readyForDeclaration(s: Shipment) {
  return s.customs?.status === 'ready_for_declaration'
}
function awaitingSignoff(s: Shipment) {
  return !s.signoff && (s.status === 'out_for_delivery' || s.status === 'delivered')
}
function needsReply(s: Shipment) {
  return needsReplyIds.value.has(s.id)
}
function partnerWait(s: Shipment) {
  return (s.partners ?? []).some((p) => p.state === 'waiting' || p.state === 'blocked')
}

const MATCH: Record<AttnKey, (s: Shipment) => boolean> = {
  claims: hasOpenClaim,
  customs_gaps: (s) => customsGaps(s).length > 0,
  ready_decl: readyForDeclaration,
  signoff: awaitingSignoff,
  needs_reply: needsReply
}

const TILES: Array<{ key: AttnKey; label: string; hint: string; icon: string; color: string }> = [
  { key: 'claims', label: 'Open claims', hint: 'review ask held', icon: 'i-lucide-shield-alert', color: 'text-red-600' },
  { key: 'customs_gaps', label: 'Customs gaps', hint: 'cannot file yet', icon: 'i-lucide-stamp', color: 'text-amber-600' },
  { key: 'ready_decl', label: 'Ready for declaration', hint: 'officer files on TradeNet', icon: 'i-lucide-file-check', color: 'text-blue-600' },
  { key: 'signoff', label: 'Awaiting sign-off', hint: 'no POD yet', icon: 'i-lucide-signature', color: 'text-zinc-600' },
  { key: 'needs_reply', label: 'Needs reply', hint: 'email or WhatsApp', icon: 'i-lucide-message-square-dot', color: 'text-primary' }
]

const filter = ref<AttnKey | null>(null)
const search = ref('')

const tiles = computed(() =>
  TILES.map((t) => ({ ...t, n: (shipments.value ?? []).filter(MATCH[t.key]).length }))
)

function toggleFilter(key: AttnKey) {
  filter.value = filter.value === key ? null : key
}

function clientLine(s: Shipment) {
  return s.mode === 'b2c' ? s.customerName : (s.company ?? s.customerName)
}

/** Attention first: claims, then customs, then sign-off, then live jobs, then done. */
function attentionRank(s: Shipment): number {
  if (hasOpenClaim(s)) return 0
  if (customsGaps(s).length || readyForDeclaration(s)) return 1
  if (needsReply(s)) return 2
  if (awaitingSignoff(s)) return 3
  if (s.status !== 'delivered' && s.customs) return 4
  if (s.status !== 'delivered') return 5
  return 6
}

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = [...(shipments.value ?? [])]
  if (filter.value) list = list.filter(MATCH[filter.value])
  if (q) {
    list = list.filter((s) =>
      `${s.id} ${clientLine(s)} ${s.customerName} ${s.origin} ${s.destination} ${s.description}`
        .toLowerCase()
        .includes(q)
    )
  }
  return list.sort(
    (a, b) => attentionRank(a) - attentionRank(b) || b.createdAt.localeCompare(a.createdAt)
  )
})

const columns = [
  { accessorKey: 'id', header: 'Job' },
  { accessorKey: 'client', header: 'Client' },
  { accessorKey: 'route', header: 'Route' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'docs', header: 'Docs' },
  { accessorKey: 'customs', header: 'Customs' },
  { accessorKey: 'flags', header: 'Flags' },
  { accessorKey: 'eta', header: 'ETA' },
  { accessorKey: 'actions', header: '' }
]

const STATUS_COLOR: Record<ShipmentStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  booked: 'neutral',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'warning',
  delivered: 'success'
}

function customsBadge(s: Shipment): { label: string; color: 'success' | 'warning' | 'info' } | null {
  const c = s.customs
  if (!c) return null
  if (c.status === 'docs_pending') return { label: CUSTOMS_LABELS.docs_pending, color: 'warning' }
  if (c.status === 'ready_for_declaration') return { label: CUSTOMS_LABELS.ready_for_declaration, color: 'info' }
  if (c.status === 'declared') return { label: 'Declared', color: 'success' }
  return { label: 'Cleared', color: 'success' }
}

/** Coarse relative time — hours/days only, so SSR and hydration agree. */
function rel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const h = Math.round(abs / 3600_000)
  const d = Math.round(abs / 86400_000)
  const label = abs < 3600_000 ? '<1h' : h < 36 ? `${h}h` : `${d}d`
  return ms >= 0 ? `in ${label}` : `${label} ago`
}

function fullWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

async function copyLink(id: string) {
  const url = `${location.origin}/track/${id}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // clipboard is blocked in some embedded browsers — still tell the room the link
  }
  toast.add({
    title: 'Tracking link copied',
    description: url,
    color: 'primary',
    icon: 'i-lucide-link'
  })
}

/* ── new booking ─────────────────────────────────────────── */

const showForm = ref(false)
const creating = ref(false)

const form = reactive({
  mode: 'b2c' as 'b2b' | 'b2c' | 'b2self',
  customerName: '',
  customerEmail: '',
  company: '',
  poNumber: '',
  incoterms: 'DAP',
  origin: '',
  destination: '',
  eta: '',
  driverName: '',
  driverPhone: '',
  vehicle: '',
  pieces: 1,
  weightKg: 10,
  description: ''
})

const MODE_ITEMS = [
  { label: 'B2C — consumer', value: 'b2c' },
  { label: 'B2B — business', value: 'b2b' },
  { label: 'B2SELF — own outlets', value: 'b2self' }
]
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP']

function validate(state: typeof form) {
  const errors: Array<{ name: string; message: string }> = []
  if (!state.customerName.trim()) errors.push({ name: 'customerName', message: 'Required' })
  if (!state.customerEmail.trim()) errors.push({ name: 'customerEmail', message: 'Required' })
  if (!state.origin.trim()) errors.push({ name: 'origin', message: 'Required' })
  if (!state.destination.trim()) errors.push({ name: 'destination', message: 'Required' })
  if (!state.description.trim()) errors.push({ name: 'description', message: 'Required' })
  return errors
}

async function createShipment() {
  creating.value = true
  try {
    const created = await $fetch<Shipment>('/api/shipments', { method: 'POST', body: { ...form } })
    showForm.value = false
    Object.assign(form, {
      customerName: '', customerEmail: '', company: '', poNumber: '',
      origin: '', destination: '', eta: '', driverName: '', driverPhone: '', vehicle: '',
      pieces: 1, weightKg: 10, description: ''
    })
    await refreshAll()
    toast.add({
      title: `Booking ${created?.id ?? ''} created`,
      description: 'Tracking email sent to the customer.',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Could not create the booking',
      description: err?.data?.statusMessage ?? 'Check the required fields and try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert'
    })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Jobs" icon="i-lucide-boxes">
        <template #right>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search job, client or route"
            class="w-56 hidden sm:block"
            :ui="{ base: 'ps-9! border-0!', trailing: 'pe-1' }"
          >
            <template v-if="search" #trailing>
              <UButton
                color="neutral"
                variant="link"
                icon="i-lucide-circle-x"
                aria-label="Clear search"
                @click="search = ''"
              />
            </template>
          </UInput>
          <UButton icon="i-lucide-plus" color="primary" @click="showForm = true">
            New booking
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- attention strip -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            v-for="t in tiles"
            :key="t.key"
            type="button"
            class="text-left rounded-xl border bg-white px-4 py-3 transition-all hover:shadow-sm"
            :class="filter === t.key
              ? 'border-primary ring-2 ring-primary/30'
              : t.n ? 'border-zinc-200' : 'border-zinc-200 opacity-60 hover:opacity-100'"
            @click="toggleFilter(t.key)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="t.icon" class="size-4 shrink-0" :class="t.color" />
              <span class="text-2xl font-bold leading-none tabular-nums">{{ t.n }}</span>
            </div>
            <div class="mt-1.5 text-[13px] font-semibold leading-tight text-zinc-800">{{ t.label }}</div>
            <div class="text-[11px] text-zinc-500 leading-tight">{{ t.hint }}</div>
          </button>
        </div>

        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search job, client or route"
          class="sm:hidden w-full"
          :ui="{ base: 'ps-9! border-0!' }"
        />

        <!-- jobs table -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold">
                Jobs
                <UBadge color="neutral" variant="subtle" class="ms-1">{{ rows.length }}</UBadge>
              </h2>
              <p class="text-xs text-zinc-500 flex-1 min-w-[14rem]">
                Sorted by what needs a person: claims, customs, unanswered messages, sign-off.
              </p>
              <UButton
                v-if="filter || search"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-filter-x"
                @click="filter = null; search = ''"
              >
                Clear filter
              </UButton>
            </div>
          </template>

          <UTable
            :data="rows"
            :columns="columns"
            :empty="'No jobs match this filter.'"
            :on-select="(_e: Event, row: any) => navigateTo(`/ops/jobs/${row.original.id}`)"
            :ui="{ td: 'align-top py-2.5', th: 'py-2' }"
          >
            <template #id-cell="{ row }">
              <div class="font-bold text-sm whitespace-nowrap">{{ row.original.id }}</div>
              <UBadge color="neutral" variant="subtle" size="sm" class="mt-1">
                {{ MODE_LABELS[row.original.mode as 'b2b'] }}
              </UBadge>
            </template>

            <template #client-cell="{ row }">
              <div class="w-40 max-w-40">
                <div class="text-sm font-medium truncate">{{ clientLine(row.original) }}</div>
                <div class="text-[11px] text-zinc-500 truncate">
                  {{ row.original.service ?? MODE_LABELS[row.original.mode as 'b2b'] }}
                </div>
              </div>
            </template>

            <template #route-cell="{ row }">
              <div class="w-52 max-w-52 text-[12px] leading-tight">
                <div class="truncate text-zinc-700">{{ row.original.origin }}</div>
                <div class="truncate text-zinc-500">
                  <UIcon name="i-lucide-arrow-right" class="size-3 align-[-1px]" />
                  {{ row.original.destination }}
                </div>
              </div>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="STATUS_COLOR[row.original.status as 'booked']" variant="subtle" class="whitespace-nowrap">
                {{ STATUS_LABELS[row.original.status as 'booked'] }}
              </UBadge>
            </template>

            <template #docs-cell="{ row }">
              <template v-if="docsDone(row.original).total">
                <div class="text-xs font-semibold tabular-nums">
                  {{ docsDone(row.original).done }}/{{ docsDone(row.original).total }}
                </div>
                <UProgress
                  size="xs"
                  class="w-14 mt-1"
                  :model-value="docsDone(row.original).done"
                  :max="docsDone(row.original).total"
                  :color="docsDone(row.original).done === docsDone(row.original).total ? 'success' : 'warning'"
                />
              </template>
              <span v-else class="text-xs text-zinc-400">—</span>
            </template>

            <template #customs-cell="{ row }">
              <UBadge
                v-if="customsBadge(row.original)"
                :color="customsBadge(row.original)!.color"
                variant="subtle"
                class="whitespace-nowrap"
              >
                {{ customsBadge(row.original)!.label }}
              </UBadge>
              <span v-else class="text-xs text-zinc-400">—</span>
            </template>

            <template #flags-cell="{ row }">
              <div class="flex flex-wrap gap-1 max-w-[11rem]">
                <UBadge v-if="hasOpenClaim(row.original)" color="error" variant="subtle" size="sm">
                  {{ CLAIM_LABELS[row.original.claim.type] }}
                </UBadge>
                <UBadge v-if="needsReply(row.original)" color="primary" variant="subtle" size="sm">
                  Needs reply
                </UBadge>
                <UBadge v-if="partnerWait(row.original)" color="warning" variant="subtle" size="sm">
                  Partner wait
                </UBadge>
                <UBadge v-if="etaPassed(row.original)" color="error" variant="subtle" size="sm">
                  ETA passed
                </UBadge>
                <span
                  v-if="!hasOpenClaim(row.original) && !needsReply(row.original) && !partnerWait(row.original) && !etaPassed(row.original)"
                  class="text-xs text-zinc-400"
                >—</span>
              </div>
            </template>

            <template #eta-cell="{ row }">
              <div class="text-xs whitespace-nowrap" :class="etaPassed(row.original) ? 'text-red-600 font-semibold' : 'text-zinc-600'">
                {{ rel(row.original.eta) }}
              </div>
              <div class="text-[11px] text-zinc-400 whitespace-nowrap">{{ fullWhen(row.original.eta) }}</div>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center gap-1 justify-end">
                <UTooltip text="Copy tracking link">
                  <UButton
                    icon="i-lucide-link"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`Copy tracking link for ${row.original.id}`"
                    @click.stop="copyLink(row.original.id)"
                  />
                </UTooltip>
                <UButton
                  :to="`/ops/jobs/${row.original.id}`"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-right"
                >
                  Open
                </UButton>
              </div>
            </template>
          </UTable>
        </UCard>
      </div>

      <!-- new booking -->
      <USlideover
        v-model:open="showForm"
        title="New booking"
        description="Creates the job and emails the customer their tracking link."
      >
        <template #body>
          <UForm :state="form" :validate="validate" class="space-y-4" @submit="createShipment">
            <UFormField label="Job type" name="mode">
              <USelect v-model="form.mode" :items="MODE_ITEMS" class="w-full" />
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UFormField label="Customer name" name="customerName" required>
                <UInput v-model="form.customerName" placeholder="Daniel Wong" class="w-full" />
              </UFormField>
              <UFormField label="Customer email" name="customerEmail" required>
                <UInput v-model="form.customerEmail" type="email" placeholder="daniel@example.com" class="w-full" />
              </UFormField>

              <template v-if="form.mode === 'b2b'">
                <UFormField label="Company" name="company">
                  <UInput v-model="form.company" placeholder="Allmighty Foods Pte Ltd" class="w-full" />
                </UFormField>
                <UFormField label="PO number" name="poNumber">
                  <UInput v-model="form.poNumber" placeholder="PO-4471" class="w-full" />
                </UFormField>
                <UFormField label="Incoterms" name="incoterms">
                  <USelect v-model="form.incoterms" :items="INCOTERMS" class="w-full" />
                </UFormField>
              </template>
              <template v-else-if="form.mode === 'b2self'">
                <UFormField label="Brand / company" name="company">
                  <UInput v-model="form.company" placeholder="Hey Fran" class="w-full" />
                </UFormField>
                <UFormField label="Transfer reference" name="poNumber">
                  <UInput v-model="form.poNumber" placeholder="TRF-0219" class="w-full" />
                </UFormField>
              </template>

              <UFormField label="Origin" name="origin" required>
                <UInput v-model="form.origin" placeholder="Senoko Food Hub, Singapore" class="w-full" />
              </UFormField>
              <UFormField label="Destination" name="destination" required>
                <UInput v-model="form.destination" placeholder="Tuas, Singapore" class="w-full" />
              </UFormField>
              <UFormField label="ETA" name="eta">
                <UInput v-model="form.eta" type="datetime-local" class="w-full" />
              </UFormField>
              <UFormField label="Driver" name="driverName">
                <UInput v-model="form.driverName" placeholder="Hafiz Rahman" class="w-full" />
              </UFormField>
              <UFormField label="Driver mobile" name="driverPhone" hint="login">
                <UInput v-model="form.driverPhone" placeholder="91234567" class="w-full" />
              </UFormField>
              <UFormField label="Vehicle" name="vehicle">
                <UInput v-model="form.vehicle" placeholder="14-ft lorry — GBC 4521 K" class="w-full" />
              </UFormField>
              <UFormField label="Pieces" name="pieces">
                <UInput v-model.number="form.pieces" type="number" min="1" class="w-full" />
              </UFormField>
              <UFormField label="Weight (kg)" name="weightKg">
                <UInput v-model.number="form.weightKg" type="number" min="0" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Cargo description" name="description" required>
              <UTextarea v-model="form.description" :rows="2" placeholder="Household goods — fragile" class="w-full" />
            </UFormField>

            <div class="flex gap-2 pt-1">
              <UButton type="submit" color="primary" :loading="creating" icon="i-lucide-send">
                Create &amp; send tracking link
              </UButton>
              <UButton color="neutral" variant="ghost" @click="showForm = false">Cancel</UButton>
            </div>
          </UForm>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
