<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import { fmtWhen, sortPortalJobs, toPortalJobs, type PortalJob } from '~/utils/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'POD / review — M&P client portal' })

const { data: jobs } = await useFetch('/api/portal/shipments', {
  key: 'portal-pod',
  transform: (rows): PortalJob[] => sortPortalJobs(toPortalJobs((rows ?? []) as unknown as Shipment[]))
})

const list = computed(() => jobs.value ?? [])
const awaiting = computed(() => list.value.filter((j) => j.status === 'out_for_delivery'))
const delivered = computed(() =>
  list.value
    .filter((j) => j.status === 'delivered')
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''))
)
const toReview = computed(() => delivered.value.filter((j) => j.reviewState === 'asked'))
const reviewed = computed(() => delivered.value.filter((j) => j.reviewState === 'received'))

const REVIEW_LABELS: Record<PortalJob['reviewState'], string> = {
  none: 'Not asked yet',
  asked: 'Review requested',
  held: 'With our CS team',
  received: 'Review received'
}
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">POD / review</h1>
        <p class="mt-1 text-sm text-zinc-500">
          Every signed delivery, the proof behind it, and where your feedback stands.
        </p>
      </div>
      <DemoHowTo page="portal-pod" />
    </div>

    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <PortalStatTile
        label="Awaiting sign-off"
        icon="i-lucide-pen-line"
        :value="awaiting.length"
        :tone="awaiting.length ? 'alert' : 'neutral'"
        hint="Sign on the tracking page when the driver arrives"
      />
      <PortalStatTile
        label="Proof of delivery"
        icon="i-lucide-file-check"
        :value="delivered.length"
        hint="Signature, name and time on every job"
      />
      <PortalStatTile
        label="Reviews to leave"
        icon="i-lucide-star"
        :value="toReview.length"
        :hint="reviewed.length ? `${reviewed.length} already sent — thank you` : 'We ask once, after delivery'"
      />
    </div>

    <template v-if="awaiting.length">
      <h2 class="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
        <UIcon name="i-lucide-truck" class="size-4" /> Out for delivery — sign on arrival
      </h2>
      <div class="mt-3 space-y-3">
        <UCard v-for="j in awaiting" :key="j.id" :ui="{ root: 'ring-primary-300 bg-primary-50/30', body: 'p-4 sm:p-5' }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-sm font-bold">{{ j.id }}</span>
            <UBadge color="warning" variant="subtle" size="sm">{{ j.statusLabel }}</UBadge>
            <span class="text-xs text-zinc-500">ETA {{ fmtWhen(j.eta) }}</span>
          </div>
          <p class="mt-1.5 text-sm font-semibold">{{ j.destination }}</p>
          <p class="text-xs text-zinc-500">
            {{ j.description }}<template v-if="j.recipient"> · for {{ j.recipient }}</template>
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton :to="`/track/${j.id}`" icon="i-lucide-pen-line" size="sm">Sign for delivery</UButton>
            <UButton :to="`/track/${j.id}`" icon="i-lucide-map-pin" size="sm" color="neutral" variant="outline">
              Track
            </UButton>
          </div>
          <p class="mt-2 text-xs text-zinc-500">
            The person receiving the cargo signs on the tracking page — no paper POD to chase afterwards.
          </p>
        </UCard>
      </div>
    </template>

    <h2 class="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
      <UIcon name="i-lucide-package-check" class="size-4" /> Delivered
    </h2>

    <div class="mt-3 space-y-3">
      <UCard v-for="j in delivered" :key="j.id" :ui="{ body: 'p-4 sm:p-5' }">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink :to="`/track/${j.id}`" class="font-mono text-sm font-bold hover:text-primary-600">
                {{ j.id }}
              </NuxtLink>
              <UBadge color="success" variant="subtle" size="sm" icon="i-lucide-check">Delivered</UBadge>
              <UBadge color="neutral" variant="outline" size="sm">{{ j.modeLabel }}</UBadge>
            </div>
            <p class="mt-1.5 text-sm font-semibold">{{ j.destination }}</p>
            <p class="text-xs text-zinc-500">
              {{ j.description }}<template v-if="j.recipient"> · for {{ j.recipient }}</template>
            </p>
            <p v-if="j.signoff" class="mt-2 text-xs text-zinc-600">
              <UIcon name="i-lucide-signature" class="me-1 inline-block size-3.5 align-[-2px] text-primary-500" />
              Signed by <strong>{{ j.signoff.name }}</strong> · {{ fmtWhen(j.signoff.at) }}
            </p>
            <p v-else-if="j.deliveredAt" class="mt-2 text-xs text-zinc-600">
              Delivered {{ fmtWhen(j.deliveredAt) }}
            </p>
          </div>

          <div class="sm:w-56 sm:shrink-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Review</p>
            <div v-if="j.reviewState === 'received'" class="mt-1">
              <div class="flex items-center gap-1 text-amber-500">
                <UIcon
                  v-for="n in 5"
                  :key="n"
                  :name="n <= (j.rating ?? 0) ? 'i-lucide-star' : 'i-lucide-star'"
                  class="size-4"
                  :class="n <= (j.rating ?? 0) ? '' : 'text-zinc-200'"
                />
                <span class="ms-1 text-xs font-semibold text-zinc-600">{{ j.rating }}/5</span>
              </div>
              <p v-if="j.reviewComment" class="mt-1 line-clamp-3 text-xs text-zinc-500">“{{ j.reviewComment }}”</p>
            </div>
            <p v-else class="mt-1 text-sm font-semibold">{{ REVIEW_LABELS[j.reviewState] }}</p>

            <div class="mt-3 flex flex-wrap gap-2">
              <UButton :to="`/track/${j.id}`" size="sm" color="neutral" variant="outline" icon="i-lucide-file-check">
                View POD
              </UButton>
              <UButton v-if="j.reviewState === 'asked'" :to="`/review/${j.id}`" size="sm" icon="i-lucide-star">
                Leave a review
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <UCard v-if="!delivered.length" :ui="{ body: 'p-5' }">
        <p class="text-sm text-zinc-500">Nothing delivered on this account yet.</p>
      </UCard>
    </div>
  </div>
</template>
