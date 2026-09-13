<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Exceptions" icon="i-lucide-triangle-alert" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Stuck jobs, passed ETAs and anything that needs a person. <span class="text-zinc-400">(W3)</span></p>
    </template>
  </UDashboardPanel>
</template>
