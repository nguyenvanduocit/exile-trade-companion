import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { DISCORD_URL } from '@/lib/discord'
import { buildDurableUrl, parseTradeUrl } from '@/lib/trade-url'
import { STORAGE_KEY, isSearchVisible, markWatchlistSeen, readState, recordWatchlistCount, saveSearch, updateSearch } from '@/lib/storage'
import { diffWatchlistTabs, searchIdForTab } from '@/lib/watchlist'
import type { ExtensionMessage, TradePage } from '@/types/trading'

const SAVE_MENU_ID = 'save-exile-trade-search'
// chrome.storage.session: sống trong phiên browser hiện tại, mất khi đóng hẳn browser, sống sót
// qua việc service worker MV3 bị Chrome kill & restart giữa chừng — đúng ý nghĩa "tab nền chỉ
// tồn tại trong phiên browser hiện tại", và không cần giữ state quan trọng trong biến JS thường.
const WATCHLIST_TABS_KEY = 'watchlistTabs'

async function getWatchlistTabMap(): Promise<Record<string, number>> {
  const stored = await browser.storage.session.get(WATCHLIST_TABS_KEY)
  return (stored[WATCHLIST_TABS_KEY] as Record<string, number> | undefined) ?? {}
}

async function setWatchlistTabMap(map: Record<string, number>) {
  await browser.storage.session.set({ [WATCHLIST_TABS_KEY]: map })
}

async function liveTabIdsFrom(tabMap: Record<string, number>): Promise<Set<number>> {
  const ids = [...new Set(Object.values(tabMap))]
  const checks = await Promise.all(
    ids.map((id) => browser.tabs.get(id).then(() => id).catch(() => null)),
  )
  return new Set(checks.filter((id): id is number => id != null))
}

// Chuỗi hoá mọi lần gọi reconcile (storage change, tab đóng, service worker vừa thức dậy) — tránh
// hai lần chạy chồng lên nhau cùng đọc/ghi watchlistTabs và mở trùng tab cho cùng một search.
let reconcileChain: Promise<void> = Promise.resolve()

function scheduleWatchlistReconcile() {
  reconcileChain = reconcileChain.then(reconcileWatchlistTabs).catch(() => undefined)
  return reconcileChain
}

// Đồng bộ tab nền thật với danh sách search đang `watching`: mở tab còn thiếu (kể cả khi
// service worker/browser vừa restart làm mất tab thật hoặc storage.session), đóng tab dư khi
// user tắt watching hoặc xoá bookmark. Dùng buildDurableUrl để tab mở đúng search kể cả khi
// queryId gốc do GGG cấp đã hết hạn — mở qua browser.tabs.create là tự động hoá việc user tự tay
// mở tab và chạy search bằng UI thật của site, không phải gọi thẳng API search.
async function reconcileWatchlistTabs() {
  const state = await readState()
  const watchedSearches = state.searches.filter((search) => search.watching && isSearchVisible(state, search))
  const watchedSearchIds = watchedSearches.map((search) => search.id)

  const tabMap = await getWatchlistTabMap()
  const liveTabIds = await liveTabIdsFrom(tabMap)
  const { toOpen, toClose } = diffWatchlistTabs(watchedSearchIds, tabMap, liveTabIds)

  const nextMap = { ...tabMap }
  for (const [searchId, tabId] of Object.entries(tabMap)) {
    if (toClose.includes(tabId)) delete nextMap[searchId]
  }
  await Promise.all(toClose.map((tabId) => browser.tabs.remove(tabId).catch(() => undefined)))

  for (const searchId of toOpen) {
    const search = watchedSearches.find((entry) => entry.id === searchId)
    if (!search) continue
    const url = (await buildDurableUrl(search).catch(() => null)) ?? search.url
    const tab = await browser.tabs.create({ url, active: false }).catch(() => null)
    if (tab?.id != null) nextMap[searchId] = tab.id
  }

  await setWatchlistTabMap(nextMap)
}

async function focusWatchlistTab(searchId: string) {
  const tabMap = await getWatchlistTabMap()
  const tabId = tabMap[searchId]
  if (tabId == null) return
  try {
    const tab = await browser.tabs.get(tabId)
    await browser.tabs.update(tabId, { active: true })
    if (tab.windowId != null) await browser.windows.update(tab.windowId, { focused: true })
  } catch {
    // Tab đã mất giữa chừng — lần reconcile kế tiếp (storage change/tabs.onRemoved) tự mở lại.
  }
}

function notificationIdFor(searchId: string) {
  return `watchlist:${searchId}:${Date.now()}`
}

