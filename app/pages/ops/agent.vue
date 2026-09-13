<script setup lang="ts">
/**
 * Agent desk — the page the presenter drives during the live Claude / Grok
 * demo: is the MCP endpoint up, what can it do, what do I paste, and a local
 * runner so the tool output shows even if the room's assistant is flaky.
 */
definePageMeta({ layout: 'ops' })
useHead({ title: 'Agent desk — M&P ops' })

const toast = useToast()

/** Demo key — matches MCP_API_KEY's fallback in server/routes/mcp.post.ts. */
const DEMO_KEY = 'mp-demo-2481'

const origin = ref('https://mnp-flow.vercel.app')
onMounted(() => { origin.value = location.origin })
const endpoint = computed(() => `${origin.value}/mcp?key=${DEMO_KEY}`)

/** GET /mcp answers 405 + a JSON hint by design — that counts as reachable. */
const { data: probe, status: probeStatus, refresh: reprobe } = await useAsyncData(
  'mcp-probe',
  async () => {
    try {
      const res = await $fetch<any>('/mcp')
      return { ok: true, tools: res?.tools ?? [], transport: res?.transport ?? 'streamable-http' }
    } catch (e: any) {
      const data = e?.data
      if (data?.data?.tools || data?.tools) {
        return { ok: true, tools: data.tools ?? data.data.tools, transport: data.transport ?? 'streamable-http (POST only)' }
      }
      // 405 with a JSON hint is the healthy answer; anything else is genuinely down.
      return { ok: e?.statusCode === 405 || e?.status === 405, tools: [], transport: 'streamable-http (POST only)' }
    }
  },
  { default: () => ({ ok: false, tools: [] as string[], transport: '' }) }
)

const TOOL_DOCS: Array<{ name: string; what: string }> = [
  { name: 'list_shipments', what: 'Every job with status, route, client, ETA and document progress.' },
  { name: 'get_shipment', what: 'One job in full: timeline, documents, customs/TradeNet, claim, sign-off, review.' },
  { name: 'list_pending_actions', what: 'Everything outstanding across the book — documents, customs, claims, sign-offs, rewards.' },
  { name: 'list_customs_gaps', what: 'Exactly what is missing before an M&P officer can file on TradeNet.' },
  { name: 'list_open_comms', what: 'Email + WhatsApp threads still owed a reply, newest first.' },
  { name: 'list_partner_waits', what: 'Lines, CFS, brokers, agents and hauliers we are waiting on or blocked by.' },
  { name: 'list_exceptions', what: 'Stuck jobs, passed ETAs, customs gaps, open claims, unanswered threads.' },
  { name: 'send_email', what: 'Send a branded M&P email and log it on the job timeline.' },
  { name: 'send_whatsapp', what: 'Append a simulated WhatsApp message to the job thread and timeline.' },
  { name: 'draft_review_ask', what: 'Preview the review email for a job and the gate decision — drafts only, sends nothing.' },
  { name: 'hold_review_for_claim', what: 'Hold a review ask with a reason so an unhappy customer is never asked mid-complaint.' },
  { name: 'issue_reward', what: 'Issue the thank-you voucher its programme pays on a review and email the code to the customer.' },
  { name: 'review_programme_stats', what: 'Compare the three review programmes: asks, reviews, ask→review %, avg rating, vouchers, cost per review.' }
]

const PROMPTS = [
  {
    text: 'List every shipment M&P is handling right now and flag anything that needs a person.',
    tools: ['list_shipments', 'list_pending_actions']
  },
  {
    text: "What's outstanding on MP-3318-MC — documents, customs, partners, open messages?",
    tools: ['get_shipment']
  },
  {
    text: 'Which jobs have customs gaps and what exactly is missing before Joreen can file on TradeNet?',
    tools: ['list_customs_gaps']
  },
  {
    text: 'Show me open WhatsApp and email threads that still need a reply, newest first.',
    tools: ['list_open_comms']
  },
  {
    text: 'Draft a WhatsApp reply to Brendan on MP-3318-MC telling him what we still need, then send it.',
    tools: ['get_shipment', 'send_whatsapp']
  },
  {
    text: 'Draft the review request for MP-8102-AF and tell me whether we are allowed to send it.',
    tools: ['draft_review_ask']
  },
  {
    text: 'MP-8125-HF has a damage claim — hold its review request, then issue the thank-you voucher on MP-8110-AF.',
    tools: ['hold_review_for_claim', 'issue_reward']
  }
]

const SHORTCUTS = [
  'Ask about MP-4471-AF',
  'Ask about MP-3318-MC'
]

const curlSnippet = computed(() => `curl -s -X POST "${endpoint.value}" \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"list_customs_gaps","arguments":{}}}'`)

const connectTab = ref('claude')
const CONNECT_TABS = [
  { value: 'claude', label: 'Claude', icon: 'i-lucide-bot' },
  { value: 'grok', label: 'Grok Bot', icon: 'i-lucide-message-square-code' },
  { value: 'curl', label: 'curl', icon: 'i-lucide-terminal' }
]

