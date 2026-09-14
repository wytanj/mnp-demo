<script setup lang="ts">
definePageMeta({ layout: 'ops' })

// /ops is just the door target — Jobs is the real ops home.
await navigateTo('/ops/jobs', { replace: true })
</script>

<template>
  <UDashboardPanel>
    <template #body>
      <p class="text-sm text-zinc-500">Opening Jobs…</p>
    </template>
  </UDashboardPanel>
</template>
