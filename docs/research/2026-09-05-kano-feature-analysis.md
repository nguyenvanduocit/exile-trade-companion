# Phân tích KANO và thứ tự feature

Ngày 2026-09-05. Dữ liệu đối thủ và nguồn Reddit nằm ở [bản đồ đối thủ](2026-09-05-competitor-landscape.md). File này chỉ giữ phần phân loại và quyết định.

## Kết luận

Feature key nên làm là **watchlist live**: chạy nhiều live search cùng lúc trong một panel, có desktop notification, gắn với price snapshot đã có. Đây là nhu cầu lặp lại suốt 6 năm trên Reddit, extension 100k user không có, extension 50k user có nhưng gãy liên tục.

Trước đó phải vá ba must-be đang thiếu, cả ba đều rẻ:

- **Bookmark chết theo thời gian.** `SavedSearch` kế thừa `TradePage` và chỉ lưu `url` cùng `queryId` (`types/trading.ts:6-13`, `types/trading.ts:23`); `queryId` được cắt từ URL ở `lib/trade-url.ts:42`. Search ID của GGG hết hạn sau vài tháng. Cần lưu query JSON lấy từ Vuex store của site và mở lại bằng URL dạng `?q=`.
- **Chưa có bản Firefox.** `package.json:13-14` chỉ có `wxt build` và `wxt zip`, chưa có script `-b firefox`.
- **Chưa tắt được từng feature.** `TradeSettings` chỉ có `captureHistory`, `maxHistory`, `collapsedFolderIds`, `hasOpenedPanel` (`types/trading.ts:36-41`). Nút `+` trên dòng mod, property filter và price snapshot đều chạy cố định.

## Điểm phải sửa trong README

README dòng 14 viết "extension không gọi GGG Trade API". Code hiện tại gọi endpoint exchange để lấy tỷ giá: `lib/exchange-rate.ts:18-21` dựng URL `https://www.pathofexile.com/api/trade/exchange/<league>`, `composables/usePriceSnapshot.ts:40-44` gọi khi cache tỷ giá quá 6 giờ (`RATE_CACHE_TTL_MS`, dòng 10), kích hoạt bởi MutationObserver trên kết quả của search đã bookmark (dòng 52-57). Tần suất thấp, tối đa một request mỗi 6 giờ mỗi league, nhưng vẫn là API call. Cộng đồng xếp "tự bắn request" vào nhóm reverse, nên README phải nói đúng: extension đọc giá listing từ DOM và chỉ gọi exchange API để lấy tỷ giá, không tự chạy search.

## Phân loại KANO

### Must-be

Thiếu là user bỏ ngay, có thì không ai khen.

- Bookmark folder, history, import/export: đã có, mọi đối thủ đều có.
- Link bền theo thời gian: thiếu, xem trên.
- Không gãy sau patch: review 1 sao phổ biến nhất là "not working 3.26", "stopped after 0.5". Extension bám Vuex thay vì DOM ở `entrypoints/trade-stats.content.ts`, đúng hướng.
- Từng feature tắt được: thiếu, xem trên. TFT bán điểm "every feature is opt out".
- Không tự chạy search: README cam kết, code giữ đúng với search. Phần exchange API cần ghi rõ như trên.
- Domain localized: content script chỉ match `pathofexile.com` (`entrypoints/trade.content/index.ts:7-12`). Chưa cần làm ngay, nhưng đối thủ gãy hàng loạt vì domain Kakao là tín hiệu nên tách domain ra config.

### One-dimensional

Càng nhiều càng hài lòng.

- Giá quy đổi chaos/div trên từng listing. Đã có `lib/exchange-rate.ts` cho snapshot, chưa hiển thị per listing. Rẻ.
- Highlight mod đã search: chưa có.
- Độ sâu tổ chức bookmark: folder lồng, icon, category, layout, middle-click mở tab nền. Mới ở mức cơ bản.
- Sync giữa máy: Liveblocks share folder ([features/folder-share.md](../features/folder-share.md)) tái dùng được làm sync cá nhân.
- Thêm mod từ kết quả một click: đã có, Poe Trade Plus có, TFT không.

### Attractive

Không có không ai trách, có thì user nhớ.

- Multi live search + watcher notify: feature key, xem Kết luận.
- Tier picker: lợi thế data pipeline `data/poedb` ở workspace poe.
- Gom listing theo seller.
- Chỉ hiện affix hợp item class, preset waystone/tablet.
- Price history theo bookmark: chỉ mình có ([features/price-history.md](../features/price-history.md)).
- Share folder live: chỉ mình có, là request từ 2020 "guide có thể ship gearing folder".
- Paste item vào để search: nhu cầu đang giảm vì POE2 có price check in-game, parser gãy mỗi patch. Không làm.

### Indifferent

Dust value, mô tả Mageblood legacy, Discord blacklist, cảnh báo 6-socket (3.29 bỏ màu socket), tab title indicator.

### Reverse

Tự bắn request, vibe-coded không open source, highlight không tắt được, Chrome-only.

## Thứ tự làm

1. **Vá must-be**: query JSON trong bookmark, Firefox build, toggle từng feature, sửa README về exchange API. Ước lượng nhỏ.
2. **Watchlist live.** Giữ nguyên nguyên tắc không tự chạy search: user chọn N bookmark, extension mở N tab live thật ở nền, content script gom kết quả mới về một panel, bắn desktop notification và ghi snapshot giá. Trần 20 theo giới hạn site. Đánh đổi là tốn RAM tab. Muốn one-tab thật phải tự mở WebSocket, tức tự gọi API, trái cam kết. Việc kéo được user chưa test.
3. **Kế tiếp**: giá quy đổi per listing, rồi tier picker.