async function copy(text: string, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: what, description: text.length > 70 ? `${text.slice(0, 70)}…` : text, color: 'success', icon: 'i-lucide-clipboard-check' })
  } catch {
    toast.add({ title: 'Could not copy', description: 'Select the text and copy manually.', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Agent desk" icon="i-lucide-bot">
        <template #right>
          <UBadge
            :label="probe.ok ? 'MCP reachable' : 'MCP unreachable'"
            :color="probe.ok ? 'success' : 'error'"
            variant="subtle"
            :icon="probe.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
          />
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :loading="probeStatus === 'pending'" @click="reprobe()" />
          <DemoHowTo page="ops-agent" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-4 xl:grid-cols-2 items-start">
        <!-- MCP STATUS -->
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-bold text-zinc-900">MCP status</h2>
              <p class="text-xs text-zinc-500 mt-0.5">
                One endpoint. Claude, Grok Bot or any MCP client reads the live job book through it —
                no export, no copy-paste.
              </p>
            </div>
            <UBadge :label="probe.transport || 'streamable-http'" color="neutral" variant="subtle" size="sm" class="shrink-0 font-mono" />
          </div>

          <div class="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <code class="flex-1 min-w-0 truncate font-mono text-xs text-zinc-700">{{ endpoint }}</code>
            <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="outline" label="Copy" @click="copy(endpoint, 'Endpoint copied')" />
          </div>
          <p class="mt-1.5 text-[11px] text-zinc-400">
            Key <code class="font-mono">{{ DEMO_KEY }}</code> — demo key, rotated before anything real goes on it.
          </p>

          <USeparator class="my-4" />

          <h3 class="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
            {{ TOOL_DOCS.length }} tools exposed
          </h3>
          <ul class="space-y-1.5">
            <li v-for="t in TOOL_DOCS" :key="t.name" class="flex gap-2 items-start">
              <UIcon name="i-lucide-wrench" class="size-3.5 text-zinc-300 mt-0.5 shrink-0" />
              <span class="min-w-0">
                <code class="font-mono text-xs font-semibold text-zinc-800">{{ t.name }}</code>
                <span class="block text-[11px] text-zinc-500 leading-snug">{{ t.what }}</span>
              </span>
            </li>
          </ul>
        </UCard>

        <!-- DEMO PROMPTS -->
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <h2 class="text-base font-bold text-zinc-900">Demo prompts</h2>
          <p class="text-xs text-zinc-500 mt-0.5">
            Say these out loud, or copy them into Claude / Grok. Every answer comes from the seeded job book.
          </p>

          <ol class="mt-3 space-y-2">
            <li
              v-for="(p, i) in PROMPTS"
              :key="i"
              class="rounded-lg border border-zinc-200 p-2.5 hover:border-primary-300 transition-colors"
            >
              <div class="flex items-start gap-2">
                <span class="shrink-0 grid place-items-center size-5 rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500 mt-0.5">
                  {{ i + 1 }}
                </span>
                <p class="min-w-0 flex-1 text-sm text-zinc-800 leading-snug">{{ p.text }}</p>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="shrink-0"
                  aria-label="Copy prompt"
                  @click="copy(p.text, 'Prompt copied')"
                />
              </div>
              <div class="mt-1.5 flex flex-wrap gap-1 ps-7">
                <UBadge
                  v-for="t in p.tools"
                  :key="t"
                  :label="t"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="font-mono text-[10px]"
                />
              </div>
            </li>
          </ol>

          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-for="s in SHORTCUTS"
              :key="s"
              :label="s"
              icon="i-lucide-clipboard-copy"
              size="xs"
              color="primary"
              variant="subtle"
              @click="copy(s, 'Shortcut copied')"
            />
          </div>
        </UCard>

        <!-- CONNECT -->
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <h2 class="text-base font-bold text-zinc-900">Connect</h2>
          <p class="text-xs text-zinc-500 mt-0.5 mb-3">Same URL for every client.</p>

          <UTabs
            v-model="connectTab"
            :items="CONNECT_TABS"
            :content="false"
            color="primary"
            variant="pill"
            size="xs"
            :ui="{ list: 'bg-zinc-100' }"
          />

          <div class="mt-3">
            <ol v-if="connectTab === 'claude'" class="space-y-1.5 text-sm text-zinc-700 list-decimal ps-5">
              <li>Open <span class="font-medium">claude.ai</span> → Settings → Connectors.</li>
              <li>Add custom connector.</li>
              <li>Paste the endpoint URL (key included) and save.</li>
              <li>Start a chat and use any demo prompt above.</li>
            </ol>

            <ol v-else-if="connectTab === 'grok'" class="space-y-1.5 text-sm text-zinc-700 list-decimal ps-5">
              <li>In Grok Bot, add a tool server / MCP connector.</li>
              <li>Paste the same endpoint URL — the key travels in the query string.</li>
              <li>Transport is streamable HTTP, POST only; there is no SSE stream to configure.</li>
              <li>Ask it "what's outstanding on MP-3318-MC?".</li>
            </ol>

            <div v-else class="rounded-lg border border-zinc-200 overflow-hidden">
              <div class="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border-b border-zinc-200">
                <UIcon name="i-lucide-terminal" class="size-3.5 text-zinc-400" />
                <span class="text-[11px] font-mono text-zinc-500">tools/call</span>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="ms-auto"
                  label="Copy"
                  @click="copy(curlSnippet, 'curl copied')"
                />
              </div>
              <pre class="p-3 text-[11px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words bg-white">{{ curlSnippet }}</pre>
            </div>
          </div>
        </UCard>

        <!-- LOCAL RUNNER -->
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <h2 class="text-base font-bold text-zinc-900">Try it here (demo)</h2>
          <p class="text-xs text-zinc-500 mt-0.5 mb-3">
            Same endpoint, called from this page — a safety net when the room's Wi-Fi or assistant is not cooperating.
          </p>
          <OpsAgentToolRunner :endpoint="`/mcp?key=${DEMO_KEY}`" />
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
