<script setup lang="ts">
import {
  CUSTOMS_LABELS,
  DECLARATION_LABELS,
  DECLARATION_REQUIRED,
  HS_HINTS,
  PREFILL_SOURCES,
  customsDocs,
  prefillDeclaration,
  type CustomsDeclaration,
  type PartnerStatus,
  type Shipment
} from '#shared/utils/shipping'

definePageMeta({ layout: 'ops' })

const route = useRoute()
const toast = useToast()
const id = computed(() => String(route.params.id ?? '').toUpperCase())

const { data: shipment, refresh, error } = await useFetch<Shipment>(
  () => `/api/shipments/${id.value}`,
  { key: `customs-${id.value}` }
)

const s = computed(() => shipment.value)
const notFound = computed(() => !!error.value && !shipment.value)
const customs = computed(() => s.value?.customs)
const filed = computed(() => customs.value?.status === 'declared' || customs.value?.status === 'cleared')

/* ── the key-in form ─────────────────────────────────────── */

type FormShape = Record<keyof CustomsDeclaration, string | number | undefined>

function blankForm(): FormShape {
  return {
    declarationType: 'IN',
    hsCode: '',
    cargoValue: undefined,
    currency: '',
    countryOfOrigin: '',
    importerUEN: '',
    importerName: '',
    permitType: '',
    vesselName: '',
    voyage: '',
    blNo: '',
    containerNo: '',
    portOfLoading: '',
    portOfDischarge: '',
    packages: undefined,
    grossWeightKg: undefined,
    description: '',
    incoterms: '',
    filedBy: '',
    filedAt: '',
    permitNo: ''
  }
}

const form = reactive<FormShape>(blankForm())

/** Copy server values in. `onlyEmpty` keeps whatever the officer is typing. */
function syncFromServer(onlyEmpty = false) {
  const d = (customs.value?.declaration ?? {}) as Record<string, unknown>
  for (const key of Object.keys(form) as Array<keyof CustomsDeclaration>) {
    const v = d[key]
    if (v === undefined || v === null || v === '') continue
    if (onlyEmpty && form[key] !== '' && form[key] !== undefined) continue
    form[key] = v as string | number
  }
}
syncFromServer()
watch(() => s.value?.id, () => syncFromServer())

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(async () => {
    if (!s.value) return
    await refresh()
    syncFromServer(true)
  }, 5000)
})
onUnmounted(() => clearInterval(timer))

/* ── live gaps ───────────────────────────────────────────── */

function isFilled(key: keyof CustomsDeclaration): boolean {
  const v = form[key]
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return !Number.isNaN(v)
  return true
}

const pendingDocs = computed(() =>
  customsDocs(s.value ?? ({ documents: [] } as unknown as Shipment)).filter(
    (d) => d.required && d.status !== 'approved' && d.status !== 'waived'
  )
)

const fieldChecks = computed(() =>
  DECLARATION_REQUIRED.map((key) => ({
    key,
    label: DECLARATION_LABELS[key],
    ok: isFilled(key)
  }))
)

const gapCount = computed(
  () => fieldChecks.value.filter((c) => !c.ok).length + pendingDocs.value.length
)

/* ── field option lists ──────────────────────────────────── */

const DECLARATION_TYPES = [
  { label: 'IN — Import', value: 'IN' },
  { label: 'OUT — Export', value: 'OUT' },
  { label: 'TRANSHIPMENT', value: 'TRANSHIPMENT' }
]
const PERMIT_TYPES = [
  'IN-PAYMENT (GST)',
  'IN-NON-PAYMENT (GST relief)',
  'IN-NON-PAYMENT (Zero-GST warehouse)',
  'OUT-DIRECT EXPORT',
  'TRANSHIPMENT / THROUGH'
]
const CURRENCIES = ['USD', 'SGD', 'CNY', 'HKD', 'EUR', 'KRW']
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP']
const OFFICERS = ['Joreen (M&P Customs)', 'Kelvin (M&P Customs)']

const officer = ref(OFFICERS[0]!)

/* ── prefill (suggestions only — a person still files) ───── */

