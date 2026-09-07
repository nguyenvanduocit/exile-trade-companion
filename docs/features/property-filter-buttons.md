# Nút + / − trên dòng thuộc tính item

Content script `entrypoints/trade-properties.content.ts` (MAIN world). Cùng hình thức với nút trên dòng mod nhưng ghi vào ô min/max của filter thuộc tính ở cột trái.

## Hành vi

Các dòng Armour, Evasion, Energy Shield, Ward, Block, Spirit, Rune Sockets, Quality, Item Level, Damage, APS, Crit, DPS/pDPS/eDPS, Reload Time, Requirements (Level, Str, Dex, Int), gem level/sockets, area level, stack size có nút `+` (min = giá trị) và `−` (max = giá trị). Bấm nút nào thì ngưỡng đối diện bị xoá. Toast xác nhận, `app.save(true)`.

## Cách hoạt động

- DOM: `span.s[data-field="<field>"]`, field trùng key trong `persistent.filters[group].filters[field]`. Đã intercept `setPropertyFilter` khi gõ tay để xác nhận field id.
- `lib/property-filter.ts`: `parsePropertyField`, `resolvePropertyGroup(field, isPoe2)`, `parsePropertyValue` (số đầu tiên trong text), `planSetPropertyMin/Max` (thay cả hai ngưỡng).
- Nhóm: `type_filters` (ilvl, quality), `req_filters` (lvl, str, dex, int), `misc_filters` (gem, area, stack), weapon/armour → `equipment_filters` trên PoE2, `weapon_filters`/`armour_filters` trên PoE1. Detect game bằng `location.pathname.startsWith('/trade2/')`.
- Dòng Requirements gộp nhiều field trong một `.item-property`, nên đánh dấu decorated trên từng span field, host hover là row. Nút được `append` vào trong span (không `after`) vì `.itemPopupAdditional` là flex column tuyệt đối.

## Quyết định

- Làm cả cho thuộc tính vì site không có nút nào cho phần này. `<claude:e26d1836-dcf1-43b5-8bc2-c8e3e42c1258>`
- PoE1 và PoE2 khác schema group filter (`equipment_filters` vs `weapon_filters`/`armour_filters`); xử lý bằng một resolver nhỏ, không tách kiến trúc theo game. Đây là khác biệt duy nhất phải rẽ nhánh trong toàn extension. `<claude:f621d05f-1660-46bd-a6fc-c329087bab54>`
- `+`/`−` thay cả hai ngưỡng để đổi chiều không để lại ràng buộc cũ. `<code:01a0710a-c29d-7722-a1af-6cb5a68a80fd>`
- Có công tắc trong Settings; tắt là gỡ nút vì DOM thuộc tính hiếm khi được site render lại. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

## Giới hạn

Các field ngoài danh sách verify (ar, ev, block, ilvl, quality, es, lvl, str, dex, int) được suy theo cùng schema, chưa gặp item mẫu cho từng cái.

## Test

`lib/property-filter.test.ts`, `lib/stat-buttons.test.ts`.
