<script setup lang="ts">
import {
  isConsumerMailbox,
  mailDeliveredTo,
  mailDirectionOf,
  mailFromOf,
  mailKindOf,
  mailToOf,
  type OutboxEmail,
  type Shipment
} from '#shared/utils/shipping'

const props = defineProps<{
  shipment: Shipment
  emails: OutboxEmail[]
}>()

const openId = ref<string | null>(null)

const thread = computed(() =>
  [...props.emails].sort((a, b) => a.at.localeCompare(b.at))
)

const contacts = computed(() => {
  const listed = props.shipment.contacts?.length
    ? props.shipment.contacts
    : [{ email: props.shipment.customerEmail, name: props.shipment.customerName, source: 'booking' as const }]
  return listed
})

function kindLabel(e: OutboxEmail): string {
  switch (mailKindOf(e)) {
    case 'tracking': return 'Tracking'
    case 'review': return 'Review request'
    case 'reward': return 'Voucher'
    case 'inbound': return 'Inbound'
    case 'reply': return 'Reply'
    default: return 'CS'
  }
}

function matchLabel(e: OutboxEmail): string | null {
  switch (e.matchedBy) {
    case 'shipment-id': return 'Matched by job id'
    case 'booking-email': return 'Matched by booking address'
    case 'alias': return 'Matched by known address'
    case 'company-domain': return 'Matched by company domain'
    default: return null
  }
}

function mailboxKind(addr: string): string {
  if (!addr.includes('@') || !isConsumerMailbox(addr)) return ''
  const d = addr.split('@')[1] ?? ''
  if (d.includes('singnet')) return 'SingNet'
  if (d.includes('gmail') || d.includes('google')) return 'Gmail'
  return 'Personal'
}

function partyMailbox(e: OutboxEmail): string {
  return mailboxKind(mailDirectionOf(e) === 'in' ? mailFromOf(e) : mailToOf(e))
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="mail-log">
    <div class="row" style="gap: 6px; margin-bottom: 10px">
      <span
        v-for="c in contacts"
        :key="c.email"
        class="pill"
        :class="c.source === 'booking' ? 'pill-gray' : 'pill-blue'"
        :title="c.source === 'booking' ? 'On the booking' : 'Wrote in later'"
      >
        {{ c.name ? `${c.name} · ` : '' }}{{ c.email }}
        <span class="muted">{{ mailboxKind(c.email) }}</span>
      </span>
    </div>

    <div v-if="!thread.length" class="dash-empty">No mail on this shipment yet.</div>

    <div
      v-for="e in thread"
      :key="e.id"
      class="mail-msg"
      :class="mailDirectionOf(e)"
    >
      <div class="row spread" style="cursor: pointer" @click="openId = openId === e.id ? null : e.id">
        <div>
          <div class="mail-line">
            <span class="pill" :class="mailDirectionOf(e) === 'in' ? 'pill-amber' : 'pill-blue'">
              {{ mailDirectionOf(e) === 'in' ? 'In' : 'Out' }}
            </span>
            <span class="pill pill-gray">{{ kindLabel(e) }}</span>
            <span v-if="partyMailbox(e)" class="muted">{{ partyMailbox(e) }}</span>
          </div>
          <div class="subject">{{ e.subject }}</div>
          <div class="meta">
            From {{ mailFromOf(e) }} · To {{ mailToOf(e) || '—' }}
            <template v-if="mailDeliveredTo(e)">
              · <span style="color: #c2410c; font-weight: 700">delivered {{ mailDeliveredTo(e) }}</span>
            </template>
            · {{ when(e.at) }}
            <template v-if="matchLabel(e)"> · {{ matchLabel(e) }}</template>
            <template v-if="mailDirectionOf(e) === 'out' && e.delivery?.state === 'sent'"> · sent via Resend</template>
            <template v-else-if="mailDirectionOf(e) === 'out' && e.delivery?.state === 'failed'"> · send failed</template>
          </div>
        </div>
        <span class="muted">{{ openId === e.id ? '▲' : '▼' }}</span>
      </div>
      <template v-if="openId === e.id">
        <pre>{{ e.body }}</pre>
        <MailCompose :email="e" />
      </template>
    </div>
  </div>
</template>
