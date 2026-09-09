# Kiến trúc

Tài liệu này mô tả cách extension được lắp ráp: các entrypoint, ba thế giới JavaScript và hai kênh messaging nối chúng, schema dữ liệu, cách bám vào nội bộ của trade site, styling trong Shadow DOM, manifest và quy ước test. Hành vi từng tính năng nằm ở [features/](features/README.md).

## Stack

- WXT 0.21 (Vite 8) build extension, Vue 3 cho UI, Tailwind 4 cho style, reka-ui cho Dialog/Dropdown/Collapsible, lucide-vue-next cho icon.
- `@webext-core/messaging` cho cả hai kênh messaging.
- `@liveblocks/client` cho chia sẻ folder.
- `@wxt-dev/i18n` với locale mặc định `vi`, thêm `en`.
- Vitest với `wxt/testing` fake-browser; vue-tsc cho typecheck.
- Bun làm package manager.

## Entrypoint

| Entrypoint | World | Vai trò |
|---|---|---|
| `entrypoints/background.ts` | service worker (MV3) / background page (MV2) | menu chuột phải, phím tắt, icon toolbar, mở tab, fetch poe.ninja và pobb.in, proxy telemetry |
| `entrypoints/onboarding/` | trang extension | 8 bước giới thiệu, mở khi cài |
| `entrypoints/trade.content/` | isolated | panel Vue trong Shadow DOM, storage, điều phối các tính năng đọc DOM (nhãn giá, snapshot, seller) |
| `entrypoints/trade-query.content.ts` | MAIN | đọc query và nhãn từ Vuex của site, hiện toast |
| `entrypoints/trade-stats.content.ts` | MAIN | nút + / − trên dòng mod, tô sáng mod |
| `entrypoints/trade-properties.content.ts` | MAIN | nút + / − trên dòng thuộc tính |
| `entrypoints/trade-ninja.content.ts` | MAIN | map mod text sang stat id, tra base item cho import |
| `entrypoints/trade-currency-icons.content.ts` | MAIN | URL icon currency cho nhãn giá |

Mọi content script match `https://www.pathofexile.com/trade/*`, `/trade2/*` và biến thể không `www`, chạy ở `document_idle`.

## Ba thế giới và hai kênh messaging

Trade site là Vue 2 + Vuex, root instance lộ ở `window.app`. Chỉ content script `world: 'MAIN'` mới thấy biến này, nhưng MAIN world không có `browser.runtime` hay `browser.storage`. Isolated world có storage và messaging tới background nhưng không thấy `window.app`. Background có host permission để fetch domain ngoài. Vì vậy mỗi tính năng được cắt theo ranh giới đó:

- **Background ↔ isolated**: `lib/extension-messaging.ts`, `defineExtensionMessaging` với `ExtensionProtocolMap`. Isolated gửi `openUrl`, `openDiscord`, `openOnboarding`, `saveActiveSearch`, `fetchNinjaCharacter`, `fetchPobCode`, `track`. Background gửi ngược `togglePanel`, `openPanel`, `getCurrentPage` kèm tabId.
- **MAIN ↔ isolated**: `lib/window-messaging.ts`, `defineWindowMessaging` trên `window.postMessage`. Namespace `exile-trade-companion` cho broadcast: `settingsRequested`, `settingsUpdated`, `queryStateChanged`, `saveToast`, `featureUsed`. Hai namespace request/response tách riêng `exile-trade-companion/ninja` (`matchNinjaStats`, `resolveItemBases`) và `exile-trade-companion/currency-icons` (`resolveCurrencyIcons`).

Namespace request/response phải tách khỏi namespace broadcast vì trong một namespace, mọi bundle có listener đều trả lời mọi request (bundle không có handler trả `undefined`) và sender lấy response đầu tiên. Cùng namespace thì `trade-stats` có thể trả `undefined` trước khi `trade-ninja` kịp trả kết quả.

Payload qua ranh giới world đi qua `structuredClone`. Hai hệ quả đã gặp và được xử lý: Vue reactive Proxy làm `structuredClone` throw `DataCloneError` nên mọi chỗ gửi settings hay query đều `toRaw` trước; `CustomEvent.detail` bị Chrome null hoá giữa MAIN và isolated world nên không dùng CustomEvent nữa (`git log -S save-toast.ts` cho bản cũ).

### Luồng settings

Isolated world giữ settings trong storage. Khi mount và mỗi khi settings đổi, `trade.content/index.ts` broadcast `settingsUpdated`. MAIN world script lắng nghe và bật/tắt subsystem của nó: bật thì gắn MutationObserver và decorate DOM, tắt thì disconnect observer và gỡ sạch DOM đã chèn. Script load muộn gửi `settingsRequested` để xin broadcast lại (`onSettingsUpdated` trong window-messaging).

### Luồng query

