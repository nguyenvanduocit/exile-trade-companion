export function formatChaos(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (amount >= 100) return Math.round(amount).toString()
  if (amount >= 10) return amount.toFixed(1).replace(/\.0$/, '')
  return amount.toFixed(2).replace(/\.?0+$/, '')
}

function formatDivine(amount: number): string {
  if (amount >= 1) return amount.toFixed(2)
  // Dưới 1 divine, toFixed(2) làm tròn về "0.00" với currency rẻ (vd 1 chaos ≈ 0.003 div) —
  // giữ đủ 2 chữ số có nghĩa để luôn thấy quy đổi, không hiện số giả "0.00".
  return amount.toPrecision(2)
}

export function formatChaosWithDivine(chaosAmount: number, divineRate?: number): string {
  const base = `${formatChaos(chaosAmount)}c`
  if (!divineRate || divineRate <= 0) return base

  const divineAmount = chaosAmount / divineRate
  return `${base} (≈${formatDivine(divineAmount)} div)`
}

export function formatDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null

  const rounded = Math.round(((current - previous) / previous) * 100)
  if (rounded === 0) return '0%'
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`
}
