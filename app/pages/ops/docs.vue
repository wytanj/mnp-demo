<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Docs vault" icon="i-lucide-folder-open" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Every document we hold, by job. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
