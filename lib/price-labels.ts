import { formatChaos, formatDivine } from './format-price'
import type { CurrencyId } from '@/types/pricing'

export const PRICE_LABEL_CLASS = 'etc-price-label'
export const PRICE_LABEL_ICON_CLASS = 'etc-price-label-icon'

// Một "khúc" trong nhãn quy đổi: số tiền + currency của nó, để lớp render (usePriceLabels)
// tự quyết vẽ icon (mượn từ ảnh currency đã thấy trên trang) hay fallback chữ "c"/"div".
export interface PriceLabelPart {
  currency: CurrencyId
  text: string
}

// Quy đổi giá một listing (đơn vị bất kỳ) ra chaos, kèm divine-equivalent khi có rate — trả
// null khi không có rate cho currency đó (giữ nguyên trang, không chèn nhãn sai). Listing giá
// gốc đã là divine thì bỏ phần divine ở kết quả vì nó trùng với giá gốc đang hiển thị ngay
// phía trên, chỉ show quy đổi chaos.
export function buildPriceLabelParts(
  amount: number,
  currency: CurrencyId,
  rates: Record<CurrencyId, number>,
): PriceLabelPart[] | null {
  const chaosAmount = currency === 'chaos'
    ? amount
    : rates[currency] != null ? amount * rates[currency]! : null
  if (chaosAmount == null) return null

  if (currency === 'divine') return [{ currency: 'chaos', text: formatChaos(chaosAmount) }]

  const parts: PriceLabelPart[] = [{ currency: 'chaos', text: formatChaos(chaosAmount) }]
  const divineRate = rates['divine']
  if (divineRate && divineRate > 0) {
    parts.push({ currency: 'divine', text: formatDivine(chaosAmount / divineRate) })
  }
  return parts
}
