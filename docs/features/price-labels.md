# Nhãn quy đổi giá trên từng listing

`composables/usePriceLabels.ts` (isolated world) chèn giá quy đổi cạnh giá của mỗi listing; `entrypoints/trade-currency-icons.content.ts` (MAIN world) cấp icon.

## Hành vi

- Listing giá chaos → `≈ 0.033 <icon divine>`; giá divine → `≈ 150 <icon chaos>`; currency khác → cả chaos lẫn divine. Nhãn chỉ chứa phần quy đổi, giá gốc đã có ngay cạnh.
- Định dạng: chaos ≥1000 → `1.2k`, ≥100 làm tròn, ≥10 một chữ số lẻ, dưới 10 hai chữ số; divine ≥1 hai chữ số lẻ, dưới 1 giữ hai chữ số có nghĩa (không hiện `0.00`).
- Tỷ giá từ `GET https://poe.ninja/{game}/api/economy/exchange/current/overview?league=...&type=Currency` qua background. `useExchangeRates` dùng chung cache 6 giờ cho nhãn và snapshot, kiểm tra cả game, league và nguồn. Cache bulk exchange cũ bị bỏ qua.
- League từ URL trade phải khớp `id` hoặc `name` trong `GET https://poe.ninja/{game}/api/economy/leagues`; request giá dùng `id` đã khớp. Không khớp thì bỏ quy đổi, không chọn league đầu tiên hay tự đoán tên.
- `lines[].primaryValue` là giá theo `core.primary`; `core.rates` là số currency trên một đơn vị primary. Parser chuẩn hóa về chaos, ưu tiên core rates để tránh sai số làm tròn. Thiếu giá thì không hiện quy đổi; lỗi mạng được thử lại ở lần cập nhật DOM sau, cách tối thiểu 60 giây.
- Icon từ `window.app.static_.exchangeDataFlat[id].image` ghép với `https://web.poecdn.com`; thiếu icon thì fallback chữ `c`/tên currency.
- Công tắc trong Settings; tắt là gỡ nhãn.

## Cách hoạt động

- `lib/price-snapshot.ts` `readListingRows` đọc `[data-field="price"]` (amount = span con đầu không phải `.price-label`, currency = `img.alt`), bỏ `[data-field="fee"]`.
- `lib/price-labels.ts` `buildPriceLabelParts` (thuần) và `currencyIconUrls`; `lib/exchange-rate.ts` `fetchExchangeRates` và `parseExchangeRates`; `lib/format-price.ts`.
- Nhãn chèn vào **trong** `[data-field="price"]` với `white-space: nowrap` để đứng cùng dòng với icon; style chèn vào light DOM bằng giá trị cứng.
- MutationObserver debounce 500ms; guard `data-etc-price-labeled`.

## Quyết định

- Đọc giá listing từ DOM; background tải toàn bộ tỷ giá Currency một lần và dùng lại cho các listing. Request economy chỉ gửi game và league, không gửi cookie. API: [poe.ninja](https://poe.ninja/docs/api).
- Chỉ hiện chiều quy đổi còn thiếu (chaos → divine, divine → chaos), không lặp giá gốc; sửa cả hai chiều và mirror → divine sau khi bản đầu chỉ đúng một chiều. `<claude:f369a81a-3b64-4e11-9151-d3312c129aa3>`
- Định dạng `10 chaos ≈ 0.033 div` chứ không phải `≈ 10c ≈ 0.03 div`; quay lại dùng icon thật thay vì chữ, giảm khoảng cách. Icon lấy từ catalog exchange của site thay vì mượn `<img>` trên trang, vì trang không có listing divine là mất icon. `<claude:9e56807a-fb18-4e46-b33c-86c38aa3e0c4>`
- Dùng giá từ poe.ninja; không suy tỷ giá từ các tin rao bulk exchange của GGG.

## Giới hạn

- Chỉ trang `search`, không áp cho bulk exchange.
- Cache của extension tối đa 6 giờ; dữ liệu thị trường còn phụ thuộc chu kỳ cập nhật của poe.ninja.
- League hoặc currency không có trong nguồn economy sẽ không có nhãn quy đổi. Snapshot cũ chỉ lưu giá chaos tổng hợp nên không thể tính lại bằng tỷ giá mới.

## Test

`composables/useExchangeRates.test.ts`, `lib/price-labels.test.ts`, `lib/exchange-rate.test.ts`, `lib/format-price.test.ts`, `lib/price-snapshot.test.ts`.
