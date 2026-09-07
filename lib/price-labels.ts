import { formatChaos, formatDivine } from './format-price'
import type { CurrencyId } from '@/types/pricing'
import type { CurrencyCatalogEntry } from './trade-app'

export const PRICE_LABEL_CLASS = 'etc-price-label'
export const PRICE_LABEL_ICON_CLASS = 'etc-price-label-icon'
// Đánh dấu [data-field="price"] đã chèn nhãn — vừa là cờ chống chèn lặp, vừa là hook CSS.
export const PRICE_LABELED_ATTR = 'data-etc-price-labeled'

// Một "khúc" trong nhãn quy đổi: số tiền + currency của nó, để lớp render (usePriceLabels)
// tự quyết vẽ icon (mượn từ ảnh currency đã thấy trên trang) hay fallback chữ "c"/"div".
export interface PriceLabelPart {
  currency: CurrencyId
  text: string
}

// Quy đổi giá một listing sang currency còn lại — trả null khi không có gì để thêm (không có
// rate cho currency đó, hoặc listing giá chaos mà chưa có rate divine). Nhãn chỉ chứa phần
// QUY ĐỔI: giá gốc đã hiển thị ngay phía trên nên không lặp lại — listing chaos chỉ show divine,
// listing divine chỉ show chaos, currency khác show cả chaos lẫn divine.
export function buildPriceLabelParts(
  amount: number,
  currency: CurrencyId,
  rates: Record<CurrencyId, number>,
): PriceLabelPart[] | null {
  const chaosAmount = currency === 'chaos'
    ? amount
    : rates[currency] != null ? amount * rates[currency]! : null
  if (chaosAmount == null) return null

  const parts: PriceLabelPart[] = []
  if (currency !== 'chaos') parts.push({ currency: 'chaos', text: formatChaos(chaosAmount) })

  const divineRate = rates['divine']
  if (currency !== 'divine' && divineRate && divineRate > 0) {
    parts.push({ currency: 'divine', text: formatDivine(chaosAmount / divineRate) })
  }
  return parts.length ? parts : null
}

// Ảnh trong catalog là path tương đối; listing trên trang render cùng path đó dưới host này
// (verify sống 2026-09-06 trên cả /trade lẫn /trade2).
const CDN_ORIGIN = 'https://web.poecdn.com'

export function currencyIconUrls(
  catalog: Record<string, CurrencyCatalogEntry>,
  ids: CurrencyId[],
): Record<CurrencyId, string> {
  const urls: Record<CurrencyId, string> = {}
  for (const id of ids) {
    const image = catalog[id]?.image
    if (image) urls[id] = CDN_ORIGIN + image
  }
  return urls
}
