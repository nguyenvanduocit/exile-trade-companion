import { i18n } from '#i18n'
import type { TradePage } from '@/types/trading'
import { buildDurableUrl as sharedBuildDurableUrl } from 'shared/trade-url'
import { parseTradeLocation } from './trade-location'

export { normalizeTradeUrl } from './trade-location'

function cleanPageTitle(title: string) {
  return title
    .replace(/\s*[|–—-]\s*Path of Exile(?:\s+Trade)?\s*$/i, '')
    .replace(/^Path of Exile(?:\s+Trade)?\s*[|–—-]\s*/i, '')
    .trim()
}

export function parseTradeUrl(value: string, pageTitle = ''): TradePage | null {
  const page = parseTradeLocation(value)
  if (!page) return null

  const fallbackTitle = `${page.league} · ${page.mode === 'exchange' ? i18n.t('tradeUrl.exchange') : i18n.t('tradeUrl.search')}`
  const title = cleanPageTitle(pageTitle) || fallbackTitle

  return { ...page, title }
}

export function isTradeUrl(value?: string) {
  return value ? parseTradeUrl(value) !== null : false
}

// Dựng lại URL search từ raw query đã lưu kèm bookmark — cài đặt thật nằm ở packages/shared/trade-url.ts
// (dùng chung với packages/web); TradePage của extension thoả cấu trúc SharedTradePage nên không cần map tay.
export async function buildDurableUrl(page: TradePage): Promise<string | null> {
  return sharedBuildDurableUrl(page)
}
