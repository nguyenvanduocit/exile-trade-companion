import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { DISCORD_URL } from '@/lib/discord'
import { fetchExchangeRates } from '@/lib/exchange-rate'
import { parseTradeUrl } from '@/lib/trade-url'
import { readState, saveSearch } from '@/lib/storage'
import { onMessage, sendMessage } from '@/lib/extension-messaging'
import { ninjaCharacterUrl, ninjaIndexStateUrl, parseNinjaUrl, resolveNinjaSnapshot, type NinjaCharacter, type NinjaFetchResult, type NinjaIndexState } from '@/lib/ninja-import'
import { looksLikePobCode, type PobFetchResult } from '@/lib/pob-import'
import { buildIntakeBody, createBatcher, intakeUrl, TELEMETRY_SERVICE, type TelemetryEvent } from '@/lib/telemetry'

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
    // queryStateChanged qua window-messaging) để lấy currentPage kèm query thay vì chỉ parse URL.
    const pagePromise = tab.id
      ? sendMessage('getCurrentPage', undefined, tab.id).catch(() => null)
      : Promise.resolve(null)

    void pagePromise.then((page) => page ?? fallback).then((page) => {
      if (page) void saveSearch(page)
    })
  })

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'toggle-trade-companion') return
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void sendMessage('togglePanel', undefined, tab.id).catch(() => undefined)
      }
    })
  })

  // Chrome MV3 cấp API qua `action`, Firefox MV2 (xem `wxt build:firefox`) qua `browser_action` —
  // wxt/browser không tự map namespace (chỉ trỏ thẳng globalThis.browser/chrome), nên tự chọn cái
  // nào tồn tại lúc runtime thay vì gọi cứng `browser.action`.
  const toolbarAction = browser.action ?? browser.browserAction
  toolbarAction.onClicked.addListener((tab) => {
    if (!tab.id || !parseTradeUrl(tab.url ?? '')) return
    void sendMessage('openPanel', undefined, tab.id).catch(() => undefined)
  })

  onMessage('openUrl', ({ data: url, sender }) => {
    if (!parseTradeUrl(url)) return
    if (sender.tab?.id) {
      void browser.tabs.update(sender.tab.id, { url })
    } else {
      void browser.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => (tab?.id ? browser.tabs.update(tab.id, { url }) : browser.tabs.create({ url })))
    }
  })

  onMessage('openDiscord', () => {
    void browser.tabs.create({ url: DISCORD_URL })
  })

  onMessage('openOnboarding', () => {
    void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
  })

  onMessage('saveActiveSearch', ({ data: page }) => {
    void saveSearch(page)
  })

  onMessage('fetchNinjaCharacter', ({ data: url }) => fetchNinjaCharacter(url))
  onMessage('fetchExchangeRates', ({ data }) => fetchExchangeRates(data.game, data.league))
  onMessage('fetchPobCode', ({ data: url }) => fetchPobCode(url))
  onMessage('track', ({ data: event }) => telemetry.push(event))
  self.addEventListener('error', (event) => telemetry.push({ name: 'background.error', props: { message: String(event.message).slice(0, 200) } }))
  self.addEventListener('unhandledrejection', (event) => telemetry.push({ name: 'background.error', props: { message: String((event as PromiseRejectionEvent).reason).slice(0, 200) } }))
})

// Hai request nội bộ của poe.ninja (xem docs/research/2026-09-05-poeninja-import.md): index-state
// cho version snapshot hiện tại của league, rồi character theo version đó. Character không nằm
// trên ladder trả {"status":404} với HTTP 200.
async function fetchNinjaCharacter(url: string): Promise<NinjaFetchResult> {
  const link = parseNinjaUrl(url)
  if (!link) return { ok: false, reason: 'invalid-url' }
  try {
    const indexResponse = await fetch(ninjaIndexStateUrl(link.game), { headers: { Accept: 'application/json' } })
    if (!indexResponse.ok) return { ok: false, reason: 'network' }
    const snapshot = resolveNinjaSnapshot((await indexResponse.json()) as NinjaIndexState, link.leagueSlug)
    if (!snapshot) return { ok: false, reason: 'league-not-found' }

    const characterResponse = await fetch(ninjaCharacterUrl(link, snapshot), { headers: { Accept: 'application/json' } })
    if (characterResponse.status === 404) return { ok: false, reason: 'character-not-found' }
    if (!characterResponse.ok) return { ok: false, reason: 'network' }
    const character = (await characterResponse.json()) as NinjaCharacter & { status?: number }
    if (character.status === 404 || !Array.isArray(character.items)) return { ok: false, reason: 'character-not-found' }
    return { ok: true, character }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

// pobb.in/<id>/raw trả PoB code text/plain (verify 2026-09-06); id sai trả trang HTML 404.
async function fetchPobCode(url: string): Promise<PobFetchResult> {
  try {
    const response = await fetch(url, { headers: { Accept: 'text/plain' } })
    if (response.status === 404) return { ok: false, reason: 'not-found' }
    if (!response.ok) return { ok: false, reason: 'network' }
    const code = (await response.text()).trim()
    return looksLikePobCode(code) ? { ok: true, code } : { ok: false, reason: 'not-found' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

// Telemetry ẩn danh (xem PRIVACY.md): background là proxy duy nhất gửi tới Datadog Logs intake, nên
// tab pathofexile.com không có request nào ra ngoài. Tắt được ở Settings; không có client token
// (dev chưa cấu hình .env) thì bỏ qua. installId ngẫu nhiên, không gắn với account.
const DATADOG_CLIENT_TOKEN = import.meta.env.VITE_DATADOG_CLIENT_TOKEN as string | undefined
const DATADOG_SITE = (import.meta.env.VITE_DATADOG_SITE as string | undefined) || 'datadoghq.com'
const INSTALL_ID_KEY = 'exile-trade-companion-install-id'

async function installId(): Promise<string> {
  const stored = await browser.storage.local.get(INSTALL_ID_KEY)
  const existing = stored[INSTALL_ID_KEY]
  if (typeof existing === 'string' && existing) return existing
  const id = crypto.randomUUID()
  await browser.storage.local.set({ [INSTALL_ID_KEY]: id })
  return id
}

const telemetry = createBatcher({
  async flush(events: TelemetryEvent[]) {
    if (!DATADOG_CLIENT_TOKEN) return
    const state = await readState()
    if (!state.settings.telemetryEnabled) return
    const body = buildIntakeBody(events, {
      service: TELEMETRY_SERVICE,
      version: browser.runtime.getManifest().version,
      env: import.meta.env.MODE,
      installId: await installId(),
    })
    await fetch(intakeUrl(DATADOG_SITE, DATADOG_CLIENT_TOKEN), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true })
  },
})
