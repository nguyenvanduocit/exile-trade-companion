import { formatChaosWithDivine } from './format-price'
import type { CurrencyId } from '@/types/pricing'

export const PRICE_LABEL_CLASS = 'etc-price-label'

// Quy đổi giá một listing (đơn vị bất kỳ) ra chaos rồi format kèm divine-equivalent bằng
// formatChaosWithDivine đã có sẵn — trả null khi không có rate cho currency đó (giữ nguyên
// trang, không chèn nhãn sai).
export function buildPriceLabel(
  amount: number,
  currency: CurrencyId,
  rates: Record<CurrencyId, number>,
): string | null {
  const chaosAmount = currency === 'chaos'
    ? amount
    : rates[currency] != null ? amount * rates[currency]! : null
  if (chaosAmount == null) return null

  return formatChaosWithDivine(chaosAmount, rates['divine'])
}
