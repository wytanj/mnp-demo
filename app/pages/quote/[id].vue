<script setup lang="ts">
import type { Quote, QuoteSection, Shipment } from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

const { data, error } = await useFetch<{ quote: Quote; shipment: Shipment | null }>(`/api/quotes/${id}`)
const quote = computed(() => data.value?.quote)
const shipment = computed(() => data.value?.shipment)

function money(n: number): string {
  return n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function subtotal(s: QuoteSection): number {
  return s.lines.reduce((sum, l) => sum + (l.excluded || l.amount === null ? 0 : l.amount), 0)
}

const showTotals = computed(() => quote.value && quote.value.showSubtotals !== false)

const totals = computed(() => {
  const t: Record<string, number> = {}
  if (!showTotals.value) return t
  for (const s of quote.value?.sections ?? []) {
    if (subtotal(s) > 0) t[s.currency] = (t[s.currency] ?? 0) + subtotal(s)
  }
  return t
})

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function print() {
  if (typeof window !== 'undefined') window.print()
}
</script>

<template>
  <div>
    <TopBar role="Quotation" />
    <main class="page">
      <div v-if="error || !quote" class="card">
        <h2>Quotation not found</h2>
      </div>

      <template v-else>
        <div class="hero-status">
          <div class="eyebrow">
            Quotation {{ quote.ref }}<template v-if="shipment"> · Shipment {{ shipment.id }}</template>
          </div>
          <div class="big">{{ quote.title }}</div>
          <div class="eta">{{ quote.route }} · {{ quote.containerType }}</div>
          <div class="row" style="margin-top: 10px; gap: 8px">
            <span class="pill" style="background: rgba(255,255,255,0.14); color: #fff">Carrier: {{ quote.carrier }}</span>
            <span v-if="shipment?.incoterms" class="pill" style="background: rgba(255,255,255,0.14); color: #fff">Incoterms: {{ shipment.incoterms }}</span>
            <span class="pill" style="background: rgba(255,255,255,0.14); color: #fff">Valid until {{ quote.validUntil }}</span>
          </div>
        </div>

        <div v-if="quote.lumpSum" class="card" style="border-color: #fbbf8f">
          <div class="row spread">
            <div>
              <h2>Estimated lump sum</h2>
              <p class="sub" style="margin-bottom: 0">{{ quote.lumpSum.note }}</p>
            </div>
            <div class="qtotal">{{ quote.lumpSum.currency }} {{ money(quote.lumpSum.amount) }}</div>
          </div>
        </div>

        <div v-else-if="Object.keys(totals).length" class="card">
          <div class="row spread">
            <div>
              <h2>Estimated total</h2>
              <p class="sub" style="margin-bottom: 0">Excludes at-cost and conditional items · GST where applicable</p>
            </div>
            <div style="text-align: right">
              <div v-for="(amt, cur) in totals" :key="cur" class="qtotal">{{ cur }} {{ money(amt) }}</div>
            </div>
          </div>
        </div>

        <div v-if="quote.cargo" class="card">
          <h2>Cargo details</h2>
          <ul style="margin: 8px 0 0; padding-left: 18px; font-size: 14px">
            <li v-for="c in quote.cargo" :key="c" style="margin-bottom: 4px">{{ c }}</li>
          </ul>
        </div>

        <div v-for="s in quote.sections" :key="s.key" class="card">
          <h2><span class="qkey">{{ s.key }}</span> {{ s.title }} <span class="pill pill-gray">{{ s.currency }}</span></h2>
          <p v-if="s.subtitle" class="sub">{{ s.subtitle }}</p>
          <table class="qtable">
            <tbody>
              <tr v-for="l in s.lines" :key="l.label" :class="{ excluded: l.excluded }">
                <td>
                  {{ l.label }}
                  <div v-if="l.note" class="qnote">{{ l.note }}</div>
                </td>
                <td class="unit">{{ l.unit }}</td>
                <td class="amt">
                  <template v-if="l.amount !== null">{{ money(l.amount) }}</template>
                  <span v-else class="pill pill-amber">at cost</span>
                </td>
              </tr>
              <tr v-if="showTotals && subtotal(s) > 0" class="subtotal">
                <td>Subtotal</td>
                <td />
                <td class="amt">{{ s.currency }} {{ money(subtotal(s)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="quote.updates?.length" class="card">
          <h2>Quote discussion</h2>
          <p class="sub">Negotiation history — one thread, no more digging through email chains.</p>
          <div
            v-for="u in quote.updates"
            :key="u.at + u.from"
            class="email-item"
            :style="u.from.startsWith('M&P') ? 'border-left: 3px solid var(--blue)' : 'border-left: 3px solid #cbd5e1'"
          >
            <div class="meta">{{ u.from }} · {{ when(u.at) }}</div>
            <div style="font-size: 14px; margin-top: 2px">{{ u.text }}</div>
          </div>
        </div>

        <div class="card">
          <h2>Notes</h2>
          <ul style="margin: 8px 0 0; padding-left: 18px; font-size: 13px; color: var(--muted)">
            <li v-for="n in quote.notes" :key="n" style="margin-bottom: 4px">{{ n }}</li>
          </ul>
        </div>

        <div class="row no-print">
          <button class="btn btn-primary" @click="print">Print / save as PDF</button>
          <NuxtLink v-if="shipment" class="btn btn-outline" :to="`/track/${shipment.id}`">Track this shipment</NuxtLink>
          <NuxtLink v-else class="btn btn-outline" to="/">Back to dashboard</NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>
