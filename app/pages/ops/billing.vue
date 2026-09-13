<script setup lang="ts">
definePageMeta({ layout: 'ops' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Billing / SOA" icon="i-lucide-receipt" />
    </template>

    <template #body>
      <p class="text-sm text-zinc-500">Coming up: Statements of account and outstanding balances. <span class="text-zinc-400">(W4)</span></p>
    </template>
  </UDashboardPanel>
</template>
