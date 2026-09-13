<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import {
  JOB_ID_RE,
  PORTAL_CLIENT,
  fmtWhen,
  normalizeJobId,
  sortPortalJobs,
  statusColor,
  toPortalJobs,
  type PortalJob
} from '~/utils/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Track a shipment — M&P client portal' })

const { data: jobs } = await useFetch('/api/shipments', {
  key: 'portal-track-chips',
  transform: (rows): PortalJob[] => sortPortalJobs(toPortalJobs((rows ?? []) as unknown as Shipment[]))
})

const raw = ref('')
const error = ref('')
const busy = ref(false)

const mine = computed(() => jobs.value ?? [])
const active = computed(() => mine.value.filter((j) => j.status !== 'delivered'))
const recent = computed(() => mine.value.filter((j) => j.status === 'delivered').slice(0, 4))

function go() {
  const id = normalizeJobId(raw.value)
  if (!id) {
    error.value = 'Enter the job id from your booking email, e.g. MP-4471-AF.'
    return
  }
  if (!JOB_ID_RE.test(id)) {
    error.value = `“${id}” doesn't look like an M&P job id. They read MP-4471-AF — four digits, then two letters.`
    return
  }
  error.value = ''
  busy.value = true
  navigateTo(`/track/${id}`)
}

function pick(id: string) {
  raw.value = id
  error.value = ''
  navigateTo(`/track/${id}`)
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Track a shipment</h1>
    <p class="mt-1 text-sm text-zinc-500">
      Live status, timeline, photos and documents — no login needed to share the link.
    </p>

    <UCard class="mt-5" :ui="{ body: 'p-5 sm:p-7' }">
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="go">
        <UInput
          v-model="raw"
          size="xl"
          class="flex-1"
          autofocus
          placeholder="Enter your M&P job id (e.g. MP-4471-AF)"
          icon="i-lucide-package-search"
          :ui="{ base: 'font-mono uppercase tracking-wide' }"
          aria-label="M&P job id"
          @input="error = ''"
        />
        <UButton type="submit" size="xl" icon="i-lucide-arrow-right" :loading="busy" class="justify-center sm:px-8">
          Go
        </UButton>
      </form>

      <p v-if="error" class="mt-3 flex items-start gap-2 text-sm font-medium text-red-600">
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" />
        <span>{{ error }}</span>
      </p>

      <div v-if="active.length" class="mt-6">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          {{ PORTAL_CLIENT.shortCompany }} — on the move now
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="j in active"
            :key="j.id"
            type="button"
            class="group flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 ps-3 pe-2 text-sm font-semibold transition-colors hover:border-primary-400 hover:bg-primary-50"
            @click="pick(j.id)"
          >
            <span class="font-mono">{{ j.id }}</span>
            <UBadge :color="statusColor(j.status)" variant="subtle" size="sm">{{ j.statusLabel }}</UBadge>
            <span class="hidden text-xs font-normal text-zinc-500 sm:inline">ETA {{ fmtWhen(j.eta) }}</span>
          </button>
        </div>
      </div>

      <div v-if="recent.length" class="mt-5">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Recently delivered</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="j in recent"
            :key="j.id"
            type="button"
            class="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-sm font-semibold text-zinc-600 transition-colors hover:border-primary-400 hover:text-zinc-900"
            @click="pick(j.id)"
          >{{ j.id }}</button>
        </div>
      </div>
    </UCard>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-zinc-200 bg-white p-4">
        <UIcon name="i-lucide-link" class="size-4 text-primary-500" />
        <p class="mt-2 text-sm font-semibold">One link per job</p>
        <p class="mt-0.5 text-xs text-zinc-500">Forward it to your warehouse or your buyer — no account needed.</p>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4">
        <UIcon name="i-lucide-message-square" class="size-4 text-primary-500" />
        <p class="mt-2 text-sm font-semibold">Ask on the job</p>
        <p class="mt-0.5 text-xs text-zinc-500">Questions land on the job itself — no ticket number to quote.</p>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4">
        <UIcon name="i-lucide-file-check" class="size-4 text-primary-500" />
        <p class="mt-2 text-sm font-semibold">Upload documents</p>
        <p class="mt-0.5 text-xs text-zinc-500">Invoice, packing list, transfer slip — straight onto the shipment.</p>
      </div>
    </div>
  </div>
</template>
