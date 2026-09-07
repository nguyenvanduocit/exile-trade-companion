# Lịch sử giá theo bookmark

`composables/usePriceSnapshot.ts` chụp snapshot giá mỗi lần người dùng mở trang kết quả của một search đã bookmark; `SearchCard` hiện trung vị mới nhất và biểu đồ.

## Hành vi

- Điều kiện chụp: trang `search`, URL có `queryId`, có bookmark hiển thị với cùng `queryId`, snapshot gần nhất cách đây trên 1 giờ, đọc được ít nhất 3 listing quy đổi được ra chaos.
- Snapshot gồm `sampleSize`, `medianChaos`, `averageChaos` trên **toàn bộ** listing đọc được, không bỏ listing đầu, không phân biệt Instant Buyout hay In Person. Giữ 90 snapshot gần nhất mỗi `queryId`.
- Bookmark hiện `Trung vị: 12.4c (≈0.05 div)` và delta % so với snapshot trước (tăng đỏ, giảm tan). Menu `•••` → Lịch sử giá mở biểu đồ SVG khi có từ 2 snapshot.
- Không có nền: chỉ chụp khi người dùng tự mở trang.

## Cách hoạt động

- `lib/price-snapshot.ts` `readListingPrices`, `computeSnapshot`; tỷ giá dùng chung cache với nhãn giá (`lib/exchange-rate.ts`, cache 6 giờ).
- `lib/storage.ts` `recordSnapshot` (FIFO 90), `setExchangeRateCache`.
- `components/PriceHistoryModal.vue`, `PriceHistoryChart.vue` với `lib/chart-scale.ts` (scale điểm, nhãn đầu/giữa/cuối khi nhiều điểm).
- Observer debounce 800ms trên `document.body`.

## Quyết định

- Median trên toàn bộ mẫu thay vì "bỏ 5 listing rẻ nhất" như ý ban đầu: GGG không expose loại giao dịch trên từng listing (DOM, `listing.method`, `listing.price.type` giống hệt nhau), nên không tách được scam listing theo loại một cách tin cậy. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`
- Tab "Price Analysis" riêng từng được dựng rồi bỏ; giá nằm ngay trên bookmark và biểu đồ mở từ menu. `<claude:e9fb66b0-37da-4834-a69f-1b8602b25076>`
- Snapshot luôn bật (không còn công tắc riêng) vì nó chỉ chạy trên search đã bookmark và không gửi request ngoài tỷ giá. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Không dùng `alarms`/`tabs` để polling nền; đây là cam kết "không tự chạy search". `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`

## Giới hạn

- Khoá theo `queryId` ngắn của GGG, nên bookmark import (URL blob) và bookmark mở qua durable URL không được chụp cho tới khi site điều hướng về id ngắn và bookmark được lưu lại với id đó.
- Mẫu chỉ là trang kết quả đầu (khoảng 10 listing đầu site render), thiên về giá rẻ nhất.

## Test

`lib/price-snapshot.test.ts`, `lib/chart-scale.test.ts`, `lib/format-price.test.ts`, `lib/storage.test.ts` (retention).
