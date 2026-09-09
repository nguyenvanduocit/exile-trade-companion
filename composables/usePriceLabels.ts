import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { useExchangeRates } from './useExchangeRates'
import { buildPriceLabelParts, PRICE_LABEL_CLASS, PRICE_LABEL_ICON_CLASS, PRICE_LABELED_ATTR } from '@/lib/price-labels'
import type { PriceLabelPart } from '@/lib/price-labels'
import { readListingRows } from '@/lib/price-snapshot'
import { sendCurrencyIconMessage } from '@/lib/window-messaging'
import { useTradeStore } from '@/composables/useTradeStore'
import type { CurrencyId } from '@/types/pricing'
import type { TradePage } from '@/types/trading'

const OBSERVER_DEBOUNCE_MS = 500

export function usePriceLabels(ctx: ContentScriptContext) {
  const store = useTradeStore()
  const { ensureRates } = useExchangeRates()
  // Icon thật của từng currency từ catalog của site (MAIN world trả về qua window-messaging),
  // hỏi một lần rồi giữ cho cả phiên. Catalog chưa load thì hỏi lại ở lần applyLabels sau;
  // currency không có trong catalog thì fallback chữ.
  const iconCache = new Map<CurrencyId, string>()

  async function ensureIcons(currencies: CurrencyId[]) {
    const missing = [...new Set(currencies)].filter((currency) => !iconCache.has(currency))
    if (!missing.length) return
    const urls = await sendCurrencyIconMessage('resolveCurrencyIcons', missing).catch(() => null)
    if (!urls) return
    for (const currency of missing) {
      const url = urls[currency]
      if (url) iconCache.set(currency, url)
    }
  }

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

  // Mọi phần trong nhãn đều là quy đổi (giá gốc nằm ở dòng của trang) nên phần nào cũng mang
  // "≈" và cùng một format, dù là một phần (listing chaos/divine) hay hai (currency khác).
  function renderPriceLabel(container: HTMLElement, parts: PriceLabelPart[]) {
    parts.forEach((part, index) => {
      container.append(document.createTextNode(index === 0 ? '≈' : ' ≈'))
      appendPricePart(container, part)
    })
  }

  function removeLabels() {
    document.querySelectorAll(`.${PRICE_LABEL_CLASS}`).forEach((el) => el.remove())
    document.querySelectorAll(`[${PRICE_LABELED_ATTR}]`).forEach((el) => el.removeAttribute(PRICE_LABELED_ATTR))
  }

  async function applyLabels(page: TradePage | null) {
    if (!page || page.mode !== 'search') return
    if (!store.state.value.settings.priceLabelsEnabled) return

    const rows = readListingRows().filter((row) => !row.el.hasAttribute(PRICE_LABELED_ATTR))
    if (!rows.length) return

    const rates = await ensureRates(page)
    await ensureIcons(['chaos', 'divine'])

    for (const row of rows) {
      const parts = buildPriceLabelParts(row.amount, row.currency, rates)
      if (!parts || !row.el.isConnected || row.el.hasAttribute(PRICE_LABELED_ATTR)) continue
      if (!store.state.value.settings.priceLabelsEnabled) return
      row.el.setAttribute(PRICE_LABELED_ATTR, 'true')

      const span = document.createElement('span')
      span.className = PRICE_LABEL_CLASS
      renderPriceLabel(span, parts)
      // Chèn vào trong [data-field="price"] (display: block, amount + icon nằm sau <br>) để nhãn
      // đứng ngay cạnh icon currency trên cùng dòng thay vì rớt xuống dòng riêng.
      row.el.append(span)
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
