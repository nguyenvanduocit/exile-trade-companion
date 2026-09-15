import type { Game, TradeMode, TradePage } from '@/types/trading'

const TRADE_HOSTS = new Set(['pathofexile.com', 'www.pathofexile.com'])

export function normalizeTradeUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

export function parseTradeLocation(value: string): Omit<TradePage, 'title'> | null {
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

  return {
    url: normalizeTradeUrl(url.toString()),
    game,
    league,
    mode,
    queryId,
  }
}
