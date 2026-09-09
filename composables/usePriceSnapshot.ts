import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { useExchangeRates } from './useExchangeRates'
import { computeSnapshot, readListingPrices } from '@/lib/price-snapshot'
import { useTradeStore } from '@/composables/useTradeStore'
import { isSearchVisible } from '@/lib/storage'
import type { TradePage } from '@/types/trading'

const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000
const OBSERVER_DEBOUNCE_MS = 800

export function usePriceSnapshot(ctx: ContentScriptContext) {
  const store = useTradeStore()
  const { ensureRates } = useExchangeRates()

  async function maybeCaptureSnapshot(page: TradePage | null) {
    if (!page || page.mode !== 'search' || !page.queryId) return

    const queryId = page.queryId
    const isBookmarked = store.state.value.searches
      .some((search) => search.queryId === queryId && isSearchVisible(store.state.value, search))
    if (!isBookmarked) return

    const now = Date.now()
    const lastForQuery = store.state.value.snapshots
      .filter((snapshot) => snapshot.queryId === queryId)
      .reduce<number>((latest, snapshot) => Math.max(latest, snapshot.capturedAt), 0)
    if (now - lastForQuery < SNAPSHOT_THROTTLE_MS) return

    const listings = readListingPrices()
    if (!listings.length) return

    const rates = await ensureRates(page)

    const result = computeSnapshot(listings, rates)
    if (!result) return

    await store.recordSnapshot({ queryId, capturedAt: now, ...result })
  }

  function watchResultsForSnapshot(getPage: () => TradePage | null) {
    let debounceTimer: number | undefined
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer)
      debounceTimer = ctx.setTimeout(() => void maybeCaptureSnapshot(getPage()), OBSERVER_DEBOUNCE_MS)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onInvalidated(() => observer.disconnect())

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }

  return { maybeCaptureSnapshot, watchResultsForSnapshot }
}
