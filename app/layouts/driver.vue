<!--
  Phone-first driver shell.

  NOTE for W5: `app/pages/driver/index.vue` and `app/pages/driver/[id].vue` still
  render their own <TopBar>, so this layout is intentionally HEADER-LESS — opting
  those pages in with `definePageMeta({ layout: 'driver' })` will not produce a
  double header. If you drop the <TopBar> from the driver pages, uncomment the
  charcoal bar below (it is the same logo + "Driver" tag + back-to-doors link).
-->
<template>
  <div class="min-h-svh bg-zinc-100">
    <!--
    <header class="bg-[#221F1F] text-white">
      <div class="mx-auto max-w-[480px] px-4 h-14 flex items-center gap-3">
        <NuxtLink to="/driver" class="flex items-center gap-2">
          <span class="grid place-items-center size-8 rounded-md bg-white p-1">
            <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
          </span>
          <span class="text-[11px] font-bold uppercase tracking-wide text-[#F17421]">Driver</span>
        </NuxtLink>
        <NuxtLink to="/" class="ms-auto text-xs font-semibold text-white/60 hover:text-white">Doors</NuxtLink>
      </div>
    </header>
    -->
    <div class="mx-auto max-w-[480px]">
      <slot />
    </div>
  </div>
</template>
