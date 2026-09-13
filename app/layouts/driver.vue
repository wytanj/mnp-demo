<!--
  Phone-first driver shell.

  The charcoal bar below is the ONLY header on the driver pages — W5 removed the
  legacy <TopBar> from `app/pages/driver/index.vue` and `app/pages/driver/[id].vue`
  when those pages opted into this layout, so there is no double header.
-->
<template>
  <div class="min-h-svh bg-zinc-100">
    <header class="bg-[#221F1F] text-white sticky top-0 z-20">
      <div class="mx-auto max-w-[480px] px-4 h-14 flex items-center gap-3">
        <NuxtLink to="/driver" class="flex items-center gap-2">
          <span class="grid place-items-center size-8 rounded-md bg-white p-1">
            <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
          </span>
          <span class="text-[11px] font-bold uppercase tracking-wide text-[#F17421]">Driver</span>
        </NuxtLink>
        <DemoHowTo page="driver" tone="dark" class="ms-auto" />
        <NuxtLink to="/" class="text-xs font-semibold text-white/60 hover:text-white">Doors</NuxtLink>
      </div>
    </header>
    <div class="mx-auto max-w-[480px]">
      <slot />
    </div>
  </div>
</template>
