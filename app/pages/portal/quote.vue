<script setup lang="ts">
import type { QuoteRequest } from '#shared/utils/shipping'
import { PORTAL_CLIENT, fmtDay, fmtWhen } from '~/utils/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Request a quote — M&P client portal' })

const toast = useToast()

const MODES = [
  { label: 'FCL — full container', value: 'FCL' },
  { label: 'LCL — part container', value: 'LCL' },
  { label: 'Air freight', value: 'AIR' },
  { label: 'Last-mile delivery', value: 'LAST_MILE' }
]
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP']

const state = reactive({
  mode: 'LCL',
  origin: '',
  destination: '',
  cargo: '',
  packages: undefined as number | undefined,
  weightKg: undefined as number | undefined,
  cbm: undefined as number | undefined,
  readyDate: '',
  incoterms: 'FOB',
  company: PORTAL_CLIENT.company,
  contact: PORTAL_CLIENT.name,
  email: PORTAL_CLIENT.email
})

function validate(s: typeof state) {
  const errors: Array<{ name: string; message: string }> = []
  if (!s.origin.trim()) errors.push({ name: 'origin', message: 'Where does it ship from?' })
  if (!s.destination.trim()) errors.push({ name: 'destination', message: 'Where should we deliver?' })
  if (!s.cargo.trim()) errors.push({ name: 'cargo', message: 'Tell us what the cargo is.' })
  if (!s.email.trim()) errors.push({ name: 'email', message: 'We need somewhere to send the quotation.' })
  return errors
}

function prefill() {
  state.mode = 'LCL'
  state.origin = 'Busan (KRPUS), Korea'
  state.destination = 'Singapore — Senoko Food Hub'
  state.cargo = 'Konjac jelly cartons on pallets, ambient, non-haz'
  state.packages = 8
  state.weightKg = 2400
  state.cbm = 12
  state.incoterms = 'EXW'
  state.readyDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
}

const busy = ref(false)
const result = ref<QuoteRequest | null>(null)

/** The server takes one `cargo` string — fold the pack/weight/cbm inputs into it. */
function cargoLine(): string {
  const bits = [state.cargo.trim()]
  const spec: string[] = []
  if (state.packages) spec.push(`${state.packages} pkgs`)
  if (state.weightKg) spec.push(`${state.weightKg} kg`)
  if (state.cbm) spec.push(`${state.cbm} cbm`)
  if (spec.length) bits.push(spec.join(' · '))
  return bits.join(' — ')
}

const { data: requests, refresh: refreshRequests } = await useFetch('/api/quotes/requests', {
  key: 'portal-quote-requests',
  transform: (rows): QuoteRequest[] =>
    ((rows ?? []) as unknown as QuoteRequest[]).filter(
      (r) => r.company === PORTAL_CLIENT.company || r.email.toLowerCase().endsWith(PORTAL_CLIENT.domain)
    )
})

