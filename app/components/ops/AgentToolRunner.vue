<script setup lang="ts">
/**
 * "Try it here" — calls the same MCP endpoint Claude / Grok Bot would call,
 * straight from the browser, so the presenter can show tool output even if the
 * room's assistant is flaky.
 */
const props = defineProps<{ endpoint: string }>()

const TOOLS = [
  { value: 'list_pending_actions', label: 'list_pending_actions — everything outstanding' },
  { value: 'list_customs_gaps', label: 'list_customs_gaps — what blocks a TradeNet filing' },
  { value: 'list_open_comms', label: 'list_open_comms — threads owed a reply' },
  { value: 'list_partner_waits', label: 'list_partner_waits — who we are waiting on' },
  { value: 'list_exceptions', label: 'list_exceptions — what is going wrong now' },
  { value: 'list_shipments', label: 'list_shipments — the whole book' },
  { value: 'get_shipment', label: 'get_shipment — one job, in full' }
]

const tool = ref('list_customs_gaps')
const shipmentId = ref('MP-3318-MC')
const running = ref(false)
const output = ref('')
const failed = ref(false)

const needsId = computed(() => tool.value === 'get_shipment')

async function run() {
  running.value = true
  failed.value = false
  output.value = ''
  try {
    const res = await $fetch<any>(props.endpoint, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool.value,
          arguments: needsId.value ? { id: shipmentId.value.trim().toUpperCase() } : {}
        }
      }
    })
    const text = res?.result?.content?.[0]?.text
    output.value = text ?? JSON.stringify(res, null, 2)
    failed.value = !!res?.result?.isError || !!res?.error
  } catch (e: any) {
    failed.value = true
    output.value = `Request failed: ${e?.data?.statusMessage ?? e?.message ?? 'unknown error'}`
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col sm:flex-row gap-2">
      <USelect v-model="tool" :items="TOOLS" class="flex-1 min-w-0" size="sm" />
      <UInput
        v-if="needsId"
        v-model="shipmentId"
        size="sm"
        placeholder="MP-3318-MC"
        class="sm:w-44 font-mono"
      />
      <UButton
        icon="i-lucide-play"
        color="primary"
        size="sm"
        label="Run"
        :loading="running"
        class="shrink-0"
        @click="run"
      />
    </div>

    <div
      v-if="output"
      class="rounded-lg border overflow-hidden"
      :class="failed ? 'border-red-200' : 'border-zinc-200'"
    >
      <div
        class="px-3 py-1.5 text-[11px] font-mono border-b flex items-center gap-2"
        :class="failed ? 'bg-red-50 border-red-200 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500'"
      >
        <UIcon :name="failed ? 'i-lucide-circle-x' : 'i-lucide-terminal'" class="size-3.5" />
        tools/call · {{ tool }}
      </div>
      <pre class="p-3 text-[11px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words max-h-80 overflow-y-auto bg-white">{{ output }}</pre>
    </div>

    <p v-else class="text-xs text-zinc-400">
      Runs against <code class="font-mono">/mcp</code> with the demo key — the exact call an assistant makes.
    </p>
  </div>
</template>
