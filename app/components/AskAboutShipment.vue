<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'

/*
 * "Ask about this shipment" — the customer half of the job-tied inbox.
 * The question lands on the job itself: no ticket number, no Freshdesk.
 * The damage / missing chip additionally opens a claim so the review
 * programme suppresses its ask.
 */
const props = defineProps<{ shipment: Shipment }>()
const emit = defineEmits<{ refresh: [] }>()

type ClaimChoice = '' | 'damage' | 'missing'

const text = ref('')
const name = ref(props.shipment.customerName ?? '')
const email = ref(props.shipment.customerEmail ?? '')
const claimType = ref<ClaimChoice>('')
const busy = ref(false)
const sent = ref(false)
const err = ref('')
const box = ref<HTMLTextAreaElement>()

const jobId = computed(() => props.shipment.id)
const hasOpenClaim = computed(() => props.shipment.claim?.status === 'open')

const QUICK: Array<{ label: string; text: string; claim?: ClaimChoice }> = [
  { label: 'Where is my cargo?', text: 'Where is my cargo right now, and when should we expect it?' },
  { label: 'Change delivery time', text: 'Can we change the delivery slot? The time that works for us is ' },
  { label: 'Documents question', text: 'I have a question about the documents for this shipment: ' },
  { label: 'Report damage / missing item', text: 'I need to report a problem with this delivery: ', claim: 'damage' }
]

function pick(q: (typeof QUICK)[number]) {
  sent.value = false
  err.value = ''
  text.value = q.text
  claimType.value = q.claim ?? ''
  nextTick(() => {
    box.value?.focus()
    const end = box.value?.value.length ?? 0
    box.value?.setSelectionRange(end, end)
  })
}

const sentNote = computed(
  () =>
    `Sent — our CS team replies by email and it's logged on job ${jobId.value}. No ticket number needed.`
)

const sendLabel = 'Send to M&P'

const mailto = computed(
  () => `mailto:cs@mp.com.sg?subject=${encodeURIComponent(`${jobId.value} — question`)}`
)

async function send() {
  const body = text.value.trim()
  if (!body) {
    err.value = 'Please type your question first.'
    return
  }
  busy.value = true
  err.value = ''
  try {
    await $fetch(`/api/shipments/${jobId.value}/message`, {
      method: 'POST',
      body: {
        name: name.value.trim() || undefined,
        email: email.value.trim() || undefined,
        text: body
      }
    })
    if (claimType.value && !hasOpenClaim.value) {
      try {
        await $fetch(`/api/shipments/${jobId.value}/claim`, {
          method: 'POST',
          body: { action: 'open', type: claimType.value, note: body, by: 'customer' }
        })
      } catch {
        // A claim already open on the job is fine — the message still landed.
      }
    }
    sent.value = true
    text.value = ''
    claimType.value = ''
    emit('refresh')
  } catch (e: any) {
    err.value = e?.data?.statusMessage ?? 'Could not send just now — please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div id="ask" class="card trk-ask">
    <h2>Ask about this shipment</h2>
    <p class="sub">
      Your question goes straight onto job {{ jobId }} — the same thread our team works from.
    </p>

    <div class="trk-chips">
      <button
        v-for="q in QUICK"
        :key="q.label"
        type="button"
        class="trk-chip"
        :class="{ on: q.claim && claimType === q.claim }"
        @click="pick(q)"
      >{{ q.label }}</button>
    </div>

    <label class="field">
      <span>Your question</span>
      <textarea
        ref="box"
        v-model="text"
        rows="4"
        placeholder="e.g. Can the truck do the 2pm slot at Senoko tomorrow?"
      />
    </label>

    <div v-if="claimType" class="trk-claim-hint">
      <strong>This opens a claim with our CS team.</strong>
      <div class="trk-claim-pick">
        <label><input v-model="claimType" type="radio" value="damage" /> Damage</label>
        <label><input v-model="claimType" type="radio" value="missing" /> Missing item</label>
        <button type="button" class="btn btn-ghost trk-clear" @click="claimType = ''">Not a claim</button>
      </div>
      <p class="muted" v-if="hasOpenClaim">
        A claim is already open on this job — your message is added to it.
      </p>
    </div>

    <div class="trk-ask-who">
      <label class="field"><span>Your name</span>
        <input v-model="name" type="text" :placeholder="shipment.customerName" />
      </label>
      <label class="field"><span>Reply to</span>
        <input v-model="email" type="email" :placeholder="shipment.customerEmail" />
      </label>
    </div>

    <p v-if="err" class="trk-err">{{ err }}</p>

    <button class="btn btn-primary btn-lg" :disabled="busy" @click="send">
      {{ busy ? 'Sending…' : sendLabel }}
    </button>

    <p v-if="sent" class="trk-sent">✅ {{ sentNote }}</p>

    <p class="trk-fallback">
      Prefer to use your own email? Write to
      <a :href="mailto">cs@mp.com.sg</a> and quote job {{ jobId }}.
    </p>
  </div>
</template>

<style>
.trk-ask { border-color: #fbbf8f; }
.trk-ask h2 { font-size: 17px; }

.trk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.trk-chip {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 11px;
  border-radius: 999px;
  cursor: pointer;
}
.trk-chip:hover { background: var(--blue-soft); border-color: #fbbf8f; }
.trk-chip.on { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }

.trk-claim-hint {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 12px;
  font-size: 13px;
  color: #7f1d1d;
}
.trk-claim-pick { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px; font-weight: 600; }
.trk-claim-pick label { display: inline-flex; align-items: center; gap: 5px; }
.trk-claim-hint .trk-clear { padding: 2px 8px; font-size: 12px; }
.trk-claim-hint .muted { margin: 6px 0 0; }

.trk-ask-who { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
@media (max-width: 560px) { .trk-ask-who { grid-template-columns: 1fr; } }

.trk-err { color: #b91c1c; font-size: 13px; margin: 0 0 8px; }
.trk-sent {
  margin: 12px 0 0;
  background: var(--green-soft);
  color: #14532d;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
}
.trk-fallback { margin: 12px 0 0; font-size: 12.5px; color: var(--muted); }
.trk-fallback a { color: var(--blue); font-weight: 700; }
</style>
