export interface ChartPoint {
  x: number
  y: number
}

export interface ChartPadding {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ChartScaleOptions {
  width: number
  height: number
  padding: ChartPadding
}

export interface ChartScaleResult {
  points: ChartPoint[]
  minY: number
  maxY: number
}

export function scaleChartPoints(data: ChartPoint[], { width, height, padding }: ChartScaleOptions): ChartScaleResult {
  if (!data.length) return { points: [], minY: 0, maxY: 0 }

  const xs = data.map((point) => point.x)
  const ys = data.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX
  const spanY = maxY - minY
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const points = data.map((point) => ({
    x: spanX === 0 ? padding.left + innerWidth / 2 : padding.left + ((point.x - minX) / spanX) * innerWidth,
    y: spanY === 0
      ? padding.top + innerHeight / 2
      : height - padding.bottom - ((point.y - minY) / spanY) * innerHeight,
  }))

  return { points, minY, maxY }
}
