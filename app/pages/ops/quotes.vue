<script setup lang="ts">
import type { Quote, QuoteRequest } from '#shared/utils/shipping'

/**
 * Quotes desk: incoming rate enquiries with their auto-quote (demo) estimate,
 * and the standing rate cards CS quotes from. "Auto-quote" is a rate-card
 * lookup, never a pricing engine — a person still sends the real quotation.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Quotes — M&P ops' })

const { data: requests, refresh } = await useFetch<QuoteRequest[]>('/api/quotes/requests', { default: () => [] })

/** Standing lanes first, then the quotes actually issued on live jobs. */
const CARD_REFS = ['QT-CN-LCL', 'QT-KR-LCL', 'QT-HK-AIR', 'QT-2481', 'QT-6220', 'QT-3318']

const { data: rateCards } = await useAsyncData('ops-rate-cards', async () => {
  const results = await Promise.all(
    CARD_REFS.map((ref) =>
      $fetch<{ quote: Quote; shipment: { id: string } | null }>(`/api/quotes/${ref}`).catch(() => null)
    )
  )
  return results
    .filter((r): r is { quote: Quote; shipment: { id: string } | null } => !!r?.quote)
    .map((r) => ({ ...r.quote, jobId: r.shipment?.id ?? null }))
}, { default: () => [] })

const toast = useToast()
const busy = ref<string | null>(null)
const showForm = ref(false)
const justCreated = ref<string | null>(null)

const MODE_COLOR: Record<string, 'info' | 'primary' | 'secondary' | 'warning'> = {
  FCL: 'info',
  LCL: 'primary',
  AIR: 'secondary',
  LAST_MILE: 'warning'
}

const STATUS_META: Record<string, { label: string; color: 'info' | 'primary' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'New', color: 'info' },
  auto_quoted: { label: 'Auto-quoted', color: 'primary' },
  sent: { label: 'Quote sent', color: 'warning' },
  won: { label: 'Won', color: 'success' },
  lost: { label: 'Lost', color: 'neutral' }
}

const columns = [
  { accessorKey: 'ref', header: 'Ref' },
  { accessorKey: 'company', header: 'Client' },
  { accessorKey: 'mode', header: 'Mode' },
  { accessorKey: 'lane', header: 'Lane & cargo' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'autoQuote', header: 'Auto-quote (demo)' },
  { accessorKey: 'actions', header: '' }
]

const openCount = computed(() => (requests.value ?? []).filter((r) => r.status === 'new' || r.status === 'auto_quoted').length)
const wonValue = computed(() =>
  (requests.value ?? [])
    .filter((r) => r.status === 'won')
    .reduce((sum, r) => sum + (r.autoQuote?.estimate ?? 0), 0)
)

