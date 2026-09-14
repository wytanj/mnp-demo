<script setup lang="ts">
import { fmtWhen, needsAction, statusColor, type PortalJob } from '~/utils/portal'

const props = defineProps<{ job: PortalJob }>()

const flagged = computed(() => needsAction(props.job))
const delivered = computed(() => props.job.status === 'delivered')
const canReview = computed(() => delivered.value && props.job.reviewState === 'asked')
const docsPct = computed(() =>
  props.job.docsTotal ? Math.round((props.job.docsDone / props.job.docsTotal) * 100) : 0
)
</script>

<template>
  <UCard
    :ui="{
      root: flagged ? 'ring-primary-300 bg-primary-50/30' : '',
      header: 'p-4 sm:px-5 sm:py-4',
      body: 'p-4 sm:px-5 sm:py-4',
      footer: 'p-3 sm:px-5 sm:py-3'
    }"
  >
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink
          :to="`/track/${job.id}`"
          class="font-mono text-sm font-bold tracking-tight hover:text-primary-600"
        >{{ job.id }}</NuxtLink>
        <UBadge :color="statusColor(job.status)" variant="subtle" size="sm">{{ job.statusLabel }}</UBadge>
        <UBadge color="neutral" variant="outline" size="sm">{{ job.modeLabel }}</UBadge>
        <UBadge
          v-if="flagged"
          color="primary"
          variant="solid"
          size="sm"
          icon="i-lucide-circle-alert"
          class="ms-auto"
        >Action needed</UBadge>
        <UBadge
          v-else-if="job.reviewState === 'received'"
          color="success"
          variant="subtle"
          size="sm"
          icon="i-lucide-star"
          class="ms-auto"
        >{{ job.rating }}/5 reviewed</UBadge>
      </div>
    </template>

    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-semibold">
      <span class="text-zinc-500">{{ job.origin }}</span>
      <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0 text-primary-500" />
      <span>{{ job.destination }}</span>
    </div>

    <p class="mt-1 text-xs text-zinc-500">
      {{ job.description }} · {{ job.pieces }} pcs · {{ job.weightKg }} kg
      <template v-if="job.recipient"> · for {{ job.recipient }}</template>
      <template v-if="job.poNumber"> · PO {{ job.poNumber }}</template>
    </p>

    <div class="mt-3">
      <PortalMiniSteps :step="job.stepIndex" />
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          {{ delivered ? 'Delivered' : 'ETA' }}
        </dt>
        <dd class="text-sm font-semibold">{{ fmtWhen(delivered && job.deliveredAt ? job.deliveredAt : job.eta) }}</dd>
      </div>
      <div v-if="job.docsTotal">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Documents</dt>
        <dd class="text-sm font-semibold">{{ job.docsDone }}/{{ job.docsTotal }}</dd>
        <UProgress :model-value="docsPct" size="xs" class="mt-1.5" />
      </div>
      <div v-if="job.customsLabel">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Customs</dt>
        <dd class="text-sm font-semibold">{{ job.customsLabel }}</dd>
      </div>
      <div v-if="job.signoff">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Signed by</dt>
        <dd class="text-sm font-semibold">{{ job.signoff.name }}</dd>
      </div>
    </dl>

    <ul v-if="flagged" class="mt-4 space-y-1.5 rounded-lg bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
      <li v-for="a in job.actions" :key="a" class="flex items-start gap-2">
        <UIcon name="i-lucide-arrow-right-circle" class="mt-0.5 size-4 shrink-0" />
        <span>{{ a }}</span>
      </li>
    </ul>

    <template #footer>
      <div class="flex flex-wrap gap-2">
        <UButton :to="`/track/${job.id}`" icon="i-lucide-map-pin" size="sm">Track</UButton>
        <UButton
          v-if="job.docsTotal"
          :to="`/track/${job.id}#docs`"
          icon="i-lucide-file-text"
          size="sm"
          color="neutral"
          variant="outline"
        >Documents</UButton>
        <UButton
          v-if="canReview"
          :to="`/review/${job.id}`"
          icon="i-lucide-star"
          size="sm"
          color="neutral"
          variant="outline"
        >Leave a review</UButton>
        <UButton
          v-if="job.status === 'out_for_delivery'"
          :to="`/track/${job.id}`"
          icon="i-lucide-pen-line"
          size="sm"
          color="neutral"
          variant="outline"
        >Sign for delivery</UButton>
      </div>
    </template>
  </UCard>
</template>
