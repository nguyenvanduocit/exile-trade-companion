import { flattenStatCatalog, type StatCatalogEntry } from '@/lib/ninja-import'
import type { StatDefinition } from '@/lib/stat-filter'
import type { Game } from '@/types/trading'

export type TradeStatCatalogResult = { ok: true; entries: StatCatalogEntry[] } | { ok: false }

const catalogs = new Map<Game, Promise<TradeStatCatalogResult>>()

export function fetchTradeStatCatalog(game: Game): Promise<TradeStatCatalogResult> {
  const cached = catalogs.get(game)
  if (cached) return cached
  const request = (async (): Promise<TradeStatCatalogResult> => {
    try {
      const root = game === 'poe2' ? 'trade2' : 'trade'
      const response = await fetch(`https://www.pathofexile.com/api/${root}/data/stats`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('catalog-unavailable')
      const data = await response.json() as { result: { entries: (StatDefinition & { id: string })[] }[] }
      const flat = Object.fromEntries(data.result.flatMap((group) => group.entries.map((entry) => [entry.id, entry])))
      const entries = flattenStatCatalog(flat)
      if (!entries.length) throw new Error('catalog-unavailable')
      return { ok: true, entries }
    } catch {
      catalogs.delete(game)
      return { ok: false }
    }
  })()
  catalogs.set(game, request)
  return request
}
