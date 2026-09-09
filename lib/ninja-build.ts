import { buildImportQuery, importItemLabel, type ResolvedImportItem } from '@/lib/ninja-import'
import { buildDurableUrl } from '@/lib/trade-url'
import type { Game, TradePage } from '@/types/trading'

export async function prepareNinjaSearches(items: ResolvedImportItem[], game: Game, league: string, rolls: number): Promise<TradePage[]> {
  return Promise.all(items.map(async (item) => {
    const page: TradePage = { url: '', title: importItemLabel(item), game, league, mode: 'search', query: buildImportQuery(item, rolls) }
    const url = await buildDurableUrl(page)
    if (!url) throw new Error('query-unavailable')
    return { ...page, url }
  }))
}
