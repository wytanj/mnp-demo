<script setup lang="ts">
import { PARTNER_ROLE_LABELS, type PartnerStatus } from '#shared/utils/shipping'

/** One partner on a job — role, name and the state colour CS scans for. */
defineProps<{ partner: PartnerStatus; compact?: boolean }>()

const ROLE_ICON: Record<string, string> = {
  shipping_line: 'i-lucide-ship',
  warehouse: 'i-lucide-warehouse',
  broker: 'i-lucide-stamp',
  agent: 'i-lucide-globe',
  haulier: 'i-lucide-truck'
}

const STATE_CLASS: Record<string, string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
  waiting: 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100',
  blocked: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
  done: 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200',
  na: 'bg-white border-dashed border-zinc-200 text-zinc-400 hover:bg-zinc-50'
}

const DOT_CLASS: Record<string, string> = {
  ok: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  blocked: 'bg-red-500',
  done: 'bg-zinc-400',
  na: 'bg-zinc-300'
}
</script>

<template>
  <button
    type="button"
    class="text-left rounded-lg border px-2.5 py-2 transition-colors min-w-0"
    :class="[STATE_CLASS[partner.state], compact ? 'w-full' : 'flex-1 min-w-[150px]']"
  >
    <span class="flex items-center gap-1.5 min-w-0">
      <UIcon :name="ROLE_ICON[partner.role] ?? 'i-lucide-handshake'" class="size-3.5 shrink-0 opacity-70" />
      <span class="text-[10px] font-semibold uppercase tracking-wide truncate opacity-70">
        {{ PARTNER_ROLE_LABELS[partner.role] }}
      </span>
      <span class="ms-auto size-2 rounded-full shrink-0" :class="DOT_CLASS[partner.state]" />
    </span>
    <span class="block text-xs font-semibold truncate mt-1">{{ partner.name }}</span>
    <span v-if="partner.waitingFor" class="block text-[11px] leading-snug mt-0.5 line-clamp-2 opacity-90">
      {{ partner.waitingFor }}
    </span>
  </button>
</template>
