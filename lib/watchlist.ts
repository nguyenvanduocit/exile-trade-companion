// Functional core cho tính năng watchlist-live: mọi hàm ở đây thuần (không đụng browser API),
// side-effect (mở/đóng tab, gọi storage, bắn notification) nằm ở entrypoints/background.ts.

// Trần số search theo dõi cùng lúc — LOW confidence, suy luận từ nghiên cứu Reddit trước đó
// ("trần 20 theo giới hạn site"), CHƯA tự verify độc lập bằng cách theo dõi thật 20+ search.
// Đặt thành hằng số riêng để dễ chỉnh nếu verify sau này ra con số khác.
export const MAX_WATCHED_SEARCHES = 20

export function canEnableWatching(currentWatchingCount: number): boolean {
  return currentWatchingCount < MAX_WATCHED_SEARCHES
}

// So khớp số lượng listing lần báo cáo trước với lần này để quyết định có phải "listing mới" hay
// không. `previousCount === undefined` nghĩa là chưa từng có baseline (search vừa được bật theo
// dõi) — chỉ thiết lập baseline, không bắn notification cho listing vốn đã có sẵn từ trước.
export function hasNewListings(previousCount: number | undefined, currentCount: number): boolean {
  if (previousCount == null) return false
  return currentCount > previousCount
}

export interface WatchlistTabDiff {
  // searchId cần mở tab nền mới (chưa có tab, hoặc tab cũ đã chết — bao gồm cả trường hợp
  // service worker/browser restart giữa chừng làm mất tab thật lẫn storage.session).
  toOpen: string[]
  // tabId cần đóng vì search tương ứng đã tắt theo dõi/bị xoá nhưng tab nền vẫn còn sống.
  toClose: number[]
}

// Tính diff giữa "nên có tab cho search nào" (watchedSearchIds) và "tab nào đang thực sự tồn tại"
// (liveTabIds, do phía gọi tự browser.tabs.get(...).catch(...) từng tab trong tabMap trước khi gọi
// hàm này) để biết cần mở thêm tab nào, đóng bớt tab nào.
export function diffWatchlistTabs(
  watchedSearchIds: string[],
  tabMap: Record<string, number>,
  liveTabIds: ReadonlySet<number>,
): WatchlistTabDiff {
  const toOpen = watchedSearchIds.filter((searchId) => {
    const tabId = tabMap[searchId]
    return tabId == null || !liveTabIds.has(tabId)
  })

  const watchedSet = new Set(watchedSearchIds)
  const toClose = Object.entries(tabMap)
    .filter(([searchId, tabId]) => !watchedSet.has(searchId) && liveTabIds.has(tabId))
    .map(([, tabId]) => tabId)

  return { toOpen, toClose }
}

// Trade site tự viết lại URL (client-side, sau khi tab đã load) sang một blob canonical khác —
// verify bằng live test 2026-09-05: mở lại một bookmark, URL đổi ngay sau khi trang render dù
// cùng một search — nên KHÔNG thể nhận diện "tab này thuộc search nào" bằng cách so khớp
// queryId/URL hiện tại của trang với giá trị đã lưu lúc bookmark (chỉ đúng trong khoảnh khắc đầu
// tiên, gãy ngay sau đó). Tab nền do background mở luôn có đúng một searchId cố định suốt vòng đời
// (browser.tabs.create một-tab-một-search), nên tra theo tabId trong tabMap đáng tin hơn nhiều.
export function searchIdForTab(tabMap: Record<string, number>, tabId: number): string | null {
  return Object.entries(tabMap).find(([, mappedTabId]) => mappedTabId === tabId)?.[0] ?? null
}
