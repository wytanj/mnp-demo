<script setup lang="ts">
import { STATUS_LABELS, type ShipmentEvent } from '#shared/utils/shipping'

const props = defineProps<{ events: ShipmentEvent[] }>()

const sorted = computed(() =>
  [...props.events].sort((a, b) => b.at.localeCompare(a.at))
)

const ACTOR_LABELS: Record<string, string> = {
  cs: 'Customer service',
  driver: 'Driver',
  customer: 'Customer',
  system: 'System'
}

function title(e: ShipmentEvent): string {
  if (e.type === 'status' && e.status) return STATUS_LABELS[e.status]
  if (e.type === 'photo') return 'Photo update from driver'
  if (e.type === 'signoff') return 'Delivery signed off'
  if (e.type === 'created') return 'Shipment created'
  return `Update from ${ACTOR_LABELS[e.actor] ?? e.actor}`
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
      <div class="when">{{ when(e.at) }} · {{ ACTOR_LABELS[e.actor] ?? e.actor }}</div>
      <div class="what">{{ title(e) }}</div>
      <div v-if="e.note" class="note">{{ e.note }}</div>
      <img v-if="e.photo" :src="e.photo" class="event-photo" alt="Shipment photo" />
    </li>
  </ul>
</template>
