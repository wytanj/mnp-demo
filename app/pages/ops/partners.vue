<script setup lang="ts">
import {
  PARTNER_ROLE_LABELS,
  PARTNER_STATE_LABELS,
  type PartnerRole,
  type PartnerState,
  type PartnerStatus
} from '#shared/utils/shipping'

/**
 * Partner coordination board — every job M&P cannot finish alone, and who else
 * has to move first: shipping line, CFS/warehouse, broker, overseas agent,
 * haulier. "By job" is the CS view, "By partner" is the chasing view.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Trade partners — M&P ops' })

interface PartnerRow {
  shipmentId: string
  client: string
  route: string
  status: string
  eta: string
  partners: PartnerStatus[]
}

const { data: rows, refresh } = await useFetch<PartnerRow[]>('/api/partners', { default: () => [] })
const toast = useToast()
const now = useState<number>('ops-now', () => Date.now())

const view = ref<'job' | 'partner'>('job')
const tab = computed({
  get: () => view.value,
  set: (v: unknown) => {
    const raw = (typeof v === 'object' && v && 'value' in (v as object)
      ? String((v as { value: string }).value)
      : String(v)) as 'job' | 'partner'
    view.value = raw === 'partner' ? 'partner' : 'job'
  }
})
const VIEWS = [
  { value: 'job', label: 'By job', icon: 'i-lucide-boxes' },
  { value: 'partner', label: 'By role', icon: 'i-lucide-handshake' }
]

const ROLES: PartnerRole[] = ['shipping_line', 'warehouse', 'broker', 'agent', 'haulier']
const STATES: PartnerState[] = ['ok', 'waiting', 'blocked', 'done', 'na']

const STATE_COLOR: Record<PartnerState, 'success' | 'warning' | 'error' | 'neutral'> = {
  ok: 'success',
  waiting: 'warning',
  blocked: 'error',
  done: 'neutral',
  na: 'neutral'
}

const ROLE_ICON: Record<string, string> = {
  shipping_line: 'i-lucide-ship',
  warehouse: 'i-lucide-warehouse',
  broker: 'i-lucide-stamp',
  agent: 'i-lucide-globe',
  haulier: 'i-lucide-truck'
}

const flat = computed(() =>
  (rows.value ?? []).flatMap((r) => r.partners.map((p) => ({ ...p, job: r })))
)

const counts = computed(() => ({
  waiting: flat.value.filter((p) => p.state === 'waiting').length,
  blocked: flat.value.filter((p) => p.state === 'blocked').length,
  ok: flat.value.filter((p) => p.state === 'ok').length,
  jobs: (rows.value ?? []).length
}))

const byRole = computed(() =>
  ROLES.map((role) => ({
    role,
    label: PARTNER_ROLE_LABELS[role],
    items: flat.value
      .filter((p) => p.role === role)
      .sort((a, b) => STATES.indexOf(a.state) - STATES.indexOf(b.state))
  })).filter((c) => c.items.length)
)

/* ── who the outside parties actually are ──
   Names carry a contact person ("Wan Hai Lines — Kelvin Lau"); we key the
   "Partners in play" strip on the org half so the same firm counts once. */
const STATE_RANK: Record<PartnerState, number> = { blocked: 0, waiting: 1, ok: 2, done: 3, na: 4 }

function orgName(name: string): string {
  return (name.split(/\s[—–-]\s/)[0] ?? name).trim()
}

/** Customers are "Titan Associates Pte Ltd" in the data — drop the legal suffix inline. */
function shortCustomer(client: string): string {
  return client.replace(/\s+(Pte\.?\s+Ltd\.?|Pte\.?|Ltd\.?)$/i, '').trim()
}

const partnersInPlay = computed(() => {
  const map = new Map<string, { name: string; jobs: Set<string>; state: PartnerState }>()
  for (const p of flat.value) {
    if (p.state === 'na') continue
    const key = orgName(p.name)
    const hit = map.get(key)
    if (!hit) {
      map.set(key, { name: key, jobs: new Set([p.job.shipmentId]), state: p.state })
      continue
    }
    hit.jobs.add(p.job.shipmentId)
    if (STATE_RANK[p.state] < STATE_RANK[hit.state]) hit.state = p.state
  }
  return [...map.values()]
    .map((o) => ({ name: o.name, jobs: o.jobs.size, state: o.state }))
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.jobs - a.jobs || a.name.localeCompare(b.name))
})

