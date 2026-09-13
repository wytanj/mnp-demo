<script setup lang="ts">
import {
  CLAIM_LABELS,
  CLAIM_TYPES,
  MODE_LABELS,
  PARTNER_ROLE_LABELS,
  PARTNER_STATE_LABELS,
  STATUS_LABELS,
  docsDone,
  etaPassed,
  type ClaimType,
  type CommsThread,
  type PartnerState,
  type PartnerStatus,
  type Shipment,
  type ShipmentStatus
} from '#shared/utils/shipping'

definePageMeta({ layout: 'ops' })

const route = useRoute()
const toast = useToast()
const id = computed(() => String(route.params.id ?? '').toUpperCase())

const { data: shipment, refresh, error } = await useFetch<Shipment>(
  () => `/api/shipments/${id.value}`,
  { key: `job-${id.value}` }
)
const { data: threads, refresh: refreshThreads } = await useFetch<CommsThread[]>(
  () => `/api/comms?shipment=${id.value}`,
  { key: `job-comms-${id.value}`, default: () => [] as CommsThread[] }
)

async function refreshAll() {
  await Promise.all([refresh(), refreshThreads()])
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    if (shipment.value) refreshAll()
  }, 5000)
})
onUnmounted(() => clearInterval(timer))

const s = computed(() => shipment.value)
const notFound = computed(() => !!error.value && !shipment.value)

const client = computed(() =>
  s.value ? (s.value.mode === 'b2c' ? s.value.customerName : (s.value.company ?? s.value.customerName)) : ''
)

const STATUS_COLOR: Record<ShipmentStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  booked: 'neutral',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'warning',
  delivered: 'success'
}

function when(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function rel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const h = Math.round(abs / 3600_000)
  const d = Math.round(abs / 86400_000)
  const label = abs < 3600_000 ? '<1h' : h < 36 ? `${h}h` : `${d}d`
  return ms >= 0 ? `in ${label}` : `${label} ago`
}

const summaryRows = computed(() => {
  const j = s.value
  if (!j) return []
  return [
    { label: 'Client', value: client.value },
    { label: 'Contact', value: `${j.customerName} · ${j.customerEmail}` },
    { label: 'Company', value: j.company ?? '—' },
    { label: 'PO / reference', value: j.poNumber ?? '—' },
    { label: 'Incoterms', value: j.incoterms ?? '—' },
    { label: 'Service', value: j.service ?? MODE_LABELS[j.mode] },
    { label: 'Route', value: `${j.origin} → ${j.destination}` },
    { label: 'ETA', value: `${when(j.eta)} (${rel(j.eta)})` },
    { label: 'Driver', value: j.driverName ? `${j.driverName}${j.driverPhone ? ` · ${j.driverPhone}` : ''}` : '—' },
    { label: 'Vehicle', value: j.vehicle || '—' },
    { label: 'Cargo', value: `${j.pieces} pcs · ${j.weightKg} kg — ${j.description}` }
  ]
})