async function submit() {
  busy.value = true
  try {
    result.value = await $fetch<QuoteRequest>('/api/quotes/requests', {
      method: 'POST',
      body: {
        company: state.company,
        contact: state.contact,
        email: state.email,
        mode: state.mode,
        origin: state.origin.trim(),
        destination: state.destination.trim(),
        cargo: cargoLine(),
        readyDate: state.readyDate || undefined,
        incoterms: state.incoterms || undefined
      }
    })
    await refreshRequests()
    toast.add({
      title: `Indicative quote ready — ${result.value.ref}`,
      description: 'Straight off our standing rate card. A person still sends the firm quotation.',
      icon: 'i-lucide-badge-check',
      color: 'primary'
    })
    await nextTick()
    document.getElementById('auto-quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({ title: 'Could not send that', description: msg ?? 'Please try again.', color: 'error' })
  } finally {
    busy.value = false
  }
}

const quote = computed(() => result.value?.autoQuote)
const lineColumns = [
  { accessorKey: 'label', header: 'Charge' },
  { accessorKey: 'amount', header: 'Amount' }
]
const lineRows = computed(() =>
  (quote.value?.lines ?? []).map((l) => ({ label: l.label, amount: `${l.currency} ${l.amount.toFixed(2)}` }))
)

function money(n: number, ccy = 'SGD'): string {
  return `${ccy} ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function accept() {
  toast.add({
    title: 'Booking request sent (demo)',
    description: `${result.value?.ref} is with M&P CS — they confirm the space and come back with the firm rate.`,
    icon: 'i-lucide-check-circle-2',
    color: 'success'
  })
}

function askReview() {
  toast.add({
    title: 'Sent to M&P for review (demo)',
    description: 'Christina will check the lane and reply with a firm quotation.',
    icon: 'i-lucide-send',
    color: 'primary'
  })
}

const STATUS_LABELS: Record<QuoteRequest['status'], string> = {
  new: 'With M&P',
  auto_quoted: 'Indicative quote',
  sent: 'Quotation sent',
  won: 'Booked',
  lost: 'Closed'
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Request a quote</h1>
        <p class="mt-1 text-sm text-zinc-500">
          Tell us the lane — you get an indicative rate on screen straight away, and a person follows with the firm quotation.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="ghost" icon="i-lucide-wand-2" size="sm" @click="prefill">
          Fill an example lane
        </UButton>
        <DemoHowTo page="portal-quote" />
      </div>
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-5">
      <UCard class="lg:col-span-3" :ui="{ body: 'p-5 sm:p-6' }">
        <UForm :state="state" :validate="validate" class="space-y-4" @submit="submit">
          <UFormField label="Service" name="mode" required>
            <USelect v-model="state.mode" :items="MODES" size="lg" class="w-full" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Origin" name="origin" required>
              <UInput v-model="state.origin" size="lg" class="w-full" placeholder="Busan (KRPUS), Korea" />
            </UFormField>
            <UFormField label="Destination" name="destination" required>
              <UInput v-model="state.destination" size="lg" class="w-full" placeholder="Singapore — Senoko Food Hub" />
            </UFormField>
          </div>

          <UFormField label="Cargo description" name="cargo" required>
            <UTextarea
              v-model="state.cargo"
              :rows="2"
              class="w-full"
              placeholder="e.g. Konjac jelly cartons on pallets, ambient, non-haz"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Packages" name="packages">
              <UInput v-model.number="state.packages" type="number" min="0" class="w-full" placeholder="8" />
            </UFormField>
            <UFormField label="Weight (kg)" name="weightKg">
              <UInput v-model.number="state.weightKg" type="number" min="0" class="w-full" placeholder="2400" />
            </UFormField>
            <UFormField label="Volume (cbm)" name="cbm">
              <UInput v-model.number="state.cbm" type="number" min="0" step="0.1" class="w-full" placeholder="12" />
            </UFormField>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Cargo ready date" name="readyDate">
              <UInput v-model="state.readyDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Incoterms" name="incoterms">
              <USelect v-model="state.incoterms" :items="INCOTERMS" class="w-full" />
            </UFormField>
          </div>

          <USeparator label="Billed to" />

          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Company" name="company">
              <UInput v-model="state.company" class="w-full" />
            </UFormField>
            <UFormField label="Contact" name="contact">
              <UInput v-model="state.contact" class="w-full" />
            </UFormField>
            <UFormField label="Email" name="email" required>
              <UInput v-model="state.email" type="email" class="w-full" />
            </UFormField>
          </div>

          <UButton type="submit" size="xl" block icon="i-lucide-calculator" :loading="busy">
            Get my indicative quote
          </UButton>
          <p class="text-center text-xs text-zinc-400">
            Rate-card lookup, not a pricing engine — M&amp;P confirm space and the firm rate before booking.
          </p>
        </UForm>
      </UCard>

      <div class="lg:col-span-2 space-y-4">
        <UCard
          v-if="quote"
          id="auto-quote"
          :ui="{ root: 'ring-primary-300', header: 'p-4 sm:px-5 sm:py-4', body: 'p-4 sm:px-5 sm:py-4' }"
        >
          <template #header>
            <UBadge color="primary" variant="subtle" icon="i-lucide-zap">Indicative quote (auto, demo)</UBadge>
            <p class="mt-2 font-mono text-sm font-bold">{{ result?.ref }}</p>
            <p class="text-xs text-zinc-500">{{ result?.origin }} → {{ result?.destination }}</p>
          </template>

          <p class="text-3xl font-bold tracking-tight">{{ money(quote.estimate, quote.currency) }}</p>
          <p class="mt-0.5 text-xs text-zinc-500">
            All-in estimate · valid until {{ fmtDay(quote.validUntil) }}
          </p>

          <UTable
            :data="lineRows"
            :columns="lineColumns"
            class="mt-4 -mx-1"
            :ui="{ th: 'text-[11px] uppercase tracking-wide py-2', td: 'py-1.5 text-xs' }"
          />

          <p class="mt-3 text-xs text-zinc-500">
            Based on rate card
            <NuxtLink :to="`/quote/${quote.rateCardRef}`" class="font-mono font-semibold text-primary-600 hover:underline">
              {{ quote.rateCardRef }}
            </NuxtLink>
            — open it for the full terms, exclusions and validity.
          </p>

          <div class="mt-4 flex flex-col gap-2">
            <UButton block icon="i-lucide-check" @click="accept">Accept &amp; book (demo)</UButton>
            <UButton block color="neutral" variant="outline" icon="i-lucide-message-square" @click="askReview">
              Ask M&amp;P to review
            </UButton>
          </div>
        </UCard>

        <UCard v-else :ui="{ body: 'p-5' }">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-zap" class="mt-0.5 size-5 shrink-0 text-primary-500" />
            <div>
              <p class="text-sm font-semibold">Answer on screen, not in three days</p>
              <p class="mt-1 text-xs text-zinc-500">
                We match your lane to the closest standing rate card and show the number immediately.
                Today that same enquiry is an email that waits for someone to be free.
              </p>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ header: 'p-4 sm:px-5 sm:py-3', body: 'p-0 sm:p-0' }">
          <template #header>
            <p class="text-sm font-bold">My recent requests</p>
          </template>
          <ul class="divide-y divide-zinc-100">
            <li v-for="r in requests" :key="r.id" class="px-4 py-3 sm:px-5">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold">{{ r.ref }}</span>
                <UBadge color="neutral" variant="outline" size="sm">{{ r.mode }}</UBadge>
                <UBadge
                  size="sm"
                  variant="subtle"
                  :color="r.status === 'won' ? 'success' : r.status === 'lost' ? 'neutral' : 'primary'"
                  class="ms-auto"
                >{{ STATUS_LABELS[r.status] }}</UBadge>
              </div>
              <p class="mt-1 text-xs font-medium">{{ r.origin }} → {{ r.destination }}</p>
              <p class="mt-0.5 text-xs text-zinc-500">
                {{ fmtWhen(r.at) }}
                <template v-if="r.autoQuote"> · est. {{ money(r.autoQuote.estimate, r.autoQuote.currency) }}</template>
              </p>
            </li>
            <li v-if="!requests?.length" class="px-4 py-4 text-xs text-zinc-500 sm:px-5">
              No enquiries on this account yet.
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </div>
</template>
