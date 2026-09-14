<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

interface OpsSummary {
  jobs: number
  inboxNeedsReply: number
  customsQueue: number
  reviewsPending: number
  quotesNew: number
  partnerWaits: number
  exceptions: number
}

/**
 * Sidebar badge counts. W2 owns `GET /api/ops/summary`; until it lands the
 * endpoint 404s, so the fetch is deliberately non-fatal (`default: () => null`)
 * and every badge is guarded behind `count > 0`.
 */
const { data: summary } = await useFetch<OpsSummary>('/api/ops/summary', {
  default: () => null,
  server: false,
  lazy: true
})

function n(key: keyof OpsSummary): number {
  const v = summary.value?.[key]
  return typeof v === 'number' ? v : 0
}

/** Nuxt UI renders a badge for `0` too, so only attach one when there is news. */
function badge(key: keyof OpsSummary, color: 'primary' | 'error' = 'primary') {
  const count = n(key)
  if (!count) return undefined
  return { label: String(count), color, variant: 'subtle' as const }
}

const items = computed<NavigationMenuItem[][]>(() => [
  [
    { label: 'Jobs', icon: 'i-lucide-boxes', to: '/ops/jobs', badge: badge('jobs') },
    { label: 'Inbox', icon: 'i-lucide-inbox', to: '/ops/inbox', badge: badge('inboxNeedsReply') },
    { label: 'Customs queue', icon: 'i-lucide-stamp', to: '/ops/customs', badge: badge('customsQueue') },
    { label: 'Reviews', icon: 'i-lucide-star', to: '/ops/reviews', badge: badge('reviewsPending') },
    { label: 'Quotes', icon: 'i-lucide-file-text', to: '/ops/quotes', badge: badge('quotesNew') },
    { label: 'Trade partners', icon: 'i-lucide-handshake', to: '/ops/partners', badge: badge('partnerWaits') },
    { label: 'Exceptions', icon: 'i-lucide-triangle-alert', to: '/ops/exceptions', badge: badge('exceptions', 'error') },
    { label: 'Agent desk', icon: 'i-lucide-bot', to: '/ops/agent' }
  ],
  [
    { label: 'Docs vault', icon: 'i-lucide-folder-open', to: '/ops/docs' },
    { label: 'Billing / SOA', icon: 'i-lucide-receipt', to: '/ops/billing' },
    { label: 'Review programme', icon: 'i-lucide-gift', to: '/ops/rewards' }
  ]
])
</script>

<template>
  <UDashboardGroup storage="cookie" storage-key="mp-ops" class="bg-zinc-50 text-zinc-900">
    <UDashboardSidebar
      collapsible
      resizable
      :default-size="17"
      :min-size="13"
      :max-size="24"
      class="dark bg-[#221F1F] border-e border-white/10"
      :ui="{
        header: 'border-b border-white/10',
        body: 'py-3',
        footer: 'border-t border-white/10 flex-col items-stretch gap-2 py-3'
      }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/ops/jobs" class="flex items-center gap-2.5 min-w-0">
          <span class="shrink-0 grid place-items-center size-9 rounded-lg bg-white p-1.5">
            <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
          </span>
          <span v-if="!collapsed" class="min-w-0">
            <span class="block text-sm font-bold text-white leading-tight truncate">M&amp;P Freights</span>
            <span class="block text-[11px] text-[#F17421] font-semibold uppercase tracking-wide">Internal ops</span>
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          orientation="vertical"
          :items="items"
          :collapsed="collapsed"
          tooltip
          color="primary"
          variant="pill"
          :ui="{ separator: 'bg-white/10 my-1' }"
        />
      </template>

      <template #footer="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          :title="collapsed ? 'Back to doors' : undefined"
        >
          <UIcon name="i-lucide-arrow-left" class="size-5 shrink-0" />
          <span v-if="!collapsed">Back to doors</span>
        </NuxtLink>

        <div class="flex items-center gap-2 px-2.5 py-1.5 min-w-0">
          <span class="shrink-0 grid place-items-center size-7 rounded-full bg-[#F17421] text-white text-[11px] font-bold">S</span>
          <span v-if="!collapsed" class="min-w-0">
            <span class="block text-xs font-semibold text-white leading-tight truncate">Sarah</span>
            <span class="block text-[11px] text-white/50 leading-tight">Customer service</span>
          </span>
          <UDashboardSidebarCollapse v-if="!collapsed" class="ms-auto shrink-0" />
        </div>

        <UDashboardSidebarCollapse v-if="collapsed" class="mx-auto" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
