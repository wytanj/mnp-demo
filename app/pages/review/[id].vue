<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'
import { programmeOf } from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

// Customer-facing page — customer-safe payload only.
const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/track/${id}`)

const rating = ref(0)
const hover = ref(0)
const comment = ref('')
const helpedBy = ref('')
const screenshot = ref('')
const platforms = ref<Array<'google' | 'facebook'>>([])
const busy = ref(false)
const submitError = ref('')

const jobId = computed(() => shipment.value?.id ?? id.toUpperCase())

/** What this job's review programme pays — not every programme pays Grab $10. */
const rewardValue = computed(() => {
  const s = shipment.value
  if (!s || typeof programmeOf !== 'function') return 'Grab $10'
  return programmeOf(s)?.reward?.value ?? 'Grab $10'
})

async function onScreenshot(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  screenshot.value = await compressImage(file)
}

async function submit() {
  if (!rating.value) {
    submitError.value = 'Please pick a star rating.'
    return
  }
  submitError.value = ''
  busy.value = true
  try {
    await $fetch(`/api/shipments/${jobId.value}/review`, {
      method: 'POST',
      body: {
        rating: rating.value,
        comment: comment.value.trim(),
        helpedBy: helpedBy.value.trim() || undefined,
        screenshot: screenshot.value || undefined,
        platforms: platforms.value.length ? platforms.value : undefined
      }
    })
    await refresh()
  } catch (e: any) {
    submitError.value = e?.data?.statusMessage ?? 'Could not submit review.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <TopBar role="Customer review" />
    <main class="page">
      <NuxtLink to="/portal" style="display:inline-block;margin-bottom:10px;font-size:13px;font-weight:700;color:var(--muted);text-decoration:none">&larr; My shipments</NuxtLink>
      <div v-if="error || !shipment" class="card">
        <h2>Shipment not found</h2>
        <p class="sub">
          Check the link, or email
          <a href="mailto:cs@mp.com.sg" style="color: var(--blue); font-weight: 700">cs@mp.com.sg</a>
          with the job number.
        </p>
      </div>

      <div v-else-if="shipment.review" class="card" style="text-align: center; padding: 36px 20px">
        <div style="font-size: 44px">🎉</div>
        <h2 style="font-size: 20px">Thanks for your feedback!</h2>
        <p class="sub">
          You rated shipment {{ shipment.id }}
          <strong style="color: #f59e0b">{{ '★'.repeat(shipment.review.rating) }}</strong>
        </p>
        <p v-if="shipment.review.comment" class="muted">"{{ shipment.review.comment }}"</p>
        <p v-if="shipment.review.helpedBy" class="muted">
          We've passed your shout-out to {{ shipment.review.helpedBy }}.
        </p>
        <div v-if="shipment.review.reward" class="rev-voucher">
          <div class="rev-voucher-emoji">🎁</div>
          <p class="rev-voucher-t">Thank you — here's a little something</p>
          <p class="rev-voucher-v">{{ shipment.review.reward.value ?? rewardValue }} voucher</p>
          <p class="rev-voucher-code">{{ shipment.review.reward.code }}</p>
          <p class="rev-voucher-note">We've emailed this to you too.</p>
        </div>
        <p v-else-if="shipment.review.screenshot" class="muted">
          📸 Proof received — voucher on its way once verified.
        </p>
        <NuxtLink class="btn btn-outline" :to="`/track/${shipment.id}`">Back to tracking</NuxtLink>
      </div>

      <div v-else class="card">
        <h2>How was your delivery?</h2>
        <p class="sub">
          Shipment {{ shipment.id }} · {{ shipment.origin }} → {{ shipment.destination }}
        </p>
        <div class="stars" style="margin: 8px 0 16px">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            :class="{ on: n <= (hover || rating) }"
            @mouseenter="hover = n"
            @mouseleave="hover = 0"
            @click="rating = n"
          >★</button>
        </div>
        <label class="field"><span>Anything we should know? (optional)</span>
          <textarea v-model="comment" rows="3" placeholder="Driver was friendly, cargo arrived in perfect condition…" />
        </label>

        <label class="field"><span>Who helped you? (driver or CS name — optional)</span>
          <input v-model="helpedBy" type="text" :placeholder="shipment.driverName" />
        </label>

        <div class="rev-proof">
          <p class="rev-proof-t">🎁 Left us a review on Google or Facebook?</p>
          <p class="rev-proof-s">
            Upload a screenshot — once M&amp;P verifies it we email a {{ rewardValue }} voucher.
          </p>
          <div class="rev-plats">
            <label><input v-model="platforms" type="checkbox" value="google" /> Google</label>
            <label><input v-model="platforms" type="checkbox" value="facebook" /> Facebook</label>
          </div>
          <input type="file" accept="image/*" @change="onScreenshot" />
        </div>

        <img v-if="screenshot" :src="screenshot" alt="Review screenshot" style="max-width: 220px; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 12px; display: block" />
        <p v-if="submitError" style="color: #b91c1c; font-size: 13px">{{ submitError }}</p>
        <button class="btn btn-primary btn-lg" :disabled="busy" @click="submit">
          {{ busy ? 'Sending…' : 'Submit review' }}
        </button>
      </div>
    </main>
  </div>
</template>

<style>
.rev-proof {
  border: 1px solid #fbbf8f;
  background: #fffdf9;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.rev-proof-t { margin: 0; font-size: 14px; font-weight: 700; }
.rev-proof-s { margin: 2px 0 10px; font-size: 13px; color: var(--muted); }
.rev-plats { display: flex; gap: 16px; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.rev-plats label { display: inline-flex; align-items: center; gap: 6px; }
.rev-voucher {
  border: 2px solid #fbbf8f;
  background: #fffaf3;
  border-radius: 14px;
  padding: 18px 16px;
  margin: 14px auto;
  max-width: 340px;
  text-align: center;
}
.rev-voucher-emoji { font-size: 30px; line-height: 1; }
.rev-voucher-t { margin: 6px 0 2px; font-size: 15px; font-weight: 800; }
.rev-voucher-v { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #b45309; }
.rev-voucher-code {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #7c2d12;
}
.rev-voucher-note { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
</style>
