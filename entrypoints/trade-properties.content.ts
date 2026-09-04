// Chạy trong MAIN world để với tới window.app (Vue 2 + Vuex của trade site).
// Gắn nút "+"/"-" vào từng dòng attribute (Armour, Quality, Block, Runic Ward, Requirements...)
// của item — khác Stat Filters (trade-stats.content.ts), các dòng này set thẳng vào ô min/max của
// filter tương ứng bên sidebar trái: "+" set min = giá trị dòng, "-" set max = 0.
import { parsePropertyField, parsePropertyValue, planSetPropertyMaxZero, planSetPropertyMin, resolvePropertyGroup } from '@/lib/property-filter'
import { SETTINGS_EVENT } from '@/lib/settings-bridge'
import type { TradeApp } from '@/lib/trade-app'
import type { TradeSettings } from '@/types/trading'

// Chạy trong MAIN world nên không có browser.i18n; chọn locale qua navigator.language của trang.
const MESSAGES = {
  vi: {
    minSet: (label: string, value: number) => `Đã đặt min "${label}" = ${value}`,
    maxZeroSet: (label: string) => `Đã đặt max "${label}" = 0`,
    addTitle: (label: string, value: number) => `Đặt min "${label}" = ${value}`,
    addNotTitle: (label: string) => `Đặt max "${label}" = 0`,
  },
  en: {
    minSet: (label: string, value: number) => `Set min "${label}" = ${value}`,
    maxZeroSet: (label: string) => `Set max "${label}" = 0`,
    addTitle: (label: string, value: number) => `Set min "${label}" = ${value}`,
    addNotTitle: (label: string) => `Set max "${label}" = 0`,
  },
} as const

const t = MESSAGES[navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en']

const BUTTON_CLASS = 'etc-add-prop'
const BUTTON_NOT_CLASS = 'etc-not-prop'
const LINE_CLASS = 'etc-prop-line'
const DECORATED_ATTR = 'etcPropDecorated'
const PROPERTY_LINE_SELECTOR = 'span.s[data-field]'

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
  style.dataset.exileTradeCompanion = 'add-property'
  style.textContent = STYLE
  document.head.append(style)
}

function toast(app: TradeApp, msg: string) {
  app.$refs.toastr?.Add({ msg, progressbar: false, timeout: 2000 })
}

function setMin(app: TradeApp, button: HTMLButtonElement, group: string, field: string, value: number, label: string) {
  const existing = app.$store.state.persistent.filters[group]?.filters[field]
  app.$store.commit('setPropertyFilter', { group, index: field, value: planSetPropertyMin(existing, value) })
  button.dataset.added = 'true'
  app.save(true)
  toast(app, t.minSet(label, value))
}

function setMaxZero(app: TradeApp, button: HTMLButtonElement, group: string, field: string, label: string) {
  const existing = app.$store.state.persistent.filters[group]?.filters[field]
  app.$store.commit('setPropertyFilter', { group, index: field, value: planSetPropertyMaxZero(existing) })
  button.dataset.added = 'true'
  app.save(true)
  toast(app, t.maxZeroSet(label))
}

function makeButton(options: { className: string; symbol: string; title: string; onClick: (app: TradeApp, button: HTMLButtonElement) => void }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = options.className
  button.textContent = options.symbol
  button.title = options.title
  button.setAttribute('aria-label', options.title)
  button.addEventListener('click', (event) => {
    // Site dùng click trên .lc/.s để sort kết quả, nút này không được kích cái đó.
    event.preventDefault()
    event.stopPropagation()
    const app = window.app
    if (!app) return
    options.onClick(app, button)
  })
  return button
}

function decorate(line: HTMLElement) {
  if (line.dataset[DECORATED_ATTR]) return
  const field = parsePropertyField(line.dataset.field)
  if (!field) return
  const group = resolvePropertyGroup(field, location.pathname.startsWith('/trade2/'))
  if (!group) return
  const label = line.textContent?.trim() ?? field
  const value = parsePropertyValue(label)
  if (value === null) return

  // Requirements gộp nhiều field (Level, Str, Dex, Int) vào chung một dòng ".item-property" —
  // dùng ancestor row làm host hover-reveal, đánh dấu decorated ngay trên field span để không bị
  // guard "host đã có nút" bỏ sót field thứ hai/ba cùng row.
  const host = line.closest('.item-property') ?? line.parentElement
  if (!host) return
  line.dataset[DECORATED_ATTR] = 'true'
  host.classList.add(LINE_CLASS)

  const addButton = makeButton({
    className: BUTTON_CLASS,
    symbol: '+',
    title: t.addTitle(label, value),
    onClick: (app, button) => setMin(app, button, group, field, value, label),
  })
  const notButton = makeButton({
    className: BUTTON_NOT_CLASS,
    symbol: '−',
    title: t.addNotTitle(label),
    onClick: (app, button) => setMaxZero(app, button, group, field, label),
  })

  // append (không after): dòng DPS/Physical DPS/Elemental DPS nằm trong ".itemPopupAdditional"
  // (flex column) — after() biến 2 nút thành flex item riêng, tự xuống hàng và đè lên property
  // list bên trái do container đó position:absolute. append() giữ nút bên trong span của field,
  // luôn nằm sát text bất kể host là block hay flex.
  line.append(addButton, notButton)
}

function decorateWithin(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(PROPERTY_LINE_SELECTOR).forEach(decorate)
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
    window.addEventListener(SETTINGS_EVENT, (event) => {
      const settings = (event as CustomEvent<TradeSettings>).detail
      if (settings.propertyFilterButtonsEnabled) start()
      else stop()
    })
  },
})
