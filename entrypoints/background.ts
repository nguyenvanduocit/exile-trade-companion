import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { DISCORD_URL } from '@/lib/discord'
import { parseTradeUrl } from '@/lib/trade-url'
import { saveSearch } from '@/lib/storage'
import type { ExtensionMessage, TradePage } from '@/types/trading'

const SAVE_MENU_ID = 'save-exile-trade-search'

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
  })
})