`trade-query.content.ts` chờ `window.app.$store`, copy `state.persistent` (status, name, type, term, disc, stats, filters, exchange) thành `TradeQuery`, suy nhãn bằng `lib/query-label.ts`, và bắn `queryStateChanged` mỗi khi store hoặc DOM filter đổi (debounce 150ms, bỏ qua khi serialize không đổi). Panel nhận, gộp với `parseTradeUrl(location.href)` thành `currentPage` dùng cho lưu bookmark, ghi lịch sử và trả lời `getCurrentPage` cho background.

## Nội bộ trade site đã dùng

Đây là hợp đồng ngầm với site, đổi là gãy. Mọi thứ đã verify trên cả `/trade` và `/trade2`.

- `window.app.$store.state.persistent`: query hiện tại. Stat Filters ở `persistent.stats[group].filters[] = {id, value:{min,max}, disabled}`; property filter ở `persistent.filters[group].filters[field] = {min,max}` hoặc `{option}`.
- Mutation: `setStatFilter {group, index?, value}`, `pushStatGroup {type, filters}`, `setPropertyFilter {group, index: field, value}`, `showAdvancedSearch(bool)`. Sau commit gọi `app.save(true)` để site đánh dấu dirty và cập nhật URL.
- `app.$refs.toastr.Add({msg, progressbar:false, timeout})`: toast của site.
- `app.static_.knownStatsFlat`: catalog stat id → `{text, option}`; `knownItems`: catalog base/unique; `exchangeDataFlat`: catalog currency với `image` là path trên `web.poecdn.com`.
- DOM kết quả: dòng mod `span.lc.s[data-field="stat.<section>.stat_<hash>"]` (hoặc `statgroup.`), dòng thuộc tính `span.s[data-field="<field>"]`, giá `[data-field="price"]` (bỏ `[data-field="fee"]` là Gold của PoE2), seller `[data-field="indexed"] a[href^="/account/view-profile/"]`, row `.row[data-id]`, tên hiển thị `.character-name`.
- Form search: dòng stat filter `.filter.full-span:not(.filter-property)` có `row.__vue__.$props.filter.id`, hai ô `input.minmax`.
- Khác biệt PoE1/PoE2 duy nhất phải rẽ nhánh: PoE2 gộp weapon và armour vào `equipment_filters`, PoE1 tách `weapon_filters` và `armour_filters`; `spirit` và `rune_sockets` chỉ có ở PoE2. Xử lý bằng `resolvePropertyGroup(field, isPoe2)`, không tách module theo game.
- Đường path `/trade/search/<league>/<blob>`: site đọc segment cuối như gzip + base64url của query JSON, không cần server cấp id. Site bỏ qua toàn bộ payload nếu có field thừa hoặc null.

## Dữ liệu

Toàn bộ state là một object `TradeState` dưới key `exile-trade-companion-state` trong `browser.storage.local` (`lib/storage.ts`, `types/trading.ts`):

```
TradeState {
  version: 1
  folders: SearchFolder[]        // id, name, color, order, note?, shareKey?
  searches: SavedSearch[]        // TradePage + id, folderId, note, order?, purchased?, createdAt, updatedAt
  history: HistoryEntry[]        // TradePage + id, visitedAt; cắt theo settings.maxHistory (50)
  settings: TradeSettings        // maxHistory, collapsedFolderIds, hasOpenedPanel, 7 công tắc tính năng
  snapshots: PriceSnapshot[]     // queryId, capturedAt, sampleSize, medianChaos, averageChaos; 90/queryId
  exchangeRate: ExchangeRateCache | null   // game, league, source, fetchedAt, rates
  hiddenSearchIds: string[]      // search bị "xoá" cục bộ trong folder đang share live
}
TradePage { url, title, game, league, mode, queryId?, query? }
```

`readState` luôn đi qua `sanitizeState` để vá blob cũ (thiếu field, field legacy `watching`, thứ tự search). `writeState` JSON round-trip trước khi ghi vì `chrome.storage` serialize array bọc Proxy thành object. Mọi hàm mutate đọc state, sửa, ghi lại; `composables/useTradeStore.ts` bọc chúng, giữ một `ref` module-level và lắng nghe `storage.onChanged` để mọi context (nhiều tab trade) thấy cùng state.

`visibleSearches` lọc `hiddenSearchIds`; mọi nơi hiển thị dùng nó, còn `state.searches` thô dành cho diff đẩy lên room khi chia sẻ.

Ngoài key trên còn `exile-trade-companion-install-id` (UUID ngẫu nhiên cho telemetry) và `sessionStorage['trade-companion-ui-state']` (panel mở/đóng, tab).

## Durable URL

`lib/trade-url.ts`: `parseTradeUrl` nhận diện URL trade (game, league, mode, queryId). `buildDurableUrl(page)` dựng lại `https://www.pathofexile.com/<trade|trade2>/<mode>/<league>/<gzip-base64url(query)>` từ `page.query`, chỉ set field có nội dung. Mọi chỗ mở bookmark hay lịch sử gọi hàm này trước, fallback về `page.url` khi bookmark cũ chưa có query.

## Mẫu chung của tính năng trên trang

