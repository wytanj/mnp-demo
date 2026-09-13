<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Inbox" icon="i-lucide-inbox" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Unified email + WhatsApp threads tied to their job. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
