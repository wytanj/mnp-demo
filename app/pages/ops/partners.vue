<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Partners" icon="i-lucide-handshake" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Shipping line, warehouse, broker and agent status per job. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
