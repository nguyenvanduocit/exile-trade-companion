// Chạy trong MAIN world để với tới window.app (Vue 2 + Vuex của trade site).
// Gắn nút "+"/"-" vào từng dòng attribute (Armour, Quality, Block, Runic Ward, Requirements...)
// của item — khác Stat Filters (trade-stats.content.ts), các dòng này set thẳng vào ô min/max của
// filter tương ứng bên sidebar trái: "+" set min = giá trị dòng, "-" set max = giá trị dòng; xóa cận đối diện.
import { parsePropertyField, parsePropertyValue, planSetPropertyMax, planSetPropertyMin, resolvePropertyGroup, type PropertyFilterValue } from '@/lib/property-filter'
import { onMessage, sendMessage } from '@/lib/window-messaging'
import type { TradeApp } from '@/lib/trade-app'

// Chạy trong MAIN world nên không có browser.i18n; chọn locale qua navigator.language của trang.
const MESSAGES = {
  vi: {
    minSet: (label: string, value: number) => `Đã đặt min "${label}" = ${value}`,
    maxSet: (label: string, value: number) => `Đã đặt max "${label}" = ${value}`,
    addTitle: (label: string, value: number) => `Đặt min "${label}" = ${value}`,
    addNotTitle: (label: string, value: number) => `Đặt max "${label}" = ${value}`,
  },
  en: {
    minSet: (label: string, value: number) => `Set min "${label}" = ${value}`,
    maxSet: (label: string, value: number) => `Set max "${label}" = ${value}`,
    addTitle: (label: string, value: number) => `Set min "${label}" = ${value}`,
    addNotTitle: (label: string, value: number) => `Set max "${label}" = ${value}`,
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

// Property field (ar, ev, quality...) luôn là {min,max}; filter dạng {option} (rarity, category)
// cùng nằm trong persistent.filters nhưng không bao giờ trùng field id với property.
function rangeFilter(app: TradeApp, group: string, field: string): PropertyFilterValue | undefined {
  const existing = app.$store.state.persistent.filters[group]?.filters[field]
  return existing && !('option' in existing) ? existing : undefined
}

function setMin(app: TradeApp, group: string, field: string, value: number, label: string) {
  const existing = rangeFilter(app, group, field)
  app.$store.commit('setPropertyFilter', { group, index: field, value: planSetPropertyMin(existing, value) })
  app.save(true)
  toast(app, t.minSet(label, value))
}

function setMax(app: TradeApp, group: string, field: string, value: number, label: string) {
  const existing = rangeFilter(app, group, field)
  app.$store.commit('setPropertyFilter', { group, index: field, value: planSetPropertyMax(existing, value) })
  app.save(true)
  toast(app, t.maxSet(label, value))
}

function makeButton(options: { className: string; symbol: string; title: string; onClick: (app: TradeApp) => void }) {
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
    options.onClick(app)
    void sendMessage('featureUsed', 'property-filter-button').catch(() => undefined)
  })
  return button
}

function decorate(line: HTMLElement) {
  if (line.dataset[DECORATED_ATTR]) return
  // Damage ranges are sortable fields, not sidebar filters. Use the same item's
  // displayed DPS (including max-quality adjustments), and name that target in the tooltip.
  const dpsField = line.dataset.field === 'pdamage' ? 'pdps' : line.dataset.field === 'edamage' ? 'edps' : null
  const valueLine = dpsField
    ? line.closest('.row')?.querySelector<HTMLElement>(`[data-field="${dpsField}"]`)
    : line
  if (!valueLine) return
  const field = parsePropertyField(valueLine.dataset.field)
  if (!field) return
  const group = resolvePropertyGroup(field, location.pathname.startsWith('/trade2/'))
  if (!group) return
  const label = Array.from(valueLine.childNodes)
    .filter(node => node.nodeName !== 'BUTTON')
    .map(node => node.textContent).join('').trim()
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
    onClick: (app) => setMin(app, group, field, value, label),
  })
  const notButton = makeButton({
    className: BUTTON_NOT_CLASS,
    symbol: '−',
    title: t.addNotTitle(label, value),
    onClick: (app) => setMax(app, group, field, value, label),
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
      // Gỡ hẳn nút đã chèn khi tắt — DOM của các dòng property (Armour/ES/Damage/APS...) hiếm khi
      // bị site tự render lại, nên nếu chỉ disconnect observer thì nút cũ nằm lại vĩnh viễn dù đã
      // tắt setting (khác dòng Requirements, hay bị site re-render nên "tự" mất trông như đã tắt).
      document.querySelectorAll(`.${BUTTON_CLASS}, .${BUTTON_NOT_CLASS}`).forEach((el) => el.remove())
      document.querySelectorAll(`.${LINE_CLASS}`).forEach((el) => el.classList.remove(LINE_CLASS))
      document.querySelectorAll<HTMLElement>('[data-etc-prop-decorated]').forEach((el) => delete el.dataset[DECORATED_ATTR])
    }

    // MAIN world không có browser.storage — chờ trade.content (isolated world) bắn setting hiện
    // tại qua window-messaging rồi mới quyết định chạy; tắt setting thì decorateWithin/observer
    // không bao giờ chạy, không phải chạy rồi ẩn UI bằng CSS.
    onMessage('settingsUpdated', ({ data: settings }) => {
      if (settings.propertyFilterButtonsEnabled) start()
      else stop()
    })
  },
})
