<script setup lang="ts">
import { HOWTO, type HowToKey } from '~/utils/howto'

/**
 * The `?` button that sits top-right of every demo page header.
 *
 * Opens a slideover with the presenter cheat-sheet for this route — what the
 * page is, what to click, what to say. Copy lives in `app/utils/howto.ts`.
 *
 * `tone="dark"` is for the charcoal (#221F1F) headers on the doors page and
 * the driver shell, where the neutral ghost button would be invisible.
 */
const props = withDefaults(
  defineProps<{ page: HowToKey, tone?: 'light' | 'dark' }>(),
  { tone: 'light' }
)

const open = ref(false)
const howto = computed(() => HOWTO[props.page])
</script>

<template>
  <div class="shrink-0">
    <UTooltip text="How to demo this page">
      <UButton
        icon="i-lucide-circle-help"
        size="sm"
        square
        color="neutral"
        variant="ghost"
        :class="tone === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : undefined"
        aria-label="How to demo this page"
        @click="open = true"
      />
    </UTooltip>

    <USlideover
      v-model:open="open"
      :title="howto.title"
      description="What to click and what to say"
    >
      <template #body>
        <div class="space-y-5">
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">What this is</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-zinc-700">{{ howto.what }}</p>
          </section>

          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Click</h3>
            <ol class="mt-1.5 space-y-2">
              <li
                v-for="(step, i) in howto.click"
                :key="i"
                class="flex gap-2.5 text-sm leading-relaxed text-zinc-700"
              >
                <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {{ i + 1 }}
                </span>
                <span class="min-w-0">{{ step }}</span>
              </li>
            </ol>
          </section>

          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Say</h3>
            <ul class="mt-1.5 space-y-2">
              <li
                v-for="(line, i) in howto.say"
                :key="i"
                class="flex gap-2.5 text-sm leading-relaxed text-zinc-700"
              >
                <UIcon name="i-lucide-quote" class="mt-1 size-3.5 shrink-0 text-zinc-300" />
                <span class="min-w-0">{{ line }}</span>
              </li>
            </ul>
          </section>
        </div>
      </template>

      <template #footer>
        <p class="text-[11px] text-zinc-400">Demo cheat-sheet — not shown to customers.</p>
      </template>
    </USlideover>
  </div>
</template>
