<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Reviews" icon="i-lucide-star" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Asked · received · suppressed, with the reason we held one back. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
