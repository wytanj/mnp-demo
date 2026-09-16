<script setup lang="ts">
import type { SlideVisual } from '~/utils/proposal'

/**
 * The three drawings in the /proposal deck, as inline SVG in the brand
 * colours (charcoal #221F1F, orange #F17421).
 *
 * Deliberately holds no words of its own: every label is passed in from
 * `app/utils/proposal.ts`, so `scripts/check-proposal-copy.mjs` sees every
 * string the deck renders. Shapes here, copy there.
 */
type DiagramVisual = Extract<SlideVisual, { kind: 'diagram' }>

const props = defineProps<{ diagram: DiagramVisual }>()

/** SVG does not wrap text, so a label becomes lines of at most `max` characters. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= max) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

const CHARCOAL = '#221F1F'
const ORANGE = '#F17421'

/* ── today ───────────────────────────────────────────────── */
const today = computed(() => (props.diagram.name === 'today' ? props.diagram : null))
const todayColumns = computed(() =>
  (today.value?.channels ?? []).map((c, i) => ({
    x: 20 + i * 265,
    centre: 20 + i * 265 + 115,
    label: c.label,
    lines: wrap(c.line, 24)
  }))
)

/* ── two systems ─────────────────────────────────────────── */
const twoSystems = computed(() => (props.diagram.name === 'two-systems' ? props.diagram : null))
const arrowLines = computed(() => wrap(twoSystems.value?.arrow ?? '', 30))

/* ── discovery ───────────────────────────────────────────── */
const discovery = computed(() => (props.diagram.name === 'discovery' ? props.diagram : null))
const sourceLines = computed(() => wrap(discovery.value?.source ?? '', 34))
const optionColumns = computed(() =>
  (discovery.value?.options ?? []).map((label, i) => ({
    x: 20 + i * 265,
    centre: 20 + i * 265 + 115,
    lines: wrap(label, 20)
  }))
)
</script>