Mỗi tính năng đọc DOM kết quả có một MutationObserver riêng, debounce 500–800ms, và hai hàm `apply`/`remove` đối xứng: tắt setting phải gỡ sạch những gì đã chèn, không chỉ ngừng chèn thêm. Guard chống chèn lặp là attribute hoặc class trên chính element (`data-etc-price-labeled`, `etcPropDecorated`, sự tồn tại của nút), nên gỡ DOM cũng tự reset guard. Với MAIN world, `window.app` có thể xuất hiện trước `$store`; luôn kiểm `app?.$store` và poll 200ms (`waitForApp`).

Thứ đọc được từ DOM thì đọc từ isolated world (giá, seller); thứ cần store hay catalog thì mới sang MAIN world.

## Styling

Panel là `createShadowRootUi` với CSS truyền dạng string (`style.css?inline`) để không fetch runtime và không nháy. Token màu và font ở `assets/main.css`: nền `#0e1115`, viền đồng `#634928`, tan `#a38d6d`, kem `#fff8e1`, font `FontinSmallCaps` (site đã load, dùng chung được trong shadow root) và Verdana 13px; utility `poe-btn`, `poe-input`, `icon-btn`; bo góc 0 theo site.

Shadow DOM không cách ly `rem`: site set `html { font-size: 10px }` nên Tailwind spacing bị co còn 62.5%. `assets/main.css` khai `--spacing: 4px` trong `@theme` để mọi utility số ra đúng pixel.

Những gì chèn vào light DOM của trang (nút + / −, nhãn giá, badge seller, tier picker, highlight) không thấy biến CSS trên `:host`, nên style của chúng dùng giá trị cứng và được chèn bằng `<style data-exile-trade-companion="…">` vào `document.head`. Đánh dấu row của seller dùng `box-shadow: inset` thay vì `border-left` vì site đã có rule border cùng specificity trên `.row`.

Panel là `position: fixed` nên đẩy trang bằng `margin-right !important` trên `<html>`, theo dõi width thật của panel qua ResizeObserver.

## Manifest và quyền

`wxt.config.ts`:

- `permissions`: `storage`, `activeTab`, `contextMenus`.
- `host_permissions`: `api.liveblocks.io` (https và wss) cho chia sẻ folder; `poe.ninja` cho tỷ giá và import, `pobb.in` cho import (hai site không trả CORS nên phải fetch từ background); `browser-intake-datadoghq.com` cho telemetry.
- `commands.toggle-trade-companion`: `Alt+Shift+B`.
- `action: {}` khai tay vì không có popup entrypoint; thiếu nó `browser.action` là `undefined`. Background chọn `browser.action ?? browser.browserAction` để chạy cả MV3 Chrome lẫn MV2 Firefox.
- Không hardcode `manifest.version`; WXT lấy từ `package.json`, và workflow release bơm version từ git tag vào đó.

Không xin `tabs`, `alarms`, `notifications`. Extension không có background polling.

## Build

`bun run build` ra `.output/chrome-mv3`, `bun run build:firefox` ra `.output/firefox-mv2`.

## i18n

Chuỗi UI ở `locales/vi.json` và `locales/en.json`, dùng qua `i18n.t(...)` của `#i18n`. Sau khi sửa locale phải `bunx wxt prepare` để sinh lại type. MAIN world script không có `browser.i18n`, nên mỗi file giữ một bảng `MESSAGES` nhỏ và chọn theo `navigator.language`.

## Telemetry

`lib/track.ts` gửi message `track` từ isolated world; MAIN world gửi `featureUsed` để panel chuyển tiếp. Background gom batch (20 event hoặc 5 giây) rồi POST NDJSON tới Datadog Logs intake; logic thuần ở `lib/telemetry.ts`. Không có `VITE_DATADOG_CLIENT_TOKEN` hoặc setting tắt thì không gửi. Trang `pathofexile.com` không thấy request nào ra ngoài. Chi tiết event ở [features/telemetry.md](features/telemetry.md).

## Test

Logic thuần nằm trong `lib/*.ts` và có test cùng tên `*.test.ts` bên cạnh; `describe`/`it` viết tiếng Việt. Component Vue và content script không có test tự động, verify bằng typecheck và bấm tay trên trade site. Import build có thêm test dataset trên 4 character thật (`lib/ninja-import.dataset.test.ts`, fixture ở `lib/__fixtures__/`). Trạng thái hiện tại: 23 file test, 280 test, chạy dưới một giây.

## Cây thư mục

```
entrypoints/        background, onboarding, trade.content (panel), content script MAIN world
components/         SearchCard, FolderSection, 4 modal, chart, drag handle, ui/ (reka-ui wrappers)
composables/        useTradeStore, useFolderSync, usePriceLabels, usePriceSnapshot, useSellerGrouping, useBookmarkDrag
lib/                logic thuần + test: storage, trade-url, stat/property filter, price-*, exchange-rate,
                    folder-sync, liveblocks-room, ninja-import, pob-import, telemetry, messaging
types/              trading.ts (TradeState, TradeQuery...), pricing.ts
locales/            vi.json, en.json
scripts/            build-ninja-fixtures.ts
public/             icon, ảnh onboarding
docs/               tài liệu này, features/, research/
```
