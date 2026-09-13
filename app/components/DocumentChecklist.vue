<script setup lang="ts">
import { docsDone, type DocumentCategory, type Shipment, type ShipmentDocument } from '#shared/utils/shipping'

// customer mode: upload + view only. cs mode adds the Verify action.
const props = withDefaults(defineProps<{ shipment: Shipment; mode?: 'customer' | 'cs' }>(), {
  mode: 'customer'
})
const emit = defineEmits<{ refresh: [] }>()

const fileInput = ref<HTMLInputElement>()
const activeKey = ref('')
const busy = ref(false)

const docs = computed(() => props.shipment.documents ?? [])
const counts = computed(() => docsDone(props.shipment))
const isCs = computed(() => props.mode === 'cs')

const CATEGORY_ORDER: DocumentCategory[] = ['customs', 'commercial', 'delivery', 'payment']
const CATEGORY_COPY: Record<DocumentCategory, { title: string; hint: string }> = {
  customs: { title: 'Customs', hint: 'needed before M&P can declare on TradeNet' },
  commercial: { title: 'Commercial', hint: 'order paperwork' },
  delivery: { title: 'Delivery', hint: 'haulier, photos, POD' },
  payment: { title: 'Payment', hint: 'transfer slips, GST advice' }
}

/** CS reads the checklist by category — the customer just sees one list. */
const groups = computed(() => {
  if (!isCs.value) return [{ key: 'all' as const, title: '', hint: '', items: docs.value }]
  const out: Array<{ key: string; title: string; hint: string; items: ShipmentDocument[] }> = []
  for (const cat of CATEGORY_ORDER) {
    const items = docs.value.filter((d) => d.category === cat)
    if (items.length) out.push({ key: cat, ...CATEGORY_COPY[cat], items })
  }
  const rest = docs.value.filter((d) => !d.category || !CATEGORY_ORDER.includes(d.category))
  if (rest.length) out.push({ key: 'other', title: 'Other', hint: '', items: rest })
  return out
})

function pickFile(key: string) {
  activeKey.value = key
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !activeKey.value) return
  busy.value = true
  try {
    let dataUrl: string
    if (file.type.startsWith('image/')) {
      dataUrl = await compressImage(file)
    } else {
      if (file.size > 3_000_000) {
        alert('File too large for the demo (max 3 MB)')
        return
      }
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(file)
      })
    }
    await $fetch(`/api/shipments/${props.shipment.id}/documents`, {
      method: 'POST',
      body: { key: activeKey.value, action: 'upload', file: dataUrl, fileName: file.name }
    })
    emit('refresh')
  } finally {
    busy.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function approve(key: string) {
  busy.value = true
  try {
    await $fetch(`/api/shipments/${props.shipment.id}/documents`, {
      method: 'POST',
      body: { key, action: 'approve' }
    })
    emit('refresh')
  } finally {
    busy.value = false
  }
}

function deadlineClass(d: ShipmentDocument): string {
  if (!d.deadline || d.status === 'approved' || d.status === 'uploaded') return ''
  return new Date(d.deadline).getTime() - Date.now() < 48 * 3600_000 ? 'due-soon' : ''
}

function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const STATUS_PILLS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Needed', cls: 'pill-amber' },
  uploaded: { label: 'Awaiting review', cls: 'pill-blue' },
  approved: { label: 'Verified', cls: 'pill-green' },
  waived: { label: 'Waived', cls: 'pill-gray' }
}
</script>

<template>
  <div class="card doc-list" :class="{ 'doc-cs': isCs }">
    <h2>
      Documents
      <span class="pill" :class="counts.done === counts.total ? 'pill-green' : 'pill-amber'">
        {{ counts.done }}/{{ counts.total }}
      </span>
    </h2>
    <p class="sub">
      <template v-if="isCs">
        Verify what has come in. Customs documents must all be verified before an M&amp;P
        customs officer can file the declaration on TradeNet.
      </template>
      <template v-else>
        Everything this shipment needs, in one place — no more chasing attachments by email.
      </template>
    </p>

    <template v-for="g in groups" :key="g.key">
      <div v-if="g.title" class="doc-group">
        {{ g.title }} <span class="muted">{{ g.hint }}</span>
      </div>

      <div v-for="d in g.items" :key="d.key" class="doc-row" :class="deadlineClass(d)">
        <div class="doc-main">
          <div class="doc-label">
            {{ d.label }}
            <span v-if="!d.required" class="muted" style="font-weight: 400">(optional)</span>
          </div>
          <div class="doc-meta">
            <span class="pill" :class="STATUS_PILLS[d.status]?.cls">{{ STATUS_PILLS[d.status]?.label }}</span>
            <span v-if="d.deadline && d.status === 'pending'" class="deadline">due {{ fmtDeadline(d.deadline) }}</span>
            <span v-if="d.uploadedBy && d.status !== 'pending'" class="muted">by {{ d.uploadedBy }}</span>
          </div>
          <div v-if="d.note" class="qnote">{{ d.note }}</div>
        </div>
        <div class="doc-actions">
          <a v-if="d.file" :href="d.file" :download="d.fileName" class="btn btn-ghost">View</a>
          <template v-if="d.status === 'pending'">
            <button class="btn btn-outline" :disabled="busy" @click="pickFile(d.key)">Upload</button>
            <button
              v-if="isCs"
              class="btn btn-ghost doc-received"
              :disabled="busy"
              title="Received by email or WhatsApp — mark it checked without uploading"
              @click="approve(d.key)"
            >Received ✓</button>
          </template>
          <button
            v-else-if="d.status === 'uploaded' && isCs"
            class="btn btn-success"
            :disabled="busy"
            @click="approve(d.key)"
          >Verify ✓</button>
        </div>
      </div>
    </template>

    <p v-if="!docs.length" class="dash-empty">No documents needed on this job.</p>

    <input ref="fileInput" type="file" accept="image/*,.pdf" style="display: none" @change="onFile" />
  </div>
</template>

<style>
.doc-list .doc-group {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink);
  margin: 14px 0 2px;
}
.doc-list .doc-group:first-of-type { margin-top: 4px; }
.doc-list .doc-group .muted {
  font-size: 11px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}
.doc-list .doc-received { border: 1px solid var(--line); }
</style>
