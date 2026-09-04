export interface SellerRow {
  el: Element
  seller: string
}

const SELLER_LINK_SELECTOR = '[data-field="indexed"] a[href^="/account/view-profile/"]'

// Đọc trực tiếp từ DOM trang kết quả trade — chạy được từ isolated-world content script
// (DOM dùng chung giữa MAIN world và isolated world dù JS context tách biệt).
// Cấu trúc đã verify trên pathofexile.com/trade2 (2026-09-05):
//   <div class="row" data-id="a1b2c3">
//     ...
//     <span data-field="indexed">
//       <a href="/account/view-profile/Trivene">Trivene#2406</a>
//     </span>
//     ...
//   </div>
// Hàng đầu danh sách kết quả là <div class="row row-total"> (không có data-id, không phải một
// listing thật) — bị loại tự nhiên nhờ selector '.row[data-id]'.
function parseSellerRow(el: Element): SellerRow | null {
  const seller = el.querySelector(SELLER_LINK_SELECTOR)?.textContent?.trim()
  if (!seller) return null
  return { el, seller }
}

export function readSellerRows(root: ParentNode = document): SellerRow[] {
  return [...root.querySelectorAll('.row[data-id]')]
    .map(parseSellerRow)
    .filter((row): row is SellerRow => row != null)
}

// Đếm số item mỗi seller có trong tập kết quả đang xem — dùng để xác định seller nào đạt
// ngưỡng "bulk" (≥2 item) cần đánh dấu.
export function groupBySeller(rows: SellerRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.seller, (counts.get(row.seller) ?? 0) + 1)
  }
  return counts
}
