// Chạy trong MAIN world để với tới window.app.static_.exchangeDataFlat — catalog currency của
// trade site, luôn đúng game của tab (/trade = POE1, /trade2 = POE2). Phục vụ nhãn quy đổi giá
// (isolated world): lấy icon thật của chaos/divine kể cả khi trang chưa hiện listing nào định
// giá bằng currency đó.
import { currencyIconUrls } from '@/lib/price-labels'
import { onCurrencyIconMessage } from '@/lib/window-messaging'
import type { TradeApp } from '@/lib/trade-app'

export default defineContentScript({
  matches: [
    'https://www.pathofexile.com/trade/*',
    'https://www.pathofexile.com/trade2/*',
    'https://pathofexile.com/trade/*',
    'https://pathofexile.com/trade2/*',
  ],
  world: 'MAIN',
  runAt: 'document_idle',

  main() {
    onCurrencyIconMessage('resolveCurrencyIcons', ({ data: ids }) => {
      const catalog = (window.app as TradeApp | undefined)?.static_?.exchangeDataFlat
      if (!catalog) throw new Error('catalog-unavailable')
      return currencyIconUrls(catalog, ids)
    })
  },
})
