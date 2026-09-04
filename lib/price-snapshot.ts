import type { CurrencyId } from '@/types/pricing'

export interface RawListing {
  amount: number
  currency: CurrencyId
}

export interface ComputedSnapshot {
  sampleSize: number
  medianChaos: number
  averageChaos: number
}

const MIN_SAMPLE_SIZE = 3

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function computeSnapshot(
  listings: RawListing[],
  rates: Record<CurrencyId, number>,
): ComputedSnapshot | null {
  const chaosValues = listings
    .map((listing) => {
      if (listing.currency === 'chaos') return listing.amount
      const rate = rates[listing.currency]
      return rate != null ? listing.amount * rate : null
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)

  if (chaosValues.length < MIN_SAMPLE_SIZE) return null

  const sum = chaosValues.reduce((total, value) => total + value, 0)

  return {
    sampleSize: chaosValues.length,
    medianChaos: median(chaosValues),
    averageChaos: sum / chaosValues.length,
  }
}

// Đọc trực tiếp từ DOM trang kết quả trade — chạy được từ isolated-world content script
// (DOM dùng chung giữa MAIN world và isolated world dù JS context tách biệt).
// Cấu trúc đã verify trên pathofexile.com/trade2 (2026-09-04):
//   <span data-field="price">
//     <span class="price-label buyout-price">Asking Price:</span>
//     <span>1</span><span>×</span>
//     <span class="currency-text currency-image"><img alt="regal">...</span>
//   </span>
// [data-field="fee"] (Gold sink riêng của POE2) bị loại vì nó không mang [data-field="price"].
export function readListingPrices(root: ParentNode = document): RawListing[] {
  const listings: RawListing[] = []
  root.querySelectorAll('[data-field="price"]').forEach((el) => {
    const img = el.querySelector('img')
    const amountEl = [...el.querySelectorAll(':scope > span')]
      .find((span) => !span.classList.contains('price-label'))
    const amount = amountEl ? Number(amountEl.textContent) : Number.NaN
    if (img?.alt && !Number.isNaN(amount)) listings.push({ amount, currency: img.alt })
  })
  return listings
}