const prefilling = ref(false)

/** Write the suggested values into every field the officer has left empty. */
function applyPrefill(): Array<{ key: keyof CustomsDeclaration; label: string; value: string; source: string }> {
  const j = s.value
  if (!j) return []
  const suggestion = prefillDeclaration(j)
  const added: Array<{ key: keyof CustomsDeclaration; label: string; value: string; source: string }> = []
  for (const [k, value] of Object.entries(suggestion) as Array<[keyof CustomsDeclaration, string | number | undefined]>) {
    if (value === undefined || value === '') continue
    if (isFilled(k)) continue
    form[k] = value
    added.push({
      key: k,
      label: DECLARATION_LABELS[k],
      value: String(value),
      source: PREFILL_SOURCES[k] ?? 'Job file'
    })
  }
  return added
}

/** "Fill from job" — booking, B/L details and quotation. Fields stay editable. */
function fillFromJob() {
  if (!s.value) return
  prefilling.value = true
  try {
    const added = applyPrefill()
    toast.add({
      title: added.length
        ? `Prefilled ${added.length} field${added.length === 1 ? '' : 's'} — check before filing`
        : 'Nothing left to prefill',
      description: added.length
        ? added.map((a) => a.label).join(', ')
        : 'Every field the job knows about is already keyed in.',
      color: 'primary',
      icon: 'i-lucide-wand-sparkles'
    })
  } finally {
    prefilling.value = false
  }
}

/* ── agent assist — suggestions only, a person files ─────── */

type AssistTask = '' | 'docs' | 'permit' | 'nudge'
const assistBusy = ref<AssistTask>('')
const assistSources = ref<Array<{ label: string; value: string; source: string }>>([])
const permitFlag = ref<{ flaggedFor: string; blockedPartner: PartnerStatus | null } | null>(null)
const nudgeOpen = ref(false)

/** "Fill from docs" — same prefill, and it says which document each value came from. */
async function fillFromDocs() {
  const j = s.value
  if (!j) return
  assistBusy.value = 'docs'
  try {
    const added = applyPrefill()
    assistSources.value = added.map(({ label, value, source }) => ({ label, value, source }))

    // The documents the read claims to come from — mark them received (demo).
    const docs = [...pendingDocs.value]
    for (const d of docs) {
      await $fetch(`/api/shipments/${id.value}/documents`, {
        method: 'POST',
        body: { key: d.key, action: 'approve' }
      })
    }
    if (docs.length) await refresh()

    toast.add({
      title: added.length
        ? `Prefilled ${added.length} field${added.length === 1 ? '' : 's'} — check before filing`
        : 'Nothing left to prefill',
      description: docs.length
        ? `Marked received: ${docs.map((d) => d.label).join(', ')}. Every value is a suggestion — the officer checks it.`
        : 'Every value is a suggestion — the officer checks it against the file.',
      color: 'primary',
      icon: 'i-lucide-file-search'
    })
  } finally {
    assistBusy.value = ''
  }
}

/** "Flag missing permit" — writes the gap onto the job and names who is stuck on it. */
async function flagPermit() {
  if (!s.value) return
  assistBusy.value = 'permit'
  try {
    const res = await $fetch<{ flaggedFor: string; blockedPartner: PartnerStatus | null }>(
      `/api/shipments/${id.value}/customs`,
      { method: 'POST', body: { action: 'flag_permit', by: officer.value } }
    )
    permitFlag.value = { flaggedFor: res.flaggedFor, blockedPartner: res.blockedPartner ?? null }
    await refresh()
    toast.add({
      title: `Permit flagged for ${res.flaggedFor}`,
      description: res.blockedPartner
        ? `${res.blockedPartner.name} is blocked on this permit — it is on the job timeline now.`
        : 'Noted on the job timeline.',
      color: 'warning',
      icon: 'i-lucide-flag'
    })
  } finally {
    assistBusy.value = ''
  }
}

/* ── draft nudge (chase copy — nothing is sent from here) ── */

