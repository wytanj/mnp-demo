<script setup lang="ts">
import { STATUS_FLOW, STATUS_LABELS } from '#shared/utils/shipping'

/** Five-segment progress bar — the /track stepper, shrunk for a card. */
const props = withDefaults(defineProps<{ step: number; labels?: boolean }>(), {
  labels: true
})

const steps = computed(() =>
  STATUS_FLOW.map((s, i) => ({
    key: s,
    label: STATUS_LABELS[s],
    done: i <= props.step,
    current: i === props.step
  }))
)
</script>

<template>
  <div class="flex gap-1">
    <div v-for="s in steps" :key="s.key" class="flex-1 min-w-0">
      <div
        class="h-1.5 rounded-full transition-colors"
        :class="[
          s.done ? 'bg-primary' : 'bg-zinc-200',
          s.current ? 'ring-3 ring-primary/25' : ''
        ]"
      />
      <div
        v-if="labels"
        class="mt-1.5 hidden sm:block truncate text-[10px] leading-tight"
        :class="s.done ? 'font-semibold text-zinc-700' : 'text-zinc-400'"
      >{{ s.label }}</div>
    </div>
  </div>
</template>
