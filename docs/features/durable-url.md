# Bookmark bền: lưu query và dựng lại URL

Search ID mà GGG cấp trong URL (`/trade/search/<league>/<id>`) hết hạn sau vài tháng. Bookmark chỉ lưu URL sẽ chết theo. Extension lưu kèm nội dung query và dựng lại URL khi mở.

## Hành vi

Mỗi bookmark và mục lịch sử mang `query: TradeQuery` chụp từ Vuex của site lúc lưu. Khi mở, extension dựng `https://www.pathofexile.com/<trade|trade2>/<mode>/<league>/<blob>` với `blob` là gzip + base64url của query JSON. Bookmark cũ chưa có query thì mở URL gốc.

## Cách hoạt động

- `entrypoints/trade-query.content.ts` copy `status, name, type, term, disc, stats, filters, exchange` từ `state.persistent`, bỏ các field route-derived (`id`, `tab`, `realm`, `league`).
- `lib/trade-url.ts`: `buildQueryPayload` chỉ set field có nội dung (`name`, `type`, `term`, `disc`, `stats` khi có filter, `filters` khi không rỗng; với exchange chỉ `have`/`want`), rồi `gzipBase64Url` bằng `CompressionStream('gzip')`.
- Import build cũng đi đường này: `buildImportQuery` → `buildDurableUrl`.

## Quyết định

- Site tự đọc segment cuối của path như blob nén của query, không cần server lưu id trước. Đã round-trip thủ công qua devtools. Site **không** đọc `?q=` (thử cả JSON thô lẫn bọc `{query}`), nên định dạng path là lựa chọn duy nhất. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Site từ chối toàn bộ payload nếu có field thừa hoặc null và âm thầm fallback về search trống, không báo lỗi. Đây là nguyên nhân bug "bookmark rồi bấm lại thì mất filter" và là lý do `buildQueryPayload` lược field. `<claude:c346416d-8845-43d2-b505-13dbb2b382fb>`
- `TradeQuery` giữ nguyên shape của Vuex (`StatGroup` với `value` cho group `count`/`weight`) để không phải map hai chiều. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`

## Giới hạn

- Bookmark lưu trước khi có tính năng này chỉ có URL ngắn; người dùng phải ghi đè bằng search hiện tại.
- Durable URL cho `trade2` được verify sau khi server PoE2 hoạt động lại; lúc implement server đang down.
- URL dựng lại không có `queryId` ngắn, nên snapshot giá chỉ chụp được sau khi site điều hướng về URL của chính nó (xem [price-history.md](price-history.md)).

## Test

`lib/trade-url.test.ts` phủ parse URL, lược field và round-trip nén.
