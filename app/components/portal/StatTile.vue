<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: number | string
    icon: string
    hint?: string
    tone?: 'neutral' | 'primary' | 'alert'
  }>(),
  { tone: 'neutral' }
)
</script>

<template>
  <div
    class="rounded-xl border bg-white p-4 sm:p-5"
    :class="tone === 'alert' ? 'border-primary-300 bg-primary-50/60' : 'border-zinc-200'"
  >
    <div class="flex items-center gap-2">
      <UIcon
        :name="icon"
        class="size-4 shrink-0"
        :class="tone === 'neutral' ? 'text-zinc-400' : 'text-primary-600'"
      />
      <span class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{{ label }}</span>
    </div>
    <div
      class="mt-2 text-3xl font-bold tabular-nums tracking-tight"
      :class="tone === 'alert' ? 'text-primary-700' : 'text-zinc-900'"
    >{{ value }}</div>
    <div v-if="hint" class="mt-0.5 text-xs text-zinc-500">{{ hint }}</div>
  </div>
</template>
