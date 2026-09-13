<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Quotes" icon="i-lucide-file-text" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Rate cards and incoming quote requests. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
