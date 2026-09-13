<script setup lang="ts">
import {
  CUSTOMS_LABELS,
  customsDocs,
  customsReady,
  declarationGaps,
  type Shipment
} from '#shared/utils/shipping'

/**
 * Customs panel on the job detail page. TradeNet stays human-in-the-loop: this
 * records what an M&P customs officer did, it never files anything itself.
 */
const props = defineProps<{ shipment: Shipment }>()
const emit = defineEmits<{ refresh: [] }>()

const toast = useToast()

const s = computed(() => props.shipment)
const customs = computed(() => s.value.customs)
const gaps = computed(() => (customs.value ? declarationGaps(s.value) : []))
const ready = computed(() => customsReady(s.value))
const outstandingDocs = computed(() =>
  customsDocs(s.value).filter((d) => d.required && d.status !== 'approved' && d.status !== 'waived')
)

const OFFICERS = ['Joreen (M&P Customs)', 'Kelvin (M&P Customs)']
const officer = ref(OFFICERS[0]!)
const permitNo = ref('')
const busy = ref('')
const err = ref('')

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success'> = {
  docs_pending: 'warning',
  ready_for_declaration: 'info',
  declared: 'success',
  cleared: 'success'
}

async function post(body: Record<string, unknown>, tag: string, ok: string) {
  busy.value = tag
  err.value = ''
  try {
    await $fetch(`/api/shipments/${s.value.id}/customs`, { method: 'POST', body })
    toast.add({ title: ok, color: 'success', icon: 'i-lucide-stamp' })
    emit('refresh')
  } catch (e: unknown) {
    const anyErr = e as { data?: { statusMessage?: string }; statusMessage?: string }
    err.value = anyErr?.data?.statusMessage ?? anyErr?.statusMessage ?? 'Could not save — try again'
  } finally {
    busy.value = ''
  }
}

function markReady() {
  return post(
    { action: 'mark_ready', by: officer.value },
    'ready',
    'Marked ready — an M&P customs officer files it on TradeNet next.'
  )
}
function markDeclared() {
  return post(
    { action: 'mark_declared', by: officer.value, permitNo: permitNo.value.trim() },
    'declared',
    `Recorded: filed on TradeNet by ${officer.value}.`
  )
}
function markCleared() {
  return post({ action: 'mark_cleared', by: officer.value }, 'cleared', 'Customs cleared — clearance notice emailed.')
}

function when(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <UCard v-if="customs" :ui="{ header: 'p-4 sm:px-4', body: 'p-4 sm:p-4' }">
    <template #header>
      <div class="flex items-center gap-2 flex-wrap">
        <UIcon name="i-lucide-stamp" class="size-4 text-primary" />
        <h3 class="text-sm font-bold flex-1">Customs</h3>
        <UBadge :color="STATUS_COLOR[customs.status]" variant="subtle">
          {{ CUSTOMS_LABELS[customs.status] }}
        </UBadge>
      </div>
    </template>

    <UAlert
      v-if="err"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="err"
      class="mb-3"
    />

    <div v-if="customs.status === 'declared' || customs.status === 'cleared'" class="text-sm space-y-1">
      <p>
        Filed on TradeNet by <strong>{{ customs.declaredBy ?? '—' }}</strong>
        <template v-if="customs.declaredAt"> · {{ when(customs.declaredAt) }}</template>
      </p>
      <p v-if="customs.permitNo">
        Permit <UBadge color="success" variant="subtle">{{ customs.permitNo }}</UBadge>
      </p>
      <p v-if="customs.clearedAt" class="text-zinc-600">Cleared {{ when(customs.clearedAt) }}</p>
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-zinc-700">
        <template v-if="outstandingDocs.length">
          <strong>{{ outstandingDocs.length }}</strong>
          customs document{{ outstandingDocs.length === 1 ? '' : 's' }} still outstanding:
          {{ outstandingDocs.map((d) => d.label).join(', ') }}.
        </template>
        <template v-else>
          Documents checked — waiting for an M&amp;P customs officer to key the declaration into TradeNet.
        </template>
      </p>

      <div v-if="gaps.length">
        <div class="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5">
          Gaps before filing ({{ gaps.length }})
        </div>
        <div class="flex flex-wrap gap-1">
          <UBadge v-for="g in gaps" :key="g" color="warning" variant="subtle" size="sm">{{ g }}</UBadge>
        </div>
      </div>
      <p v-else class="text-sm text-green-700 font-semibold">
        <UIcon name="i-lucide-check-circle-2" class="size-4 align-[-2px]" /> No gaps left — ready to file.
      </p>
    </div>

    <USeparator class="my-4" />

    <div class="space-y-3">
      <UFormField label="M&P customs officer" size="sm">
        <USelect v-model="officer" :items="OFFICERS" class="w-full" />
      </UFormField>
      <UFormField
        v-if="customs.status === 'docs_pending' || customs.status === 'ready_for_declaration'"
        label="Permit no (typed in from TradeNet)"
        size="sm"
      >
        <UInput v-model="permitNo" placeholder="IN-2026-09-114721" class="w-full" />
      </UFormField>

      <div class="flex flex-wrap gap-2">
        <UButton
          :to="`/ops/customs/${s.id}`"
          color="primary"
          icon="i-lucide-file-pen-line"
          size="sm"
        >
          Open declaration form
        </UButton>
        <UTooltip :text="ready ? '' : 'All customs documents must be verified first'">
          <UButton
            v-if="customs.status === 'docs_pending'"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!ready"
            :loading="busy === 'ready'"
            @click="markReady()"
          >
            Mark ready
          </UButton>
        </UTooltip>
        <UTooltip :text="ready ? '' : 'All customs documents must be verified first'">
          <UButton
            v-if="customs.status === 'docs_pending' || customs.status === 'ready_for_declaration'"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!ready"
            :loading="busy === 'declared'"
            @click="markDeclared()"
          >
            Mark declared (manual)
          </UButton>
        </UTooltip>
        <UButton
          v-if="customs.status === 'declared'"
          color="primary"
          size="sm"
          :loading="busy === 'cleared'"
          @click="markCleared()"
        >
          Mark cleared
        </UButton>
      </div>

      <p class="text-[11px] text-zinc-500 leading-snug">
        M&amp;P checks the documents; an M&amp;P customs officer files on TradeNet and records the
        permit here. Nothing auto-files.
      </p>
    </div>
  </UCard>
</template>
