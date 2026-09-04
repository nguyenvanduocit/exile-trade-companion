<script setup lang="ts">
import { computed } from 'vue'
import { i18n } from '#i18n'
import { scaleChartPoints } from '@/lib/chart-scale'
import { formatChaos } from '@/lib/format-price'
import type { PriceSnapshot } from '@/types/pricing'

const props = defineProps<{
  snapshots: PriceSnapshot[]
}>()

const WIDTH = 380
const HEIGHT = 200
const PADDING = { top: 24, right: 16, bottom: 28, left: 46 }

function formatAxisDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const scaled = computed(() => scaleChartPoints(
  props.snapshots.map((snapshot) => ({ x: snapshot.capturedAt, y: snapshot.medianChaos })),
  { width: WIDTH, height: HEIGHT, padding: PADDING },
))

const points = computed(() => scaled.value.points.map((point, index) => ({
  ...point,
  snapshot: props.snapshots[index]!,
})))

const polylinePoints = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '))

const gridLines = computed(() => {
  const { minY, maxY } = scaled.value
  const midY = (minY + maxY) / 2
  const top = PADDING.top
  const bottom = HEIGHT - PADDING.bottom
  const mid = (top + bottom) / 2
  return [
    { y: top, value: maxY },
    { y: mid, value: midY },
    { y: bottom, value: minY },
  ]
})

// Label mọi điểm khi ít (<=6, đọc được hết); nhiều hơn thì chỉ label đầu/giữa/cuối để tránh chồng chữ.
const labeledIndices = computed(() => {
  const n = points.value.length
  if (n <= 6) return points.value.map((_, i) => i)
  return [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
})

// Điểm đầu/cuối lệch anchor ra khỏi tâm — tránh chữ tràn mép trái/phải và đè lên nhãn trục Y bên trái.
function labelAnchor(index: number): 'start' | 'middle' | 'end' {
  if (index === 0) return 'start'
  if (index === points.value.length - 1) return 'end'
  return 'middle'
}

function labelDx(index: number): number {
  if (index === 0) return 4
  if (index === points.value.length - 1) return -4
  return 0
}

// Điểm nằm sát gridline đáy cần label đẩy lên cao hơn để không đè lên số trục Y cùng độ cao.
function labelDy(pointY: number): number {
  const bottom = HEIGHT - PADDING.bottom
  return pointY > bottom - 14 ? -16 : -8
}
</script>

<template>
  <p v-if="snapshots.length < 2" class="px-1 py-6 text-center leading-5 text-dim">
    {{ i18n.t('priceHistory.notEnoughData') }}
  </p>
  <svg v-else :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="w-full" role="img" :aria-label="i18n.t('priceHistory.chartLabel')">
    <g v-for="line in gridLines" :key="line.y">
      <line :x1="PADDING.left" :y1="line.y" :x2="WIDTH - PADDING.right" :y2="line.y" class="stroke-rule" stroke-width="1" />
      <text :x="PADDING.left - 6" :y="line.y + 3" text-anchor="end" class="fill-dim text-[9px]">{{ formatChaos(line.value) }}c</text>
    </g>

    <polyline :points="polylinePoints" fill="none" class="stroke-tan" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

    <g v-for="(point, index) in points" :key="point.snapshot.id">
      <circle :cx="point.x" :cy="point.y" r="3" class="fill-tan" />
      <text
        v-if="labeledIndices.includes(index)"
        :x="point.x + labelDx(index)"
        :y="point.y + labelDy(point.y)"
        :text-anchor="labelAnchor(index)"
        class="fill-cream text-[9px]"
      >
        {{ formatChaos(point.snapshot.medianChaos) }}c
      </text>
      <text
        v-if="labeledIndices.includes(index)"
        :x="point.x + labelDx(index)"
        :y="HEIGHT - PADDING.bottom + 14"
        :text-anchor="labelAnchor(index)"
        class="fill-dim text-[9px]"
      >
        {{ formatAxisDate(point.snapshot.capturedAt) }}
      </text>
    </g>
  </svg>
</template>
