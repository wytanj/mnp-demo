<script setup lang="ts">
import { STATUS_FLOW, STATUS_LABELS, statusIndex, type ShipmentStatus } from '#shared/utils/shipping'

const props = defineProps<{ status: ShipmentStatus }>()
const current = computed(() => statusIndex(props.status))
</script>

<template>
  <div class="steps">
    <div
      v-for="(s, i) in STATUS_FLOW"
      :key="s"
      class="step"
      :class="{ done: i <= current, current: i === current }"
    >
      <div class="bar" />
      {{ STATUS_LABELS[s] }}
    </div>
  </div>
</template>
