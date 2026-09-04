import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { groupBySeller, readSellerRows } from '@/lib/seller-grouping'
import { useTradeStore } from '@/composables/useTradeStore'
import type { TradePage } from '@/types/trading'

const OBSERVER_DEBOUNCE_MS = 500
export const BULK_SELLER_ROW_CLASS = 'etc-bulk-seller-row'
export const BULK_SELLER_BADGE_CLASS = 'etc-bulk-seller-badge'
const DECORATED_ATTR = 'data-etc-bulk-seller-labeled'
// [data-field="indexed"] chứa một <a href="/account/view-profile/..."> thật (dùng để đọc tên
// seller — text content khớp), nhưng span cha của nó luôn co về 0x0 (verify sống 2026-09-05,
// pathofexile.com/trade2: getBoundingClientRect toàn số 0) nên chèn badge vào đó sẽ vô hình.
// Dòng "Acc: <tên>" thật sự hiển thị nằm trong span.character-name — chèn badge vào đây.
const CHARACTER_NAME_SELECTOR = '.character-name'

export function useSellerGrouping(ctx: ContentScriptContext) {
  const store = useTradeStore()

  function clearRow(el: Element) {
    el.classList.remove(BULK_SELLER_ROW_CLASS)
    el.removeAttribute(DECORATED_ATTR)
    el.querySelectorAll(`.${BULK_SELLER_BADGE_CLASS}`).forEach((badge) => badge.remove())
  }

  function removeGrouping() {
    readSellerRows().forEach((row) => clearRow(row.el))
  }

  function applyGrouping(page: TradePage | null) {
    if (!page || page.mode !== 'search') return
    if (!store.state.value.settings.bulkSellerHighlightEnabled) return

    const rows = readSellerRows()
    // Số item mỗi seller co giãn khi trang tải thêm listing (infinite scroll/sort lại) — luôn
    // dọn dấu cũ rồi tính lại từ counts hiện tại, thay vì chỉ xử lý row chưa từng thấy.
    rows.forEach((row) => clearRow(row.el))

    const counts = groupBySeller(rows)
    for (const row of rows) {
      const count = counts.get(row.seller) ?? 0
      if (count < 2) continue

      row.el.classList.add(BULK_SELLER_ROW_CLASS)
      row.el.setAttribute(DECORATED_ATTR, 'true')

      const characterName = row.el.querySelector(CHARACTER_NAME_SELECTOR)
      if (!characterName) continue
      const badge = document.createElement('span')
      badge.className = BULK_SELLER_BADGE_CLASS
      badge.textContent = `×${count}`
      characterName.append(badge)
    }
  }

  function watchResultsForGrouping(getPage: () => TradePage | null) {
    let debounceTimer: number | undefined
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer)
      debounceTimer = ctx.setTimeout(() => applyGrouping(getPage()), OBSERVER_DEBOUNCE_MS)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onInvalidated(() => observer.disconnect())

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }

  return { applyGrouping, watchResultsForGrouping, removeGrouping }
}
