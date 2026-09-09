# Nút + / − trên dòng mod và tô sáng mod đang search

Hai subsystem trong cùng content script `entrypoints/trade-stats.content.ts` (MAIN world), bật tắt độc lập bằng hai công tắc.

## Hành vi

- Rê chuột vào dòng mod trong kết quả: nút `+` và `−` trượt ra ở cuối dòng, dính nhau như button group.
- `+`: stat có số → thêm vào group And đầu tiên với `min` = giá trị trên item (stat đã có thì cập nhật min, xoá max, giữ các field khác như `weight`); stat không số → thêm không ngưỡng; đã có → toast "đã có".
- `−`: stat có số → `max` = giá trị; stat không số → thêm vào group Not đầu tiên (tạo mới nếu chưa có).
- Giá trị của "Adds X to Y … Damage" là trung bình hai đầu. Mod dạng "reduced" khớp stat "increased" (và less/more) với dấu âm.
- Sau khi commit: mở Advanced Search, `app.save(true)`, toast bằng toastr của site. Nút thu lại khi rời chuột; vẫn hiện khi focus bằng bàn phím. Không tự chạy search.
- Tô sáng: dòng mod có stat id nằm trong bất kỳ group nào của Stat Filters và không `disabled` được thêm class highlight. Rescan toàn document khi DOM đổi và khi `persistent.stats` đổi (Vuex watch).

## Cách hoạt động

- DOM: `span.lc.s[data-field="stat.<section>.stat_<hash>"]` hoặc `statgroup.…`; `parseStatField` lấy id. Click trên `.lc.s` là sort của site nên nút `stopPropagation`.
- `lib/stat-filter.ts`: `parseStatValue(text, definition)` dựng regex từ `text` của catalog (`#` → số), `planAddStat`/`planAddStatNot` trả plan `add | add-group | update | exists`, `activeStatIds`.
- Commit: `pushStatGroup {type, filters}`, `setStatFilter {group, index?, value}`, `showAdvancedSearch(true)`.
- Settings qua `settingsUpdated`; tắt thì gỡ nút, class và observer.
- Mỗi lần bấm gửi `featureUsed('stat-filter-button')` để panel ghi telemetry.

## Quyết định

- Bám Vuex thay vì mô phỏng click DOM của site, giống nút kính lúp `searchByMe` của site nhưng cho từng stat. `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>`
- Thêm nút `−` cho group Not. `<claude:68032713-914b-457f-b950-3bee580985a7>`
- Nút hiện khi hover, width 0 lúc nghỉ để không nới dòng; hai nút dính nhau, z-index đủ cao. `<claude:9b405aed-91b1-4524-b048-3ff670623e12>` `<claude:bab81a95-1940-4747-aead-1a32021096ab>`
- `+` đặt min và `−` đặt max bằng giá trị trên item, cập nhật filter đã có thay vì tạo trùng; stat không số giữ hành vi And/Not. Giá trị chỉ lấy từ placeholder `#` của catalog để không nhầm số trong tên skill. `<code:01a0710a-c29d-7722-a1af-6cb5a68a80fd>` `<code:01a0710b-7e60-7ae1-ac71-b583b4ab8e5d>` `<code:01a0710e-9e08-7862-9cb3-f97ceac1422f>`
- Tô sáng dựa trên `disabled` của filter, không chỉ sự có mặt. Bug "highlight không bao giờ chạy" do `window.app` tồn tại trước `$store`: exception ở lần scan đồng bộ đầu tiên làm observer không bao giờ được gắn nhưng guard đã set; sửa bằng kiểm `app?.$store`. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Công tắc riêng cho từng subsystem, tắt là gỡ retroactive. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

## Giới hạn

- Dòng `statgroup.` (pseudo group của site) không có giá trị số, `+` chỉ thêm không ngưỡng.
- Stat có `option` (Allocates …) không đặt ngưỡng.

## Test

`lib/stat-filter.test.ts`, `lib/stat-buttons.test.ts` (mô phỏng DOM và Vuex cho callback click).
