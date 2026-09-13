<script setup lang="ts">
import {
  mailComposeTo,
  mailDeliveredTo,
  mailDirectionOf,
  mailFromOf,
  mailToOf,
  type OutboxEmail
} from '#shared/utils/shipping'

const props = defineProps<{ email: OutboxEmail }>()

const confirm = ref(false)

const fromAddr = computed(() => mailFromOf(props.email))
const toAddr = computed(() => mailToOf(props.email))
const composeTo = computed(() => mailComposeTo(props.email))
const deliveredTo = computed(() => mailDeliveredTo(props.email))
const inbound = computed(() => mailDirectionOf(props.email) === 'in')
const canCompose = computed(() => composeTo.value.includes('@'))

function mailtoHref(): string {
  const e = props.email
  const origin = typeof location !== 'undefined' ? location.origin : ''
  const subject = inbound.value && !/^re:/i.test(e.subject) ? `Re: ${e.subject}` : e.subject
  const quoted = inbound.value
    ? `\n\n--- original message from ${fromAddr.value} ---\n${e.body}`
    : `${e.body}${e.ctaLabel ? `\n\n${e.ctaLabel}: ${origin}${e.ctaUrl}` : ''}`
  return `mailto:${composeTo.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoted)}`
}

function label(): string {
  return inbound.value ? 'Reply in mail app' : 'Compose a copy in mail app'
}
</script>

<template>
  <div class="mail-addrs">
    <div class="mail-addr">
      <span class="k">From</span>
      <span class="v">{{ fromAddr }}</span>
    </div>
    <div class="mail-addr">
      <span class="k">To</span>
      <span class="v">{{ toAddr || '—' }}</span>
    </div>
    <div v-if="deliveredTo" class="mail-addr live">
      <span class="k">Resend delivered to</span>
      <span class="v">{{ deliveredTo }}</span>
      <span class="hint">Live API reroute — not the To address above</span>
    </div>
  </div>

  <div v-if="canCompose" class="mail-compose">
    <button v-if="!confirm" class="btn btn-outline" type="button" @click="confirm = true">
      {{ label }}…
    </button>
    <div v-else class="mail-confirm">
      <p>
        Opens <strong>your</strong> mail app as a new message to
        <strong>{{ composeTo }}</strong>.
      </p>
      <p class="muted">
        This does not go through Resend. Check From/To before you hit send — seed addresses can be live inboxes.
      </p>
      <div class="row">
        <a class="btn btn-outline" :href="mailtoHref()" @click="confirm = false">Open mail app → {{ composeTo }}</a>
        <button class="btn btn-ghost" type="button" @click="confirm = false">Cancel</button>
      </div>
    </div>
  </div>
</template>
