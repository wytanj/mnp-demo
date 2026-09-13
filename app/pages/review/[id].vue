<script setup lang="ts">
import type { Shipment } from '#shared/utils/shipping'

const route = useRoute()
const id = route.params.id as string

const { data: shipment, refresh, error } = await useFetch<Shipment>(`/api/shipments/${id}`)

const rating = ref(0)
const hover = ref(0)
const comment = ref('')
const screenshot = ref('')
const busy = ref(false)
const submitError = ref('')

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
    await $fetch(`/api/shipments/${id}/review`, {
      method: 'POST',
      body: { rating: rating.value, comment: comment.value.trim(), screenshot: screenshot.value || undefined }
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
      <div v-if="error || !shipment" class="card">
        <h2>Shipment not found</h2>
      </div>

      <div v-else-if="shipment.review" class="card" style="text-align: center; padding: 36px 20px">
        <div style="font-size: 44px">🎉</div>
        <h2 style="font-size: 20px">Thanks for your feedback!</h2>
        <p class="sub">
          You rated shipment {{ shipment.id }}
          <strong style="color: #f59e0b">{{ '★'.repeat(shipment.review.rating) }}</strong>
        </p>
        <p v-if="shipment.review.comment" class="muted">"{{ shipment.review.comment }}"</p>
        <p v-if="shipment.review.reward" style="font-weight: 700">
          🎁 Your reward code: <span style="color: var(--blue)">{{ shipment.review.reward.code }}</span>
        </p>
        <p v-else-if="shipment.review.screenshot" class="muted">
          📸 Screenshot received — we'll email your reward code once it's verified.
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
        <label class="field">
          <span>🎁 Left us a public review? Upload a screenshot to claim a reward code</span>
          <input type="file" accept="image/*" @change="onScreenshot" />
        </label>
        <img v-if="screenshot" :src="screenshot" alt="Review screenshot" style="max-width: 220px; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 12px; display: block" />
        <p v-if="submitError" style="color: #b91c1c; font-size: 13px">{{ submitError }}</p>
        <button class="btn btn-primary btn-lg" :disabled="busy" @click="submit">
          {{ busy ? 'Sending…' : 'Submit review' }}
        </button>
      </div>
    </main>
  </div>
</template>
