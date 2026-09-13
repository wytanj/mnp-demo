<script setup lang="ts">
import { STATUS_LABELS, type ShipmentEvent } from '#shared/utils/shipping'

const props = withDefaults(
  defineProps<{ events: ShipmentEvent[]; mode?: 'internal' | 'customer' }>(),
  { mode: 'internal' }
)

/*
 * Belt and braces: /api/track already drops events flagged internal, but CS/AI
 * shop talk must never reach a customer timeline even if a seed misses the flag.
 */
const CS_ONLY_RE = /^\s*(\u{1F4E9}|\u{1F916})/u

const sorted = computed(() => {
  const list = props.events.filter((e) => {
    if (props.mode !== 'customer') return true
    if (e.internal) return false
    return !CS_ONLY_RE.test(e.note ?? '')
  })
  return list.sort((a, b) => b.at.localeCompare(a.at))
})

const ACTOR_LABELS: Record<string, string> = {
  cs: 'Customer service',
  driver: 'Driver',
  customer: 'Customer',
  system: 'System'
}

function isOwnQuestion(e: ShipmentEvent): boolean {
  return props.mode === 'customer' && e.type === 'message' && e.actor === 'customer'
}

function title(e: ShipmentEvent): string {
  if (e.type === 'status' && e.status) return STATUS_LABELS[e.status]
  if (e.type === 'photo') return 'Photo update from driver'
  if (e.type === 'signoff') return 'Delivery signed off'
  if (e.type === 'created') return 'Shipment created'
  if (e.type === 'customs') return 'Customs update'
  if (e.type === 'claim') return 'Claim update'
  if (e.type === 'message') return isOwnQuestion(e) ? 'You asked' : 'Question from customer'
  return `Update from ${ACTOR_LABELS[e.actor] ?? e.actor}`
}

/** Strip the ops-side framing off the customer's own question. */
function noteOf(e: ShipmentEvent): string | undefined {
  if (!isOwnQuestion(e)) return e.note
  return (e.note ?? '').replace(/^\u{1F4AC}\s*Customer asked via tracking page:\s*/u, '').trim()
}

function who(e: ShipmentEvent): string {
  if (isOwnQuestion(e)) return 'You'
  return ACTOR_LABELS[e.actor] ?? e.actor
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <ul class="timeline">
    <li v-for="e in sorted" :key="e.id" :class="{ minor: e.type === 'note' || e.type === 'created' }">
      <div class="when">{{ when(e.at) }} · {{ who(e) }}</div>
      <div class="what">{{ title(e) }}</div>
      <div v-if="noteOf(e)" class="note">{{ noteOf(e) }}</div>
      <img v-if="e.photo" :src="e.photo" class="event-photo" alt="Shipment photo" />
    </li>
    <li v-if="!sorted.length" class="minor">
      <div class="what">No updates yet</div>
      <div class="note">Updates appear here as soon as the job moves.</div>
    </li>
  </ul>
</template>
