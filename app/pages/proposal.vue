<script setup lang="ts">
import { PROPOSAL_SLIDES, slideIndexById } from '~/utils/proposal'

definePageMeta({ layout: 'default' })
useHead({ title: 'M&P Flow — written proposal' })

const route = useRoute()
const router = useRouter()

const total = PROPOSAL_SLIDES.length
const index = computed(() => slideIndexById(route.query.slide))
const current = computed(() => PROPOSAL_SLIDES[index.value]!)
const isDark = computed(() => current.value.tone === 'dark')
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === total - 1)

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
        <span class="block text-sm font-semibold uppercase tracking-[0.14em] text-[#F17421]">Written proposal</span>
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
      class="flex-1 min-h-0 overflow-y-auto flex flex-col px-4 sm:px-6 py-8 sm:py-12"
      :class="isDark ? 'bg-[#221F1F]' : 'bg-[#f0f1f3]'"
    >
      <div class="w-full max-w-3xl mx-auto my-auto">
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
            class="rounded-2xl px-5 py-8 sm:px-10 sm:py-12"
            :class="isDark ? 'text-white' : 'bg-white border border-zinc-200 shadow-sm'"
          >
            <p
              v-if="current.kicker"
              class="mb-3 text-sm font-bold uppercase tracking-[0.14em]"
              :class="isDark ? 'text-[#F17421]' : 'text-brand-700'"
            >
              {{ current.kicker }}
            </p>

            <h1
              id="slide-title"
              class="text-3xl sm:text-5xl font-bold tracking-tight text-balance"
              :class="isDark ? 'text-white' : 'text-zinc-900'"
            >
              {{ current.title }}
            </h1>

            <p
              v-if="current.lead"
              class="mt-4 text-xl sm:text-2xl leading-relaxed"
              :class="isDark ? 'text-white/80' : 'text-zinc-600'"
            >
              {{ current.lead }}
            </p>

            <div
              v-if="current.blocks.length"
              class="mt-8 space-y-6 text-lg sm:text-xl leading-relaxed"
              :class="isDark ? 'text-white/85' : 'text-zinc-700'"
            >
              <template v-for="(block, i) in current.blocks" :key="i">
                <p v-if="block.kind === 'paragraph'">{{ block.text }}</p>

                <ul v-else-if="block.kind === 'bullets'" class="list-disc pl-6 space-y-2.5">
                  <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
                </ul>

                <ol v-else-if="block.kind === 'steps'" class="space-y-4">
                  <li v-for="(item, j) in block.items" :key="j" class="flex gap-4">
                    <span
                      class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-base font-bold"
                      :class="isDark ? 'bg-[#F17421]/25 text-[#F17421]' : 'bg-brand-100 text-brand-700'"
                    >
                      {{ j + 1 }}
                    </span>
                    <span class="min-w-0">{{ item }}</span>
                  </li>
                </ol>

                <div
                  v-else-if="block.kind === 'callout'"
                  class="rounded-xl bg-brand-50 border border-brand-200 px-5 py-4 text-zinc-800"
                >
                  <p v-if="block.title" class="font-bold">{{ block.title }}</p>
                  <p :class="block.title ? 'mt-1.5' : undefined">{{ block.text }}</p>
                </div>

                <div v-else-if="block.kind === 'link'">
                  <UButton
                    :to="block.href"
                    target="_blank"
                    rel="noopener"
                    size="xl"
                    color="primary"
                    trailing-icon="i-lucide-external-link"
                  >
                    {{ block.label }}
                  </UButton>
                  <p
                    v-if="block.note"
                    class="mt-3 text-base"
                    :class="isDark ? 'text-white/70' : 'text-zinc-600'"
                  >
                    {{ block.note }}
                  </p>
                </div>
              </template>
            </div>
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

      <div class="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 sm:px-6 py-3 sm:py-4">
        <UButton
          size="xl"
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
          size="xl"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
          :disabled="isLast"
          :aria-label="isLast ? 'End of proposal' : 'Next slide'"
          @click="go(1)"
        >
          <span class="sm:hidden">{{ isLast ? 'End' : 'Next' }}</span>
          <span class="hidden sm:inline">{{ isLast ? 'End of proposal' : 'Next' }}</span>
        </UButton>
      </div>
    </footer>
  </div>
</template>