const missingList = computed(() => {
  const docs = pendingDocs.value.map((d) => d.label)
  const fields = fieldChecks.value.filter((c) => !c.ok).map((c) => c.label)
  return { docs, fields }
})

const nudgeWhatsApp = computed(() => {
  const j = s.value
  if (!j) return ''
  const first = (j.customerName ?? '').split(' ')[0] || 'there'
  const { docs, fields } = missingList.value
  const wants = [...docs, ...fields.map((f) => f.toLowerCase())]
  return [
    `Hi ${first}, M&P here on ${j.id} (${j.origin.split(',')[0]} → ${j.destination.split(',')[0]}).`,
    wants.length
      ? `Before ${officer.value.split(' ')[0]} can file the import declaration on TradeNet we still need: ${wants.join(', ')}.`
      : 'Everything we need is in — the declaration goes to TradeNet next.',
    'Can you send them across today? Vessel ETA is close and the CFS slot depends on the permit.',
    'Thanks! — M&P International Freights'
  ].join(' ')
})

const nudgeEmail = computed(() => {
  const j = s.value
  if (!j) return ''
  const { docs, fields } = missingList.value
  return [
    `Subject: ${j.id} — documents outstanding before customs declaration`,
    '',
    `Dear ${j.customerName},`,
    '',
    `We are preparing the import declaration for ${j.id} (${j.description}).`,
    docs.length ? `Still outstanding from your side: ${docs.join(', ')}.` : '',
    fields.length ? `We also need to confirm: ${fields.join(', ')}.` : '',
    '',
    `Once these are with us, ${officer.value} files the declaration on TradeNet and the permit number goes onto your tracking page.`,
    '',
    'Kind regards,',
    'M&P International Freights'
  ].filter((l) => l !== undefined).join('\n')
})

function draftNudge() {
  nudgeOpen.value = true
}

async function copyNudge(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied', description: 'Paste it into WhatsApp or the inbox reply.', color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    toast.add({ title: 'Could not copy', description: 'Select the text and copy it manually.', color: 'warning', icon: 'i-lucide-copy-x' })
  }
}

/* ── broker handoff ──────────────────────────────────────── */

const broker = computed(() => (s.value?.partners ?? []).find((p) => p.role === 'broker'))
const blockedPartner = computed(() =>
  (s.value?.partners ?? []).find((p) => p.state === 'blocked' && (p.role === 'warehouse' || p.role === 'haulier'))
)
const handingOver = ref(false)

const PARTNER_STATE_DOT: Record<string, string> = {
  ok: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  blocked: 'bg-red-500',
  done: 'bg-zinc-400',
  na: 'bg-zinc-300'
}

async function handToBroker() {
  if (!s.value) return
  handingOver.value = true
  try {
    await $fetch(`/api/shipments/${id.value}/partners`, {
      method: 'POST',
      body: {
        role: 'broker',
        state: 'waiting',
        name: broker.value?.name ?? officer.value,
        waitingFor: 'Declaration pack handed over — filing on TradeNet',
        note: `Handed over by ${officer.value} from the declaration desk`
      }
    })
    await refresh()
    toast.add({
      title: 'Handed to the broker',
      description: `${broker.value?.name ?? officer.value} has the declaration pack — filing on TradeNet next.`,
      color: 'success',
      icon: 'i-lucide-handshake'
    })
  } finally {
    handingOver.value = false
  }
}

/* ── customs query ───────────────────────────────────────── */

const responding = ref(false)
const queried = computed(() => customs.value?.status === 'queried')

async function respondQuery() {
  if (!s.value) return
  responding.value = true
  try {
    await $fetch(`/api/shipments/${id.value}/customs`, {
      method: 'POST',
      body: { action: 'respond_query', by: officer.value, note: 'Reply keyed into TradeNet with the supporting documents' }
    })
    await refresh()
    toast.add({
      title: 'Query answered',
      description: `${officer.value} responded on TradeNet — back with Singapore Customs.`,
      color: 'success',
      icon: 'i-lucide-message-square-reply'
    })
  } finally {
    responding.value = false
  }
}

/* ── save / submit ───────────────────────────────────────── */

