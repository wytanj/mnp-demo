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
      <span class="step-label">{{ STATUS_LABELS[s] }}</span>
      <span v-if="i === current" class="step-now">Now</span>
    </div>
  </div>
</template>

<style>
/*
 * The shared .steps palette in main.css is tuned for white cards; on the
 * charcoal hero the labels came out near-invisible. Override only inside
 * .hero-status so the ops/white-card usage is untouched.
 */
.steps .step-label { display: block; }
.steps .step-now {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--blue);
}

.hero-status .steps { margin: 16px 0 2px; }
.hero-status .steps .step {
  color: rgba(255, 255, 255, 0.72); /* ~8:1 on the charcoal gradient */
  font-size: 11px;
  line-height: 1.35;
}
.hero-status .steps .step.done { color: #fff; font-weight: 700; }
.hero-status .steps .bar { background: rgba(255, 255, 255, 0.24); }
.hero-status .steps .step.done .bar { background: #f17421; }
.hero-status .steps .step.current .bar {
  background: #f17421;
  box-shadow: 0 0 0 3px rgba(241, 116, 33, 0.32);
}
.hero-status .steps .step-now { color: #f9b27e; }

@media (max-width: 420px) {
  .hero-status .steps { gap: 3px; }
  .hero-status .steps .step { font-size: 10px; }
}
</style>
