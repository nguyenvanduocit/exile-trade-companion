# Price Snapshot & Price Analysis tab

## Goal

Cho phép so sánh giá hiện tại của một saved/recent search với giá trong quá khứ. Mỗi lần user mở trang kết quả của một search đã track, extension tự chụp một "snapshot giá" (trung vị + trung bình toàn bộ listing đọc được, quy đổi chaos-equivalent), lưu lại theo thời gian. Hiển thị median mới nhất ngay dưới tên search trong sidebar.

## Bối cảnh kỹ thuật đã verify

Repo hiện tại (`poe-pro-trade`, WXT + Vue 2 content trên trang GGG là Vue 2/Vuex, extension UI là Vue 3) **chưa có bất kỳ data model, content script, hay storage nào đọc giá item** — toàn bộ hạ tầng dưới đây là mới.

Đã xác minh trực tiếp trên trang live (`pathofexile.com/trade2`, applies tương tự `/trade`):

- Mỗi result row có `<span data-field="price">` chứa: amount (`<span>1</span>`), `×`, `<img alt="regal">` (currency short-id) + tên đầy đủ. Tách biệt với `<span data-field="fee">` (Gold sink riêng của POE2 — không phải giá item, phải loại bỏ).
- `document.querySelectorAll('[data-field="price"]')` đọc được trực tiếp từ **isolated-world content script** (DOM dùng chung giữa MAIN world và isolated world dù JS context tách biệt) — không cần content script `world: 'MAIN'` mới, không cần đọc `window.app`.
- `POST https://www.pathofexile.com/api/trade2/exchange/<league>` với body `{ query: { status: { option: 'online' }, have: [...currencyIds], want: ['chaos'] }, sort: { have: 'asc' } }` trả về **toàn bộ listing data ngay trong response** (`result[key].listing.offers[].exchange.{currency,amount}` + `.item.{currency,amount}`) — verify bằng request thật, status 200, có `offers[0] = {exchange:{currency:'divine',amount:1}, item:{currency:'chaos',amount:1,stock:1567}}`. Một request cho nhiều currency cùng lúc (đã test `have:['divine','exalted','regal']` trong 1 request, GGG cho phép multi-select).
- Request này gọi được bằng `fetch(url, {credentials:'include'})` same-origin ngay trong content script đang chạy trên trang trade — không cần `tabs` permission, không cần tab ẩn.
- Response header có `x-rate-limit-account` / `x-rate-limit-ip` (vd `6:4:10`, `12:4:60,...`) — throttle policy dưới đây (1h/search cho snapshot, 6h cho tỷ giá) nằm sâu dưới các ngưỡng này nên rủi ro rate-limit/ban thấp.
- `parseTradeUrl()` (`lib/trade-url.ts`) đã trả `TradePage.mode: 'search'|'exchange'` và `queryId?: string` — dùng để chỉ chụp snapshot khi `mode === 'search'` và `queryId` tồn tại (không snapshot trang Bulk Item Exchange).

## Data model — `types/pricing.ts` (mới)

```ts
export type CurrencyId = string // short id lấy từ img.alt trên trang trade, vd 'chaos' | 'divine' | 'exalted' | 'regal'

export interface PriceSnapshot {
  id: string
  queryId: string        // khớp TradePage.queryId — key nối snapshot với SavedSearch/HistoryEntry
  capturedAt: number      // epoch ms
  sampleSize: number       // số listing hợp lệ dùng để tính (sau khi loại currency chưa rõ tỷ giá)
  medianChaos: number
  averageChaos: number
}

export interface ExchangeRateCache {
  league: string
  fetchedAt: number
  rates: Record<CurrencyId, number>  // chaos-equivalent, vd { divine: 180, exalted: 12 }
}
```

`chaos` luôn có rate = 1 (base unit), không cần lưu trong cache.

## `TradeState` mở rộng — `types/trading.ts` + `lib/storage.ts`

Thêm hai field vào `TradeState`:

```ts
export interface TradeState {
  version: 1
  folders: SearchFolder[]
  searches: SavedSearch[]
  history: HistoryEntry[]
  settings: TradeSettings
  snapshots: PriceSnapshot[]        // mới
  exchangeRate: ExchangeRateCache | null  // mới
}
```

- `createDefaultState()`: `snapshots: []`, `exchangeRate: null`.
- `sanitizeState()`: `snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : []`, `exchangeRate: candidate.exchangeRate ?? null` — bắt buộc để `importState()` không mất field mới khi import blob cũ.
- Hàm mới trong `lib/storage.ts`:
  - `recordSnapshot(snapshot: Omit<PriceSnapshot, 'id'>)`: push snapshot mới cho `queryId`, giữ tối đa **90 snapshot/queryId** (FIFO — cắt bớt cái cũ nhất khi vượt), `writeState()`.
  - `getSnapshotsForQuery(queryId: string)`: filter + sort theo `capturedAt` giảm dần (đọc, không ghi — có thể để composable tự filter từ `store.state.value.snapshots`, không nhất thiết cần hàm riêng trong storage.ts).
  - `setExchangeRateCache(cache: ExchangeRateCache)`: ghi đè `state.exchangeRate`, `writeState()`.

