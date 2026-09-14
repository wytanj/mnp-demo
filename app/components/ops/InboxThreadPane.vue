<script setup lang="ts">
import { STATUS_LABELS, declarationGaps, type CommsThread, type Shipment } from '#shared/utils/shipping'

/**
 * Right pane of the ops inbox. WhatsApp renders as a chat, email as stacked
 * mail cards. The reply box is simulated (pitch mode) and POSTs to
 * /api/comms/reply, which logs the send on the job's timeline.
 */
const props = defineProps<{ thread: CommsThread | null }>()
const emit = defineEmits<{ sent: [thread: CommsThread | null]; back: [] }>()

const toast = useToast()
const draft = ref('')
const sending = ref(false)
const drafting = ref(false)
const scroller = useTemplateRef<HTMLElement>('scroller')

const now = useState<number>('ops-now', () => Date.now())

const isWa = computed(() => props.thread?.channel === 'whatsapp')
const canReply = computed(() => !!props.thread?.shipmentId)

const STATUS_META: Record<string, { label: string; color: 'warning' | 'info' | 'neutral' }> = {
  needs_reply: { label: 'Needs reply', color: 'warning' },
  waiting_on_them: { label: 'Waiting on them', color: 'info' },
  closed: { label: 'Closed', color: 'neutral' }
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  })
}

