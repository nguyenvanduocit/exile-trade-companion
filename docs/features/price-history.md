# Lịch sử giá theo bookmark

Menu `•••` → **Capture giá** trên bookmark gọi `composables/usePriceSnapshot.ts` để lưu giá từ kết quả đang mở; `SearchCard` hiện trung vị mới nhất và biểu đồ.

## Hành vi

- Điều kiện chụp: người dùng bấm Capture giá, kết quả đã tải khớp query, game và league của bookmark hiển thị, đọc được ít nhất 3 listing quy đổi được ra chaos. Menu kiểm tra khi mở; nếu đang sửa bộ lọc, đang tải hoặc xem search khác thì hiện hướng dẫn chạy đúng search. Không giới hạn một lần mỗi giờ.
- Snapshot gồm `sampleSize`, `medianChaos`, `averageChaos` trên **toàn bộ** listing đọc được, không bỏ listing đầu, không phân biệt Instant Buyout hay In Person. Giữ 90 snapshot gần nhất mỗi `queryId`.
- Bookmark hiện `Trung vị: 12.4c (≈0.05 div)` và delta % so với snapshot trước (tăng đỏ, giảm tan). Menu `•••` → Lịch sử giá mở biểu đồ SVG khi có từ 2 snapshot.
- Mở trang hoặc tải thêm kết quả không tự tạo snapshot. Giao diện báo khi đang capture, đã lưu, thiếu mẫu hoặc lưu thất bại.

## Cách hoạt động

- `lib/price-snapshot.ts` `readListingPrices`, `computeSnapshot`; tỷ giá dùng chung cache với nhãn giá (`lib/exchange-rate.ts`, cache 6 giờ).
- `lib/storage.ts` `recordSnapshot` (FIFO 90), `setExchangeRateCache`.
- `components/PriceHistoryModal.vue`, `PriceHistoryChart.vue` với `lib/chart-scale.ts` (scale điểm, nhãn đầu/giữa/cuối khi nhiều điểm).
- `SearchCard` gọi `captureSnapshot` khi chọn menu; hàm kiểm tra URL thực tế lúc bấm trước khi đọc DOM. Không còn observer hoặc timer tự chụp giá.
- Bridge `price-search` đọc query của kết quả đã tải trong MAIN world. So sánh bỏ qua thứ tự key, field rỗng và `disabled: false`; giữ các stat, ngưỡng và nhóm count. Không dùng query của form đang chỉnh sửa.
- Khóa lịch sử dùng `queryId` đã lưu, hoặc `bookmark:<id>` khi bookmark import không có `queryId`. Cả ghi snapshot, dòng giá và biểu đồ dùng chung khóa này nên GGG chuẩn hóa URL không tách lịch sử; bookmark import ở league khác không dùng chung giá.

## Quyết định

- Median trên toàn bộ mẫu thay vì "bỏ 5 listing rẻ nhất" như ý ban đầu: GGG không expose loại giao dịch trên từng listing (DOM, `listing.method`, `listing.price.type` giống hệt nhau), nên không tách được scam listing theo loại một cách tin cậy. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`
- Tab "Price Analysis" riêng từng được dựng rồi bỏ; giá nằm ngay trên bookmark và biểu đồ mở từ menu. `<claude:e9fb66b0-37da-4834-a69f-1b8602b25076>`
- Snapshot từng luôn bật sau khi bỏ công tắc riêng. Từ 2026-09-14, người dùng chủ động capture qua menu bookmark; bỏ observer và throttle một giờ.
- Không dùng `alarms`/`tabs` để polling nền; đây là cam kết "không tự chạy search". `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`

## Giới hạn

- Bookmark cũ chỉ có ID, không lưu query, cần ID kết quả khớp; nếu GGG thay ID thì lưu lại search để có query.
- Mẫu chỉ là trang kết quả đầu (khoảng 10 listing đầu site render), thiên về giá rẻ nhất.

## Test

`composables/usePriceSnapshot.test.ts` (capture thủ công, import/durable, giữ lịch sử, response trễ, thiếu mẫu và lỗi lưu), `lib/trade-price-search.test.ts` (kết quả đã tải), `lib/price-search-match.test.ts` (query và cặp URL Emerald thực tế), `lib/price-snapshot.test.ts`, `lib/chart-scale.test.ts`, `lib/format-price.test.ts`, `lib/storage.test.ts` (retention).