function searchIdFromNotificationId(notificationId: string): string | null {
  return /^watchlist:(.+):\d+$/.exec(notificationId)?.[1] ?? null
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: SAVE_MENU_ID,
        title: i18n.t('background.saveContextMenu'),
        contexts: ['page'],
        documentUrlPatterns: [
          'https://www.pathofexile.com/trade/*',
          'https://www.pathofexile.com/trade2/*',
          'https://pathofexile.com/trade/*',
          'https://pathofexile.com/trade2/*',
        ],
      })
    })

    if (details.reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
    }
  })

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SAVE_MENU_ID || !tab?.url) return
    const url = tab.url
    const fallback = parseTradeUrl(url, tab.title)

    // Background không có quyền vào MAIN world của tab, nên phải hỏi content script (đã nghe
    // QUERY_STATE_EVENT) để lấy currentPage kèm query thay vì chỉ parse URL.
    const pagePromise = tab.id
      ? browser.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PAGE' } satisfies ExtensionMessage).catch(() => null) as Promise<TradePage | null>
      : Promise.resolve(null)

    void pagePromise.then((page) => page ?? fallback).then((page) => {
      if (page) void saveSearch(page)
    })
  })

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'toggle-trade-companion') return
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtensionMessage).catch(() => undefined)
      }
    })
  })

  // Chrome MV3 cấp API qua `action`, Firefox MV2 (xem `wxt build:firefox`) qua `browser_action` —
  // wxt/browser không tự map namespace (chỉ trỏ thẳng globalThis.browser/chrome), nên tự chọn cái
  // nào tồn tại lúc runtime thay vì gọi cứng `browser.action`.
  const toolbarAction = browser.action ?? browser.browserAction
  toolbarAction.onClicked.addListener((tab) => {
    if (!tab.id || !parseTradeUrl(tab.url ?? '')) return
    void browser.tabs.sendMessage(tab.id, { type: 'OPEN_PANEL' } satisfies ExtensionMessage).catch(() => undefined)
  })

  browser.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
    if (message.type === 'OPEN_URL' && parseTradeUrl(message.url)) {
      if (sender.tab?.id) {
        void browser.tabs.update(sender.tab.id, { url: message.url })
      } else {
        void browser.tabs
          .query({ active: true, currentWindow: true })
          .then(([tab]) => (tab?.id ? browser.tabs.update(tab.id, { url: message.url }) : browser.tabs.create({ url: message.url })))
      }
    }

    if (message.type === 'OPEN_DISCORD') {
      void browser.tabs.create({ url: DISCORD_URL })
    }

    if (message.type === 'OPEN_ONBOARDING') {
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
    }

    if (message.type === 'SAVE_ACTIVE_SEARCH') {
      void saveSearch(message.page)
    }

    if (message.type === 'WATCHLIST_REPORT') {
      void recordWatchlistCount(message.searchId, message.count).then(({ isNew, state }) => {
        if (!isNew) return
        const search = state.searches.find((entry) => entry.id === message.searchId)
        if (!search) return
        void browser.notifications.create(notificationIdFor(message.searchId), {
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon/128.png'),
          title: i18n.t('watchlist.notificationTitle'),
          message: i18n.t('watchlist.notificationBody', { title: search.title }),
        })
      })
    }

    if (message.type === 'FOCUS_WATCHLIST_TAB') {
      void markWatchlistSeen(message.searchId).then(() => focusWatchlistTab(message.searchId))
    }

    if (message.type === 'WATCHLIST_TAB_IDENTIFY') {
      const tabId = sender.tab?.id
      if (tabId == null) return Promise.resolve({ searchId: null })
      return getWatchlistTabMap().then((tabMap) => ({ searchId: searchIdForTab(tabMap, tabId) }))
    }
  })

  browser.notifications.onClicked.addListener((notificationId) => {
    const searchId = searchIdFromNotificationId(notificationId)
    if (!searchId) return
    void markWatchlistSeen(searchId).then(() => focusWatchlistTab(searchId))
    void browser.notifications.clear(notificationId)
  })

  // Tab watchlist mất đi có 2 nguồn hoàn toàn khác nghĩa, phải phân biệt trước khi reconcile:
  // (a) chính reconcile vừa browser.tabs.remove() nó (do watching đã tắt/bookmark đã xoá) — lúc
  //     đó search tương ứng cũng đã watching:false rồi, không cần làm gì thêm;
  // (b) user tự tay đóng tab, hoặc tab crash ngoài dự kiến — searchIdForTab vẫn map tới tabId này
  //     vì KHÔNG có lượt reconcile nào chủ động xoá nó khỏi tabMap. Trường hợp (b) trước đây bị
  //     coi như "tab chết, mở lại" (đúng ý service worker restart) nhưng lại khiến user đóng tab
  //     tay là bị tự mở lại ngay — sai với ý định thật của user. Coi (b) là "user muốn dừng theo
  //     dõi", tắt watching thay vì mở tab mới.
  browser.tabs.onRemoved.addListener((tabId) => {
    void getWatchlistTabMap().then((tabMap) => {
      const searchId = searchIdForTab(tabMap, tabId)
      return searchId ? updateSearch(searchId, { watching: false }) : undefined
    }).then(() => scheduleWatchlistReconcile())
  })

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) void scheduleWatchlistReconcile()
  })

  // Service worker MV3 có thể bị Chrome kill và restart bất kỳ lúc nào — reconcile ngay khi
  // background thức dậy để phát hiện tab đã mất (và storage.session có thể cũng mất) rồi tự mở lại.
  void scheduleWatchlistReconcile()
})
