// Chạy trong MAIN world để với tới window.app (Vue 2 + Vuex của trade site).
// Gắn nút "+"/"-" vào từng dòng mod trong kết quả; "+" thêm stat vào group đầu tiên của Stat
// Filters, "-" thêm vào group "not" đầu tiên tìm thấy (tự tạo group "not" nếu chưa có).
import { parseStatField, planAddStat, planAddStatNot, type AddStatPlan } from '@/lib/stat-filter'
import { SETTINGS_EVENT } from '@/lib/settings-bridge'
import type { TradeApp } from '@/lib/trade-app'
import type { TradeSettings } from '@/types/trading'

// Chạy trong MAIN world nên không có browser.i18n; chọn locale qua navigator.language của trang.
const MESSAGES = {
  vi: {
    statExists: (label: string) => `${label} đã có trong Stat Filters`,
    statAdded: (label: string) => `Đã thêm "${label}" vào Stat Filters`,
    addTitle: (label: string) => `Thêm "${label}" vào Stat Filters`,
    addNotTitle: (label: string) => `Thêm "${label}" vào group Not`,
  },
  en: {
    statExists: (label: string) => `${label} is already in Stat Filters`,
    statAdded: (label: string) => `Added "${label}" to Stat Filters`,
    addTitle: (label: string) => `Add "${label}" to Stat Filters`,
    addNotTitle: (label: string) => `Add "${label}" to Not group`,
  },
} as const

const t = MESSAGES[navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en']

const BUTTON_CLASS = 'etc-add-stat'
const BUTTON_NOT_CLASS = 'etc-not-stat'
const LINE_CLASS = 'etc-stat-line'
const STAT_LINE_SELECTOR = '.lc.s[data-field^="stat."], .lc.s[data-field^="statgroup."]'

const STYLE = `
.${LINE_CLASS} { position: relative; }
.${BUTTON_CLASS}, .${BUTTON_NOT_CLASS} {
  display: inline-grid; place-items: center; vertical-align: middle; overflow: hidden;
  position: relative; z-index: 5;
  width: 0; height: 18px; margin-left: 0; padding: 0;
  border: 1px solid transparent;
  background: #1c2026; color: #fff8e1; font: 14px/1 FontinSmallCaps, sans-serif;
  cursor: pointer; opacity: 0;
  transition: width 120ms, margin-left 120ms, opacity 120ms, background-color 120ms, border-color 120ms;
}
.${BUTTON_CLASS} { border-radius: 3px 0 0 3px; }
.${BUTTON_NOT_CLASS} { border-radius: 0 3px 3px 0; }
.${LINE_CLASS}:hover .${BUTTON_CLASS}, .${BUTTON_CLASS}:focus-visible {
  width: 18px; margin-left: 6px; opacity: 1; border-color: #634928;
}
.${LINE_CLASS}:hover .${BUTTON_NOT_CLASS}, .${BUTTON_NOT_CLASS}:focus-visible {
  width: 18px; margin-left: -1px; opacity: 1; border-color: #634928;
}
.${BUTTON_CLASS}:hover, .${BUTTON_CLASS}:focus-visible { border-color: #a38d6d; background: #2c2011; outline: none; z-index: 6; }
.${BUTTON_NOT_CLASS}:hover, .${BUTTON_NOT_CLASS}:focus-visible { border-color: #af5a4a; background: #2c1111; outline: none; z-index: 6; }
.${BUTTON_CLASS}[data-added="true"] { width: 18px; margin-left: 6px; opacity: 1; border-color: #8a6a3a; color: #a38d6d; cursor: default; }
.${BUTTON_NOT_CLASS}[data-added="true"] { width: 18px; margin-left: -1px; opacity: 1; border-color: #8a4a3a; color: #c08a7a; cursor: default; }
`

function injectStyle() {
  const style = document.createElement('style')
  style.dataset.exileTradeCompanion = 'add-stat'
  style.textContent = STYLE
  document.head.append(style)
}

function toast(app: TradeApp, msg: string) {
  app.$refs.toastr?.Add({ msg, progressbar: false, timeout: 2000 })
}

function applyPlan(app: TradeApp, button: HTMLButtonElement, plan: AddStatPlan, groupType: 'and' | 'not', label: string) {
  if (plan.action === 'exists') {
    button.dataset.added = 'true'
    toast(app, t.statExists(label))
    return
  }

  if (plan.action === 'add-group') app.$store.commit('pushStatGroup', { type: groupType, filters: [plan.value] })
  else app.$store.commit('setStatFilter', { group: plan.group, value: plan.value })
  app.$store.commit('showAdvancedSearch', true)
  app.save(true)
  button.dataset.added = 'true'
  toast(app, t.statAdded(label))
}

function addStat(app: TradeApp, button: HTMLButtonElement, id: string, label: string) {
  applyPlan(app, button, planAddStat(app.$store.state.persistent.stats, id), 'and', label)
}

function addStatNot(app: TradeApp, button: HTMLButtonElement, id: string, label: string) {
  applyPlan(app, button, planAddStatNot(app.$store.state.persistent.stats, id), 'not', label)
}

function makeButton(id: string, label: string, options: { className: string; symbol: string; title: string; onClick: (app: TradeApp, button: HTMLButtonElement) => void }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = options.className
  button.textContent = options.symbol
  button.title = options.title
  button.setAttribute('aria-label', options.title)
  button.addEventListener('click', (event) => {
    // Site dùng click trên .lc.s để sort kết quả, nút này không được kích cái đó.
    event.preventDefault()
    event.stopPropagation()
    const app = window.app
    if (!app) return
    options.onClick(app, button)
  })
  return button
}

function decorate(line: HTMLElement) {
  const id = parseStatField(line.dataset.field)
  if (!id) return
  const host = line.parentElement
  if (!host || host.querySelector(`.${BUTTON_CLASS}`)) return

  const label = line.textContent?.trim() ?? id
  const addButton = makeButton(id, label, {
    className: BUTTON_CLASS,
    symbol: '+',
    title: t.addTitle(label),
    onClick: (app, button) => addStat(app, button, id, label),
  })
  const notButton = makeButton(id, label, {
    className: BUTTON_NOT_CLASS,
    symbol: '−',
    title: t.addNotTitle(label),
    onClick: (app, button) => addStatNot(app, button, id, label),
  })

  host.classList.add(LINE_CLASS)
  line.after(addButton, notButton)
}

function decorateWithin(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(STAT_LINE_SELECTOR).forEach(decorate)
}

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
    injectStyle()

    let observer: MutationObserver | undefined

    function start() {
      if (observer) return
      decorateWithin(document)
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) decorateWithin(node)
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    function stop() {
      observer?.disconnect()
      observer = undefined
    }

    // MAIN world không có browser.storage — chờ trade.content (isolated world) bắn setting hiện
    // tại qua CustomEvent rồi mới quyết định chạy; tắt setting thì decorateWithin/observer không
    // bao giờ chạy, không phải chạy rồi ẩn UI bằng CSS.
    // CustomEvent#detail dạng object bị null hoá khi băng qua ranh giới MAIN/ISOLATED world thật —
    // isolated world (trade.content/index.ts) bắn JSON string, tự parse lại ở đây.
    window.addEventListener(SETTINGS_EVENT, (event) => {
      const settings = JSON.parse((event as CustomEvent<string>).detail) as TradeSettings
      if (settings.statFilterButtonsEnabled) start()
      else stop()
    })
  },
})
