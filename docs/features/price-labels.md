# Nhãn quy đổi giá trên từng listing

`composables/usePriceLabels.ts` (isolated world) chèn giá quy đổi cạnh giá của mỗi listing; `entrypoints/trade-currency-icons.content.ts` (MAIN world) cấp icon.

## Hành vi

- Listing giá chaos → `≈ 0.033 <icon divine>`; giá divine → `≈ 150 <icon chaos>`; currency khác → cả chaos lẫn divine. Nhãn chỉ chứa phần quy đổi, giá gốc đã có ngay cạnh.
- Định dạng: chaos ≥1000 → `1.2k`, ≥100 làm tròn, ≥10 một chữ số lẻ, dưới 10 hai chữ số; divine ≥1 hai chữ số lẻ, dưới 1 giữ hai chữ số có nghĩa (không hiện `0.00`).
- Tỷ giá từ `POST /api/trade(2)/exchange/<league>` với `have: [currencies], want: ['chaos']`, lấy median ratio của offer đầu mỗi currency; cache 6 giờ mỗi league trong `state.exchangeRate`. Currency không có offer đổi thẳng chaos (mirror, hinekora's lock…) được quy đổi qua divine rồi nhân lại. Currency vẫn không ra rate được nhớ trong phiên để không hỏi lại.
- Icon từ `window.app.static_.exchangeDataFlat[id].image` ghép với `https://web.poecdn.com`; thiếu icon thì fallback chữ `c`/tên currency.
- Công tắc trong Settings; tắt là gỡ nhãn.

## Cách hoạt động

- `lib/price-snapshot.ts` `readListingRows` đọc `[data-field="price"]` (amount = span con đầu không phải `.price-label`, currency = `img.alt`), bỏ `[data-field="fee"]`.
- `lib/price-labels.ts` `buildPriceLabelParts` (thuần) và `currencyIconUrls`; `lib/exchange-rate.ts` `fetchExchangeRates` và `parseExchangeRatios`; `lib/format-price.ts`.
- Nhãn chèn vào **trong** `[data-field="price"]` với `white-space: nowrap` để đứng cùng dòng với icon; style chèn vào light DOM bằng giá trị cứng.
- MutationObserver debounce 500ms; guard `data-etc-price-labeled`.

## Quyết định

- Đọc giá từ DOM, không gọi API fetch listing của GGG. Request duy nhất là exchange để lấy tỷ giá, tối đa một lần mỗi 6 giờ mỗi league, same-origin với credentials. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>` `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Chỉ hiện chiều quy đổi còn thiếu (chaos → divine, divine → chaos), không lặp giá gốc; sửa cả hai chiều và mirror → divine sau khi bản đầu chỉ đúng một chiều. `<claude:f369a81a-3b64-4e11-9151-d3312c129aa3>`
- Định dạng `10 chaos ≈ 0.033 div` chứ không phải `≈ 10c ≈ 0.03 div`; quay lại dùng icon thật thay vì chữ, giảm khoảng cách. Icon lấy từ catalog exchange của site thay vì mượn `<img>` trên trang, vì trang không có listing divine là mất icon. `<claude:9e56807a-fb18-4e46-b33c-86c38aa3e0c4>`
- Median thay vì average cho ratio vì exchange đầy outlier. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`

## Giới hạn

- Chỉ trang `search`, không áp cho bulk exchange.
- Tỷ giá stale tối đa 6 giờ.

## Test

`lib/price-labels.test.ts`, `lib/exchange-rate.test.ts`, `lib/format-price.test.ts`, `lib/price-snapshot.test.ts`.