const DOT_CLASS: Record<PartnerState, string> = {
  ok: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  blocked: 'bg-red-500',
  done: 'bg-zinc-400',
  na: 'bg-zinc-300'
}

/* ── slideover ── */
const open = ref(false)
const active = ref<{ partner: PartnerStatus; job: PartnerRow } | null>(null)
const nextState = ref<PartnerState>('waiting')
const note = ref('')
const busy = ref(false)

function openPartner(job: PartnerRow, partner: PartnerStatus) {
  active.value = { job, partner }
  nextState.value = partner.state
  note.value = ''
  open.value = true
}

function since(iso?: string): string {
  if (!iso) return 'just now'
  const hrs = Math.round((now.value - new Date(iso).getTime()) / 3_600_000)
  if (hrs < 1) return 'less than an hour'
  if (hrs < 48) return `${hrs}h`
  return `${Math.round(hrs / 24)} days`
}

function shortDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

async function post(body: Record<string, unknown>, message: string) {
  if (!active.value) return
  busy.value = true
  try {
    await $fetch(`/api/shipments/${active.value.job.shipmentId}/partners`, { method: 'POST', body })
    await refresh()
    const updated = (rows.value ?? [])
      .find((r) => r.shipmentId === active.value!.job.shipmentId)
    if (updated) {
      active.value = {
        job: updated,
        partner: updated.partners.find((p) => p.role === active.value!.partner.role) ?? active.value.partner
      }
    }
    toast.add({ title: message, description: `${active.value.partner.name} · ${active.value.job.shipmentId}`, color: 'success', icon: 'i-lucide-handshake' })
  } catch (e: any) {
    toast.add({ title: 'Could not update', description: e?.data?.statusMessage ?? 'Try again', color: 'error' })
  } finally {
    busy.value = false
  }
}

function nudge() {
  if (!active.value) return
  post(
    {
      role: active.value.partner.role,
      state: 'waiting',
      waitingFor: active.value.partner.waitingFor,
      note: note.value.trim() || 'Nudged by CS'
    },
    'Nudge sent (demo)'
  )
}

function applyState() {
  if (!active.value) return
  post(
    {
      role: active.value.partner.role,
      state: nextState.value,
      waitingFor: nextState.value === 'waiting' || nextState.value === 'blocked' ? active.value.partner.waitingFor : '',
      note: note.value.trim()
    },
    `Marked ${PARTNER_STATE_LABELS[nextState.value].toLowerCase()}`
  )
}

