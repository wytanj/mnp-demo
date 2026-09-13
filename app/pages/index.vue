<script setup lang="ts">
useHead({ title: 'M&P International Freights — demo' })

const doors = [
  {
    label: 'Internal ops',
    to: '/ops',
    icon: 'i-lucide-layout-dashboard',
    sub: 'Jobs · inbox · customs · partners · reviews'
  },
  {
    label: 'Client portal',
    to: '/portal',
    icon: 'i-lucide-package-search',
    sub: 'My shipments · track · quote · POD'
  },
  {
    label: 'Driver',
    to: '/driver',
    icon: 'i-lucide-truck',
    sub: "Today's jobs · photo · delivered"
  }
]
</script>

<template>
  <div class="min-h-svh bg-[#221F1F] text-white flex flex-col">
    <header class="px-6 sm:px-10 pt-7 pb-2 flex items-center gap-3">
      <span class="grid place-items-center size-10 rounded-lg bg-white p-1.5 shrink-0">
        <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
      </span>
      <span class="leading-tight">
        <span class="block text-sm font-bold tracking-tight">M&amp;P International Freights</span>
        <span class="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F17421]">Tuesday live demo</span>
      </span>
    </header>

    <main class="flex-1 flex items-center px-6 sm:px-10 py-10">
      <div class="w-full max-w-6xl mx-auto grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-3">
        <NuxtLink
          v-for="d in doors"
          :key="d.to"
          :to="d.to"
          class="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7 md:min-h-[220px] transition-all duration-150 hover:bg-white/[0.08] hover:border-[#F17421]/60 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F17421] focus-visible:ring-offset-2 focus-visible:ring-offset-[#221F1F]"
        >
          <span class="grid place-items-center size-12 rounded-xl bg-[#F17421]/15 text-[#F17421] group-hover:bg-[#F17421] group-hover:text-white transition-colors">
            <UIcon :name="d.icon" class="size-6" />
          </span>

          <span class="mt-8 md:mt-10 block">
            <span class="flex items-center gap-2 text-2xl font-bold tracking-tight">
              {{ d.label }}
              <UIcon
                name="i-lucide-arrow-right"
                class="size-5 text-[#F17421] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
              />
            </span>
            <span class="mt-1.5 block text-sm text-white/55">{{ d.sub }}</span>
          </span>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
