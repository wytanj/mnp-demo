<script setup lang="ts">
import type { Shipment, ShipmentDocument } from '#shared/utils/shipping'

const props = defineProps<{ shipment: Shipment }>()
const emit = defineEmits<{ refresh: [] }>()

const fileInput = ref<HTMLInputElement>()
const activeKey = ref('')
const busy = ref(false)

const docs = computed(() => props.shipment.documents ?? [])
const doneCount = computed(() => docs.value.filter((d) => d.status === 'approved' || d.status === 'waived').length)

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
  <div class="card">
    <h2>
      Documents
      <span class="pill" :class="doneCount === docs.length ? 'pill-green' : 'pill-gray'">{{ doneCount }}/{{ docs.length }}</span>
    </h2>
    <p class="sub">Everything this shipment needs, in one place — no more chasing attachments by email.</p>

    <div v-for="d in docs" :key="d.key" class="doc-row" :class="deadlineClass(d)">
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
        <button v-if="d.status === 'pending'" class="btn btn-outline" :disabled="busy" @click="pickFile(d.key)">Upload</button>
        <button v-else-if="d.status === 'uploaded'" class="btn btn-success" :disabled="busy" @click="approve(d.key)">Verify ✓</button>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*,.pdf" style="display: none" @change="onFile" />
  </div>
</template>
