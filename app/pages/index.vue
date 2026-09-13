<script setup lang="ts">
import { STATUS_LABELS, mailDeliveredTo, mailDirectionOf, mailFromOf, mailToOf, type OutboxEmail, type Shipment } from '#shared/utils/shipping'

const { data: shipments, refresh: refreshShipments } = await useFetch<Shipment[]>('/api/shipments')
const { data: emails, refresh: refreshEmails } = await useFetch<OutboxEmail[]>('/api/emails')

const showForm = ref(false)
const creating = ref(false)
const toast = ref('')
const route = useRoute()
const openEmail = ref<string | null>(null)
const openMail = ref<string | null>((route.query.mail as string) || null)

const form = reactive({
  mode: 'b2c',
  customerName: '',
  customerEmail: '',
  company: '',
  poNumber: '',
  incoterms: 'DAP',
  origin: '',
  destination: '',
  eta: '',
  driverName: '',
  driverPhone: '',
  vehicle: '',
  pieces: 1,
  weightKg: 10,
  description: ''
})

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    refreshShipments()
    refreshEmails()
  }, 5000)
})
onUnmounted(() => clearInterval(timer))

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2400)
}

async function copyLink(id: string) {
  const url = `${location.origin}/track/${id}`
  await navigator.clipboard.writeText(url)
  flash('Tracking link copied — paste it into WhatsApp or email')
}

async function createShipment() {
  creating.value = true
  try {
    await $fetch('/api/shipments', { method: 'POST', body: { ...form } })
    showForm.value = false
    Object.assign(form, {
      customerName: '', customerEmail: '', company: '', poNumber: '',
      origin: '', destination: '', eta: '', driverName: '', driverPhone: '', vehicle: '',
      pieces: 1, weightKg: 10, description: ''
    })
    await Promise.all([refreshShipments(), refreshEmails()])
    flash('Shipment created — tracking email sent to customer')
  } catch (e: any) {
    flash(e?.data?.statusMessage ?? 'Could not create shipment')
  } finally {
    creating.value = false
  }
}

function pillClass(s: Shipment) {
  if (s.status === 'delivered') return 'pill-green'
  if (s.status === 'out_for_delivery') return 'pill-amber'
  return 'pill-blue'
}

function mailFor(id: string): OutboxEmail[] {
  return (emails.value ?? []).filter((e) => e.shipmentId === id)
}

function toggleMail(id: string) {
  openMail.value = openMail.value === id ? null : id
}
</script>