function money(n: number, currency = 'SGD'): string {
  return `${currency} ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

async function act(request: QuoteRequest, action: 'send' | 'won' | 'lost') {
  busy.value = request.id
  try {
    await $fetch(`/api/quotes/requests/${request.id}`, { method: 'POST', body: { action } })
    await refresh()
    toast.add({
      title: action === 'send' ? `Quote sent to ${request.company} (demo)` : `${request.ref} marked ${action}`,
      description: action === 'send' && request.autoQuote
        ? `${money(request.autoQuote.estimate, request.autoQuote.currency)} · rate card ${request.autoQuote.rateCardRef}`
        : request.company,
      color: action === 'lost' ? 'neutral' : 'success',
      icon: action === 'send' ? 'i-lucide-send' : action === 'won' ? 'i-lucide-trophy' : 'i-lucide-x'
    })
  } catch (e: any) {
    toast.add({ title: 'Could not update', description: e?.data?.statusMessage ?? 'Try again', color: 'error' })
  } finally {
    busy.value = null
  }
}

async function onCreated(created: QuoteRequest) {
  await refresh()
  justCreated.value = created.id
  setTimeout(() => { if (justCreated.value === created.id) justCreated.value = null }, 6000)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Quotes" icon="i-lucide-file-text">
        <template #right>
          <UButton icon="i-lucide-plus" color="primary" size="sm" label="New request" @click="showForm = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- QUOTE REQUESTS -->
      <section>
        <div class="flex items-end gap-3 flex-wrap mb-3">
          <div>
            <h2 class="text-base font-bold text-zinc-900">Quote requests</h2>
            <p class="text-xs text-zinc-500">
              Every enquiry gets an indicative number back immediately — a lookup against the closest standing
              rate card, labelled <span class="font-medium">auto-quote (demo)</span>. A person still sends the real quotation.
            </p>
          </div>
          <div class="ms-auto flex gap-2">
            <UBadge :label="`${openCount} open`" color="primary" variant="subtle" />
            <UBadge :label="`${money(wonValue)} won`" color="success" variant="subtle" />
          </div>
        </div>

        <div class="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <UTable :data="requests" :columns="columns" :ui="{ td: 'align-top py-3 px-2.5', th: 'py-2.5 px-2.5' }">
            <template #ref-cell="{ row }">
              <div class="min-w-24">
                <span class="font-mono text-xs font-bold text-zinc-900">{{ row.original.ref }}</span>
                <UBadge
                  v-if="justCreated === row.original.id"
                  label="new"
                  color="primary"
                  variant="solid"
                  size="sm"
                  class="ms-1.5"
                />
                <p class="text-[11px] text-zinc-400 mt-0.5">{{ when(row.original.at) }}</p>
              </div>
            </template>

            <template #company-cell="{ row }">
              <div class="min-w-32 max-w-40">
                <p class="text-xs font-semibold text-zinc-900 truncate">{{ row.original.company }}</p>
                <p class="text-[11px] text-zinc-500 truncate">{{ row.original.contact }}</p>
                <p class="text-[11px] text-zinc-400 truncate">{{ row.original.email }}</p>
              </div>
            </template>

            <template #mode-cell="{ row }">
              <UBadge
                :label="row.original.mode.replace('_', ' ')"
                :color="MODE_COLOR[row.original.mode] ?? 'neutral'"
                variant="subtle"
                size="sm"
              />
            </template>

            <template #lane-cell="{ row }">
              <div class="min-w-40 max-w-48 text-xs text-zinc-600">
                <p class="truncate">{{ row.original.origin }}</p>
                <p class="text-zinc-400 truncate">→ {{ row.original.destination }}</p>
                <p class="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{{ row.original.cargo }}</p>
                <p v-if="row.original.incoterms" class="text-[11px] text-zinc-400">
                  {{ row.original.incoterms }}<span v-if="row.original.readyDate"> · ready {{ row.original.readyDate }}</span>
                </p>
              </div>
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :label="STATUS_META[row.original.status]?.label ?? row.original.status"
                :color="STATUS_META[row.original.status]?.color ?? 'neutral'"
                variant="subtle"
                size="sm"
              />
            </template>

            <template #autoQuote-cell="{ row }">
              <div v-if="row.original.autoQuote" class="min-w-28">
                <p class="text-sm font-bold text-zinc-900 tabular-nums">
                  {{ money(row.original.autoQuote.estimate, row.original.autoQuote.currency) }}
                </p>
                <NuxtLink
                  :to="`/quote/${row.original.autoQuote.rateCardRef}`"
                  class="text-[11px] text-zinc-400 hover:text-primary-600 underline decoration-dotted"
                  :title="`Rate card ${row.original.autoQuote.rateCardRef} — valid to ${row.original.autoQuote.validUntil}`"
                >{{ row.original.autoQuote.rateCardRef }}</NuxtLink>
              </div>
              <span v-else class="text-xs text-zinc-400">—</span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex flex-col gap-1.5 items-stretch w-28">
                <UButton
                  v-if="row.original.status !== 'won' && row.original.status !== 'lost'"
                  size="xs"
                  color="primary"
                  variant="subtle"
                  icon="i-lucide-send"
                  label="Send quote"
                  :loading="busy === row.original.id"
                  @click="act(row.original, 'send')"
                />
                <div class="flex gap-1.5">
                  <UButton
                    size="xs"
                    color="success"
                    variant="ghost"
                    label="Won"
                    :disabled="row.original.status === 'won'"
                    :loading="busy === row.original.id"
                    @click="act(row.original, 'won')"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    label="Lost"
                    :disabled="row.original.status === 'lost'"
                    :loading="busy === row.original.id"
                    @click="act(row.original, 'lost')"
                  />
                </div>
              </div>
            </template>
          </UTable>
        </div>
      </section>

      <!-- RATE CARDS -->
      <section>
        <div class="mb-3">
          <h2 class="text-base font-bold text-zinc-900">Rate cards</h2>
          <p class="text-xs text-zinc-500">The standing lanes, plus the quotes already issued on live jobs.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="c in rateCards" :key="c.ref" :ui="{ body: 'p-4 sm:p-4' }">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono text-[11px] font-bold text-zinc-500">{{ c.ref }}</span>
                  <UBadge v-if="c.jobId" :label="c.jobId" color="neutral" variant="subtle" size="sm" class="font-mono" />
                  <UBadge v-else label="standing lane" color="primary" variant="subtle" size="sm" />
                </div>
                <h3 class="text-sm font-semibold text-zinc-900 mt-1 leading-snug">{{ c.title }}</h3>
              </div>
              <UIcon name="i-lucide-file-text" class="size-5 text-zinc-300 shrink-0" />
            </div>

            <p class="text-xs text-zinc-600 mt-2 leading-snug">{{ c.route }}</p>
            <dl class="mt-2 text-[11px] text-zinc-500 space-y-0.5">
              <div class="flex gap-2"><dt class="w-20 shrink-0">Carrier</dt><dd class="truncate">{{ c.carrier }}</dd></div>
              <div class="flex gap-2"><dt class="w-20 shrink-0">Equipment</dt><dd class="truncate">{{ c.containerType }}</dd></div>
              <div class="flex gap-2"><dt class="w-20 shrink-0">Valid until</dt><dd>{{ c.validUntil }}</dd></div>
              <div v-if="c.lumpSum" class="flex gap-2">
                <dt class="w-20 shrink-0">Lump sum</dt>
                <dd class="font-semibold text-zinc-700">{{ money(c.lumpSum.amount, c.lumpSum.currency) }}</dd>
              </div>
            </dl>

            <UButton
              :to="`/quote/${c.ref}`"
              class="mt-3"
              block
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-external-link"
              label="Open rate card"
            />
          </UCard>
        </div>
      </section>
    </template>
  </UDashboardPanel>

  <OpsQuoteRequestForm v-model:open="showForm" @created="onCreated" />
</template>