## Logic thuần — `lib/price-snapshot.ts` (mới, functional core)

```ts
export interface RawListing { amount: number; currency: CurrencyId }

export function readListingPrices(root: ParentNode = document): RawListing[]
// querySelectorAll('[data-field="price"]') — bỏ qua [data-field="fee"] (Gold sink POE2, không phải giá item).
// Cấu trúc thật đã verify: <span data-field="price"><span class="price-label ...">Asking Price:</span>
//   <span>1</span><span>×</span><span class="currency-text currency-image"><img alt="regal">...</span></span>
// → currency = el.querySelector('img').alt; amount = Number(el.querySelector(':scope > span:not(.price-label)')?.textContent)
//   (span con đầu tiên không mang class price-label — đây chính là amount, span "×" bị Number() loại vì NaN nên
//   querySelector chỉ cần lấy phần tử ĐẦU TIÊN khớp selector, không phải parse thêm). Bỏ listing nếu amount NaN hoặc thiếu img.

export function computeSnapshot(
  listings: RawListing[],
  rates: Record<CurrencyId, number>,
): { medianChaos: number; averageChaos: number; sampleSize: number } | null
// 1. Chuẩn hoá: amount * (currency === 'chaos' ? 1 : rates[currency]) — bỏ listing có currency không có trong rates (và không phải chaos).
// 2. Nếu số listing hợp lệ < 3 → return null (không đủ mẫu, không lưu snapshot).
// 3. Sort tăng dần, tính median + average trên TOÀN BỘ listing hợp lệ — không loại bỏ theo vị trí hay
//    theo loại giao dịch (Instant Buyout vs In Person). Lý do đổi: GGG không expose field nào trên listing
//    hay trong response /api/trade(2)/fetch cho biết một listing cụ thể là Instant Buyout hay In Person —
//    đây chỉ là filter ở cấp search (`query.status.option`, giá trị `securable` = Instant Buyout, xem
//    `status: securable` đã dùng trong skill /gear-upgrade), không phải thuộc tính đọc lại được sau khi
//    trang đã load. Verify trực tiếp 2026-09-04: DOM button, `listing.method`, `listing.price.type` giống
//    hệt nhau bất kể loại. Vì không tách được theo loại một cách đáng tin cậy, quyết định: lấy toàn bộ.
```

Hàm thuần, không side-effect, test được độc lập (TDD theo đúng convention repo — các lib khác như `stat-filter.ts`/`property-filter.ts` đều có `.test.ts` colocate).

## Tỷ giá — `lib/exchange-rate.ts` (mới)

```ts
export async function fetchExchangeRates(
  league: string,
  game: Game,          // 'poe1' | 'poe2' — quyết định path /api/trade/exchange vs /api/trade2/exchange
  currencies: CurrencyId[],
): Promise<Record<CurrencyId, number>>
```

- POST tới `https://www.pathofexile.com/api/trade${game === 'poe2' ? '2' : ''}/exchange/${league}` với body đã verify ở trên (`have: currencies, want: ['chaos']`).
- Parse `result` object (dict theo key lạ, phải `Object.values(result)`), với mỗi entry lấy `listing.offers[0]` → `{ exchange: {currency, amount}, item: {currency:'chaos', amount} }` → ratio = `item.amount / exchange.amount` (chaos nhận được / 1 đơn vị currency đó).
- Group theo `exchange.currency`, tính **median** ratio mỗi currency (không phải average — outlier listing rất phổ biến ở exchange).
- **Giả định cần verify khi implement**: response shape cho `/api/trade/exchange` (POE1) hiện chưa được test trực tiếp (chỉ verify trên `/api/trade2/exchange`, POE2) — do cùng codebase GGG nên nhiều khả năng giống hệt, nhưng phải xác nhận bằng 1 request thật trước khi ship cho POE1.

## Trigger & throttle — nối vào `entrypoints/trade.content/App.vue`