async function copyLink() {
  const url = `${location.origin}/track/${id.value}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // clipboard blocked (embedded browser) — the toast still shows the link
  }
  toast.add({ title: 'Tracking link copied', description: url, color: 'primary', icon: 'i-lucide-link' })
}

/* ── claims ──────────────────────────────────────────────── */

const openClaim = computed(() => (s.value?.claim?.status === 'open' ? s.value.claim : null))
const claimForm = ref(false)
const claimType = ref<ClaimType>('damage')
const claimNote = ref('')
const resolveNote = ref('')
const busy = ref('')

const CLAIM_ITEMS = CLAIM_TYPES.map((t) => ({ label: CLAIM_LABELS[t], value: t }))

async function post(url: string, body: Record<string, unknown>, tag: string, ok: string) {
  busy.value = tag
  try {
    await $fetch(url, { method: 'POST', body })
    toast.add({ title: ok, color: 'success', icon: 'i-lucide-check' })
    await refreshAll()
    return true
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Could not save',
      description: err?.data?.statusMessage ?? 'Try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert'
    })
    return false
  } finally {
    busy.value = ''
  }
}

async function openAClaim() {
  const done = await post(
    `/api/shipments/${id.value}/claim`,
    { action: 'open', type: claimType.value, note: claimNote.value.trim(), by: 'cs' },
    'claim-open',
    'Claim opened — the review request is held while it is open.'
  )
  if (done) {
    claimForm.value = false
    claimNote.value = ''
  }
}

async function resolveClaim() {
  const done = await post(
    `/api/shipments/${id.value}/claim`,
    { action: 'resolve', note: resolveNote.value.trim() },
    'claim-resolve',
    'Claim resolved.'
  )
  if (done) resolveNote.value = ''
}

/* ── review ask ──────────────────────────────────────────── */

const REVIEW_COPY: Record<string, { label: string; color: 'neutral' | 'warning' | 'success' }> = {
  not_yet: { label: 'No review request yet', color: 'neutral' },
  sent: { label: 'Review request sent', color: 'neutral' },
  held: { label: 'Review request held', color: 'warning' },
  answered: { label: 'Review answered', color: 'success' }
}
const reviewState = computed(() => s.value?.reviewAsk?.state ?? 'not_yet')
const suppressReason = ref('')

function reviewAsk(action: 'send' | 'suppress' | 'release') {
  const copy = {
    send: 'Review request sent to the customer.',
    suppress: 'Review request held.',
    release: 'Held review request released and sent.'
  }[action]
  return post(
    `/api/shipments/${id.value}/review-ask`,
    { action, reason: suppressReason.value.trim() || undefined },
    `review-${action}`,
    copy
  )
}

/* ── partners ────────────────────────────────────────────── */

const PARTNER_COLOR: Record<PartnerState, 'success' | 'warning' | 'error' | 'neutral'> = {
  ok: 'success',
  done: 'success',
  waiting: 'warning',
  blocked: 'error',
  na: 'neutral'
}

function nudge(p: PartnerStatus) {
  return post(
    `/api/shipments/${id.value}/partners`,
    {
      role: p.role,
      state: 'waiting',
      waitingFor: p.waitingFor,
      note: `Nudged ${p.name} from the job page`
    },
    `nudge-${p.role}`,
    `Nudged ${p.name} — logged on the timeline.`
  )
}

/* ── comms ───────────────────────────────────────────────── */

const THREAD_STATUS: Record<string, { label: string; color: 'primary' | 'warning' | 'neutral' }> = {
  needs_reply: { label: 'Needs reply', color: 'primary' },
  waiting_on_them: { label: 'Waiting on them', color: 'warning' },
  closed: { label: 'Closed', color: 'neutral' }
}

function lastMessage(t: CommsThread): string {
  const m = t.messages[t.messages.length - 1]
  if (!m) return '—'
  const body = m.body.replace(/\s+/g, ' ').trim()
  return body.length > 130 ? `${body.slice(0, 129)}…` : body
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="notFound ? 'Job not found' : id" icon="i-lucide-package">
        <template #trailing>
          <UBadge v-if="s" color="neutral" variant="subtle" class="ms-1">{{ client }}</UBadge>
        </template>
        <template #right>
          <template v-if="s">
            <UButton color="neutral" variant="outline" icon="i-lucide-link" size="sm" @click="copyLink()">
              <span class="hidden sm:inline">Copy tracking link</span>
            </UButton>
            <UButton
              :to="`/track/${id}`"
              target="_blank"
              color="neutral"
              variant="outline"
              icon="i-lucide-external-link"
              size="sm"
            >
              <span class="hidden md:inline">Customer view</span>
            </UButton>
            <UButton
              v-if="s.customs"
              :to="`/ops/customs/${id}`"
              color="primary"
              icon="i-lucide-stamp"
              size="sm"
            >
              Customs form
            </UButton>
          </template>
          <UButton v-else to="/ops/jobs" color="neutral" variant="outline" icon="i-lucide-arrow-left" size="sm">
            All jobs
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="notFound"
        color="warning"
        variant="subtle"
        icon="i-lucide-search-x"
        :title="`No job called ${id}`"
        description="That reference is not in the system. It may have been typed wrong, or the demo data was reseeded."
        class="max-w-xl"
      >
        <template #actions>
          <UButton to="/ops/jobs" color="primary" size="sm" icon="i-lucide-arrow-left">Back to jobs</UButton>
        </template>
      </UAlert>

      <div v-else-if="s" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <!-- ── LEFT ─────────────────────────────────────── -->
        <div class="lg:col-span-2 space-y-4 min-w-0">
          <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-bold flex-1">{{ s.id }}</h3>
                <UBadge :color="STATUS_COLOR[s.status]" variant="subtle">{{ STATUS_LABELS[s.status] }}</UBadge>
                <UBadge color="neutral" variant="subtle">{{ MODE_LABELS[s.mode] }}</UBadge>
                <UBadge v-if="etaPassed(s)" color="error" variant="subtle">ETA passed</UBadge>
                <UBadge
                  v-if="docsDone(s).total"
                  :color="docsDone(s).done === docsDone(s).total ? 'success' : 'warning'"
                  variant="subtle"
                >Docs {{ docsDone(s).done }}/{{ docsDone(s).total }}</UBadge>
              </div>
            </template>

            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <div v-for="r in summaryRows" :key="r.label" class="min-w-0">
                <dt class="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{{ r.label }}</dt>
                <dd class="text-sm text-zinc-800 break-words">{{ r.value }}</dd>
              </div>
            </dl>

            <USeparator class="my-4" />
            <StatusSteps :status="s.status" />
          </UCard>

          <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-history" class="size-4 text-primary" />
                <h3 class="text-sm font-bold">Timeline</h3>
                <UBadge color="neutral" variant="subtle" class="ms-auto">{{ s.events.length }}</UBadge>
              </div>
            </template>
            <EventTimeline :events="s.events" />
          </UCard>

          <DocumentChecklist v-if="s.documents?.length" :shipment="s" mode="cs" @refresh="refreshAll()" />
        </div>

        <!-- ── RIGHT ────────────────────────────────────── -->
        <div class="space-y-4 min-w-0">
          <OpsJobCustomsCard v-if="s.customs" :shipment="s" @refresh="refreshAll()" />

          <!-- claim -->
          <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2 flex-wrap">
                <UIcon name="i-lucide-shield-alert" class="size-4 text-primary" />
                <h3 class="text-sm font-bold flex-1">Claim</h3>
                <UBadge v-if="openClaim" color="error" variant="subtle">{{ CLAIM_LABELS[openClaim.type] }}</UBadge>
                <UBadge v-else-if="s.claim" color="success" variant="subtle">Resolved</UBadge>
                <UBadge v-else color="neutral" variant="subtle">None</UBadge>
              </div>
            </template>

            <div v-if="openClaim" class="space-y-3">
              <p class="text-sm text-zinc-700">{{ openClaim.note || CLAIM_LABELS[openClaim.type] }}</p>
              <p class="text-[11px] text-zinc-500">
                Opened by {{ openClaim.openedBy }} · {{ when(openClaim.openedAt) }}
              </p>
              <UInput v-model="resolveNote" placeholder="Resolution note (optional)" class="w-full" size="sm" />
              <UButton color="primary" size="sm" :loading="busy === 'claim-resolve'" @click="resolveClaim()">
                Resolve claim
              </UButton>
            </div>
            <div v-else class="space-y-3">
              <p v-if="s.claim" class="text-sm text-zinc-700">
                {{ CLAIM_LABELS[s.claim.type] }} resolved {{ when(s.claim.resolvedAt) }}<template v-if="s.claim.resolvedNote"> — {{ s.claim.resolvedNote }}</template>
              </p>
              <p v-else class="text-sm text-zinc-500">No claims on this job.</p>

              <template v-if="claimForm">
                <USelect v-model="claimType" :items="CLAIM_ITEMS" class="w-full" size="sm" />
                <UInput v-model="claimNote" placeholder="What happened?" class="w-full" size="sm" />
                <div class="flex gap-2">
                  <UButton color="primary" size="sm" :loading="busy === 'claim-open'" @click="openAClaim()">
                    Open claim
                  </UButton>
                  <UButton color="neutral" variant="ghost" size="sm" @click="claimForm = false">Cancel</UButton>
                </div>
              </template>
              <UButton v-else color="neutral" variant="outline" size="sm" @click="claimForm = true">
                Open a claim
              </UButton>
            </div>
          </UCard>

          <!-- review ask -->
          <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2 flex-wrap">
                <UIcon name="i-lucide-star" class="size-4 text-primary" />
                <h3 class="text-sm font-bold flex-1">Review ask</h3>
                <UBadge :color="REVIEW_COPY[reviewState]!.color" variant="subtle">
                  {{ REVIEW_COPY[reviewState]!.label }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-zinc-700">
                <template v-if="s.review">
                  ★ {{ s.review.rating }}/5 — “{{ s.review.comment }}”
                </template>
                <template v-else-if="s.reviewAsk?.reason">{{ s.reviewAsk.reason }}</template>
                <template v-else-if="reviewState === 'sent'">
                  Sent {{ when(s.reviewAsk?.at) }} — waiting on the customer.
                </template>
                <template v-else>
                  Goes out automatically once the job is delivered — unless a claim is open.
                </template>
              </p>

              <UInput
                v-if="reviewState !== 'held'"
                v-model="suppressReason"
                placeholder="Reason, if you hold it"
                size="sm"
                class="w-full"
              />

              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="reviewState !== 'held'"
                  color="primary"
                  size="sm"
                  icon="i-lucide-send"
                  :loading="busy === 'review-send'"
                  :disabled="!!s.review"
                  @click="reviewAsk('send')"
                >
                  Send review request now
                </UButton>
                <UButton
                  v-if="reviewState !== 'held'"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-pause"
                  :loading="busy === 'review-suppress'"
                  :disabled="!!s.review"
                  @click="reviewAsk('suppress')"
                >
                  Suppress
                </UButton>
                <UButton
                  v-else
                  color="primary"
                  size="sm"
                  icon="i-lucide-play"
                  :loading="busy === 'review-release'"
                  @click="reviewAsk('release')"
                >
                  Release
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- partners -->
          <UCard v-if="s.partners?.length" :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-handshake" class="size-4 text-primary" />
                <h3 class="text-sm font-bold flex-1">Partners</h3>
                <UButton to="/ops/partners" size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-right">
                  Board
                </UButton>
              </div>
            </template>

            <div class="space-y-3">
              <div v-for="p in s.partners" :key="p.role" class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      {{ PARTNER_ROLE_LABELS[p.role] }}
                    </span>
                    <UBadge :color="PARTNER_COLOR[p.state]" variant="subtle" size="sm">
                      {{ PARTNER_STATE_LABELS[p.state] }}
                    </UBadge>
                  </div>
                  <div class="text-sm font-medium text-zinc-800 break-words">{{ p.name }}</div>
                  <div v-if="p.waitingFor" class="text-[12px] text-zinc-600 break-words">{{ p.waitingFor }}</div>
                  <div v-if="p.contact" class="text-[11px] text-zinc-400 break-words">{{ p.contact }}</div>
                </div>
                <UButton
                  v-if="p.state === 'waiting' || p.state === 'blocked'"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-bell-ring"
                  :loading="busy === `nudge-${p.role}`"
                  @click="nudge(p)"
                >
                  Nudge
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- comms -->
          <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-messages-square" class="size-4 text-primary" />
                <h3 class="text-sm font-bold flex-1">Messages</h3>
                <UBadge color="neutral" variant="subtle">{{ threads.length }}</UBadge>
              </div>
            </template>

            <p v-if="!threads.length" class="text-sm text-zinc-500">No email or WhatsApp on this job yet.</p>

            <div class="space-y-3">
              <NuxtLink
                v-for="t in threads"
                :key="t.id"
                :to="`/ops/inbox?thread=${encodeURIComponent(t.id)}`"
                class="block rounded-lg border border-zinc-200 p-3 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UIcon
                    :name="t.channel === 'whatsapp' ? 'i-lucide-message-circle' : 'i-lucide-mail'"
                    class="size-3.5"
                    :class="t.channel === 'whatsapp' ? 'text-green-600' : 'text-blue-600'"
                  />
                  <span class="text-[13px] font-semibold text-zinc-800">{{ t.contactName }}</span>
                  <UBadge :color="THREAD_STATUS[t.status]!.color" variant="subtle" size="sm">
                    {{ THREAD_STATUS[t.status]!.label }}
                  </UBadge>
                  <span class="text-[11px] text-zinc-400 ms-auto">{{ rel(t.lastAt) }}</span>
                </div>
                <div class="text-[12px] text-zinc-500 mt-0.5">{{ t.subject }}</div>
                <p class="text-[12px] text-zinc-700 mt-1 line-clamp-2">{{ lastMessage(t) }}</p>
                <span class="text-[11px] font-semibold text-primary mt-1 inline-block">Open in inbox →</span>
              </NuxtLink>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