<template>
  <div>
    <TopBar role="Customer Service view" nav="cs" />
    <main class="page wide">
      <div class="card">
        <div class="row spread">
          <div>
            <h2>Operations dashboard</h2>
            <p class="sub" style="margin-bottom: 0">
              Book a shipment — the delivery notification &amp; tracking link go out automatically.
            </p>
          </div>
          <button class="btn btn-primary" @click="showForm = !showForm">
            {{ showForm ? 'Close' : '+ New shipment' }}
          </button>
        </div>

        <form v-if="showForm" style="margin-top: 18px" @submit.prevent="createShipment">
          <div class="row" style="margin-bottom: 14px">
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2c" /> B2C (consumer)
            </label>
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2b" /> B2B (business)
            </label>
            <label class="row" style="gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer">
              <input v-model="form.mode" type="radio" value="b2self" /> B2SELF (own outlets / internal transfer)
            </label>
          </div>

          <div class="form-grid">
            <label class="field"><span>Customer name *</span>
              <input v-model="form.customerName" type="text" required placeholder="Daniel Wong" />
            </label>
            <label class="field"><span>Customer email *</span>
              <input v-model="form.customerEmail" type="email" required placeholder="daniel@example.com" />
            </label>
            <template v-if="form.mode === 'b2b'">
              <label class="field"><span>Company</span>
                <input v-model="form.company" type="text" placeholder="Allmighty Foods Pte Ltd" />
              </label>
              <label class="field"><span>PO number</span>
                <input v-model="form.poNumber" type="text" placeholder="PO-4471" />
              </label>
              <label class="field"><span>Incoterms</span>
                <select v-model="form.incoterms">
                  <option>EXW</option><option>FOB</option><option>CIF</option>
                  <option>DAP</option><option>DDP</option>
                </select>
              </label>
            </template>
            <template v-else-if="form.mode === 'b2self'">
              <label class="field"><span>Brand / company</span>
                <input v-model="form.company" type="text" placeholder="Hey Fran" />
              </label>
              <label class="field"><span>Transfer reference</span>
                <input v-model="form.poNumber" type="text" placeholder="TRF-0219" />
              </label>
            </template>
            <label class="field"><span>Origin *</span>
              <input v-model="form.origin" type="text" required placeholder="Senoko Food Hub, Singapore" />
            </label>
            <label class="field"><span>Destination *</span>
              <input v-model="form.destination" type="text" required placeholder="Tuas, Singapore" />
            </label>
            <label class="field"><span>ETA</span>
              <input v-model="form.eta" type="datetime-local" />
            </label>
            <label class="field"><span>Driver</span>
              <input v-model="form.driverName" type="text" placeholder="Hafiz Rahman" />
            </label>
            <label class="field"><span>Driver mobile (their portal login)</span>
              <input v-model="form.driverPhone" type="tel" placeholder="9123 4567" />
            </label>
            <label class="field"><span>Vehicle</span>
              <input v-model="form.vehicle" type="text" placeholder="14-ft lorry — GBC 4521 K" />
            </label>
            <label class="field"><span>Pieces</span>
              <input v-model.number="form.pieces" type="number" min="1" />
            </label>
            <label class="field"><span>Weight (kg)</span>
              <input v-model.number="form.weightKg" type="number" min="0" />
            </label>
            <label class="field full"><span>Cargo description *</span>
              <input v-model="form.description" type="text" required placeholder="Household goods — fragile" />
            </label>
          </div>
          <button class="btn btn-primary" type="submit" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create & send tracking link' }}
          </button>
        </form>
      </div>

      <div class="layout cols-2">
      <div>
      <div class="card">
        <div class="row spread">
          <h2>Active shipments</h2>
          <NuxtLink class="btn btn-outline" to="/driver">🚚 Driver portal</NuxtLink>
        </div>
        <div v-for="s in shipments" :key="s.id" class="shipment-block">
          <div class="shipment-row">
            <div>
              <div class="row" style="gap: 8px">
                <span class="id">{{ s.id }}</span>
                <span class="pill" :class="pillClass(s)">{{ STATUS_LABELS[s.status] }}</span>
                <span class="pill pill-gray">{{ s.mode.toUpperCase() }}</span>
                <span v-if="s.documents" class="pill" :class="s.documents.every(d => d.status === 'approved' || d.status === 'waived') ? 'pill-green' : 'pill-amber'">
                  Docs {{ s.documents.filter(d => d.status === 'approved' || d.status === 'waived').length }}/{{ s.documents.length }}
                </span>
                <span v-if="s.review" class="pill pill-amber">★ {{ s.review.rating }}/5</span>
                <span v-if="mailFor(s.id).length" class="pill" :class="openMail === s.id ? 'pill-blue' : 'pill-gray'">
                  Mail {{ mailFor(s.id).length }}
                </span>
              </div>
              <div class="route">
                {{ s.origin }} → {{ s.destination }} ·
                {{ s.mode === 'b2c' ? s.customerName : (s.company ?? s.customerName) }}
                <template v-if="s.service"> · {{ s.service }}</template>
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-outline" @click="toggleMail(s.id)">
                {{ openMail === s.id ? 'Hide mail' : 'Mail log' }}
              </button>
              <button class="btn btn-outline" @click="copyLink(s.id)">Copy tracking link</button>
              <NuxtLink class="btn btn-outline" :to="`/track/${s.id}`">Customer view</NuxtLink>
              <NuxtLink class="btn btn-outline" :to="`/driver/${s.id}`">Driver view</NuxtLink>
              <NuxtLink v-if="s.quote" class="btn btn-outline" :to="`/quote/${s.id}`">Quote</NuxtLink>
            </div>
          </div>
          <div v-if="openMail === s.id" class="shipment-mail">
            <ShipmentEmailLog :shipment="s" :emails="mailFor(s.id)" />
          </div>
        </div>
      </div>

      </div>
      <div>
      <div class="card">
        <h2>Mail log <span class="pill pill-green">per shipment</span></h2>
        <p class="sub">Inbound questions and outbound sends — Gmail, SingNet or company domain, all attached to the job.</p>
        <div v-for="e in emails" :key="e.id" class="email-item">
          <div class="row spread" style="cursor: pointer" @click="openEmail = openEmail === e.id ? null : e.id">
            <div>
              <div class="subject">
                <span class="pill" :class="mailDirectionOf(e) === 'in' ? 'pill-amber' : 'pill-blue'">
                  {{ mailDirectionOf(e) === 'in' ? 'In' : 'Out' }}
                </span>
                {{ e.subject }}
              </div>
              <div class="meta">
                From {{ mailFromOf(e) }}
                · To {{ mailToOf(e) || '—' }}
                <template v-if="mailDeliveredTo(e)">
                  · <span style="color: #c2410c; font-weight: 700">delivered {{ mailDeliveredTo(e) }}</span>
                </template>
                <template v-if="e.shipmentId"> · {{ e.shipmentId }}</template>
                · {{ new Date(e.at).toLocaleString() }}
                <span v-if="e.delivery?.state === 'sent'" class="pill pill-green">✓ sent via Resend</span>
                <span v-else-if="e.delivery?.state === 'failed'" class="pill pill-amber" :title="e.delivery.detail">send failed</span>
                <span v-else-if="mailDirectionOf(e) === 'in'" class="pill pill-amber">received</span>
                <span v-else class="pill pill-gray">simulated</span>
              </div>
            </div>
            <span class="muted">{{ openEmail === e.id ? '▲' : '▼' }}</span>
          </div>
          <template v-if="openEmail === e.id">
            <pre>{{ e.body }}</pre>
            <MailCompose :email="e" />
            <div v-if="e.ctaLabel && e.ctaUrl" class="row" style="margin-top: 10px">
              <NuxtLink class="btn btn-outline" :to="e.ctaUrl">{{ e.ctaLabel }}</NuxtLink>
            </div>
          </template>
        </div>
        <p v-if="!emails?.length" class="muted">No emails yet.</p>
      </div>

      <RewardsDashboard compact />

      <div class="card">
        <h2>Frequent lanes <span class="pill pill-gray">rate cards</span></h2>
        <div class="shipment-row">
          <div>
            <div class="id">Shanghai / Shenzhen → Singapore</div>
            <div class="route">LCL consolidation · standing rate card</div>
          </div>
          <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-CN-LCL">View rates</NuxtLink></div>
        </div>
        <div class="shipment-row">
          <div>
            <div class="id">Busan → Singapore</div>
            <div class="route">LCL · last quoted for Allmighty Foods (QT-6220, under discussion)</div>
          </div>
          <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-6220">View quote</NuxtLink></div>
        </div>
        <div class="shipment-row">
          <div>
            <div class="id">Busan → Singapore</div>
            <div class="route">FCL 20' · last used by Allmighty Foods (QT-2481, shipment in transit)</div>
          </div>
          <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-2481">View quote</NuxtLink></div>
        </div>
        <div class="shipment-row">
          <div>
            <div class="id">Hong Kong → Singapore</div>
            <div class="route">LCL · last used by Mecha (QT-3318, shipment on the water)</div>
          </div>
          <div class="actions"><NuxtLink class="btn btn-outline" to="/quote/QT-3318">View quote</NuxtLink></div>
        </div>
      </div>

      <div class="card">
        <h2>Billing <span class="pill pill-gray">SOA</span></h2>
        <div class="shipment-row">
          <div>
            <div class="id">Titan Associates Pte Ltd</div>
            <div class="route">Statement of account · ended 08/12/2022 · SGD 1,294.02 outstanding</div>
          </div>
          <div class="actions"><NuxtLink class="btn btn-outline" to="/statement/12011">View statement</NuxtLink></div>
        </div>
      </div>

      <div class="card">
        <h2>Ask AI about your shipments <span class="pill pill-blue">MCP</span></h2>
        <p class="sub">
          Connect Claude (or any MCP client) and ask "what's the status of my Busan container?"
          or "what documents am I still missing?" in plain English.
        </p>
        <pre style="white-space: pre-wrap; font-size: 12px; background: #fbfcfe; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 0 0 10px">https://mnp-flow.vercel.app/mcp?key=mp-demo-2481</pre>
        <p class="muted" style="margin: 0">
          claude.ai → Settings → Connectors → Add custom connector → paste the URL.
          Tools: shipment list, full shipment status, outstanding actions.
        </p>
      </div>

      <div class="card">
        <h2>Rollout plan</h2>
        <p class="sub">Today CS types every update by email. We automate in phases:</p>
        <ul class="timeline" style="margin-top: 4px">
          <li>
            <div class="what">Phase 1 — automated delivery notification <span class="pill pill-green">this demo</span></div>
            <div class="note">Booking triggers the email + live tracking link. No more manual "here are your shipping details".</div>
          </li>
          <li class="minor">
            <div class="what">Phase 2 — driver updates</div>
            <div class="note">Photos &amp; status from the driver's phone, straight to the customer. Previewed in Driver view.</div>
          </li>
          <li class="minor">
            <div class="what">Phase 3 — e-sign POD &amp; reviews</div>
            <div class="note">Customer signs off on their phone; review request emails itself. Previewed in Customer view.</div>
          </li>
        </ul>
      </div>
      </div>
      </div>
    </main>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
