<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import {
  PORTAL_CLIENT,
  isToday,
  needsAction,
  sortPortalJobs,
  toPortalJobs,
  type PortalJob
} from '~/utils/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'My shipments — M&P client portal' })

/*
 * /api/shipments is the ops feed. The transform runs before Nuxt serialises the
 * payload, so only the customer-safe projection ever reaches the browser — no
 * WhatsApp threads, partner board, driver mobile or TradeNet key-in draft.
 */
const { data: jobs, status } = await useFetch('/api/shipments', {
  key: 'portal-my-shipments',
  transform: (rows): PortalJob[] => sortPortalJobs(toPortalJobs((rows ?? []) as unknown as Shipment[]))
})

const list = computed(() => jobs.value ?? [])
const active = computed(() => list.value.filter((j) => j.status !== 'delivered'))
const arrivingToday = computed(() => active.value.filter((j) => isToday(j.eta)))
const flagged = computed(() => list.value.filter(needsAction))
const delivered = computed(() => list.value.filter((j) => j.status === 'delivered'))
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">My shipments</h1>
        <p class="mt-1 text-sm text-zinc-500">
          {{ PORTAL_CLIENT.company }} — everything you have moving with M&amp;P.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton to="/portal/track" icon="i-lucide-search" color="neutral" variant="outline">Track by job id</UButton>
        <UButton to="/portal/quote" icon="i-lucide-calculator">Request a quote</UButton>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <PortalStatTile
        label="Active shipments"
        icon="i-lucide-ship"
        :value="active.length"
        hint="Booked through out for delivery"
      />
      <PortalStatTile
        label="Arriving today"
        icon="i-lucide-clock"
        :value="arrivingToday.length"
        :hint="arrivingToday.length ? arrivingToday.map((j) => j.id).join(' · ') : 'Nothing due today'"
      />
      <PortalStatTile
        label="Action needed"
        icon="i-lucide-circle-alert"
        :value="flagged.length"
        :tone="flagged.length ? 'alert' : 'neutral'"
        :hint="flagged.length ? 'Documents or sign-off waiting on you' : 'Nothing waiting on you'"
      />
    </div>

    <UAlert
      v-if="flagged.length"
      class="mt-5"
      color="primary"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="These need you first"
      :description="flagged.map((j) => `${j.id}: ${j.actions.join(', ')}`).join(' · ')"
    />

    <div v-if="status === 'pending'" class="mt-5 space-y-3">
      <USkeleton v-for="n in 3" :key="n" class="h-44 w-full rounded-xl" />
    </div>

    <div v-else class="mt-5 space-y-3">
      <PortalJobCard v-for="j in active" :key="j.id" :job="j" />

      <template v-if="delivered.length">
        <h2 class="!mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
          <UIcon name="i-lucide-package-check" class="size-4" />
          Delivered
          <span class="font-normal normal-case tracking-normal text-zinc-400">
            — proof of delivery and reviews on
            <NuxtLink to="/portal/pod" class="font-semibold text-primary-600 hover:underline">POD / review</NuxtLink>
          </span>
        </h2>
        <PortalJobCard v-for="j in delivered" :key="j.id" :job="j" />
      </template>

      <UCard v-if="!list.length">
        <p class="text-sm text-zinc-500">
          Nothing on this account yet. Have a job id? Track it on
          <NuxtLink to="/portal/track" class="font-semibold text-primary-600">Track</NuxtLink>.
        </p>
      </UCard>
    </div>
  </div>
</template>