const stateItems = STATES.map((s) => ({ value: s, label: PARTNER_STATE_LABELS[s] }))
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Trade partners" icon="i-lucide-handshake">
        <template #right>
          <UTabs
            v-model="tab"
            :items="VIEWS"
            :content="false"
            color="primary"
            variant="pill"
            size="xs"
            :ui="{ list: 'bg-zinc-100' }"
          />
          <DemoHowTo page="ops-partners" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-xs text-zinc-500 shrink-0">
        Trade partners are the outside parties M&amp;P needs on each job — not the customer.
      </p>

      <!-- top strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <UPageCard
          v-for="c in [
            { k: 'blocked', label: 'Blocked', n: counts.blocked, cls: 'text-red-600', icon: 'i-lucide-octagon-x' },
            { k: 'waiting', label: 'Waiting on them', n: counts.waiting, cls: 'text-amber-600', icon: 'i-lucide-hourglass' },
            { k: 'ok', label: 'On track', n: counts.ok, cls: 'text-emerald-600', icon: 'i-lucide-circle-check' },
            { k: 'jobs', label: 'Jobs with partners', n: counts.jobs, cls: 'text-zinc-700', icon: 'i-lucide-boxes' }
          ]"
          :key="c.k"
          variant="subtle"
          :ui="{ container: 'p-3 sm:p-4 gap-1' }"
        >
          <div class="flex items-center gap-2">
            <UIcon :name="c.icon" class="size-4" :class="c.cls" />
            <span class="text-xs font-medium text-zinc-500">{{ c.label }}</span>
          </div>
          <div class="text-2xl font-bold tabular-nums" :class="c.cls">{{ c.n }}</div>
        </UPageCard>
      </div>

      <!-- who the outside parties actually are -->
      <div v-if="partnersInPlay.length" class="shrink-0">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Partners in play</p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="o in partnersInPlay"
            :key="o.name"
            type="button"
            class="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
            :title="`${o.name} — ${PARTNER_STATE_LABELS[o.state].toLowerCase()}`"
            @click="view = 'partner'"
          >
            <span class="size-1.5 rounded-full shrink-0" :class="DOT_CLASS[o.state]" />
            <span class="font-medium text-zinc-800">{{ o.name }}</span>
            <span class="text-zinc-400">· {{ o.jobs }} {{ o.jobs === 1 ? 'job' : 'jobs' }} · {{ PARTNER_STATE_LABELS[o.state].toLowerCase() }}</span>
          </button>
        </div>
      </div>

      <!-- BY JOB -->
      <div v-if="view === 'job'" class="grid gap-3 xl:grid-cols-2">
        <UCard v-for="r in rows" :key="r.shipmentId" :ui="{ body: 'p-4 sm:p-4' }">
          <div class="flex items-start gap-2 flex-wrap">
            <NuxtLink :to="`/ops/jobs/${r.shipmentId}`" class="font-mono text-sm font-bold text-zinc-900 hover:text-primary-600">
              {{ r.shipmentId }}
            </NuxtLink>
            <UBadge :label="r.status" color="neutral" variant="subtle" size="sm" />
            <span class="ms-auto text-[11px] text-zinc-400">ETA {{ shortDate(r.eta) }}</span>
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <UIcon name="i-lucide-building-2" class="size-3 shrink-0 text-zinc-400" />
            <span class="truncate">Customer · {{ r.client }}</span>
          </p>
          <p class="text-[11px] text-zinc-400 line-clamp-1">{{ r.route }}</p>

          <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Trade partners on this job
          </p>
          <div class="mt-1.5 grid gap-2 sm:grid-cols-2">
            <OpsPartnerChip
              v-for="p in r.partners"
              :key="p.role"
              :partner="p"
              compact
              @click="openPartner(r, p)"
            />
          </div>
        </UCard>
      </div>

      <!-- BY PARTNER -->
      <div v-else class="space-y-2.5">
        <p class="text-xs text-zinc-500">
          One column per partner role. Grouped by who has to move next — not by customer.
        </p>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="col in byRole" :key="col.role" class="rounded-xl border border-zinc-200 bg-white">
            <div class="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100">
              <UIcon :name="ROLE_ICON[col.role]" class="size-4 text-zinc-400" />
              <h3 class="text-xs font-bold uppercase tracking-wide text-zinc-600">{{ col.label }}</h3>
              <UBadge :label="String(col.items.length)" color="neutral" variant="subtle" size="sm" class="ms-auto" />
            </div>
            <div class="p-2.5 space-y-2">
              <button
                v-for="(p, i) in col.items"
                :key="`${p.job.shipmentId}-${i}`"
                type="button"
                class="w-full text-left rounded-lg border border-zinc-200 bg-white p-2.5 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                @click="openPartner(p.job, p)"
              >
                <span class="block text-sm font-bold text-zinc-900 leading-snug">{{ p.name }}</span>
                <UBadge
                  :label="PARTNER_STATE_LABELS[p.state]"
                  :color="STATE_COLOR[p.state]"
                  variant="subtle"
                  size="sm"
                  class="mt-1"
                />
                <span class="block text-[11px] text-zinc-500 truncate mt-1">
                  <span class="font-mono">{{ p.job.shipmentId }}</span> · {{ shortCustomer(p.job.client) }}
                </span>
                <span v-if="p.waitingFor" class="block text-[11px] text-zinc-500 leading-snug mt-1 line-clamp-2">
                  {{ p.waitingFor }}
                </span>
                <span v-if="p.since" class="block text-[10px] text-zinc-400 mt-1">since {{ since(p.since) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <p class="text-xs text-zinc-400">
        Nudges are simulated for the demo — each one is written to the job's timeline so the next person sees it.
      </p>
    </template>
  </UDashboardPanel>

  <USlideover v-model:open="open" :title="active?.partner.name ?? 'Partner'" :description="active ? `${PARTNER_ROLE_LABELS[active.partner.role]} · ${active.job.shipmentId}` : ''">
    <template #body>
      <div v-if="active" class="space-y-4">
        <div class="flex items-center gap-2 flex-wrap">
          <UBadge
            :label="PARTNER_STATE_LABELS[active.partner.state]"
            :color="STATE_COLOR[active.partner.state]"
            variant="subtle"
          />
          <UBadge v-if="active.partner.channel" :label="active.partner.channel === 'whatsapp' ? 'WhatsApp' : 'Email'" color="neutral" variant="subtle" size="sm" />
          <span v-if="active.partner.since" class="text-xs text-zinc-400">since {{ since(active.partner.since) }}</span>
        </div>

        <dl class="text-sm divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          <div class="flex gap-3 px-3 py-2">
            <dt class="w-28 shrink-0 text-xs font-medium text-zinc-500">Job / customer</dt>
            <dd class="min-w-0">
              <NuxtLink :to="`/ops/jobs/${active.job.shipmentId}`" class="font-mono text-primary-600 hover:underline">
                {{ active.job.shipmentId }}
              </NuxtLink>
              <span class="text-zinc-500"> · {{ active.job.client }}</span>
            </dd>
          </div>
          <div class="flex gap-3 px-3 py-2">
            <dt class="w-28 shrink-0 text-xs font-medium text-zinc-500">Route</dt>
            <dd class="min-w-0 text-zinc-700 text-xs">{{ active.job.route }}</dd>
          </div>
          <div v-if="active.partner.contact" class="flex gap-3 px-3 py-2">
            <dt class="w-28 shrink-0 text-xs font-medium text-zinc-500">Contact</dt>
            <dd class="min-w-0 text-zinc-700 text-xs break-all">{{ active.partner.contact }}</dd>
          </div>
          <div v-if="active.partner.waitingFor" class="flex gap-3 px-3 py-2">
            <dt class="w-28 shrink-0 text-xs font-medium text-zinc-500">Waiting for</dt>
            <dd class="min-w-0 text-zinc-700 text-xs">{{ active.partner.waitingFor }}</dd>
          </div>
          <div v-if="active.partner.eta" class="flex gap-3 px-3 py-2">
            <dt class="w-28 shrink-0 text-xs font-medium text-zinc-500">Their ETA</dt>
            <dd class="min-w-0 text-zinc-700 text-xs">{{ active.partner.eta }}</dd>
          </div>
        </dl>

        <UFormField label="Note (goes on the job timeline)" size="sm">
          <UTextarea v-model="note" :rows="2" class="w-full" placeholder="e.g. Called Kelvin, HBL promised by 6pm" />
        </UFormField>

        <div class="flex items-end gap-2">
          <UFormField label="Set state" size="sm" class="flex-1">
            <USelect v-model="nextState" :items="stateItems" class="w-full" />
          </UFormField>
          <UButton label="Apply" color="primary" :loading="busy" @click="applyState" />
        </div>

        <USeparator />

        <UButton
          block
          icon="i-lucide-bell-ring"
          color="warning"
          variant="subtle"
          label="Nudge (demo)"
          :loading="busy"
          @click="nudge"
        />
        <p class="text-[11px] text-zinc-400 text-center">
          Sends a chase on {{ active.partner.channel === 'whatsapp' ? 'WhatsApp' : 'email' }} and marks them "waiting on them".
        </p>
      </div>
    </template>
  </USlideover>
</template>
