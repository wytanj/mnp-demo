<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Customs queue" icon="i-lucide-stamp" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Declarations waiting on documents or missing fields. <span class="text-zinc-400">(W3)</span></p>
    </template>
  </UDashboardPanel>
</template>
