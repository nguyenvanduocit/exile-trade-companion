import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { fetchExchangeRates } from '@/lib/exchange-rate'
import { buildPriceLabel, PRICE_LABEL_CLASS } from '@/lib/price-labels'
import { readListingRows } from '@/lib/price-snapshot'
import { useTradeStore } from '@/composables/useTradeStore'
import type { CurrencyId } from '@/types/pricing'
import type { TradePage } from '@/types/trading'

const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const OBSERVER_DEBOUNCE_MS = 500
const DECORATED_ATTR = 'data-etc-price-labeled'

export function usePriceLabels(ctx: ContentScriptContext) {
  const store = useTradeStore()
  // Currency đã fetch mà API không trả rate (không có offer nào trên league) — nhớ trong phiên
  // này để pagination/infinite scroll không lặp lại request cho cùng currency vô ích.
  const unresolvedCurrencies = new Set<CurrencyId>()

  async function ensureRates(page: TradePage, currencies: CurrencyId[]): Promise<Record<CurrencyId, number>> {
    const now = Date.now()
    const cache = store.state.value.exchangeRate
    const cacheFresh = cache != null && cache.league === page.league && now - cache.fetchedAt < RATE_CACHE_TTL_MS
    if (!cacheFresh) unresolvedCurrencies.clear()

    // Nhãn cần rate cho MỌI currency đang hiển thị lẫn 'divine' — divine phải luôn có mặt để
    // hiện "(≈X div)" kể cả khi không có listing nào định giá bằng divine.
    const wanted = new Set(currencies)
    wanted.add('divine')
    wanted.delete('chaos')

    const missing = [...wanted].filter((currency) =>
      !unresolvedCurrencies.has(currency) && (!cacheFresh || !(currency in cache!.rates)))

    let rates: Record<CurrencyId, number> = cacheFresh ? { ...cache!.rates } : {}
    if (missing.length) {
      const fetched = await fetchExchangeRates(page.game, page.league, missing)
      for (const currency of missing) {
        if (!(currency in fetched)) unresolvedCurrencies.add(currency)
      }
      rates = { ...rates, ...fetched }
      await store.setExchangeRateCache({ league: page.league, fetchedAt: now, rates })
    }
    return rates
  }

  function removeLabels() {
    document.querySelectorAll(`.${PRICE_LABEL_CLASS}`).forEach((el) => el.remove())
    document.querySelectorAll(`[${DECORATED_ATTR}]`).forEach((el) => el.removeAttribute(DECORATED_ATTR))
  }

  async function applyLabels(page: TradePage | null) {
    if (!page || page.mode !== 'search') return
    if (!store.state.value.settings.priceLabelsEnabled) return

    const rows = readListingRows().filter((row) => !row.el.hasAttribute(DECORATED_ATTR))
    if (!rows.length) return

    const rates = await ensureRates(page, rows.map((row) => row.currency))

    for (const row of rows) {
      row.el.setAttribute(DECORATED_ATTR, 'true')
      const label = buildPriceLabel(row.amount, row.currency, rates)
      if (!label) continue

      const span = document.createElement('span')
      span.className = PRICE_LABEL_CLASS
      span.textContent = label
      row.el.after(span)
    }
  }

  function watchResultsForLabels(getPage: () => TradePage | null) {
    let debounceTimer: number | undefined
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer)
      debounceTimer = ctx.setTimeout(() => void applyLabels(getPage()), OBSERVER_DEBOUNCE_MS)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onInvalidated(() => observer.disconnect())

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }

  return { applyLabels, watchResultsForLabels, removeLabels }
}