<template>
  <!-- Today: one shipment, seen in pieces -->
  <svg
    v-if="today"
    viewBox="0 0 800 375"
    role="img"
    :aria-label="today.alt"
    class="w-full h-auto"
  >
    <title>{{ today.alt }}</title>

    <g v-for="col in todayColumns" :key="col.label">
      <rect :x="col.x" y="10" width="230" height="110" rx="14" fill="#ffffff" stroke="#d4d4d8" stroke-width="1.5" />
      <text :x="col.x + 20" y="48" font-size="22" font-weight="700" :fill="CHARCOAL">{{ col.label }}</text>
      <text
        v-for="(line, i) in col.lines"
        :key="i"
        :x="col.x + 20"
        :y="78 + i * 22"
        font-size="15"
        fill="#71717a"
      >{{ line }}</text>
      <line
        :x1="col.centre"
        y1="122"
        :x2="col.centre"
        y2="236"
        stroke="#a1a1aa"
        stroke-width="2"
        stroke-dasharray="6 6"
      />
    </g>

    <rect x="8" y="230" width="784" height="76" rx="16" fill="none" stroke="#a1a1aa" stroke-width="1.5" stroke-dasharray="5 5" />
    <g v-for="col in todayColumns" :key="`piece-${col.label}`">
      <rect :x="col.x" y="242" width="230" height="52" rx="10" :fill="ORANGE" fill-opacity="0.16" :stroke="ORANGE" stroke-width="1.5" />
    </g>
    <text x="267" y="276" font-size="22" fill="#a1a1aa" text-anchor="middle">?</text>
    <text x="532" y="276" font-size="22" fill="#a1a1aa" text-anchor="middle">?</text>

    <text x="400" y="345" font-size="20" font-weight="600" :fill="CHARCOAL" text-anchor="middle">{{ today.centre }}</text>
  </svg>

  <!-- The trial beside the system you use today -->
  <svg
    v-else-if="twoSystems"
    viewBox="0 0 800 300"
    role="img"
    :aria-label="twoSystems.alt"
    class="w-full h-auto"
  >
    <title>{{ twoSystems.alt }}</title>
    <defs>
      <marker id="mp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" :fill="ORANGE" />
      </marker>
    </defs>

    <!-- the trial -->
    <rect x="20" y="24" width="310" height="170" rx="18" fill="#ffffff" :stroke="ORANGE" stroke-width="2.5" />
    <text x="175" y="66" font-size="23" font-weight="700" :fill="CHARCOAL" text-anchor="middle">{{ twoSystems.here }}</text>
    <text x="175" y="94" font-size="15" fill="#71717a" text-anchor="middle">{{ twoSystems.hereSub }}</text>
    <g v-for="i in 3" :key="`chip-${i}`">
      <rect :x="55 + (i - 1) * 85" y="120" width="64" height="48" rx="10" :fill="ORANGE" fill-opacity="0.12" />
      <circle :cx="55 + (i - 1) * 85 + 32" cy="140" r="9" :fill="ORANGE" />
      <rect :x="55 + (i - 1) * 85 + 14" y="152" width="36" height="10" rx="5" :fill="ORANGE" />
    </g>

    <!-- the system they use today -->
    <rect x="470" y="24" width="310" height="170" rx="18" fill="#e8e8ea" stroke="#c9c9cf" stroke-width="2" />
    <text x="625" y="66" font-size="19" font-weight="700" fill="#52525b" text-anchor="middle">{{ twoSystems.there }}</text>
    <text x="625" y="94" font-size="15" fill="#8a8a93" text-anchor="middle">{{ twoSystems.thereSub }}</text>
    <g v-for="row in 3" :key="`row-${row}`">
      <rect v-for="col in 3" :key="col" :x="490 + (col - 1) * 95" :y="112 + (row - 1) * 22" width="85" height="14" rx="4" fill="#c4c4cb" />
    </g>

    <!-- one arrow, one promise -->
    <line x1="338" y1="100" x2="462" y2="100" :stroke="ORANGE" stroke-width="3" marker-end="url(#mp-arrow)" />
    <line x1="400" y1="114" x2="400" y2="222" :stroke="ORANGE" stroke-width="1.5" stroke-dasharray="4 5" />
    <text
      v-for="(line, i) in arrowLines"
      :key="i"
      x="400"
      :y="246 + i * 24"
      font-size="17"
      font-weight="600"
      :fill="CHARCOAL"
      text-anchor="middle"
    >{{ line }}</text>
  </svg>

  <!-- One session, three paths -->
  <svg
    v-else-if="discovery"
    viewBox="0 0 800 330"
    role="img"
    :aria-label="discovery.alt"
    class="w-full h-auto"
  >
    <title>{{ discovery.alt }}</title>
    <defs>
      <marker id="mp-arrow-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" :fill="ORANGE" />
      </marker>
    </defs>

    <rect x="140" y="8" width="520" height="86" rx="16" :fill="CHARCOAL" />
    <text
      v-for="(line, i) in sourceLines"
      :key="i"
      x="400"
      :y="sourceLines.length > 1 ? 44 + i * 26 : 58"
      font-size="19"
      font-weight="600"
      fill="#ffffff"
      text-anchor="middle"
    >{{ line }}</text>

    <path
      v-for="col in optionColumns"
      :key="`arm-${col.centre}`"
      :d="`M 400 96 C 400 140 ${col.centre} 136 ${col.centre} 174`"
      fill="none"
      :stroke="ORANGE"
      stroke-width="2.5"
      marker-end="url(#mp-arrow-d)"
    />

    <g v-for="col in optionColumns" :key="`opt-${col.centre}`">
      <rect :x="col.x" y="184" width="230" height="130" rx="14" fill="#ffffff" stroke="#d4d4d8" stroke-width="1.5" />
      <circle :cx="col.centre" cy="216" r="7" :fill="ORANGE" />
      <text
        v-for="(line, i) in col.lines"
        :key="i"
        :x="col.centre"
        :y="col.lines.length > 1 ? 254 + i * 26 : 264"
        font-size="18"
        font-weight="600"
        :fill="CHARCOAL"
        text-anchor="middle"
      >{{ line }}</text>
    </g>
  </svg>
</template>
