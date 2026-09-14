<script setup lang="ts">
definePageMeta({ layout: 'ops' })

// Old deep link — the review programme now lives under /ops.
await navigateTo('/ops/rewards', { replace: true })
</script>

<template>
  <UDashboardPanel>
    <template #body>
      <p class="text-sm text-zinc-500">Opening Review programme…</p>
    </template>
  </UDashboardPanel>
</template>
