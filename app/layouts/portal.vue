<script setup lang="ts">
const links = [
  { label: 'My shipments', to: '/portal' },
  { label: 'Track', to: '/portal/track' },
  { label: 'Request quote', to: '/portal/quote' },
  { label: 'POD / review', to: '/portal/pod' }
]
</script>

<template>
  <div class="min-h-svh flex flex-col bg-zinc-50 text-zinc-900">
    <header class="bg-white border-b border-zinc-200 sticky top-0 z-20">
      <div class="mx-auto w-full max-w-[1100px] px-4 sm:px-6 h-16 flex items-center gap-4">
        <NuxtLink to="/portal" class="flex items-center gap-2.5 shrink-0">
          <span class="grid place-items-center size-9 rounded-lg bg-[#221F1F] p-1.5">
            <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
          </span>
          <span class="hidden sm:block leading-tight">
            <span class="block text-sm font-bold">M&amp;P Freights</span>
            <span class="block text-[11px] font-semibold uppercase tracking-wide text-[#F17421]">Client portal</span>
          </span>
        </NuxtLink>

        <nav class="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            active-class="!bg-[#FDEADD] !text-[#B34E12]"
          >{{ l.label }}</NuxtLink>
        </nav>

        <div class="ms-auto hidden md:flex items-center gap-2 shrink-0 rounded-full bg-zinc-100 ps-1 pe-3 py-1">
          <span class="grid place-items-center size-7 rounded-full bg-[#F17421] text-white text-[11px] font-bold">MT</span>
          <span class="text-xs leading-tight">
            <span class="block font-semibold">Melissa Tan</span>
            <span class="block text-zinc-500">Allmighty Foods</span>
          </span>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full">
      <UContainer class="!max-w-[1100px] py-6 sm:py-8">
        <slot />
      </UContainer>
    </main>

    <footer class="border-t border-zinc-200 bg-white">
      <div class="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>M&amp;P International Freights — client portal demo</span>
        <NuxtLink to="/" class="font-semibold text-zinc-600 hover:text-[#F17421]">← Back to doors</NuxtLink>
      </div>
    </footer>
  </div>
</template>