const saving = ref(false)
const submitting = ref(false)
const submitError = ref('')

function payload(): CustomsDeclaration {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(form)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  delete out.filedBy
  delete out.filedAt
  delete out.permitNo
  return out as CustomsDeclaration
}

async function saveDraft(quiet = false) {
  saving.value = true
  submitError.value = ''
  try {
    await $fetch(`/api/shipments/${id.value}/customs`, {
      method: 'POST',
      body: { action: 'save_declaration', declaration: payload() }
    })
    await refresh()
    if (!quiet) {
      toast.add({ title: 'Draft saved', description: `${id.value} declaration draft stored.`, color: 'success', icon: 'i-lucide-save' })
    }
    return true
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    submitError.value = err?.data?.statusMessage ?? 'Could not save the draft.'
    return false
  } finally {
    saving.value = false
  }
}

async function submitDemo() {
  submitting.value = true
  submitError.value = ''
  try {
    const saved = await saveDraft(true)
    if (!saved) return
    const res = await $fetch<{ permitNo: string }>(`/api/shipments/${id.value}/customs`, {
      method: 'POST',
      body: { action: 'submit_demo', by: officer.value }
    })
    await refresh()
    syncFromServer()
    toast.add({
      title: 'Submitted to TradeNet (demo)',
      description: `Filed by ${officer.value}, permit ${res.permitNo}`,
      color: 'success',
      icon: 'i-lucide-stamp'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    submitError.value = err?.data?.statusMessage ?? 'TradeNet submission failed.'
  } finally {
    submitting.value = false
  }
}

function when(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="notFound ? 'Job not found' : `Declaration · ${id}`" icon="i-lucide-file-pen-line">
        <template #right>
          <UButton to="/ops/customs" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left">
            <span class="hidden sm:inline">Queue</span>
          </UButton>
          <UButton
            v-if="s"
            :to="`/ops/jobs/${id}`"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-package"
          >
            <span class="hidden sm:inline">Job</span>
          </UButton>
          <UButton
            v-if="s"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-wand-sparkles"
            :loading="prefilling"
            @click="fillFromJob()"
          >
            <span class="hidden md:inline">Fill from job</span>
            <span class="md:hidden">Fill</span>
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
        description="Nothing to declare — check the reference on the customs queue."
        class="max-w-xl"
      >
        <template #actions>
          <UButton to="/ops/customs" color="primary" size="sm" icon="i-lucide-arrow-left">Back to queue</UButton>
        </template>
      </UAlert>

      <div v-else-if="s" class="space-y-4">
        <UAlert
          v-if="filed"
          color="success"
          variant="subtle"
          icon="i-lucide-badge-check"
          title="Declared on TradeNet"
          :description="`Filed by ${customs?.declaredBy ?? officer} on ${when(customs?.declaredAt)} · permit ${customs?.permitNo ?? '—'}`"
        />

        <UAlert
          v-if="queried"
          color="error"
          variant="subtle"
          icon="i-lucide-message-square-warning"
          :title="CUSTOMS_LABELS.queried"
          :description="customs?.queryNote ?? 'Singapore Customs raised a query on this declaration.'"
        >
          <template #actions>
            <UButton
              color="error"
              size="sm"
              icon="i-lucide-message-square-reply"
              :loading="responding"
              @click="respondQuery()"
            >
              Respond as {{ officer.split(' ')[0] }}
            </UButton>
          </template>
        </UAlert>

        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="TradeNet would reject this"
          :description="submitError"
          close
          @update:open="submitError = ''"
        />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <!-- ── key-in form ──────────────────────────── -->
          <div class="lg:col-span-2 min-w-0">
            <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
              <template #header>
                <div class="flex items-center gap-2 flex-wrap">
                  <UIcon name="i-lucide-stamp" class="size-4 text-primary" />
                  <div class="flex-1 min-w-0">
                    <h2 class="text-sm font-bold">TradeNet declaration — key-in</h2>
                    <p class="text-[11px] text-zinc-500">
                      {{ s.id }} · {{ s.company ?? s.customerName }} · {{ s.origin }} → {{ s.destination }}
                    </p>
                  </div>
                  <UBadge :color="gapCount ? 'warning' : 'success'" variant="subtle">
                    {{ gapCount ? `${gapCount} gap${gapCount === 1 ? '' : 's'}` : 'Complete' }}
                  </UBadge>
                </div>
              </template>

              <UForm :state="form" class="space-y-5" @submit.prevent>
                <!-- Declaration -->
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">Declaration</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UFormField label="Declaration type" name="declarationType" required>
                      <USelect v-model="form.declarationType" :items="DECLARATION_TYPES" class="w-full" />
                    </UFormField>
                    <UFormField label="Permit type" name="permitType">
                      <USelect v-model="form.permitType" :items="PERMIT_TYPES" class="w-full" />
                    </UFormField>
                  </div>
                </div>

                <USeparator />

                <!-- Importer -->
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">Importer / declaring agent</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UFormField label="Importer name" name="importerName">
                      <UInput v-model="form.importerName" placeholder="Titan Associates Pte Ltd" class="w-full" />
                    </UFormField>
                    <UFormField label="Importer UEN" name="importerUEN" required>
                      <UInput v-model="form.importerUEN" placeholder="201512345K" class="w-full font-mono" />
                    </UFormField>
                  </div>
                </div>

                <USeparator />

                <!-- Consignment -->
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">Consignment</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UFormField label="Vessel / carrier" name="vesselName" required>
                      <UInput v-model="form.vesselName" placeholder="WAN HAI 516" class="w-full" />
                    </UFormField>
                    <UFormField label="Voyage" name="voyage">
                      <UInput v-model="form.voyage" placeholder="W050" class="w-full" />
                    </UFormField>
                    <UFormField label="B/L number" name="blNo" required>
                      <UInput v-model="form.blNo" placeholder="ICS2008403A" class="w-full font-mono" />
                    </UFormField>
                    <UFormField label="Container number" name="containerNo">
                      <UInput v-model="form.containerNo" placeholder="TEMU 482391-0" class="w-full font-mono" />
                    </UFormField>
                    <UFormField label="Port of loading" name="portOfLoading" required>
                      <UInput v-model="form.portOfLoading" placeholder="CNSZX — Shenzhen (Yantian)" class="w-full" />
                    </UFormField>
                    <UFormField label="Port of discharge" name="portOfDischarge" required>
                      <UInput v-model="form.portOfDischarge" placeholder="SGSIN — Keppel Distripark" class="w-full" />
                    </UFormField>
                    <UFormField label="Incoterms" name="incoterms">
                      <USelect v-model="form.incoterms" :items="INCOTERMS" class="w-full" />
                    </UFormField>
                  </div>
                </div>

                <USeparator />

                <!-- Goods -->
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">Goods</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UFormField label="HS code" name="hsCode" required>
                      <UInput v-model="form.hsCode" placeholder="8471.60.70" class="w-full font-mono" />
                    </UFormField>
                    <UFormField label="Country of origin" name="countryOfOrigin" required>
                      <UInput v-model="form.countryOfOrigin" placeholder="CN — China" class="w-full" />
                    </UFormField>
                    <UFormField label="Goods description" name="description" class="sm:col-span-2" required>
                      <UTextarea v-model="form.description" :rows="2" placeholder="Wireless keyboards, retail packed" class="w-full" />
                    </UFormField>
                    <UFormField label="Packages" name="packages" required>
                      <UInput v-model.number="form.packages" type="number" min="1" class="w-full" />
                    </UFormField>
                    <UFormField label="Gross weight (kg)" name="grossWeightKg" required>
                      <UInput v-model.number="form.grossWeightKg" type="number" min="0" class="w-full" />
                    </UFormField>
                    <UFormField label="Cargo value" name="cargoValue" required>
                      <UInput v-model.number="form.cargoValue" type="number" min="0" class="w-full" />
                    </UFormField>
                    <UFormField label="Currency" name="currency" required>
                      <USelect v-model="form.currency" :items="CURRENCIES" class="w-full" />
                    </UFormField>
                  </div>

                  <div class="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                    <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5">
                      HS code lookup
                    </div>
                    <div class="flex flex-col gap-1">
                      <button
                        v-for="h in HS_HINTS"
                        :key="h.code"
                        type="button"
                        class="text-left text-[12px] flex items-center gap-2 rounded px-1.5 py-1 hover:bg-white"
                        @click="form.hsCode = h.code"
                      >
                        <span class="font-mono font-semibold text-zinc-800">{{ h.code }}</span>
                        <span class="text-zinc-500">{{ h.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <USeparator />

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-save"
                    :loading="saving"
                    @click="saveDraft()"
                  >
                    Save draft
                  </UButton>
                  <UButton
                    color="primary"
                    icon="i-lucide-send"
                    :loading="submitting"
                    :disabled="filed || queried"
                    @click="submitDemo()"
                  >
                    Submit to TradeNet (demo)
                  </UButton>
                  <span class="text-[11px] text-zinc-500 flex-1 min-w-[12rem]">
                    Filed by a named M&amp;P customs officer — TradeNet is never auto-filed.
                  </span>
                </div>
              </UForm>
            </UCard>
          </div>

          <!-- ── right rail ───────────────────────────── -->
          <div class="space-y-4 min-w-0">
            <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-list-checks" class="size-4 text-primary" />
                  <h3 class="text-sm font-bold flex-1">Gaps before filing</h3>
                  <UBadge :color="gapCount ? 'warning' : 'success'" variant="subtle">{{ gapCount }}</UBadge>
                </div>
              </template>

              <ul class="space-y-1.5">
                <li v-for="c in fieldChecks" :key="c.key" class="flex items-start gap-2 text-[13px]">
                  <UIcon
                    :name="c.ok ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'"
                    class="size-4 shrink-0 mt-0.5"
                    :class="c.ok ? 'text-green-600' : 'text-amber-500'"
                  />
                  <span :class="c.ok ? 'text-zinc-400 line-through' : 'text-zinc-800 font-medium'">{{ c.label }}</span>
                </li>
                <li v-for="d in pendingDocs" :key="d.key" class="flex items-start gap-2 text-[13px]">
                  <UIcon name="i-lucide-file-warning" class="size-4 shrink-0 mt-0.5 text-amber-500" />
                  <span class="text-zinc-800 font-medium">Document: {{ d.label }}</span>
                </li>
              </ul>

              <p v-if="!gapCount" class="mt-3 text-[13px] font-semibold text-green-700">
                Nothing outstanding — {{ officer.split(' ')[0] }} can file this now.
              </p>
            </UCard>

            <!-- ── agent assist — suggestions only ──────── -->
            <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
                  <h3 class="text-sm font-bold flex-1">Assist — suggestions only, a person files</h3>
                </div>
              </template>

              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-file-search"
                  :loading="assistBusy === 'docs'"
                  @click="fillFromDocs()"
                >
                  Fill from docs
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-flag"
                  :loading="assistBusy === 'permit'"
                  @click="flagPermit()"
                >
                  Flag missing permit
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-message-square-plus"
                  @click="draftNudge()"
                >
                  Draft nudge
                </UButton>
              </div>

              <!-- where each suggested value came from -->
              <div v-if="assistSources.length" class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5">
                  Read from the file ({{ assistSources.length }})
                </div>
                <ul class="space-y-1">
                  <li v-for="a in assistSources" :key="a.label" class="text-[12px] leading-snug">
                    <span class="font-semibold text-zinc-800">{{ a.label }}</span>
                    <span class="text-zinc-600"> — {{ a.value }}</span>
                    <span class="block text-[11px] text-zinc-500">source: {{ a.source }}</span>
                  </li>
                </ul>
                <p class="mt-2 text-[11px] text-zinc-500">
                  Suggestions. Nothing is submitted — {{ officer.split(' ')[0] }} checks each line and files on TradeNet.
                </p>
              </div>

              <!-- permit flag result -->
              <div v-if="permitFlag" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p class="text-[12px] font-semibold text-amber-900">
                  ⚠ Permit missing — flagged for {{ permitFlag.flaggedFor }}
                </p>
                <p v-if="permitFlag.blockedPartner" class="text-[12px] text-amber-800 mt-1">
                  {{ permitFlag.blockedPartner.name }} is blocked on this permit.
                  <NuxtLink to="/ops/partners" class="font-semibold underline">Trade partners</NuxtLink>
                </p>
              </div>
              <div
                v-else-if="blockedPartner"
                class="mt-3 text-[12px] text-red-700 leading-snug"
              >
                <UIcon name="i-lucide-octagon-alert" class="size-3.5 align-[-2px]" />
                {{ blockedPartner.name }} is blocked without this permit.
              </div>

              <!-- draft nudge -->
              <div v-if="nudgeOpen" class="mt-3 space-y-2">
                <div class="rounded-lg border border-zinc-200 bg-white p-2.5">
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1">WhatsApp</div>
                  <p class="text-[12px] text-zinc-800 whitespace-pre-wrap leading-snug">{{ nudgeWhatsApp }}</p>
                  <UButton
                    class="mt-2"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-copy"
                    @click="copyNudge(nudgeWhatsApp)"
                  >
                    Copy
                  </UButton>
                </div>
                <div class="rounded-lg border border-zinc-200 bg-white p-2.5">
                  <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1">Email</div>
                  <p class="text-[12px] text-zinc-800 whitespace-pre-wrap leading-snug">{{ nudgeEmail }}</p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" @click="copyNudge(nudgeEmail)">
                      Copy
                    </UButton>
                    <UButton size="xs" color="primary" variant="soft" icon="i-lucide-inbox" to="/ops/inbox">
                      Send via Inbox
                    </UButton>
                  </div>
                </div>
                <p class="text-[11px] text-zinc-500">Draft copy only — nothing is sent from this page.</p>
              </div>
            </UCard>

            <!-- ── broker handoff ───────────────────────── -->
            <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-handshake" class="size-4 text-primary" />
                  <h3 class="text-sm font-bold flex-1">Broker handoff</h3>
                </div>
              </template>

              <div v-if="broker" class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="size-2 rounded-full shrink-0" :class="PARTNER_STATE_DOT[broker.state]" />
                  <span class="text-[13px] font-semibold text-zinc-900">{{ broker.name }}</span>
                </div>
                <p v-if="broker.waitingFor" class="text-[12px] text-zinc-600 leading-snug">
                  {{ broker.waitingFor }}
                </p>
                <p v-if="broker.contact" class="text-[11px] text-zinc-500">{{ broker.contact }}</p>
              </div>
              <p v-else class="text-[12px] text-zinc-500">
                No broker on this job yet — handing over adds one.
              </p>

              <div class="mt-3 flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-handshake"
                  :loading="handingOver"
                  @click="handToBroker()"
                >
                  Hand to broker
                </UButton>
                <UButton to="/ops/partners" color="neutral" variant="ghost" size="sm" icon="i-lucide-external-link">
                  Open on Trade partners
                </UButton>
              </div>
              <p class="mt-2 text-[11px] text-zinc-500 leading-snug">
                Hands the declaration pack over — the broker still files on TradeNet themselves.
              </p>
            </UCard>

            <UCard :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-user-check" class="size-4 text-primary" />
                  <h3 class="text-sm font-bold">Officer</h3>
                </div>
              </template>
              <UFormField label="Filed by" size="sm">
                <USelect v-model="officer" :items="OFFICERS" class="w-full" />
              </UFormField>
              <p class="mt-2 text-[11px] text-zinc-500 leading-snug">
                The officer's name and the permit number are recorded against the job once they
                submit on TradeNet.
              </p>
              <div v-if="filed || queried" class="mt-3 text-[12px]">
                <div class="text-zinc-500">Permit</div>
                <div class="font-mono font-semibold text-zinc-800">{{ customs?.permitNo ?? '—' }}</div>
              </div>
            </UCard>

            <DocumentChecklist
              v-if="s.documents?.length"
              :shipment="s"
              mode="cs"
              show-gaps
              @refresh="refresh()"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
