import { useExchangeRates } from './useExchangeRates'
import { computeSnapshot, readListingPrices } from '@/lib/price-snapshot'
import { useTradeStore } from '@/composables/useTradeStore'
import { isSearchVisible } from '@/lib/storage'
import { parseTradeUrl } from '@/lib/trade-url'
import { matchesPriceSearch, snapshotQueryId } from '@/lib/price-search-match'
import { sendPriceSearchMessage } from '@/lib/window-messaging'
import type { SavedSearch } from '@/types/trading'

export function usePriceSnapshot() {
  const store = useTradeStore()
  const { ensureRates } = useExchangeRates()

  async function capturePage(search: SavedSearch) {
    const page = parseTradeUrl(window.location.href)
    if (!page?.queryId || page.mode !== 'search' || search.game !== page.game || search.league !== page.league) return null
    const result = await sendPriceSearchMessage('getPriceSearch')
    const saved = store.state.value.searches.find((item) => item.id === search.id && isSearchVisible(store.state.value, item))
    if (!result || !saved || result.url !== page.url
      || parseTradeUrl(window.location.href)?.url !== page.url || !matchesPriceSearch(saved, result)) return null
    return { page: result, historyQueryId: snapshotQueryId(saved) }
  }

  async function canCaptureSnapshot(search: SavedSearch) {
    return await capturePage(search) !== null
  }

  async function captureSnapshot(search: SavedSearch) {
    const capture = await capturePage(search)
    if (!capture) return 'unavailable'
    const { page, historyQueryId } = capture
    const now = Date.now()
    const listings = readListingPrices()
    if (!listings.length) return 'insufficient-listings'

    const rates = await ensureRates(page)

    const result = computeSnapshot(listings, rates)
    if (!result) return 'insufficient-listings'

    await store.recordSnapshot({ queryId: historyQueryId, capturedAt: now, ...result })
    return 'captured'
  }

  return { canCaptureSnapshot, captureSnapshot }
}
