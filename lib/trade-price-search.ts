import { parseTradeLocation } from './trade-location'
import type { TradeApp } from './trade-app'
import type { TradePriceSearch } from '@/types/pricing'

export function readTradePriceSearch(app: TradeApp | undefined, url: string): TradePriceSearch | null {
  const page = parseTradeLocation(url)
  const active = app?.$store.state.transient?.search?.active
  const game = active?.realm === 'poe2' ? 'poe2' : active?.realm === 'pc' ? 'poe1' : null
  if (!page?.queryId || page.mode !== 'search' || !active
    || active.type !== 'search' || !active.id || game !== page.game || active.league !== page.league
    || active.dirty !== false || app?.searchRequest != null
    || !Array.isArray(active.results) || !active.results.length
    || !active.query || typeof active.query !== 'object' || Array.isArray(active.query)) return null

  // The site's active query shares nested form data; dirty searches no longer describe these results.
  return {
    url: page.url,
    queryId: active.id,
    game: page.game,
    league: page.league,
    query: structuredClone(active.query),
  }
}
