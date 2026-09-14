<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import { findStatement } from '#shared/utils/billing'

/**
 * Printable statement of account. The numbers come from the job book via
 * buildStatements() — Billing / SOA and this page never drift apart.
 */
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: shipments } = await useFetch<Shipment[]>('/api/shipments', { default: () => [] })

const soa = computed(() => findStatement(shipments.value ?? [], id.value))

function money(n: number): string {
  return n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const DOC_LABELS: Record<string, string> = { IV: 'Invoice', DN: 'Debit note', CN: 'Credit note' }

function print() {
  if (typeof window !== 'undefined') window.print()
}
</script>

<template>
  <div>
    <TopBar role="Statement of account" />
    <main class="page">
      <div style="margin-bottom:10px;display:flex;gap:14px;flex-wrap:wrap">
        <NuxtLink to="/portal" style="font-size:13px;font-weight:700;color:var(--muted);text-decoration:none">&larr; My shipments</NuxtLink>
        <NuxtLink to="/ops/billing" style="font-size:13px;font-weight:700;color:var(--muted);text-decoration:none">&larr; Billing / SOA</NuxtLink>
      </div>
      <div v-if="!soa" class="card">
        <h2>Statement not found</h2>
        <p class="muted" style="margin-bottom:0">No account {{ id }} on the job book. <NuxtLink to="/ops/billing">See all statements</NuxtLink>.</p>
      </div>

      <template v-else>
        <div class="card">
          <div class="row spread" style="align-items: flex-start">
            <div>
              <img src="/mp-logo.svg" alt="M&P International Freights" style="height: 36px; margin-bottom: 8px" />
              <div style="font-weight: 800; font-size: 16px">M&amp;P INTERNATIONAL FREIGHTS PTE LTD</div>
              <div class="muted" style="line-height: 1.5">
                37 Jalan Pemimpin, #04-10 Mapex, Singapore 577177<br />
                Tel (65) 6221 2218 · Fax (65) 6324 1629<br />
                GST Reg No. 200614913Z
              </div>
            </div>
            <div style="text-align: right">
              <div style="font-weight: 800; font-size: 18px">Statement of Account</div>
              <div class="muted">Ended {{ soa.endedDate }}</div>
              <div class="muted" style="font-size: 12px">Prepared by {{ soa.preparedBy }} · {{ soa.preparedAt }}</div>
            </div>
          </div>
          <hr class="divider" />
          <div class="row spread" style="align-items: flex-start">
            <div>
              <div class="k" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted)">Bill to</div>
              <div style="font-weight: 700">{{ soa.customer.name }}</div>
              <div class="muted" style="line-height: 1.5">
                <div v-for="a in soa.customer.address" :key="a">{{ a }}</div>
                Tel {{ soa.customer.tel }}
              </div>
            </div>
            <div style="text-align: right">
              <div class="k" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted)">Account no.</div>
              <div style="font-weight: 700">{{ soa.accountNo }}</div>
            </div>
          </div>
        </div>

        <div class="hero-status">
          <div class="eyebrow">Balance due</div>
          <div class="big">{{ soa.currency }} {{ money(soa.total) }}</div>
          <div class="eta">Please state the invoice number when making payment</div>
          <div class="steps" style="margin-top: 16px">
            <div v-for="b in soa.aging" :key="b.label" class="step" :class="{ done: b.amount > 0, current: b.amount > 0 }">
              <div class="bar" />
              {{ b.label }}<br /><strong>{{ money(b.amount) }}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Activity</h2>
          <div style="overflow-x: auto">
            <table class="qtable" style="min-width: 560px">
              <thead>
                <tr class="thead">
                  <td>Date</td><td>Document</td><td>Remark</td>
                  <td class="amt">Debit</td><td class="amt">Credit</td><td class="amt">Balance</td>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in soa.lines" :key="l.docNo">
                  <td style="white-space: nowrap">{{ l.date }}</td>
                  <td style="white-space: nowrap">
                    <span class="pill" :class="l.docType === 'IV' ? 'pill-blue' : 'pill-amber'">{{ DOC_LABELS[l.docType] ?? l.docType }}</span>
                    {{ l.docNo }}
                  </td>
                  <td>{{ l.remark }}</td>
                  <td class="amt">{{ money(l.debit) }}</td>
                  <td class="amt">{{ money(l.credit) }}</td>
                  <td class="amt">{{ money(l.balance) }}</td>
                </tr>
                <tr class="subtotal">
                  <td colspan="3">Total amount {{ soa.currency }}</td>
                  <td colspan="3" class="amt">{{ money(soa.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>How to pay</h2>
          <div class="detail-grid" style="margin-top: 12px">
            <div>
              <div class="k">PayNow (UEN)</div>
              <div class="v">200614913Z</div>
            </div>
            <div>
              <div class="k">Bank transfer — SGD</div>
              <div class="v">UOB 459-335-273-5</div>
            </div>
            <div>
              <div class="k">Bank transfer — USD</div>
              <div class="v">UOB 440-900-098-8</div>
            </div>
            <div>
              <div class="k">SWIFT / bank / branch</div>
              <div class="v">UOVBSGSG · 7375 · 305</div>
            </div>
          </div>
          <p class="muted" style="margin-bottom: 0">
            Cheques should be crossed and made payable to <strong>M&amp;P International Freights Pte Ltd</strong>.
            Please state the invoice number when making payment.
          </p>
        </div>

        <div class="row no-print">
          <button class="btn btn-primary" @click="print">⬇️ Download PDF</button>
          <NuxtLink class="btn btn-outline" to="/">Back to dashboard</NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>
