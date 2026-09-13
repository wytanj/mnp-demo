<script setup lang="ts">
import type { OutboxEmail, Shipment, ShipmentMode } from '#shared/utils/shipping'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

type DashTab = 'overview' | 'clients' | 'reviews' | 'rewards' | 'automations'
const TABS: DashTab[] = ['overview', 'clients', 'reviews', 'rewards', 'automations']

const { data: shipments, refresh: refreshShipments } = await useFetch<Shipment[]>('/api/shipments')
const { data: emails, refresh: refreshEmails } = await useFetch<OutboxEmail[]>('/api/emails')

const route = useRoute()
const router = useRouter()
const initialTab = TABS.includes(route.query.tab as DashTab) ? route.query.tab as DashTab : 'overview'
const tab = ref<DashTab>(initialTab)
const query = ref('')
const selectedClient = ref<string | null>(null)
const rewardCodes = reactive<Record<string, string>>({})
const toast = ref('')
const lightbox = ref('')
const showFlyer = ref(false)

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

function clientKey(s: Shipment): string {
  return (s.company?.trim() || s.customerEmail).toLowerCase()
}

function clientName(s: Shipment): string {
  return s.company?.trim() || s.customerName
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function stars(n: number) {
  return [1, 2, 3, 4, 5].map((i) => ({ i, on: i <= n }))
}

function emailFor(shipmentId: string, kind: 'track' | 'review' | 'reward'): OutboxEmail | undefined {
  return (emails.value ?? []).find((e) => {
    if (e.shipmentId !== shipmentId) return false
    if (kind === 'track') return e.ctaUrl.startsWith('/track')
    if (kind === 'review') return e.ctaUrl.startsWith('/review')
    return /reward/i.test(e.subject)
  })
}

interface ClientRow {
  key: string
  name: string
  contacts: string[]
  emails: string[]
  modes: ShipmentMode[]
  shipments: Shipment[]
  reviews: Shipment[]
  rewards: Shipment[]
  pending: Shipment[]
  avg: number | null
  lastAt: string
}

const all = computed(() => shipments.value ?? [])

const clients = computed<ClientRow[]>(() => {
  const map = new Map<string, ClientRow>()
  for (const s of all.value) {
    const key = clientKey(s)
    let row = map.get(key)
    if (!row) {
      row = {
        key,
        name: clientName(s),
        contacts: [],
        emails: [],
        modes: [],
        shipments: [],
        reviews: [],
        rewards: [],
        pending: [],
        avg: null,
        lastAt: s.createdAt
      }
      map.set(key, row)
    }
    row.shipments.push(s)
    if (!row.contacts.includes(s.customerName)) row.contacts.push(s.customerName)
    if (!row.emails.includes(s.customerEmail)) row.emails.push(s.customerEmail)
    if (!row.modes.includes(s.mode)) row.modes.push(s.mode)
    if (s.createdAt > row.lastAt) row.lastAt = s.createdAt
    if (s.review) {
      row.reviews.push(s)
      if (s.review.reward) row.rewards.push(s)
      else if (s.review.screenshot) row.pending.push(s)
    }
    const latestReview = s.review?.at
    if (latestReview && latestReview > row.lastAt) row.lastAt = latestReview
    if (s.review?.reward?.at && s.review.reward.at > row.lastAt) row.lastAt = s.review.reward.at
  }
  for (const row of map.values()) {
    row.avg = row.reviews.length
      ? row.reviews.reduce((n, s) => n + (s.review?.rating ?? 0), 0) / row.reviews.length
      : null
  }
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
})

const reviews = computed(() =>
  all.value.filter((s) => s.review).sort((a, b) => (b.review!.at).localeCompare(a.review!.at))
)
const pendingProof = computed(() => reviews.value.filter((s) => !s.review!.reward && s.review!.screenshot))
const inAppOnly = computed(() => reviews.value.filter((s) => !s.review!.reward && !s.review!.screenshot))
const rewardsSent = computed(() => reviews.value.filter((s) => s.review!.reward))
const delivered = computed(() => all.value.filter((s) => s.status === 'delivered' || s.signoff))
const awaitingReview = computed(() => delivered.value.filter((s) => !s.review))

const avgRating = computed(() => {
  if (!reviews.value.length) return null
  return reviews.value.reduce((n, s) => n + s.review!.rating, 0) / reviews.value.length
})

const q = computed(() => query.value.trim().toLowerCase())

function matchesQuery(s: Shipment): boolean {
  if (!q.value) return true
  const blob = [
    s.id, s.customerName, s.customerEmail, s.company, s.review?.comment, s.review?.reward?.code
  ].filter(Boolean).join(' ').toLowerCase()
  return blob.includes(q.value)
}

const visibleClients = computed(() => {
  const list = selectedClient.value
    ? clients.value.filter((c) => c.key === selectedClient.value)
    : clients.value
  if (!q.value) return list
  return list.filter((c) =>
    [c.name, ...c.contacts, ...c.emails].join(' ').toLowerCase().includes(q.value)
  )
})

const visibleReviews = computed(() => {
  let list = reviews.value
  if (selectedClient.value) list = list.filter((s) => clientKey(s) === selectedClient.value)
  return list.filter(matchesQuery)
})

const visibleRewards = computed(() => {
  let list = rewardsSent.value
  if (selectedClient.value) list = list.filter((s) => clientKey(s) === selectedClient.value)
  return list.filter(matchesQuery)
})

const visiblePending = computed(() => {
  let list = pendingProof.value
  if (selectedClient.value) list = list.filter((s) => clientKey(s) === selectedClient.value)
  return list.filter(matchesQuery)
})

const autoFns = computed(() => {
  const mail = emails.value ?? []
  const tracking = mail.filter((e) => e.ctaUrl.startsWith('/track')).length
  const reviewReq = mail.filter((e) => e.ctaUrl.startsWith('/review')).length
  const rewardMail = mail.filter((e) => /reward/i.test(e.subject)).length
  return [
    {
      id: 'tracking',
      name: 'Booking confirmation',
      trigger: 'Fires when a shipment is booked',
      action: 'Emails the live tracking link — no CS typing',
      mode: 'Automatic · live',
      live: true,
      count: tracking
    },
    {
      id: 'review-request',
      name: 'Review request',
      trigger: 'Fires when the customer signs the POD',
      action: 'Emails “How did we do?” + giveaway prompt',
      mode: 'Automatic · live',
      live: true,
      count: reviewReq
    },
    {
      id: 'reward',
      name: 'Voucher fulfilment',
      trigger: 'Fires when CS approves public-review proof',
      action: 'Emails the Grab voucher code',
      mode: 'Semi-auto · CS click',
      live: true,
      count: rewardMail
    },
    {
      id: 'reminder',
      name: 'Review reminder',
      trigger: 'Would fire 48h after delivery if no review',
      action: 'Nudge the customer to leave a public review',
      mode: 'Planned',
      live: false,
      count: awaitingReview.value.length
    }
  ]
})

const pipeline = computed(() => {
  const rows = all.value
    .filter((s) => s.status === 'delivered' || s.signoff || s.review)
    .sort((a, b) => (b.review?.at ?? b.signoff?.at ?? b.createdAt).localeCompare(a.review?.at ?? a.signoff?.at ?? a.createdAt))
  return selectedClient.value ? rows.filter((s) => clientKey(s) === selectedClient.value) : rows
})

const recentAuto = computed(() => {
  const kinds = (emails.value ?? [])
    .filter((e) => e.ctaUrl.startsWith('/track') || e.ctaUrl.startsWith('/review') || /reward/i.test(e.subject))
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
  return kinds
})

function autoKind(e: OutboxEmail): string {
  if (e.ctaUrl.startsWith('/review')) return 'Review request'
  if (/reward/i.test(e.subject)) return 'Voucher email'
  return 'Tracking email'
}

async function approveReward(s: Shipment) {
  const code = (rewardCodes[s.id] ?? '').trim()
  if (!code) {
    flash('Enter a voucher code first')
    return
  }
  try {
    await $fetch(`/api/shipments/${s.id}/reward`, {
      method: 'POST',
      body: { code, value: 'Grab $10' }
    })
    delete rewardCodes[s.id]
    await Promise.all([refreshShipments(), refreshEmails()])
    flash('Voucher approved — email generated in outbox')
  } catch (e: any) {
    flash(e?.data?.statusMessage ?? 'Could not approve reward')
  }
}

async function copyCode(code: string) {
  await navigator.clipboard.writeText(code)
  flash('Voucher code copied')
}

function toggleClient(key: string) {
  selectedClient.value = selectedClient.value === key ? null : key
}

function go(next: DashTab) {
  tab.value = next
  const query = { ...route.query } as Record<string, string>
  if (next === 'overview') delete query.tab
  else query.tab = next
  router.replace({ query })
}

function onKpi(next: DashTab) {
  if (props.compact) {
    return navigateTo({ path: '/rewards', query: next === 'overview' ? {} : { tab: next } })
  }
  go(next)
}

function platformLabel(p: 'google' | 'facebook') {
  return p === 'google' ? 'Google' : 'Facebook'
}
</script>

<template>
  <div>
    <div class="card" :class="{ 'rewards-compact': compact }" :style="compact ? 'border-color: #fbbf8f' : undefined">
      <div class="row spread" style="align-items: flex-start">
        <div>
          <h2>
            Review rewards
            <span v-if="pendingProof.length" class="pill pill-amber">{{ pendingProof.length }} to verify</span>
            <span v-else class="pill pill-green">Giveaway · Grab $10</span>
          </h2>
          <p class="sub" style="margin-bottom: 0">
            Public Google / Facebook reviews → verified Grab voucher codes.
            {{ compact ? 'Approve proof here, or open the full dashboard.' : 'Clients, reviews, vouchers and the automations that send them.' }}
          </p>
        </div>
        <div class="row" style="align-items: flex-start">
          <img
            class="campaign-thumb"
            src="/giveaway.jpg"
            alt="M&P review giveaway flyer"
            title="Campaign flyer"
            @click="showFlyer = true"
          />
          <NuxtLink v-if="compact" class="btn btn-primary" to="/rewards">Open dashboard</NuxtLink>
        </div>
      </div>

      <div class="kpi-grid">
        <button class="kpi clickable" :class="{ on: !compact && tab === 'clients' }" type="button" @click="onKpi('clients')">
          <div class="n">{{ clients.length }}</div>
          <div class="l">Clients</div>
        </button>
        <button class="kpi clickable" :class="{ on: !compact && tab === 'reviews' }" type="button" @click="onKpi('reviews')">
          <div class="n">{{ reviews.length }}</div>
          <div class="l">Reviews given</div>
          <div v-if="avgRating" class="hint">avg {{ avgRating.toFixed(1) }} ★</div>
        </button>
        <button class="kpi clickable" :class="{ on: !compact && tab === 'rewards' }" type="button" @click="onKpi('rewards')">
          <div class="n">{{ rewardsSent.length }}</div>
          <div class="l">Rewards given</div>
          <div class="hint">Grab vouchers</div>
        </button>
        <button class="kpi clickable" :class="{ on: !compact && tab === 'rewards' }" type="button" @click="onKpi('rewards')">
          <div class="n">{{ pendingProof.length }}</div>
          <div class="l">Pending proof</div>
        </button>
        <button class="kpi clickable" :class="{ on: !compact && tab === 'automations' }" type="button" @click="onKpi('automations')">
          <div class="n">{{ autoFns.filter(f => f.live).length }}</div>
          <div class="l">Auto functions</div>
          <div class="hint">live now</div>
        </button>
      </div>

      <template v-if="compact">
        <div v-if="pendingProof.length" style="margin-top: 16px">
          <div class="muted" style="margin-bottom: 8px; font-weight: 700">Waiting for CS verification</div>
          <div v-for="s in pendingProof" :key="s.id" class="shipment-row">
            <div>
              <div class="row" style="gap: 8px">
                <span class="id">{{ s.id }}</span>
                <span class="star-row"><span v-for="st in stars(s.review!.rating)" :key="st.i" :class="{ on: st.on }">★</span></span>
                <span class="muted">{{ s.customerName }}</span>
              </div>
              <div v-if="s.review!.comment" class="route">"{{ s.review!.comment }}"</div>
              <img
                v-if="s.review!.screenshot"
                class="proof-thumb"
                style="margin-top: 8px"
                :src="s.review!.screenshot"
                alt="Review screenshot"
                @click="lightbox = s.review!.screenshot!"
              />
            </div>
            <div class="actions" style="align-items: center">
              <input v-model="rewardCodes[s.id]" type="text" placeholder="GRAB10" style="width: 140px" />
              <button class="btn btn-success" @click="approveReward(s)">Approve &amp; send</button>
            </div>
          </div>
        </div>
        <p v-else class="muted" style="margin: 14px 0 0">No proofs waiting — {{ rewardsSent.length }} voucher{{ rewardsSent.length === 1 ? '' : 's' }} already sent.</p>
      </template>
    </div>

    <template v-if="!compact">
      <div class="card">
        <div class="dash-toolbar">
          <div class="dash-tabs">
            <button class="dash-tab" :class="{ on: tab === 'overview' }" type="button" @click="go('overview')">Overview</button>
            <button class="dash-tab" :class="{ on: tab === 'clients' }" type="button" @click="go('clients')">Clients <span class="muted">{{ clients.length }}</span></button>
            <button class="dash-tab" :class="{ on: tab === 'reviews' }" type="button" @click="go('reviews')">Reviews <span class="muted">{{ reviews.length }}</span></button>
            <button class="dash-tab" :class="{ on: tab === 'rewards' }" type="button" @click="go('rewards')">Rewards <span class="muted">{{ rewardsSent.length }}</span></button>
            <button class="dash-tab" :class="{ on: tab === 'automations' }" type="button" @click="go('automations')">Automatic functions</button>
          </div>
          <input v-model="query" class="dash-search" type="search" placeholder="Search client, shipment, code…" />
        </div>
        <div v-if="selectedClient" class="row" style="margin-bottom: 12px">
          <span class="pill pill-blue">Filtered · {{ clients.find(c => c.key === selectedClient)?.name }}</span>
          <button class="btn btn-ghost" type="button" @click="selectedClient = null">Clear</button>
        </div>

        <template v-if="tab === 'overview' || tab === 'automations'">
          <div class="funnel">
            <div class="funnel-step">
              <div class="n">{{ clients.length }}</div>
              <div class="l">Clients</div>
            </div>
            <div class="funnel-step">
              <div class="n">{{ delivered.length }}</div>
              <div class="l">Delivered</div>
            </div>
            <div class="funnel-step">
              <div class="n">{{ reviews.length }}</div>
              <div class="l">Reviewed</div>
            </div>
            <div class="funnel-step">
              <div class="n">{{ pendingProof.length + rewardsSent.filter(s => s.review?.screenshot).length }}</div>
              <div class="l">Public proof</div>
            </div>
            <div class="funnel-step">
              <div class="n">{{ rewardsSent.length }}</div>
              <div class="l">Vouchers sent</div>
            </div>
          </div>
        </template>

        <template v-if="tab === 'overview'">
          <div class="layout cols-2 even" style="margin-top: 16px">
            <div>
              <h2>Proof to verify</h2>
              <p class="sub">Customer uploaded a public-review screenshot. Approve and the Grab code emails itself.</p>
              <div v-if="!visiblePending.length" class="dash-empty">Nothing waiting for verification.</div>
              <div v-for="s in visiblePending" :key="s.id" class="shipment-row">
                <div>
                  <div class="row" style="gap: 8px">
                    <span class="id">{{ s.id }}</span>
                    <span class="star-row"><span v-for="st in stars(s.review!.rating)" :key="st.i" :class="{ on: st.on }">★</span></span>
                    <span v-for="p in s.review!.platforms ?? []" :key="p" class="pill pill-gray">{{ platformLabel(p) }}</span>
                  </div>
                  <div class="route">{{ clientName(s) }} · {{ s.customerName }}</div>
                  <div v-if="s.review!.comment" class="route">"{{ s.review!.comment }}"</div>
                  <img
                    v-if="s.review!.screenshot"
                    class="proof-thumb"
                    style="width: 140px; height: auto; margin-top: 8px"
                    :src="s.review!.screenshot"
                    alt="Review screenshot"
                    @click="lightbox = s.review!.screenshot!"
                  />
                </div>
                <div class="actions" style="align-items: center">
                  <input v-model="rewardCodes[s.id]" type="text" placeholder="GRAB10" style="width: 140px" />
                  <button class="btn btn-success" @click="approveReward(s)">Approve &amp; send</button>
                </div>
              </div>
              <p v-if="inAppOnly.length" class="muted" style="margin-top: 10px">
                {{ inAppOnly.length }} in-app review{{ inAppOnly.length === 1 ? '' : 's' }} without public proof — no voucher yet.
              </p>
            </div>
            <div>
              <h2>Automatic functions</h2>
              <p class="sub">What the system already sends on its own.</p>
              <div v-for="fn in autoFns.filter(f => f.live)" :key="fn.id" class="auto-card" style="margin-bottom: 10px">
                <div class="row spread">
                  <h3>{{ fn.name }}</h3>
                  <span class="pill pill-green">{{ fn.mode }}</span>
                </div>
                <p class="trig">{{ fn.trigger }} · {{ fn.action }}</p>
                <div class="count">{{ fn.count }} <span class="muted" style="font-size: 13px; font-weight: 600">sent</span></div>
              </div>
            </div>
          </div>
        </template>

        <template v-if="tab === 'clients'">
          <div v-if="!visibleClients.length" class="dash-empty">No clients match.</div>
          <div v-else class="table-wrap">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Shipments</th>
                  <th>Reviews</th>
                  <th>Avg</th>
                  <th>Rewards</th>
                  <th>Status</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in visibleClients"
                  :key="c.key"
                  class="clickable"
                  :class="{ sel: selectedClient === c.key }"
                  @click="toggleClient(c.key)"
                >
                  <td>
                    <div class="row" style="gap: 10px; flex-wrap: nowrap">
                      <span class="avatar">{{ initials(c.name) }}</span>
                      <div>
                        <div class="who">{{ c.name }}</div>
                        <div class="meta">{{ c.contacts.join(', ') }}</div>
                        <div class="meta">{{ c.emails[0] }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {{ c.shipments.length }}
                    <div class="meta">
                      <span v-for="m in c.modes" :key="m" class="pill pill-gray" style="margin-right: 4px">{{ m.toUpperCase() }}</span>
                    </div>
                  </td>
                  <td>{{ c.reviews.length }}</td>
                  <td>
                    <span v-if="c.avg !== null" class="star-row" :title="c.avg.toFixed(1)">
                      <span v-for="st in stars(Math.round(c.avg))" :key="st.i" :class="{ on: st.on }">★</span>
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>{{ c.rewards.length }}</td>
                  <td>
                    <span v-if="c.pending.length" class="pill pill-amber">{{ c.pending.length }} to verify</span>
                    <span v-else-if="c.rewards.length" class="pill pill-green">Voucher sent</span>
                    <span v-else-if="c.reviews.length" class="pill pill-gray">No public proof</span>
                    <span v-else class="pill pill-gray">No review yet</span>
                  </td>
                  <td class="meta">{{ fmtWhen(c.lastAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="tab === 'reviews'">
          <div v-if="!visibleReviews.length" class="dash-empty">No reviews match.</div>
          <div v-else class="table-wrap">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Client</th>
                  <th>Shipment</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Platforms</th>
                  <th>Proof</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in visibleReviews" :key="s.id">
                  <td class="meta">{{ fmtWhen(s.review!.at) }}</td>
                  <td>
                    <div class="who">{{ clientName(s) }}</div>
                    <div class="meta">{{ s.customerName }}</div>
                  </td>
                  <td>
                    <NuxtLink :to="`/track/${s.id}`">{{ s.id }}</NuxtLink>
                  </td>
                  <td>
                    <span class="star-row">
                      <span v-for="st in stars(s.review!.rating)" :key="st.i" :class="{ on: st.on }">★</span>
                    </span>
                  </td>
                  <td style="max-width: 280px">{{ s.review!.comment || '—' }}</td>
                  <td>
                    <span v-for="p in s.review!.platforms ?? []" :key="p" class="pill pill-gray" style="margin: 0 4px 4px 0">{{ platformLabel(p) }}</span>
                    <span v-if="!(s.review!.platforms ?? []).length" class="muted">In-app</span>
                  </td>
                  <td>
                    <img
                      v-if="s.review!.screenshot"
                      class="proof-thumb"
                      :src="s.review!.screenshot"
                      alt="Review screenshot"
                      @click="lightbox = s.review!.screenshot!"
                    />
                    <span v-else class="muted">None</span>
                  </td>
                  <td>
                    <template v-if="s.review!.reward">
                      <span class="code-chip">{{ s.review!.reward.code }}</span>
                      <div class="meta">{{ s.review!.reward.value ?? 'Grab $10' }}</div>
                    </template>
                    <span v-else-if="s.review!.screenshot" class="pill pill-amber">To verify</span>
                    <span v-else class="pill pill-gray">No proof</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="tab === 'rewards'">
          <h2 style="margin-top: 4px">Waiting to send</h2>
          <p class="sub">Verify the screenshot, enter the Grab code, send.</p>
          <div v-if="!visiblePending.length" class="dash-empty">No vouchers waiting.</div>
          <div v-for="s in visiblePending" :key="s.id" class="shipment-row">
            <div>
              <div class="row" style="gap: 8px">
                <span class="id">{{ s.id }}</span>
                <span class="star-row"><span v-for="st in stars(s.review!.rating)" :key="st.i" :class="{ on: st.on }">★</span></span>
                <span class="muted">{{ clientName(s) }} · {{ s.customerName }}</span>
              </div>
              <div v-if="s.review!.comment" class="route">"{{ s.review!.comment }}"</div>
            </div>
            <div class="actions" style="align-items: center">
              <input v-model="rewardCodes[s.id]" type="text" placeholder="GRAB10" style="width: 140px" />
              <button class="btn btn-success" @click="approveReward(s)">Approve &amp; send</button>
            </div>
          </div>

          <h2 style="margin-top: 22px">Rewards given</h2>
          <p class="sub">Voucher codes already emailed to the customer.</p>
          <div v-if="!visibleRewards.length" class="dash-empty">No vouchers sent yet.</div>
          <div v-else class="table-wrap">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Client</th>
                  <th>Shipment</th>
                  <th>Code</th>
                  <th>Value</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in visibleRewards" :key="s.id">
                  <td class="meta">{{ fmtWhen(s.review!.reward!.at) }}</td>
                  <td>
                    <div class="who">{{ clientName(s) }}</div>
                    <div class="meta">{{ s.customerEmail }}</div>
                  </td>
                  <td><NuxtLink :to="`/track/${s.id}`">{{ s.id }}</NuxtLink></td>
                  <td>
                    <button class="code-chip" type="button" :title="'Copy ' + s.review!.reward!.code" @click="copyCode(s.review!.reward!.code)">
                      {{ s.review!.reward!.code }}
                    </button>
                  </td>
                  <td>{{ s.review!.reward!.value ?? 'Grab $10' }}</td>
                  <td>
                    <span v-if="emailFor(s.id, 'reward')?.delivery?.state === 'sent'" class="pill pill-green">Sent</span>
                    <span v-else-if="emailFor(s.id, 'reward')?.delivery?.state === 'failed'" class="pill pill-amber">Failed</span>
                    <span v-else class="pill pill-gray">{{ emailFor(s.id, 'reward') ? 'Simulated' : 'Logged' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="tab === 'automations'">
          <div class="auto-grid" style="margin-top: 8px">
            <div v-for="fn in autoFns" :key="fn.id" class="auto-card">
              <div class="row spread">
                <h3>{{ fn.name }}</h3>
                <span class="pill" :class="fn.live ? 'pill-green' : 'pill-gray'">{{ fn.mode }}</span>
              </div>
              <p class="trig"><strong>When</strong> {{ fn.trigger }}</p>
              <p class="trig" style="margin-bottom: 8px"><strong>Then</strong> {{ fn.action }}</p>
              <div class="count">
                {{ fn.count }}
                <span class="muted" style="font-size: 13px; font-weight: 600">
                  {{ fn.live ? 'fired' : 'awaiting review' }}
                </span>
              </div>
            </div>
          </div>

          <h2 style="margin-top: 22px">Per-shipment pipeline</h2>
          <p class="sub">Each automatic function against delivered jobs.</p>
          <div v-if="!pipeline.length" class="dash-empty">No delivered shipments yet.</div>
          <div v-else class="table-wrap">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Client</th>
                  <th>Tracking email</th>
                  <th>Review request</th>
                  <th>Review in</th>
                  <th>Public proof</th>
                  <th>Voucher</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in pipeline" :key="s.id">
                  <td><span class="who">{{ s.id }}</span></td>
                  <td>
                    <div class="who">{{ clientName(s) }}</div>
                    <div class="meta">{{ s.customerName }}</div>
                  </td>
                  <td>
                    <span v-if="emailFor(s.id, 'track')" class="pill pill-green">Auto sent</span>
                    <span v-else class="pill pill-gray">—</span>
                  </td>
                  <td>
                    <span v-if="emailFor(s.id, 'review')" class="pill pill-green">Auto sent</span>
                    <span v-else-if="s.review" class="pill pill-gray">Done</span>
                    <span v-else-if="s.status === 'delivered'" class="pill pill-amber">Due</span>
                    <span v-else class="pill pill-gray">—</span>
                  </td>
                  <td>
                    <span v-if="s.review" class="star-row">
                      <span v-for="st in stars(s.review.rating)" :key="st.i" :class="{ on: st.on }">★</span>
                    </span>
                    <span v-else class="pill pill-gray">Waiting</span>
                  </td>
                  <td>
                    <span v-if="s.review?.screenshot" class="pill pill-green">Uploaded</span>
                    <span v-else class="pill pill-gray">None</span>
                  </td>
                  <td>
                    <span v-if="s.review?.reward" class="code-chip">{{ s.review.reward.code }}</span>
                    <span v-else-if="s.review?.screenshot" class="pill pill-amber">CS to send</span>
                    <span v-else class="pill pill-gray">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 style="margin-top: 22px">Recent automatic activity</h2>
          <div v-if="!recentAuto.length" class="dash-empty">No automated emails yet.</div>
          <div v-for="e in recentAuto" :key="e.id" class="email-item">
            <div class="row spread">
              <div>
                <div class="subject">{{ autoKind(e) }} · {{ e.subject }}</div>
                <div class="meta">To {{ e.to }} · {{ fmtWhen(e.at) }}</div>
              </div>
              <span v-if="e.delivery?.state === 'sent'" class="pill pill-green">Sent</span>
              <span v-else-if="e.delivery?.state === 'failed'" class="pill pill-amber">Failed</span>
              <span v-else class="pill pill-gray">Simulated</span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <div v-if="lightbox" class="lightbox" @click="lightbox = ''">
      <img :src="lightbox" alt="Review screenshot" @click.stop />
    </div>
    <div v-if="showFlyer" class="lightbox" @click="showFlyer = false">
      <img src="/giveaway.jpg" alt="M&P review giveaway flyer" @click.stop />
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
