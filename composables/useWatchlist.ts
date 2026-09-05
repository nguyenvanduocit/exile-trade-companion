import { ref } from 'vue'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { browser } from 'wxt/browser'
import { readListingPrices } from '@/lib/price-snapshot'
import { isSearchVisible } from '@/lib/storage'
import { useTradeStore } from '@/composables/useTradeStore'
import type { ExtensionMessage, TradePage } from '@/types/trading'

const OBSERVER_DEBOUNCE_MS = 800

export function useWatchlist(ctx: ContentScriptContext) {
  const store = useTradeStore()
  // searchId mà TAB NÀY được background gán khi mở (xem WATCHLIST_TAB_IDENTIFY ở background.ts) —
  // null nếu tab này không phải tab nền do watchlist mở (vd tab user tự tay mở).
  // Trade site tự viết lại URL sang một blob canonical khác ngay sau khi trang load (verify bằng
  // live test 2026-09-05: mở lại một bookmark, địa chỉ đổi dù cùng một search) — so khớp
  // queryId/URL của trang hiện tại với giá trị đã lưu lúc bookmark chỉ đúng trong khoảnh khắc đầu
  // tiên rồi gãy ngay sau đó. Danh tính do background gán qua handshake này mới ổn định suốt vòng
  // đời tab, nên là nguồn tin cậy chính; khớp theo URL chỉ còn dùng làm fallback cho tab user tự mở.
  const dedicatedSearchId = ref<string | null>(null)
  let identified = false
  let liveSearchActivated = false

  async function identifyTab() {
    if (identified) return
    identified = true
    const response = await browser.runtime
      .sendMessage({ type: 'WATCHLIST_TAB_IDENTIFY' } satisfies ExtensionMessage)
      .catch(() => null) as { searchId: string | null } | null
    dedicatedSearchId.value = response?.searchId ?? null
  }

  // Site có chế độ "Live Search" riêng (nút "Activate Live Search" trong thanh action của form
  // search, xem tmp/research/trade.js — component method toggleLive() giữ một kết nối mở với
  // server để đẩy listing mới về ngay, khác hẳn trang search tĩnh chỉ có đúng kết quả lúc load).
  // Tab nền watchlist PHẢI bật cái này thì mới thật sự "theo dõi" — nếu không, trang chỉ là ảnh
  // chụp một lần, không bao giờ tự có thêm listing mới để MutationObserver bắt được. Bấm nút DOM
  // thật (không đụng $store/component instance nội bộ, đã minified và có thể đổi theo patch) —
  // chỉ bấm đúng 1 lần cho tab này, và chỉ khi nút đang ở trạng thái "Activate" (chưa bật).
  function tryActivateLiveSearch() {
    if (liveSearchActivated || !dedicatedSearchId.value) return
    const button = [...document.querySelectorAll('button')]
      .find((el) => el.textContent?.trim() === 'Activate Live Search') as HTMLButtonElement | undefined
    if (!button) return
    liveSearchActivated = true
    button.click()
  }

  function matchWatchedSearch(page: TradePage) {
    if (dedicatedSearchId.value) {
      const dedicated = store.state.value.searches
        .find((search) => search.id === dedicatedSearchId.value && search.watching)
      if (dedicated) return dedicated
    }

    // Fallback cho tab KHÔNG phải do watchlist mở (user tự tay đang xem một search trùng với một
    // search đang theo dõi) — best-effort, có thể gãy sau khi site viết lại URL như trên.
    return store.state.value.searches.find((search) =>
      search.watching
      && isSearchVisible(store.state.value, search)
      && (search.queryId === page.queryId || search.url === page.url))
  }

  function reportListingCount(page: TradePage | null) {
    if (!page || page.mode !== 'search') return
    const search = matchWatchedSearch(page)
    if (!search) return

    const count = readListingPrices().length
    void browser.runtime.sendMessage({ type: 'WATCHLIST_REPORT', searchId: search.id, count } satisfies ExtensionMessage)
  }

  function watchResultsForWatchlist(getPage: () => TradePage | null) {
    void identifyTab().then(tryActivateLiveSearch)

    let debounceTimer: number | undefined
    const observer = new MutationObserver(() => {
      // Thử bật Live Search ngay mỗi lần DOM đổi (rẻ, tự guard chỉ chạy 1 lần) — nút có thể chưa
      // tồn tại lúc identifyTab() vừa resolve nếu trang còn đang render kết quả.
      tryActivateLiveSearch()
      window.clearTimeout(debounceTimer)
      debounceTimer = ctx.setTimeout(() => reportListingCount(getPage()), OBSERVER_DEBOUNCE_MS)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onInvalidated(() => observer.disconnect())

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }

  return { reportListingCount, watchResultsForWatchlist }
}
