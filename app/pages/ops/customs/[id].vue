<script setup lang="ts">
import {
  DECLARATION_LABELS,
  DECLARATION_REQUIRED,
  customsDocs,
  type CustomsDeclaration,
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

const HS_HINTS = [
  { code: '8471.60.70', label: 'Keyboards & other input units', match: /keyboard|mouse|input unit/i },
  { code: '1106.20.00', label: 'Flour & meal of roots (konjac)', match: /konjac|flour|oat|starch/i },
  { code: '2007.99.90', label: 'Jellies, jams & fruit purée', match: /jelly|jellies|gumm|candy|snack/i }
]

const officer = ref(OFFICERS[0]!)

/* ── prefill ─────────────────────────────────────────────── */

function guessCountry(origin: string): string {
  const o = origin.toLowerCase()
  if (/hong kong|kowloon|hkg/.test(o)) return 'HK — Hong Kong SAR'
  if (/shenzhen|yantian|shanghai|ningbo|china|cnsz/.test(o)) return 'CN — China'
  if (/busan|korea|krpus/.test(o)) return 'KR — Republic of Korea'
  if (/taiwan|kaohsiung/.test(o)) return 'TW — Taiwan'
  if (/singapore|senoko|tuas|psa/.test(o)) return 'SG — Singapore'
  return 'CN — China'
}

function guessHs(description: string): string {
  return HS_HINTS.find((h) => h.match.test(description))?.code ?? '3926.90.99'
}

function guessValue(j: Shipment): number {
  const lump = j.quote?.lumpSum?.amount
  if (lump) return Math.round(lump)
  return Math.max(1200, Math.round((j.weightKg || 100) * 48 / 10) * 10)
}

const prefilling = ref(false)

/**
 * Demo convenience: fill the draft from what the job already knows (B/L,
 * booking, cargo description) and mark the outstanding customs documents as
 * received, so the officer can key in and file in two clicks on stage.
 */
async function prefill() {
  const j = s.value
  if (!j) return
  prefilling.value = true
  try {
    const vessel = /\(([A-Z][A-Z \-]+?)\s+V\.?\s*([A-Z0-9]+)\)/.exec(j.description)
    const guesses: Partial<Record<keyof CustomsDeclaration, string | number>> = {
      declarationType: 'IN',
      permitType: 'IN-PAYMENT (GST)',
      hsCode: guessHs(j.description),
      cargoValue: guessValue(j),
      currency: 'USD',
      countryOfOrigin: guessCountry(j.origin),
      importerUEN: '201512345K',
      importerName: j.company ?? j.customerName,
      vesselName: vessel?.[1]?.trim(),
      voyage: vessel?.[2],
      blNo: j.poNumber,
      portOfLoading: `${j.origin.split(',')[0]}`.trim(),
      portOfDischarge: 'SGSIN — Singapore',
      packages: j.pieces,
      grossWeightKg: j.weightKg,
      description: j.description.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      incoterms: j.incoterms
    }

    const added: string[] = []
    for (const [key, value] of Object.entries(guesses) as Array<[keyof CustomsDeclaration, string | number | undefined]>) {
      if (value === undefined || value === '') continue
      if (isFilled(key)) continue
      form[key] = value
      added.push(DECLARATION_LABELS[key])
    }

    // Documents are what the prefill claims to read from — mark them received.
    const docs = [...pendingDocs.value]
    for (const d of docs) {
      await $fetch(`/api/shipments/${id.value}/documents`, {
        method: 'POST',
        body: { key: d.key, action: 'approve' }
      })
    }
    if (docs.length) await refresh()

    toast.add({
      title: added.length ? `Pre-filled ${added.length} field${added.length === 1 ? '' : 's'}` : 'Nothing left to pre-fill',
      description: [
        added.length ? added.join(', ') : 'Every required field was already keyed in.',
        docs.length ? `Marked received: ${docs.map((d) => d.label).join(', ')}.` : ''
      ].filter(Boolean).join(' '),
      color: 'primary',
      icon: 'i-lucide-wand-sparkles'
    })
  } finally {
    prefilling.value = false
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
            @click="prefill()"
          >
            <span class="hidden md:inline">Pre-fill from documents (demo)</span>
            <span class="md:hidden">Pre-fill</span>
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
                    :disabled="filed"
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
              <div v-if="filed" class="mt-3 text-[12px]">
                <div class="text-zinc-500">Permit</div>
                <div class="font-mono font-semibold text-zinc-800">{{ customs?.permitNo ?? '—' }}</div>
              </div>
            </UCard>

            <DocumentChecklist v-if="s.documents?.length" :shipment="s" mode="cs" @refresh="refresh()" />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
