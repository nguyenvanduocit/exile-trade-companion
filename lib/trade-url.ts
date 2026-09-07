import { i18n } from '#i18n'
import type { Game, TradeMode, TradePage } from '@/types/trading'
import { buildDurableUrl as sharedBuildDurableUrl } from 'shared/trade-url'

const TRADE_HOSTS = new Set(['pathofexile.com', 'www.pathofexile.com'])

function cleanPageTitle(title: string) {
  return title
    .replace(/\s*[|–—-]\s*Path of Exile(?:\s+Trade)?\s*$/i, '')
    .replace(/^Path of Exile(?:\s+Trade)?\s*[|–—-]\s*/i, '')
    .trim()
}

export function normalizeTradeUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

export function parseTradeUrl(value: string, pageTitle = ''): TradePage | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' || !TRADE_HOSTS.has(url.hostname)) return null

  const segments = url.pathname.split('/').filter(Boolean)
  const tradeRoot = segments[0]
  if (tradeRoot !== 'trade' && tradeRoot !== 'trade2') return null

  const modeIndex = segments.findIndex((segment) => segment === 'search' || segment === 'exchange')
  if (modeIndex < 0) return null

  const mode = segments[modeIndex] as TradeMode
  const game: Game = tradeRoot === 'trade2' || segments[modeIndex + 1]?.toLowerCase() === 'poe2'
    ? 'poe2'
    : 'poe1'
  const leagueIndex = segments[modeIndex + 1]?.toLowerCase() === 'poe2' ? modeIndex + 2 : modeIndex + 1
  const league = decodeURIComponent(segments[leagueIndex] ?? 'Unknown')
  const queryId = segments[leagueIndex + 1]
  const fallbackTitle = `${league} · ${mode === 'exchange' ? i18n.t('tradeUrl.exchange') : i18n.t('tradeUrl.search')}`
  const title = cleanPageTitle(pageTitle) || fallbackTitle

  return {
    url: normalizeTradeUrl(url.toString()),
    title,
    game,
    league,
    mode,
    queryId,
  }
}

export function isTradeUrl(value?: string) {
  return value ? parseTradeUrl(value) !== null : false
}

// Dựng lại URL search từ raw query đã lưu kèm bookmark — cài đặt thật nằm ở packages/shared/trade-url.ts
// (dùng chung với packages/web); TradePage của extension thoả cấu trúc SharedTradePage nên không cần map tay.
export async function buildDurableUrl(page: TradePage): Promise<string | null> {
  return sharedBuildDurableUrl(page)
}
