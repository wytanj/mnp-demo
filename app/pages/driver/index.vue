<script setup lang="ts">
import { STATUS_LABELS, type ShipmentStatus } from '#shared/utils/shipping'

interface DriverJob {
  id: string
  status: ShipmentStatus
  origin: string
  destination: string
  eta: string
  vehicle: string
  description: string
  pieces: number
  weightKg: number
  signedOff: boolean
}

const phone = ref('')
const driverName = ref('')
const jobs = ref<DriverJob[]>([])
const busy = ref(false)
const loginError = ref('')

async function login() {
  const digits = phone.value.replace(/\D/g, '')
  if (digits.length < 8) {
    loginError.value = 'Enter your 8-digit mobile number.'
    return
  }
  loginError.value = ''
  busy.value = true
  try {
    const res = await $fetch<{ driverName: string; jobs: DriverJob[] }>(`/api/driver/${digits}`)
    driverName.value = res.driverName
    jobs.value = res.jobs
    localStorage.setItem('mp-driver-phone', digits)
  } catch (e: any) {
    loginError.value = e?.data?.statusMessage ?? 'No jobs found for this number.'
  } finally {
    busy.value = false
  }
}

function logout() {
  localStorage.removeItem('mp-driver-phone')
  driverName.value = ''
  jobs.value = []
  phone.value = ''
}

onMounted(() => {
  const saved = localStorage.getItem('mp-driver-phone')
  if (saved) {
    phone.value = saved
    login()
  }
})

function pillClass(status: ShipmentStatus): string {
  if (status === 'delivered') return 'pill-green'
  if (status === 'out_for_delivery') return 'pill-amber'
  return 'pill-blue'
}

function fmtEta(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div>
    <TopBar role="Driver portal" />
    <main class="page">
      <div v-if="!driverName" class="card login-card">
        <div class="login-emoji">🚚</div>
        <h2 class="login-title">Driver login</h2>
        <p class="sub" style="text-align: center">No password, no app store — just your mobile number.</p>
        <form @submit.prevent="login">
          <input
            v-model="phone"
            class="phone-input"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="9123 4567"
            autofocus
            aria-label="Mobile number"
          />
          <p v-if="loginError" class="login-error">{{ loginError }}</p>
          <button class="btn btn-primary login-btn" type="submit" :disabled="busy">
            {{ busy ? 'Checking…' : 'View my jobs' }}
          </button>
        </form>
        <hr class="divider" />
        <p class="muted" style="margin: 0; text-align: center; font-size: 12px">
          Demo drivers: Hafiz <strong>9123 4567</strong> · Suresh <strong>9234 5678</strong> · Azlan <strong>9345 6789</strong>
        </p>
      </div>

      <template v-else>
        <div class="hero-status">
          <div class="eyebrow">Driver portal</div>
          <div class="big">Hi, {{ driverName }} 👋</div>
          <div class="eta">{{ jobs.length }} job{{ jobs.length === 1 ? '' : 's' }} assigned to you</div>
        </div>

        <NuxtLink v-for="j in jobs" :key="j.id" :to="`/driver/${j.id}`" class="card job-card">
          <div class="row spread">
            <span class="id" style="font-weight: 700">{{ j.id }}</span>
            <span class="pill" :class="pillClass(j.status)">{{ STATUS_LABELS[j.status] }}</span>
          </div>
          <div style="font-size: 14px; margin-top: 6px">{{ j.origin }} → <strong>{{ j.destination }}</strong></div>
          <div class="muted">{{ j.description }} · {{ j.pieces }} pcs · {{ j.weightKg }} kg</div>
          <div class="muted">ETA {{ fmtEta(j.eta) }} · {{ j.vehicle }}</div>
          <div class="row spread" style="margin-top: 10px">
            <span v-if="j.signedOff" class="pill pill-green">✅ Signed off</span>
            <span v-else class="muted">Tap to post updates →</span>
          </div>
        </NuxtLink>

        <button class="btn btn-ghost" @click="logout">Log out</button>
      </template>
    </main>
  </div>
</template>

<style scoped>
.job-card {
  display: block;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
  padding: 20px 18px;
}
.job-card:hover, .job-card:active { border-color: var(--blue); }

.login-card {
  max-width: 440px;
  margin: 8vh auto 16px;
  padding: 28px 22px;
}
.login-emoji { font-size: 44px; text-align: center; }
.login-title { text-align: center; font-size: 22px; margin: 4px 0 2px; }

.phone-input {
  width: 100%;
  font-size: 30px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.12em;
  padding: 18px 12px;
  border: 2px solid var(--line);
  border-radius: 14px;
  font-variant-numeric: tabular-nums;
}
.phone-input:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}
.phone-input::placeholder { color: #cbd5e1; font-weight: 500; }

.login-btn {
  width: 100%;
  margin-top: 14px;
  padding: 18px;
  font-size: 18px;
  border-radius: 14px;
}
.login-error {
  color: #b91c1c;
  font-size: 14px;
  text-align: center;
  margin: 10px 0 0;
}

/* thumb-sized targets on small screens */
@media (max-width: 640px) {
  .login-card { margin-top: 4vh; }
  .phone-input { font-size: 26px; }
}
</style>
