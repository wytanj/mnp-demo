<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import type { Statement } from '#shared/utils/billing'
import { buildStatements, moneySGD } from '#shared/utils/billing'

/**
 * Billing / SOA. One statement of account per *customer account* — generated
 * from the job book, not typed twice — plus the invoice lines behind them.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Billing / SOA — M&P ops' })

const { data: shipments } = await useFetch<Shipment[]>('/api/shipments', { default: () => [] })

const statements = computed<Statement[]>(() => buildStatements(shipments.value ?? []))

/** Every document on every account, flattened for the lines table. */
const allLines = computed(() =>
  statements.value.flatMap((st) =>
    st.lines.map((l) => ({
      ...l,
      client: st.customer.name,
      accountNo: st.accountNo,
      currency: st.currency,
      key: `${st.accountNo}-${l.docType}-${l.docNo}`
    }))
  )
)

const account = ref('all')
const accountItems = computed(() => [
  { label: 'All accounts', value: 'all' },
  ...statements.value.map((st) => ({ label: st.customer.name, value: st.accountNo }))
])

const lines = computed(() =>
  account.value === 'all' ? allLines.value : allLines.value.filter((l) => l.accountNo === account.value)
)

const total = computed(() => Math.round(lines.value.reduce((sum, l) => sum + l.debit - l.credit, 0) * 100) / 100)
const grandOutstanding = computed(() =>
  Math.round(statements.value.reduce((sum, st) => sum + st.outstanding, 0) * 100) / 100
)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Billing / SOA" icon="i-lucide-receipt">
        <template #right>
          <DemoHowTo page="ops-billing" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <p class="text-sm text-zinc-600 max-w-2xl">
            Customers (accounts), not trade partners. One statement per account, generated from the job book.
          </p>
          <p class="text-xs text-zinc-500">
            {{ statements.length }} accounts ·
            <span class="font-semibold text-zinc-800 tabular-nums">{{ moneySGD(grandOutstanding) }}</span> outstanding
          </p>
        </div>

        <!-- One SOA card per customer account -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
          <UCard v-for="st in statements" :key="st.accountNo" :ui="{ body: 'p-4 sm:p-5' }" class="flex flex-col">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <h2 class="text-base font-bold text-zinc-900 truncate">{{ st.customer.name }}</h2>
                <p class="text-xs text-zinc-500">Account {{ st.accountNo }} · ended {{ st.endedDate }}</p>
              </div>
              <UBadge
                :label="st.agingLabel"
                :color="st.agingLabel === 'Current' ? 'success' : 'warning'"
                variant="subtle"
                size="sm"
                class="shrink-0"
              />
            </div>

            <div class="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
              <p class="text-xs text-zinc-500">Outstanding</p>
              <p class="text-2xl font-bold text-zinc-900 tabular-nums">{{ moneySGD(st.outstanding, st.currency) }}</p>
            </div>

            <p class="mt-2 text-xs text-zinc-500">
              {{ st.openJobs }} open {{ st.openJobs === 1 ? 'job' : 'jobs' }} · {{ st.jobCount }} on the account
            </p>

            <UButton
              :to="`/statement/${st.accountNo}`"
              class="mt-3"
              block
              color="primary"
              icon="i-lucide-external-link"
              label="Open SOA"
            />
          </UCard>
        </div>

        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-bold text-zinc-900">Invoice lines</h2>
              <p class="text-xs text-zinc-500 mt-0.5">
                Derived from each job's quoted lump sum — the same layout accounts prints today.
              </p>
            </div>
            <USelect v-model="account" :items="accountItems" size="sm" class="w-52" />
          </div>

          <div class="overflow-x-auto -mx-1 mt-3">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-200">
                  <th class="py-2 px-1 font-semibold">Doc</th>
                  <th class="py-2 px-1 font-semibold">Customer</th>
                  <th class="py-2 px-1 font-semibold">Job</th>
                  <th class="py-2 px-1 font-semibold">Status</th>
                  <th class="py-2 px-1 font-semibold text-end">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                <tr v-for="l in lines" :key="l.key">
                  <td class="py-2.5 px-1">
                    <span class="font-mono text-xs text-zinc-700">{{ l.docType }}-{{ l.docNo }}</span>
                    <span class="block text-[11px] text-zinc-400 truncate max-w-56">{{ l.remark }}</span>
                  </td>
                  <td class="py-2.5 px-1">
                    <NuxtLink :to="`/statement/${l.accountNo}`" class="text-xs font-semibold text-zinc-800 hover:text-primary-600">
                      {{ l.client }}
                    </NuxtLink>
                    <span class="block text-[11px] text-zinc-400 font-mono">{{ l.accountNo }}</span>
                  </td>
                  <td class="py-2.5 px-1">
                    <NuxtLink :to="`/ops/jobs/${l.job}`" class="font-mono text-xs font-semibold text-zinc-800 hover:text-primary-600">
                      {{ l.job }}
                    </NuxtLink>
                  </td>
                  <td class="py-2.5 px-1">
                    <UBadge :label="l.indicative ? 'Indicative' : l.status" :color="l.status === 'Invoiced' ? 'success' : 'neutral'" variant="subtle" size="sm" />
                  </td>
                  <td class="py-2.5 px-1 text-end font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                    {{ moneySGD(l.debit, l.currency) }}
                  </td>
                </tr>
                <tr v-if="!lines.length">
                  <td colspan="5" class="py-6 text-center text-xs text-zinc-400">No quoted lump sums yet.</td>
                </tr>
              </tbody>
              <tfoot v-if="lines.length">
                <tr class="border-t-2 border-zinc-200">
                  <td colspan="4" class="py-2.5 px-1 text-xs font-semibold text-zinc-600">Total billable (excl. GST)</td>
                  <td class="py-2.5 px-1 text-end font-bold text-zinc-900 tabular-nums whitespace-nowrap">{{ moneySGD(total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
