import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { parseTradeUrl } from '@/lib/trade-url'
import { saveSearch } from '@/lib/storage'
import type { ExtensionMessage } from '@/types/trading'

const SAVE_MENU_ID = 'save-exile-trade-search'

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
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
  })

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SAVE_MENU_ID || !tab?.url) return
    const page = parseTradeUrl(tab.url, tab.title)
    if (page) void saveSearch(page)
  })

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'toggle-trade-companion') return
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtensionMessage).catch(() => undefined)
      }
    })
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

    if (message.type === 'SAVE_ACTIVE_SEARCH') {
      void saveSearch(message.page)
    }
  })
})
