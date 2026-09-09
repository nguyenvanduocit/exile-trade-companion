import { sendMessage } from '@/lib/extension-messaging'
import { useTradeStore } from './useTradeStore'
import type { CurrencyId, ExchangeRateCache } from '@/types/pricing'
import type { Game } from '@/types/trading'

const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const RETRY_DELAY_MS = 60 * 1000
type RatePage = { game: Game; league: string }
type Rates = Record<CurrencyId, number>

// Labels and snapshots can request the same quote during one DOM update.
const pending = new Map<string, Promise<Rates>>()
const retryAfter = new Map<string, number>()

export function isExchangeRateCacheFresh(cache: ExchangeRateCache | null, page: RatePage): boolean {
  return cache != null && cache.source === 'poe.ninja' && cache.game === page.game
    && cache.league === page.league && Date.now() - cache.fetchedAt < RATE_CACHE_TTL_MS
}

export function useExchangeRates() {
  const store = useTradeStore()

  async function ensureRates(page: RatePage): Promise<Rates> {
    const cache = store.state.value.exchangeRate
    if (isExchangeRateCacheFresh(cache, page)) return cache!.rates

    const key = JSON.stringify([page.game, page.league])
    const inflight = pending.get(key)
    if (inflight) return inflight
    if (Date.now() < (retryAfter.get(key) ?? 0)) return {}

    const request = (async () => {
      const rates = await sendMessage('fetchExchangeRates', { game: page.game, league: page.league }).catch(() => null)
      if (!rates || !Object.keys(rates).length) {
        retryAfter.set(key, Date.now() + RETRY_DELAY_MS)
        return {}
      }
      await store.setExchangeRateCache({ game: page.game, league: page.league, source: 'poe.ninja', fetchedAt: Date.now(), rates })
      retryAfter.delete(key)
      return rates
    })()
    pending.set(key, request)
    try {
      return await request
    } finally {
      pending.delete(key)
    }
  }

  return { ensureRates }
}
