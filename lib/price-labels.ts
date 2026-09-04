import { formatChaos, formatChaosWithDivine } from './format-price'
import type { CurrencyId } from '@/types/pricing'

export const PRICE_LABEL_CLASS = 'etc-price-label'

// Quy đổi giá một listing (đơn vị bất kỳ) ra chaos rồi format kèm divine-equivalent bằng
// formatChaosWithDivine đã có sẵn — trả null khi không có rate cho currency đó (giữ nguyên
// trang, không chèn nhãn sai). Listing giá gốc đã là divine thì bỏ hậu tố "(≈X div)" vì nó
// trùng với giá gốc đang hiển thị ngay phía trên, chỉ show quy đổi chaos.
export function buildPriceLabel(
  amount: number,
  currency: CurrencyId,
  rates: Record<CurrencyId, number>,
): string | null {
  const chaosAmount = currency === 'chaos'
    ? amount
    : rates[currency] != null ? amount * rates[currency]! : null
  if (chaosAmount == null) return null

  if (currency === 'divine') return `${formatChaos(chaosAmount)}c`

  return formatChaosWithDivine(chaosAmount, rates['divine'])
}
