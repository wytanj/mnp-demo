<script setup lang="ts">
definePageMeta({ layout: 'ops' })

useHead({ title: 'Review rewards — M&P International Freights' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Rewards" icon="i-lucide-gift" />
    </template>

    <template #body>
      <main class="page wide" style="max-width: none; padding: 0">
        <RewardsDashboard />
      </main>
    </template>
  </UDashboardPanel>
</template>