Trong `syncCurrentPage()` (`App.vue:83-90`), sau khi xác định `parsed.queryId` tồn tại và `parsed.mode === 'search'`, gọi một hàm mới `maybeCaptureSnapshot(parsed)` (đặt trong composable mới `composables/usePriceSnapshot.ts`, không nhồi thêm vào App.vue's `<script setup>` vốn đã dài):

1. Đọc snapshot gần nhất cho `queryId` từ `store.state.value.snapshots`. Nếu `capturedAt` cách đây < 1h → bỏ qua.
2. `readListingPrices()` lấy danh sách currency có trên trang. Nếu tất cả đã có trong `store.state.value.exchangeRate?.rates` và cache đó `fetchedAt` cách đây < 6h → dùng luôn.
3. Nếu thiếu/cache cũ: gọi `fetchExchangeRates(league, game, missingCurrencies)`, merge vào cache hiện có (giữ rate cũ của currency không nằm trong lần fetch này), `store.setExchangeRateCache(...)`.
4. `computeSnapshot(listings, rates)` — null thì dừng (không đủ mẫu).
5. `store.recordSnapshot({ queryId, capturedAt: Date.now(), ...result })`.

Chạy `void maybeCaptureSnapshot(parsed)` không chặn UI (giống cách `recordHistory` hiện tại được gọi `void`).

## `composables/useTradeStore.ts` — thêm method

Thêm `recordSnapshot` và `setExchangeRateCache` wrapper (cùng pattern các method khác đã có: gọi `lib/storage.ts`, cập nhật `state.value`).

## UI — dòng 2 dưới tên search (`components/SearchCard.vue`)

Thêm computed `latestSnapshot` (tìm trong `store.state.value.snapshots` theo `props.search.queryId`, lấy 2 snapshot gần nhất để tính delta). Render dưới `<span>` title (trước `search.note` line hiện có ở `SearchCard.vue:82`), CHỈ hiện khi có snapshot:

```
Median: 12.4c  ▼ 8%     (so với snapshot trước đó)
```

Format số qua một helper mới `lib/format-price.ts` (chaos-equivalent → hiển thị gọn, vd `1234` → `1.2k`, và nếu có exchange rate divine thì show kèm `≈0.05 div`). Không hiện gì nếu `search.queryId` chưa có snapshot nào (không placeholder rác).

## Tab mới "Price Analysis"

Cả `entrypoints/trade.content/App.vue` (`tab` ref dòng 31, mảng tab dòng 170-173) và `entrypoints/popup/App.vue` (`View` type dòng 12, tab nav dòng 112-130) đều cần thêm option thứ ba: `'analysis'`.

- i18n: `locales/vi.json` + `en.json` thêm `panel.tabAnalysis`.
- Component mới `components/PriceAnalysisTab.vue`:
  - **List view**: liệt kê mọi `queryId` có ≥1 snapshot, resolve tên hiển thị bằng cách tìm trong `store.state.value.searches` (ưu tiên) rồi `store.state.value.history` (fallback) theo `queryId`; nếu không tìm thấy ở cả hai (search đã bị xoá nhưng snapshot còn), hiện `queryId` thô.
  - Click một item → **detail view**: danh sách snapshot của `queryId` đó, mới nhất trước, mỗi dòng: `relativeTime(capturedAt)` (tái dùng `lib/relative-time.ts` đã có), median + average (chaos-equivalent, format qua `lib/format-price.ts`), delta % so với snapshot ngay trước nó trong danh sách.
  - Không có snapshot nào trong toàn bộ state → empty state tương tự `history.empty` hiện có ở `App.vue:235-237`.

## Retention

`recordSnapshot()` giữ tối đa 90 snapshot/`queryId`, FIFO cắt bớt bản cũ nhất khi vượt — nằm trong `lib/storage.ts`, cùng chỗ với logic cắt `maxHistory` đã có ở `recordHistory()` (`lib/storage.ts:108-120`).

## Ngoài phạm vi (out of scope)

- Không tự động polling nền (không dùng `chrome.alarms`, không thêm permission `alarms`/`tabs`) — mọi capture đều trigger bởi user tự mở trang search.
- Không track giá theo từng listing riêng lẻ — chỉ track median/average tổng hợp theo search.
- Không đổi UI trang GGG (không inject dòng giá vào DOM kết quả của pathofexile.com) — mọi hiển thị nằm trong sidebar/popup của extension.

## File cần tạo/sửa (tổng hợp cho bước lập plan)

**Mới:**
- `types/pricing.ts`
- `lib/price-snapshot.ts` + `.test.ts`
- `lib/exchange-rate.ts` + `.test.ts`
- `lib/format-price.ts` + `.test.ts`
- `composables/usePriceSnapshot.ts`
- `components/PriceAnalysisTab.vue`

**Sửa:**
- `types/trading.ts` — mở rộng `TradeState`
- `lib/storage.ts` — `createDefaultState`, `sanitizeState`, `recordSnapshot`, `setExchangeRateCache`
- `composables/useTradeStore.ts` — wrapper method mới
- `entrypoints/trade.content/App.vue` — gọi `maybeCaptureSnapshot`, thêm tab thứ ba
- `entrypoints/popup/App.vue` — thêm tab thứ ba (đồng bộ với sidebar)
- `components/SearchCard.vue` — dòng median dưới title
- `locales/vi.json`, `locales/en.json` — nhãn tab mới + text liên quan giá
