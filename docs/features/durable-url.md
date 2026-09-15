# Bookmark bền: lưu query và dựng lại URL

Search ID mà GGG cấp trong URL (`/trade/search/<league>/<id>`) hết hạn sau vài tháng. Bookmark chỉ lưu URL sẽ chết theo. Extension lưu kèm nội dung query và dựng lại URL khi mở.

## Hành vi

Mỗi bookmark và mục lịch sử mang `query: TradeQuery` chụp từ Vuex của site lúc lưu. Khi mở, extension dựng `https://www.pathofexile.com/trade/<mode>/<league>/<blob>` cho PoE1 hoặc `https://www.pathofexile.com/trade2/<mode>/poe2/<league>/<blob>` cho PoE2. `blob` là gzip + base64url của query JSON. Bookmark cũ chưa có query thì mở URL gốc.

## Cách hoạt động

- `entrypoints/trade-query.content.ts` copy `status, name, type, term, disc, stats, filters, exchange` từ `state.persistent`, bỏ các field route-derived (`id`, `tab`, `realm`, `league`).
- `packages/shared/trade-url.ts`: `buildQueryPayload` chuẩn hóa field theo GGG trước khi nén bằng `CompressionStream('gzip')`: `term` ưu tiên hơn `name`/`type`, discriminator nằm trong `{ option, discriminator }`; stat group theo thứ tự `type, filters, value, disabled`; bỏ `disabled: false` và giá trị rỗng, giữ `disabled: true` và ngưỡng bằng 0. Exchange giữ `have`/`want`.
- Import build cũng đi đường này: `buildImportQuery` → `buildDurableUrl`.
- GGG gọi `history.replaceState` với URL do `stateUrl()` tạo. Generator đã dùng realm và payload chuẩn hóa tương ứng; cặp link Emerald ngày 2026-09-14 được kiểm tra khớp toàn bộ URL trong Chromium. Bộ nén của Node có thể tạo byte gzip khác Chromium dù JSON giống nhau, nên test Node so cả đường dẫn và chuỗi JSON sau giải nén.

## Quyết định

- Site tự đọc segment cuối của path như blob nén của query, không cần server lưu id trước. Đã round-trip thủ công qua devtools. Site **không** đọc `?q=` (thử cả JSON thô lẫn bọc `{query}`), nên định dạng path là lựa chọn duy nhất. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Site từ chối toàn bộ payload nếu có field thừa hoặc null và âm thầm fallback về search trống, không báo lỗi. Đây là nguyên nhân bug "bookmark rồi bấm lại thì mất filter" và là lý do `buildQueryPayload` lược field. `<claude:c346416d-8845-43d2-b505-13dbb2b382fb>`
- `TradeQuery` giữ nguyên shape của Vuex (`StatGroup` với `value` cho group `count`/`weight`) để không phải map hai chiều. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`

## Giới hạn

- Bookmark lưu trước khi có tính năng này chỉ có URL ngắn; người dùng phải ghi đè bằng search hiện tại.
- Durable URL cho `trade2` được verify sau khi server PoE2 hoạt động lại; lúc implement server đang down.
- Capture giá nhận diện theo query của kết quả đã tải, không yêu cầu blob URL giữ nguyên (xem [price-history.md](price-history.md)).

## Test

`lib/trade-url.test.ts` phủ parse và cặp URL Emerald thực tế; `packages/shared/trade-url.test.ts` phủ payload, discriminator, ngưỡng 0, filter bị tắt và round-trip nén.
