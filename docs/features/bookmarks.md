# Bookmark, folder và lịch sử

Lõi của extension: lưu search đang mở vào folder, sắp xếp, ghi chú, mở lại, và ghi lịch sử mọi trang trade đã xem.

## Hành vi

- Panel nhận diện search đang mở qua URL và query trong Vuex của site. Nút bookmark ở đầu mỗi folder lưu search vào folder đó; menu chuột phải "Lưu vào Trade Companion" lưu vào folder mặc định. Site hiện toast xác nhận.
- Tên bookmark suy từ query: tên item/unique → base type → rarity + category → stat filter đầu tiên (`+N` nếu nhiều) → cặp currency exchange.
- Ba folder mặc định: Theo dõi (`watchlist`), Nâng cấp đồ (`gear`), Mua số lượng (`bulk`). Tạo/sửa folder qua modal với tên, 8 màu hoặc màu tuỳ chọn, ghi chú. Xoá folder chuyển bookmark sang Theo dõi, không xoá được folder cuối.
- Bookmark: mở trong tab hiện tại, đổi tên (autofocus, Enter lưu, Esc huỷ), ghi chú, đánh dấu đã mua (gạch ngang), ghi đè bằng search hiện tại, sao chép link, xoá. Kéo thả để sắp xếp trong folder, đổi folder, sắp xếp folder.
- Lịch sử: mỗi URL trade mới được ghi một lần, dedupe theo URL, giữ 50, hiện 15. Nhãn đẹp tới sau (cần `window.app`) thì entry vừa ghi được vá lại.
- Panel nhớ trạng thái mở/đóng và tab trong `sessionStorage`; lần đầu cài tự mở.
- Sao lưu: xuất toàn bộ `TradeState` ra JSON, nhập thay thế toàn bộ (qua `sanitizeState`).

## Cách hoạt động

- `entrypoints/trade.content/App.vue`: `syncCurrentPage` poll `location.href` mỗi 1.2 giây (site là SPA, không có event điều hướng tin cậy), ghi lịch sử; `onQueryState` nhận nhãn và query từ MAIN world.
- `entrypoints/trade-query.content.ts`: đọc `state.persistent` và DOM filter, `lib/query-label.ts` suy nhãn.
- `lib/storage.ts`: mọi mutate; `saveSearch` dedupe theo `url` (lưu lại cùng URL thì cập nhật, không nhân đôi); `removeFolder` dồn bookmark; `moveSearch`/`moveFolder` dùng `lib/bookmark-order.ts` (`insertRelative`, `normalizeSearchOrder`).
- `composables/useBookmarkDrag.ts` + `components/BookmarkDragHandle.vue`: HTML5 drag & drop, MIME `application/x-exile-bookmark`, tự cuộn khi kéo sát mép.
- `components/FolderSection.vue`, `SearchCard.vue`, `FolderFormModal.vue`.
- Mở bookmark: `buildDurableUrl(search) ?? search.url` rồi `openUrl` qua background, background `tabs.update` tab hiện tại (xem [durable-url.md](durable-url.md)).

## Quyết định

- Không có popup; toàn bộ UI là panel trên trang trade, icon toolbar chỉ mở panel. Popup từng tồn tại và bị bỏ để không duy trì hai bản UI. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Panel đẩy trang (margin-right trên `<html>`) thay vì overlay đè lên kết quả. `<claude:886e65a7-b331-43b8-9837-ae941998dc20>`
- Mở bookmark trong tab hiện tại, không mở tab mới. `<claude:1e82a26d-7996-4dfc-9345-9e54bbe622ea>`
- Nút lưu nằm ngay trên tiêu đề từng folder thay vì một khối "Current search" riêng. `<claude:ab8371a0-4d7e-407c-838a-dee400fdb683>`
- Toast xác nhận dùng toastr có sẵn của site thay vì tự vẽ. `<claude:4593d951-fbb7-4015-abe4-a34eddec050b>`
- Thuật toán đặt tên bookmark theo thứ tự ưu tiên ở trên. `<claude:57b37fd6-8c93-4242-8050-f3928adbe745>`
- Đổi tên bookmark inline, autofocus vào ô nhập. `<claude:a5a0e307-6188-4c7e-8b8e-38ee0cf7f448>` `<claude:99fdfe8c-3e8b-48f1-8042-0c7ac9393cec>`
- Ghi đè bookmark bằng search hiện tại. `<claude:f6544543-f394-4fac-9f7c-211ab68d286c>`
- Giữ ít icon trên hàng, phần còn lại vào menu `•••`. `<claude:fe0fad8c-85bf-4b77-8a70-61425e2b1a9f>`
- Kéo thả thay cho menu Move up/down/Move to folder; không làm folder lồng nhau. Trạng thái đã mua là mục trong menu, hiển thị gạch ngang. `<code:01a07056-25cd-7822-abf1-15699f5e1656>` `<code:01a070d4-b6e9-7f53-86d1-1cc49191f8c9>`
- Tạo folder bằng modal (tên, màu, ghi chú) thay vì inline; ghi chú folder và ghi chú bookmark dùng cùng kiểu nút nhỏ. `<claude:2a8f7624-937d-4a11-a058-521a45221fcc>` `<code:01a07174-9a17-76e1-b96a-de769265d3e2>`
- Bỏ mũi tên thu gọn ở folder, bấm tên là đủ. `<claude:32a9abf3-bbc2-4820-aa4a-1c7111356f2f>`
- Menu ngữ cảnh dùng dropdown reka-ui nổi thay vì hàng nút inline. `<claude:a9ae0a94-e37a-4ac3-bf6c-3bf1b6b568fa>`
- Folder rename/delete với xác nhận, không xoá folder cuối. `<code:01a067b8-d05e-7211-9501-321ac8151acc>`
- Live search/watchlist từng được thêm rồi gỡ hẳn (xem [decisions.md](../decisions.md)). `<claude:adc732e5-d22e-4d18-aba0-e7040d016a0f>`

## Giới hạn

- Poll URL 1.2 giây có độ trễ nhỏ khi ghi lịch sử.
- Kéo thả dùng HTML5 DnD, không hoạt động trên màn cảm ứng.
- Nhập JSON thay thế toàn bộ dữ liệu, không merge.

## Test

`lib/storage.test.ts`, `lib/query-label.test.ts`, `lib/edit-title.test.ts`, `lib/relative-time.ts` (không test), `lib/bookmark-order.ts` được phủ qua `storage.test.ts`.
