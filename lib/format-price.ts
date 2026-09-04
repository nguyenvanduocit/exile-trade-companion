export function formatChaos(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (amount >= 100) return Math.round(amount).toString()
  if (amount >= 10) return amount.toFixed(1).replace(/\.0$/, '')
  return amount.toFixed(2).replace(/\.?0+$/, '')
}

export function formatChaosWithDivine(chaosAmount: number, divineRate?: number): string {
  const base = `${formatChaos(chaosAmount)}c`
  if (!divineRate || divineRate <= 0) return base

  const divineAmount = chaosAmount / divineRate
  if (divineAmount < 0.01) return base

  return `${base} (≈${divineAmount.toFixed(2)} div)`
}

export function formatDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null

  const rounded = Math.round(((current - previous) / previous) * 100)
  if (rounded === 0) return '0%'
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`
}