function relTime(iso?: string): string {
  if (!iso) return ''
  const mins = Math.round((now.value - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
}

watch(() => props.thread?.id, async () => {
  draft.value = ''
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})

onMounted(async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})

/* ── "AI" draft: a templated reply built from the thread + the job it sits on ── */

function firstName(full: string): string {
  return (full.split(/[\s(]/)[0] ?? full).trim()
}

function intentOf(text: string): 'customs' | 'delivery' | 'claim' | 'general' {
  const t = text.toLowerCase()
  if (/customs|permit|declar|hs code|invoice|packing|uen|tradenet|duty|gst/.test(t)) return 'customs'
  if (/damage|dented|broken|crushed|claim|missing/.test(t)) return 'claim'
  if (/deliver|eta|arriv|when|slot|timing|time|unstuff|collect|driver|home/.test(t)) return 'delivery'
  return 'general'
}

async function aiDraft() {
  const t = props.thread
  if (!t) return
  drafting.value = true
  try {
    let s: Shipment | null = null
    if (t.shipmentId) {
      s = await $fetch<Shipment>(`/api/shipments/${t.shipmentId}`).catch(() => null)
    }
    const lastIn = [...t.messages].reverse().find((m) => m.direction === 'in') ?? t.messages[t.messages.length - 1]
    const intent = intentOf(lastIn?.body ?? '')
    const hi = `Hi ${firstName(t.contactName)},`
    const sign = isWa.value ? '\n\n— Sarah, M&P CS' : '\n\nThank you,\nSarah\nCustomer Service · M&P International Freights'
    const eta = s?.eta ? new Date(s.eta).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : null
    const gaps = s ? declarationGaps(s) : []

    let body: string
    if (intent === 'customs') {
      body = gaps.length
        ? `${hi}\n\nThanks for chasing this. Before our customs officer can file the declaration on TradeNet for ${t.shipmentId}, we still need:\n\n${gaps.map((g) => `• ${g}`).join('\n')}\n\nOnce those are in, Joreen files the same day and I'll send you the permit number.`
        : `${hi}\n\nThanks for chasing this. Nothing is outstanding from your side on ${t.shipmentId} — our customs officer has everything needed and the declaration is going in on TradeNet. I'm sending the paperwork you asked for across now, and I'll follow up with the permit number once it's back.`
    } else if (intent === 'delivery') {
      body = `${hi}\n\nQuick update on ${t.shipmentId}: it is currently ${s ? STATUS_LABELS[s.status].toLowerCase() : 'in progress'}${eta ? `, ETA ${eta}` : ''}.${s?.driverName ? ` ${s.driverName} is on the run and will call ahead before arriving.` : ''}\n\nHappy to hold the slot if that timing does not work — just tell me the window that suits and I'll rebook it.`
    } else if (intent === 'claim') {
      body = `${hi}\n\nSorry about this — I've logged it on ${t.shipmentId} and our claims team is on it. We're pulling the delivery photos and the bay CCTV clip now.\n\nI'll come back to you with an outcome within one working day; no action needed from your side in the meantime.`
    } else {
      body = `${hi}\n\nThanks for your message on ${t.shipmentId}.${s ? ` The job is ${STATUS_LABELS[s.status].toLowerCase()}${eta ? ` with ETA ${eta}` : ''}.` : ''}\n\nYou can follow it live here: ${t.shipmentId ? `/track/${t.shipmentId}` : ''} — and I'll keep you posted on anything that changes.`
    }
    draft.value = `${body}${sign}`
  } finally {
    drafting.value = false
  }
}

async function send() {
  const t = props.thread
  const text = draft.value.trim()
  if (!t || !t.shipmentId || !text) return
  sending.value = true
  try {
    const res = await $fetch<{ ok: boolean; thread: CommsThread | null }>('/api/comms/reply', {
      method: 'POST',
      body: {
        threadId: t.id,
        channel: t.channel,
        shipmentId: t.shipmentId,
        to: t.contactHandle,
        body: text
      }
    })
    draft.value = ''
    emit('sent', res.thread)
    toast.add({
      title: t.channel === 'whatsapp' ? 'WhatsApp sent (simulated)' : 'Email sent (simulated)',
      description: `Logged on ${t.shipmentId}`,
      color: 'success',
      icon: t.channel === 'whatsapp' ? 'i-lucide-message-circle' : 'i-lucide-mail'
    })
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  } catch (e: any) {
    toast.add({ title: 'Could not send', description: e?.data?.statusMessage ?? 'Try again', color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="!thread" class="h-full grid place-items-center p-8 text-center">
    <div>
      <UIcon name="i-lucide-mails" class="size-10 text-zinc-300" />
      <p class="mt-3 text-sm font-medium text-zinc-600">Pick a conversation</p>
      <p class="text-xs text-zinc-400 max-w-xs mt-1">
        Email and WhatsApp land in the same list, each one attached to the job it belongs to.
      </p>
    </div>
  </div>

  <div v-else class="flex flex-col h-full min-h-0">
    <!-- header -->
    <div class="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 flex items-start gap-3">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        class="lg:hidden -ms-1"
        aria-label="Back to list"
        @click="emit('back')"
      />
      <span
        class="shrink-0 grid place-items-center size-10"
        :class="isWa ? 'rounded-full bg-[#25D366] text-white' : 'rounded-lg bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200'"
      >
        <UIcon :name="isWa ? 'i-lucide-message-circle' : 'i-lucide-mail'" class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-sm font-semibold text-zinc-900 truncate">{{ thread.contactName }}</h2>
          <UBadge
            :label="STATUS_META[thread.status]?.label ?? thread.status"
            :color="STATUS_META[thread.status]?.color ?? 'neutral'"
            variant="subtle"
            size="sm"
          />
          <UBadge
            :label="isWa ? 'WhatsApp' : 'Email'"
            color="neutral"
            variant="subtle"
            size="sm"
            :class="isWa ? 'text-[#128C4A]' : ''"
          />
        </div>
        <p class="text-xs text-zinc-500 truncate mt-0.5">
          {{ thread.contactHandle }}
          <span v-if="thread.contactRole" class="text-zinc-400">· {{ thread.contactRole.replace(/_/g, ' ') }}</span>
        </p>
      </div>

      <UButton
        v-if="thread.shipmentId"
        :to="`/ops/jobs/${thread.shipmentId}`"
        :label="thread.shipmentId"
        icon="i-lucide-package"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0 font-mono"
      />
      <UBadge v-else label="Not on a job" color="neutral" variant="subtle" size="sm" class="shrink-0" />
    </div>

    <!-- messages -->
    <div
      ref="scroller"
      class="flex-1 min-h-0 overflow-y-auto px-4 py-4"
      :class="isWa ? 'bg-[#ece5dd]' : 'bg-zinc-50'"
    >
      <!-- WhatsApp: chat bubbles -->
      <template v-if="isWa">
        <div class="mx-auto max-w-2xl space-y-2">
          <div
            v-for="m in thread.messages"
            :key="m.id"
            class="flex"
            :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[78%] rounded-xl px-3 py-2 shadow-sm text-sm leading-relaxed"
              :class="m.direction === 'out' ? 'bg-[#d9fdd3] text-zinc-900' : 'bg-white text-zinc-900'"
            >
              <p v-if="m.direction === 'in'" class="text-[11px] font-semibold text-[#128C4A] mb-0.5">{{ m.from }}</p>
              <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
              <a
                v-if="m.attachment"
                class="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-1 text-[11px] font-medium text-zinc-700"
              >
                <UIcon :name="m.attachment.kind === 'image' ? 'i-lucide-image' : 'i-lucide-file-text'" class="size-3.5" />
                {{ m.attachment.name }}
              </a>
              <p class="mt-0.5 text-[10px] text-zinc-500 text-end">
                {{ stamp(m.at) }}
                <UIcon v-if="m.direction === 'out'" name="i-lucide-check-check" class="size-3 text-sky-600 align-[-2px]" />
              </p>
            </div>
          </div>
        </div>
      </template>

      <!-- Email: stacked mail cards -->
      <template v-else>
        <div class="mx-auto max-w-3xl space-y-3">
          <div
            v-for="m in thread.messages"
            :key="m.id"
            class="rounded-lg border bg-white shadow-sm overflow-hidden"
            :class="m.direction === 'in' ? 'border-zinc-200' : 'border-primary-200'"
          >
            <div
              class="px-4 py-2.5 border-b flex items-center gap-2 flex-wrap"
              :class="m.direction === 'in' ? 'bg-zinc-50 border-zinc-200' : 'bg-primary-50/60 border-primary-100'"
            >
              <UIcon
                :name="m.direction === 'in' ? 'i-lucide-corner-down-left' : 'i-lucide-send'"
                class="size-4 shrink-0"
                :class="m.direction === 'in' ? 'text-zinc-400' : 'text-primary-500'"
              />
              <span class="text-xs font-semibold text-zinc-800">{{ m.from }}</span>
              <span class="text-[11px] text-zinc-400">
                {{ m.direction === 'in' ? `to cs@mp.com.sg` : `to ${thread.contactHandle}` }}
              </span>
              <span class="ms-auto text-[11px] text-zinc-400">{{ stamp(m.at) }}</span>
            </div>
            <div class="px-4 py-3">
              <p class="text-sm font-semibold text-zinc-900 mb-1.5">{{ thread.subject }}</p>
              <p class="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{{ m.body }}</p>
              <span
                v-if="m.attachment"
                class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600"
              >
                <UIcon :name="m.attachment.kind === 'image' ? 'i-lucide-image' : 'i-lucide-file-text'" class="size-3.5" />
                {{ m.attachment.name }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- reply box -->
    <div class="shrink-0 border-t border-zinc-200 bg-white p-3">
      <template v-if="canReply">
        <UTextarea
          v-model="draft"
          :rows="3"
          autoresize
          :maxrows="8"
          class="w-full"
          :placeholder="isWa ? `Reply to ${thread.contactName} on WhatsApp…` : `Reply to ${thread.contactHandle}…`"
        />
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <UButton
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="drafting"
            label="Draft with AI (demo)"
            @click="aiDraft"
          />
          <span class="text-[11px] text-zinc-400 hidden sm:inline">
            Last inbound {{ relTime(thread.messages[thread.messages.length - 1]?.at) }}
          </span>
          <UButton
            v-if="isWa"
            class="ms-auto text-white hover:opacity-90"
            :style="{ backgroundColor: '#25D366' }"
            icon="i-lucide-message-circle"
            size="sm"
            :loading="sending"
            :disabled="!draft.trim()"
            label="Send via WhatsApp (demo)"
            @click="send"
          />
          <UButton
            v-else
            class="ms-auto"
            color="primary"
            icon="i-lucide-send"
            size="sm"
            :loading="sending"
            :disabled="!draft.trim()"
            label="Send email (demo)"
            @click="send"
          />
        </div>
      </template>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="Not attached to a job"
        description="Newsletters and cold vendor mail stay read-only — attach it to a job first if it turns out to matter."
        :ui="{ title: 'text-xs font-semibold', description: 'text-xs' }"
      />
    </div>
  </div>
</template>
