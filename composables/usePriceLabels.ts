import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { fetchExchangeRates } from '@/lib/exchange-rate'
import { buildPriceLabelParts, PRICE_LABEL_CLASS, PRICE_LABEL_ICON_CLASS } from '@/lib/price-labels'
import type { PriceLabelPart } from '@/lib/price-labels'
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
  // Icon thật của từng currency, "mượn" từ chính ảnh trang đã render cho listing khác — tích
  // luỹ dần qua các lần applyLabels nên không cần tự host asset. Currency nào trang chưa từng
  // hiện (hiếm khi xảy ra, thường trang có đủ chaos/divine ngay từ trang đầu) thì fallback chữ.
  const iconCache = new Map<CurrencyId, string>()

  function appendPricePart(container: HTMLElement, part: PriceLabelPart) {
    container.append(document.createTextNode(part.text))
    const iconSrc = iconCache.get(part.currency)
    if (iconSrc) {
      const img = document.createElement('img')
      img.src = iconSrc
      img.alt = part.currency
      img.className = PRICE_LABEL_ICON_CLASS
      container.append(img)
    } else {
      container.append(document.createTextNode(part.currency === 'chaos' ? 'c' : ` ${part.currency}`))
    }
  }

  function renderPriceLabel(container: HTMLElement, parts: PriceLabelPart[]) {
    const [primary, secondary] = parts as [PriceLabelPart, PriceLabelPart?]
    appendPricePart(container, primary)
    if (!secondary) return
    container.append(document.createTextNode(' (≈'))
    appendPricePart(container, secondary)
    container.append(document.createTextNode(')'))
  }

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
      rates = { ...rates, ...fetched }

      // Currency thanh khoản thấp (mirror, hinekora's lock...) hiếm khi có offer đổi thẳng
      // sang chaos — bulk exchange của chúng thường chỉ thanh khoản qua divine. Fallback: quy
      // đổi những currency còn thiếu qua divine rồi nhân lại chaos-per-divine đã có.
      const stillMissing = missing.filter((currency) => currency !== 'divine' && !(currency in fetched))
      if (stillMissing.length && rates['divine']) {
        const viaDivine = await fetchExchangeRates(page.game, page.league, stillMissing, 'divine')
        for (const currency of stillMissing) {
          const divinePerUnit = viaDivine[currency]
          if (divinePerUnit != null) rates[currency] = divinePerUnit * rates['divine']!
        }
      }

      for (const currency of missing) {
        if (!(currency in rates)) unresolvedCurrencies.add(currency)
      }
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

    const allRows = readListingRows()
    for (const row of allRows) {
      if (!iconCache.has(row.currency)) iconCache.set(row.currency, row.iconSrc)
    }

    const rows = allRows.filter((row) => !row.el.hasAttribute(DECORATED_ATTR))
    if (!rows.length) return

    const rates = await ensureRates(page, rows.map((row) => row.currency))

    for (const row of rows) {
      row.el.setAttribute(DECORATED_ATTR, 'true')
      const parts = buildPriceLabelParts(row.amount, row.currency, rates)
      if (!parts) continue

      const span = document.createElement('span')
      span.className = PRICE_LABEL_CLASS
      renderPriceLabel(span, parts)
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
