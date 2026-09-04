// Chạy trong MAIN world để với tới window.app (Vue 2 + Vuex của trade site).
// Gắn nút "+"/"-" vào từng dòng mod trong kết quả; "+" thêm stat vào group đầu tiên của Stat
// Filters, "-" thêm vào group "not" đầu tiên tìm thấy (tự tạo group "not" nếu chưa có).
import { activeStatIds, parseStatField, planAddStat, planAddStatNot, type AddStatPlan } from '@/lib/stat-filter'
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
const HIGHLIGHT_CLASS = 'etc-stat-highlight'
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
.${HIGHLIGHT_CLASS} { background: rgba(163, 141, 109, 0.22); box-shadow: inset 0 0 0 1px rgba(138, 106, 58, 0.65); border-radius: 2px; }
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

// Tô sáng những dòng mod khớp statId đang thực sự active trong Stat Filters hiện tại — activeIds
// tính sẵn một lần cho cả root (tránh đọc lại $store mỗi dòng), so trực tiếp bằng parseStatField
// để chắc chắn cùng cách tách id với nút +/− ở decorate().
function applyHighlight(root: ParentNode, activeIds: Set<string>) {
  root.querySelectorAll<HTMLElement>(STAT_LINE_SELECTOR).forEach((line) => {
    const id = parseStatField(line.dataset.field)
    line.classList.toggle(HIGHLIGHT_CLASS, id !== null && activeIds.has(id))
  })
}

// window.app có thể chưa sẵn sàng ngay tại document_idle (site còn đang khởi tạo Vue root) — poll
// tới khi $store xuất hiện, cùng pattern với trade-query.content.ts.
function waitForApp(): Promise<TradeApp> {
  return new Promise((resolve) => {
    const check = () => (window.app?.$store ? resolve(window.app) : setTimeout(check, 200))
    check()
  })
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
      // Gỡ hẳn nút đã chèn khi tắt — guard trong decorate() dựa trên sự tồn tại của nút
      // (host.querySelector('.etc-add-stat')), nên gỡ nút cũng tự reset guard cho lần bật lại.
      document.querySelectorAll(`.${BUTTON_CLASS}, .${BUTTON_NOT_CLASS}`).forEach((el) => el.remove())
      document.querySelectorAll(`.${LINE_CLASS}`).forEach((el) => el.classList.remove(LINE_CLASS))
    }

    // Subsystem highlight tách riêng khỏi start()/stop() của nút +/− ở trên — hai setting độc lập
    // nhau, bật/tắt cái này không được đổi hành vi cái kia. Cùng convention "mỗi feature một
    // MutationObserver riêng" đã dùng ở usePriceLabels/useWatchlist/usePriceSnapshot.
    let highlightObserver: MutationObserver | undefined
    let unwatchStats: (() => void) | undefined

    // `window.app` có thể đã tồn tại nhưng `$store` chưa kịp gắn vào (Vue root dựng trước, Vuex
    // wiring sau) — root cause thật của bug "highlight không bao giờ chạy" tối nay: check `!app`
    // không đủ, `app.$store` truy cập tiếp sẽ throw. Exception đó (khi xảy ra ở lần gọi ĐỒNG BỘ
    // đầu tiên trong startHighlight(), trước dòng myObserver.observe()) làm cả observer lẫn
    // waitForApp().then() phía sau KHÔNG BAO GIỜ được thiết lập, còn highlightObserver thì đã gán
    // nên mọi lần startHighlight() gọi lại sau đó (SETTINGS_EVENT bắn nhiều lần lúc trang hydrate)
    // đều bị guard `if (highlightObserver) return` chặn vĩnh viễn — verify bằng live test 2026-09-05
    // (log cho thấy 6 lần gọi đều bị chặn bởi đúng guard này). Check `$store` thay vì chỉ check `app`.
    function scanHighlight(root: ParentNode) {
      const app = window.app
      if (!app?.$store) return
      applyHighlight(root, activeStatIds(app.$store.state.persistent.stats))
    }

    function startHighlight() {
      if (highlightObserver) return
      // Rescan toàn document (không chỉ node vừa thêm) mỗi lần có mutation — kết quả search trên
      // trang trade thường tới sau một hard navigation (bấm Search điều hướng URL thật, không phải
      // SPA push-state), nên tại lúc mutation xảy ra window.app có thể mới sẵn sàng ngay trước đó;
      // scan lại toàn bộ đảm bảo không bỏ sót dòng nào bất kể node cụ thể nào được thêm vào DOM.
      const myObserver = new MutationObserver(() => scanHighlight(document))
      highlightObserver = myObserver
      scanHighlight(document)
      myObserver.observe(document.body, { childList: true, subtree: true })

      // Stat Filters có thể đổi mà không kèm DOM mutation (user thêm/xoá filter trong panel bên
      // trái mà chưa bấm Search lại) — Vuex 2 $store.watch báo lại để re-scan toàn document.
      void waitForApp().then((app) => {
        // stopHighlight() có thể đã chạy (và startHighlight() khác đã thay highlightObserver)
        // trước khi promise này resolve — bỏ qua, đừng gắn watch cho một lượt bật đã lỗi thời.
        if (highlightObserver !== myObserver) return
        unwatchStats = app.$store.watch((state) => state.persistent.stats, () => scanHighlight(document), { deep: true })
        scanHighlight(document)
      })
    }

    function stopHighlight() {
      highlightObserver?.disconnect()
      highlightObserver = undefined
      unwatchStats?.()
      unwatchStats = undefined
      // Gỡ retroactive như stop() ở trên — tắt setting không chỉ ngừng thêm mới mà phải dọn sạch
      // highlight đã gắn từ trước.
      document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS))
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

      if (settings.highlightSearchedModsEnabled) startHighlight()
      else stopHighlight()
    })
  },
})
