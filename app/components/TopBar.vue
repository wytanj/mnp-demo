<script setup lang="ts">
defineProps<{ role?: string; nav?: 'cs' }>()
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <NuxtLink to="/" class="brand">
        <span class="brand-chip"><img src="/mp-logo.svg" alt="M&P International Freights" /></span>
      </NuxtLink>
      <nav v-if="nav === 'cs'" class="topbar-nav">
        <NuxtLink to="/">Operations</NuxtLink>
      </nav>
      <span v-if="role" class="role-tag">{{ role }}</span>
    </div>
  </header>
</template>
