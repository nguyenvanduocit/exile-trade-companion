// Chạy trong MAIN world để với tới window.app (Vue 2 + Vuex của trade site).
// Suy ra nhãn "đang mua gì" từ state.persistent.name/type + DOM filter, bắn qua CustomEvent
// cho content script chính (isolated world) dùng làm title khi lưu search.
// Đồng thời nghe chiều ngược lại: sidebar (isolated world) bắn SAVE_TOAST_EVENT khi lưu search,
// script này hiện toast bằng toastr có sẵn của site thay vì tự vẽ UI thông báo.
import { buildQueryLabel, QUERY_STATE_EVENT, type QueryStateDetail } from '@/lib/query-label'
import { SAVE_TOAST_EVENT } from '@/lib/save-toast'
import type { TradeApp } from '@/lib/trade-app'
import type { TradeQuery } from '@/types/trading'

function categoryLabel(): string | null {
  const title = [...document.querySelectorAll('.filter-title')]
    .find((el) => el.textContent?.trim().startsWith('Item Category'))
  const row = title?.closest('.filter-body')
  const input = row?.querySelector<HTMLInputElement>('.filter-select .multiselect__input')
  return input?.placeholder?.trim() || null
}

function rarityLabel(): string | null {
  const title = [...document.querySelectorAll('.filter-title')]
    .find((el) => el.textContent?.trim().startsWith('Item Rarity'))
  const row = title?.closest('.filter-body')
  const input = row?.querySelector<HTMLInputElement>('.filter-select .multiselect__input')
  return input?.placeholder?.trim() || null
}

function exchangeAlts(): string[] {
  return [...document.querySelectorAll<HTMLImageElement>('.exchange-filter-item.active img')]
    .map((img) => img.alt)
    .filter(Boolean)
}

// Đọc text đọc được của từng dòng stat filter (vd "#% increased Rarity of Items found") trong
// nhóm "Stat Filters" — mỗi dòng stat có icon `.mutate-type` (explicit/pseudo/implicit...),
// group header của nhóm/subgroup thì không, nên lọc theo đó để không lẫn tiêu đề nhóm.
function statLabels(): string[] {
  const groupTitle = [...document.querySelectorAll('.filter-title')]
    .find((el) => el.textContent?.trim().startsWith('Stat Filters'))
  const group = groupTitle?.closest('.filter-group')
  if (!group) return []
  return [...group.querySelectorAll('.filter-group-body .filter-title-clickable')]
    .filter((el) => el.querySelector('.mutate-type'))
    .map((el) => el.querySelector('span')?.textContent?.trim())
    .filter((text): text is string => Boolean(text))
}

function currentLabel(app: TradeApp): string | null {
  const { name, type } = app.$store.state.persistent
  return buildQueryLabel({
    name,
    type,
    rarityLabel: rarityLabel(),
    categoryLabel: categoryLabel(),
    statLabels: statLabels(),
    exchangeAlts: exchangeAlts(),
  })
}

// Bản sao thuần dữ liệu của state.persistent, không kèm id/tab/realm/league (route-derived, không
// thuộc nội dung query) — dùng để lưu kèm bookmark và dựng lại durable URL sau này.
function currentQuery(app: TradeApp): TradeQuery {
  const { status, name, type, term, disc, stats, filters, exchange } = app.$store.state.persistent
  return { status, name, type, term, disc, stats, filters, exchange }
}

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

  async main() {
    const app = await waitForApp()
    let pending: number | undefined
    let lastSerialized: string | undefined

    function emit() {
      const detail: QueryStateDetail = { label: currentLabel(app), query: currentQuery(app) }
      // So sánh cả query (không chỉ label) trước khi bắn event — MutationObserver/store watch bắn
      // rất thường xuyên, tránh dispatch (và kéo theo recordHistory ở phía nghe) khi state thật ra
      // chưa đổi gì so với lần emit trước.
      const serialized = JSON.stringify(detail)
      if (serialized === lastSerialized) return
      lastSerialized = serialized
      window.dispatchEvent(new CustomEvent<QueryStateDetail>(QUERY_STATE_EVENT, { detail }))
    }

    function scheduleEmit() {
      if (pending) window.clearTimeout(pending)
      pending = window.setTimeout(emit, 150)
    }

    emit()
    app.$store.watch((state) => state.persistent, scheduleEmit, { deep: true })

    const observer = new MutationObserver(scheduleEmit)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'placeholder'] })

    window.addEventListener(SAVE_TOAST_EVENT, (event) => {
      const msg = (event as CustomEvent<string>).detail
      if (msg) app.$refs.toastr?.Add({ msg, progressbar: false, timeout: 2000 })
    })
  },
})
