<script setup lang="ts">
import { PROPOSAL_SLIDES, slideIndexById } from '~/utils/proposal'

/**
 * /proposal — a visual walkthrough of the M&P Flow demo.
 *
 * One headline, one big picture, at most three numbered captions. The badges
 * over a screenshot are positioned in percent of the picture box, so the box
 * must keep the 16:10 shape the capture script shoots at (1440×900).
 *
 * All copy lives in `~/utils/proposal`; this file only lays it out.
 */
definePageMeta({ layout: 'default' })
useHead({ title: 'M&P Flow — a walk through the demo' })

const route = useRoute()
const router = useRouter()

const total = PROPOSAL_SLIDES.length
const index = computed(() => slideIndexById(route.query.slide))
const current = computed(() => PROPOSAL_SLIDES[index.value]!)
const isDark = computed(() => current.value.tone === 'dark')
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === total - 1)
const captions = computed(() => current.value.captions ?? [])

/** Captions read as one row across when there are two or three of them. */
const captionCols = computed(() =>
  captions.value.length >= 3 ? 'sm:grid-cols-3' : captions.value.length === 2 ? 'sm:grid-cols-2' : ''
)

function goTo(i: number) {
  const target = Math.min(Math.max(i, 0), total - 1)
  if (target === index.value) return
  router.replace({ query: target === 0 ? {} : { slide: PROPOSAL_SLIDES[target]!.id } })
}

function go(delta: number) {
  goTo(index.value + delta)
}

const mainEl = ref<HTMLElement | null>(null)
watch(index, () => mainEl.value?.scrollTo({ top: 0 }))

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']
const BACK_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']

