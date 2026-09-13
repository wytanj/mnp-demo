<script setup lang="ts">
import type { QuoteRequest } from '#shared/utils/shipping'

/**
 * New rate enquiry, keyed in by CS on behalf of a caller. POSTing it returns
 * an auto-quote (a lookup against the closest standing rate card) immediately —
 * that instant row is the "auto-quote request" feel the demo is selling.
 */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [request: QuoteRequest] }>()

const toast = useToast()
const busy = ref(false)

const blank = () => ({
  company: '',
  contact: '',
  email: '',
  mode: 'LCL' as QuoteRequest['mode'],
  origin: '',
  destination: '',
  cargo: '',
  readyDate: '',
  incoterms: 'FOB'
})

const form = reactive(blank())

const MODES = [
  { value: 'FCL', label: "FCL — full container" },
  { value: 'LCL', label: 'LCL — consolidation' },
  { value: 'AIR', label: 'Air freight' },
  { value: 'LAST_MILE', label: 'Last mile / local' }
]

const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP'].map((value) => ({ value, label: value }))

const valid = computed(() =>
  ['company', 'contact', 'email', 'origin', 'destination', 'cargo'].every((k) => String((form as any)[k]).trim())
)

/** One click fills a believable enquiry so the demo never stalls on typing. */
function prefill() {
  Object.assign(form, {
    company: 'Sunrise Trading Pte Ltd',
    contact: 'Alicia Goh',
    email: 'alicia@sunrisetrading.com.sg',
    mode: 'LCL',
    origin: 'Shenzhen (Yantian), China',
    destination: 'Singapore — Tuas South',
    cargo: 'LCL — 9 cbm homeware on 6 pallets, non-haz',
    readyDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    incoterms: 'FOB'
  })
}

async function submit() {
  if (!valid.value) return
  busy.value = true
  try {
    const created = await $fetch<QuoteRequest>('/api/quotes/requests', {
      method: 'POST',
      body: { ...form, readyDate: form.readyDate || undefined }
    })
    emit('created', created)
    toast.add({
      title: `${created.ref} auto-quoted (demo)`,
      description: created.autoQuote
        ? `${created.autoQuote.currency} ${created.autoQuote.estimate.toLocaleString('en-SG')} off rate card ${created.autoQuote.rateCardRef}`
        : 'Request logged',
      color: 'success',
      icon: 'i-lucide-zap'
    })
    Object.assign(form, blank())
    open.value = false
  } catch (e: any) {
    toast.add({ title: 'Could not create request', description: e?.data?.statusMessage ?? 'Check the form', color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <USlideover v-model:open="open" title="New quote request" description="Auto-quoted off the closest standing rate card the moment you save.">
    <template #body>
      <div class="space-y-3">
        <UButton
          icon="i-lucide-wand-sparkles"
          size="xs"
          color="neutral"
          variant="outline"
          label="Fill with a sample enquiry"
          @click="prefill"
        />

        <div class="grid sm:grid-cols-2 gap-3">
          <UFormField label="Company" required size="sm">
            <UInput v-model="form.company" class="w-full" placeholder="Sunrise Trading Pte Ltd" />
          </UFormField>
          <UFormField label="Contact" required size="sm">
            <UInput v-model="form.contact" class="w-full" placeholder="Alicia Goh" />
          </UFormField>
        </div>

        <UFormField label="Email" required size="sm">
          <UInput v-model="form.email" type="email" class="w-full" placeholder="alicia@sunrisetrading.com.sg" />
        </UFormField>

        <div class="grid sm:grid-cols-2 gap-3">
          <UFormField label="Mode" size="sm">
            <USelect v-model="form.mode" :items="MODES" class="w-full" />
          </UFormField>
          <UFormField label="Incoterms" size="sm">
            <USelect v-model="form.incoterms" :items="INCOTERMS" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Origin" required size="sm">
          <UInput v-model="form.origin" class="w-full" placeholder="Shenzhen (Yantian), China" />
        </UFormField>
        <UFormField label="Destination" required size="sm">
          <UInput v-model="form.destination" class="w-full" placeholder="Singapore — Tuas South" />
        </UFormField>

        <UFormField label="Cargo" required size="sm" hint="Volume, packing, hazardous?">
          <UTextarea v-model="form.cargo" :rows="2" class="w-full" placeholder="LCL — 9 cbm homeware on 6 pallets, non-haz" />
        </UFormField>

        <UFormField label="Cargo ready date" size="sm">
          <UInput v-model="form.readyDate" type="date" class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2 w-full">
        <UButton color="neutral" variant="ghost" label="Cancel" @click="open = false" />
        <UButton
          class="ms-auto"
          color="primary"
          icon="i-lucide-zap"
          label="Create & auto-quote"
          :disabled="!valid"
          :loading="busy"
          @click="submit"
        />
      </div>
    </template>
  </USlideover>
</template>
