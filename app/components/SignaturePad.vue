<script setup lang="ts">
const canvas = ref<HTMLCanvasElement>()
const drawing = ref(false)
const hasInk = ref(false)
let ctx: CanvasRenderingContext2D | null = null

onMounted(() => {
  const el = canvas.value!
  const dpr = window.devicePixelRatio || 1
  el.width = el.clientWidth * dpr
  el.height = el.clientHeight * dpr
  ctx = el.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1a2433'
})

function pos(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function start(e: PointerEvent) {
  drawing.value = true
  canvas.value!.setPointerCapture(e.pointerId)
  const { x, y } = pos(e)
  ctx?.beginPath()
  ctx?.moveTo(x, y)
}

function move(e: PointerEvent) {
  if (!drawing.value || !ctx) return
  const { x, y } = pos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  hasInk.value = true
}

function end() {
  drawing.value = false
}

function clear() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  hasInk.value = false
}

function toDataURL(): string {
  return canvas.value!.toDataURL('image/png')
}

defineExpose({ clear, toDataURL, hasInk })
</script>

<template>
  <div>
    <canvas
      ref="canvas"
      class="sig-canvas"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
    />
    <div class="row spread" style="margin-top: 8px">
      <span class="muted">Sign above with finger or mouse</span>
      <button type="button" class="btn btn-ghost" @click="clear">Clear</button>
    </div>
  </div>
</template>
