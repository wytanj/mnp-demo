<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'

/**
 * Billing / SOA (light). One seeded statement of account plus the invoice
 * lines derived from each job's quoted lump sum — enough to show where
 * accounts picks the job book up.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Billing / SOA — M&P ops' })

const { data: shipments } = await useFetch<Shipment[]>('/api/shipments', { default: () => [] })

/** The demo statement that exists at /statement/[id]. */
const SOA = {
  id: '12011',
  customer: 'Titan Associates Pte Ltd',
  endedDate: '08/12/2022',
  outstanding: 1294.02,
  currency: 'SGD'
}

/** The two documents already on the Titan statement, kept in step with it. */
const SOA_LINES = [
  { job: 'MP-9032-TA', client: SOA.customer, ref: 'DN 20356', docNo: 'DN-20356', amount: 289.02, currency: 'SGD', status: 'Invoiced' },
  { job: 'MP-9032-TA', client: SOA.customer, ref: 'IV 291919', docNo: 'IV-291919', amount: 1005.00, currency: 'SGD', status: 'Invoiced' }
]

const lines = computed(() => [
  ...SOA_LINES,
  ...(shipments.value ?? [])
    .filter((s) => s.quote?.lumpSum)
    .map((s, i) => ({
      job: s.id,
      client: s.company ?? s.customerName,
      ref: s.quote!.ref,
      docNo: `IV-${29200 + i * 7}`,
      amount: s.quote!.lumpSum!.amount,
      currency: s.quote!.lumpSum!.currency,
      status: s.status === 'delivered' ? 'Invoiced' : 'Draft'
    }))
])

const total = computed(() => lines.value.reduce((sum, l) => sum + l.amount, 0))

function money(n: number, currency = 'SGD'): string {
  return `${currency} ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Billing / SOA" icon="i-lucide-receipt" />
    </template>

    <template #body>
      <div class="grid gap-4 lg:grid-cols-2 items-start">
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-bold text-zinc-900">Statement of account</h2>
              <p class="text-sm text-zinc-700 mt-0.5">{{ SOA.customer }}</p>
              <p class="text-xs text-zinc-500">Account {{ SOA.id }} · period ended {{ SOA.endedDate }}</p>
            </div>
            <UBadge label="30 days" color="warning" variant="subtle" size="sm" class="shrink-0" />
          </div>

          <div class="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
            <p class="text-xs text-zinc-500">Outstanding</p>
            <p class="text-2xl font-bold text-zinc-900 tabular-nums">{{ money(SOA.outstanding, SOA.currency) }}</p>
          </div>

          <UButton
            :to="`/statement/${SOA.id}`"
            class="mt-3"
            block
            color="primary"
            icon="i-lucide-external-link"
            label="Open SOA"
          />
          <p class="mt-2 text-[11px] text-zinc-400 text-center">
            The same layout accounts prints today — now generated from the job book.
          </p>
        </UCard>

        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <h2 class="text-base font-bold text-zinc-900">Invoice lines</h2>
          <p class="text-xs text-zinc-500 mt-0.5 mb-3">Derived from each job's quoted lump sum.</p>

          <div class="overflow-x-auto -mx-1">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-200">
                  <th class="py-2 px-1 font-semibold">Doc</th>
                  <th class="py-2 px-1 font-semibold">Job</th>
                  <th class="py-2 px-1 font-semibold">Status</th>
                  <th class="py-2 px-1 font-semibold text-end">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                <tr v-for="l in lines" :key="l.docNo">
                  <td class="py-2.5 px-1">
                    <span class="font-mono text-xs text-zinc-700">{{ l.docNo }}</span>
                    <span class="block text-[11px] text-zinc-400 font-mono">{{ l.ref }}</span>
                  </td>
                  <td class="py-2.5 px-1">
                    <NuxtLink :to="`/ops/jobs/${l.job}`" class="font-mono text-xs font-semibold text-zinc-800 hover:text-primary-600">
                      {{ l.job }}
                    </NuxtLink>
                    <span class="block text-[11px] text-zinc-400 truncate max-w-32">{{ l.client }}</span>
                  </td>
                  <td class="py-2.5 px-1">
                    <UBadge :label="l.status" :color="l.status === 'Invoiced' ? 'success' : 'neutral'" variant="subtle" size="sm" />
                  </td>
                  <td class="py-2.5 px-1 text-end font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                    {{ money(l.amount, l.currency) }}
                  </td>
                </tr>
                <tr v-if="!lines.length">
                  <td colspan="4" class="py-6 text-center text-xs text-zinc-400">No quoted lump sums yet.</td>
                </tr>
              </tbody>
              <tfoot v-if="lines.length">
                <tr class="border-t-2 border-zinc-200">
                  <td colspan="3" class="py-2.5 px-1 text-xs font-semibold text-zinc-600">Total billable (excl. GST)</td>
                  <td class="py-2.5 px-1 text-end font-bold text-zinc-900 tabular-nums whitespace-nowrap">{{ money(total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