function onKey(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return

  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
  // Space / Enter on a focused button or link already activates it; handling them
  // here too would advance two slides at once.
  if ((e.key === ' ' || e.key === 'Enter') && target?.closest('a, button, [role="button"]')) return

  if (NEXT_KEYS.includes(e.key)) go(1)
  else if (BACK_KEYS.includes(e.key)) go(-1)
  else if (e.key === 'Home') goTo(0)
  else if (e.key === 'End') goTo(total - 1)
  else return

  e.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="h-svh flex flex-col bg-[#f0f1f3]">
    <header class="shrink-0 flex items-center gap-3 bg-[#221F1F] px-4 sm:px-6 py-3 text-white">
      <span class="grid place-items-center size-10 rounded-lg bg-white p-1.5 shrink-0">
        <img src="/mp-logo.svg" alt="M&P International Freights" class="max-h-full max-w-full">
      </span>
      <span class="leading-tight min-w-0">
        <span class="block text-sm font-bold tracking-tight truncate">M&amp;P International Freights</span>
        <span class="block text-sm font-semibold uppercase tracking-[0.14em] text-[#F17421]">A walk through the demo</span>
      </span>
      <a
        href="https://mnp-flow.vercel.app"
        target="_blank"
        rel="noopener"
        class="ms-auto shrink-0 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-white/70 hover:text-white hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F17421]"
      >
        Live demo
        <UIcon name="i-lucide-external-link" class="size-4" />
      </a>
    </header>

    <main
      ref="mainEl"
      class="flex-1 min-h-0 overflow-y-auto flex flex-col px-4 sm:px-6 py-4 sm:py-6"
      :class="isDark ? 'bg-[#221F1F]' : 'bg-[#f0f1f3]'"
    >
      <div class="w-full max-w-5xl mx-auto my-auto">
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity duration-200 ease-out"
          leave-active-class="transition-opacity duration-150 ease-in"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <article
            :key="current.id"
            aria-labelledby="slide-title"
            :class="isDark ? 'text-white text-center py-10' : 'text-zinc-900'"
          >
            <p
              v-if="current.kicker"
              class="mb-2 text-sm font-bold uppercase tracking-[0.14em]"
              :class="isDark ? 'text-[#F17421]' : 'text-brand-700'"
            >
              {{ current.kicker }}
            </p>

            <h1
              id="slide-title"
              class="font-bold tracking-tight text-balance"
              :class="isDark ? 'text-white text-4xl sm:text-6xl' : 'text-zinc-900 text-2xl sm:text-4xl'"
            >
              {{ current.title }}
            </h1>

            <p
              v-if="current.lead"
              class="mt-3 text-balance"
              :class="isDark ? 'text-white/80 text-xl sm:text-2xl' : 'text-zinc-600 text-lg sm:text-xl'"
            >
              {{ current.lead }}
            </p>

            <!-- ── the one big picture ─────────────────────────── -->

            <!-- A screenshot of the running demo, with numbered badges over it. -->
            <figure
              v-if="current.visual.kind === 'shot'"
              class="mt-4 mx-auto w-[min(100%,86svh)]"
            >
              <div class="relative aspect-[16/10] overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
                <img
                  :src="current.visual.src"
                  :alt="current.visual.alt"
                  width="1440"
                  height="900"
                  class="absolute inset-0 h-full w-full object-cover"
                >
                <span
                  v-for="mark in current.visual.marks ?? []"
                  :key="mark.n"
                  aria-hidden="true"
                  class="absolute grid size-7 sm:size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#F17421] text-sm sm:text-base font-bold text-white ring-2 ring-white shadow-lg"
                  :style="{ left: `${mark.x}%`, top: `${mark.y}%` }"
                >
                  {{ mark.n }}
                </span>
              </div>
            </figure>

            <!-- A drawing, in the brand colours. -->
            <figure
              v-else-if="current.visual.kind === 'diagram'"
              class="mt-4 mx-auto w-[min(100%,92svh)]"
            >
              <ProposalDiagram :diagram="current.visual" />
            </figure>

            <!-- The trial, as a strip of numbered steps. -->
            <div v-else-if="current.visual.kind === 'strip'" class="relative mt-6">
              <!-- The rule the numbers sit on, so five cards read as one run. -->
              <div
                aria-hidden="true"
                class="hidden sm:block absolute left-[10%] right-[10%] top-[38px] h-0.5 bg-[#F17421]/30"
              />
              <ol class="relative grid gap-3 sm:grid-cols-5">
                <li
                  v-for="(step, i) in current.visual.steps"
                  :key="i"
                  class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-col sm:text-center"
                >
                  <span class="grid size-9 shrink-0 place-items-center rounded-full bg-[#F17421] text-base font-bold text-white">
                    {{ i + 1 }}
                  </span>
                  <span class="text-base font-semibold leading-snug text-zinc-800 sm:mt-1">{{ step.label }}</span>
                </li>
              </ol>
            </div>

            <!-- The asks, as numbered cards. -->
            <ol
              v-else-if="current.visual.kind === 'asks'"
              class="mt-6 grid gap-4 sm:grid-cols-2"
            >
              <li
                v-for="(item, i) in current.visual.items"
                :key="i"
                class="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                  {{ i + 1 }}
                </span>
                <span class="text-lg font-semibold leading-snug text-zinc-800">{{ item }}</span>
              </li>
            </ol>

            <!-- A way out to the live demo. -->
            <div v-else-if="current.visual.kind === 'link'" class="mt-6 text-center">
              <UButton
                :to="current.visual.href"
                target="_blank"
                rel="noopener"
                size="xl"
                color="primary"
                trailing-icon="i-lucide-external-link"
              >
                {{ current.visual.label }}
              </UButton>
              <p class="mt-3 text-base text-zinc-600">{{ current.visual.note }}</p>
            </div>

            <!-- ── the captions that read the picture ──────────── -->
            <ol
              v-if="captions.length"
              class="mt-6 grid gap-x-6 gap-y-4"
              :class="captionCols"
            >
              <li v-for="caption in captions" :key="caption.n" class="flex gap-3">
                <span
                  class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#F17421] text-sm font-bold text-white"
                >
                  {{ caption.n }}
                </span>
                <span class="text-base sm:text-lg leading-snug text-zinc-700">{{ caption.text }}</span>
              </li>
            </ol>

            <p
              v-if="current.note"
              class="mt-6 text-base"
              :class="isDark ? 'text-white/60' : 'text-zinc-500'"
            >
              {{ current.note }}
            </p>
          </article>
        </Transition>
      </div>
    </main>

    <footer class="shrink-0 bg-white border-t border-zinc-200">
      <div aria-hidden="true" class="h-1 w-full bg-zinc-200">
        <div
          class="h-full bg-[#F17421] transition-[width] duration-300 ease-out"
          :style="{ width: `${((index + 1) / total) * 100}%` }"
        />
      </div>

      <div class="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 sm:px-6 py-3">
        <UButton
          size="lg"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          :disabled="isFirst"
          aria-label="Previous slide"
          @click="go(-1)"
        >
          Back
        </UButton>

        <span
          aria-live="polite"
          class="mx-auto whitespace-nowrap text-base font-semibold tabular-nums text-zinc-600"
        >
          {{ index + 1 }} / {{ total }}
        </span>

        <UButton
          size="lg"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
          :disabled="isLast"
          :aria-label="isLast ? 'End of the walkthrough' : 'Next slide'"
          @click="go(1)"
        >
          <span class="sm:hidden">{{ isLast ? 'End' : 'Next' }}</span>
          <span class="hidden sm:inline">{{ isLast ? 'End of the walkthrough' : 'Next' }}</span>
        </UButton>
      </div>
    </footer>
  </div>
</template>
