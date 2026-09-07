# Đánh dấu seller bán nhiều item

`composables/useSellerGrouping.ts` (isolated world). Trong kết quả đang xem, listing của seller có từ 2 item trở lên được đánh dấu để mua gộp một lần.

## Hành vi

- Row của seller đạt ngưỡng nhận vạch màu đồng bên trái và badge `×N` cạnh tên account trong `.character-name`.
- Đếm lại toàn bộ mỗi lần DOM đổi (infinite scroll, sort), dọn dấu cũ rồi gắn lại theo số đếm hiện tại.
- Công tắc trong Settings; tắt là gỡ class và badge.

## Cách hoạt động

- `lib/seller-grouping.ts` `readSellerRows` (`.row[data-id]` → `[data-field="indexed"] a[href^="/account/view-profile/"]`), `groupBySeller`.
- Style chèn vào light DOM: row dùng `box-shadow: inset 3px 0 0 0 #8a6a3a` thay vì `border-left` vì site có rule border cùng specificity trên `.row` và thắng thua phụ thuộc thứ tự nạp CSS.
- Badge đặt trong `.character-name` vì `[data-field="indexed"]` co về 0×0 dù chứa link thật.
- Observer debounce 500ms.

## Quyết định

- Ngưỡng 2 item, chỉ tính listing đang hiển thị; không gọi API để đếm toàn bộ kết quả. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`
- Hai bug tìm ra khi verify sống (border bị đè, badge vô hình) sửa bằng box-shadow và đổi chỗ chèn. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

## Test

`lib/seller-grouping.test.ts`.
