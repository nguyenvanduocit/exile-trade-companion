# Tier picker cho stat (PoE2)

Content script `entrypoints/trade-tiers.content.ts`, chỉ chạy trên `/trade2`. Thêm ô chọn "≈ Tier…" vào mỗi dòng stat filter trên form search; chọn tier là điền ngưỡng số tương ứng.

## Hành vi

- Ô select nằm trong `.filter-title` của dòng stat, hiện optgroup theo nhóm item, option `T1 · min 105` kèm tooltip ilvl và khoảng roll.
- Chọn tier: điền `min` bằng sàn của tier (trung bình hai đầu với flat damage); stat đảo chiều (giá trị âm mạnh hơn) điền `max`. Ngưỡng đối diện mâu thuẫn bị xoá. Điền qua `input` + `change` event để Vue của site nhận.
- Ngữ cảnh thu hẹp nhóm: Item Category (`type_filters.filters.category`), base item (`query.type`) tra `poe2-base-types.json`, unique (`query.name`) tra `knownItems` của site rồi tra base. Category không biết hoặc mâu thuẫn → không hiện picker. Không ngữ cảnh → mọi nhóm với nhãn gọn.
- Người dùng sửa tay ô min/max thì select reset về placeholder.
- Công tắc trong Settings; tắt là gỡ select, style, observer và Vuex watch.

## Cách hoạt động

- Id stat lấy từ `row.__vue__.$props.filter.id` (có namespace explicit/pseudo), không dựa text hiển thị. Group `weight` bị bỏ qua.
- `lib/tier-filter.ts`: `resolveTierTypes`, `getContextTierFamilies`, `tierBound`, `conflictsWithTier`, bảng `CATEGORY_TYPES` đã đối chiếu với selector category của site.
- Dữ liệu: `data/poe2-tiers.json` là snapshot nguyên bản của TierFill (MIT) tại commit `0481fee0`, `data/poe2-base-types.json` sinh từ RePoE (1.721 base). Nguồn, checksum và cách cập nhật ở `data/README.md`.
- Rescan debounce 80ms khi DOM đổi hoặc `persistent`/`knownItems` đổi; `onSettingsUpdated` xử lý script load muộn.

## Quyết định

- Dùng data ladder cộng đồng của TierFill thay vì tự dựng từ poedb để ra nhanh; ghi rõ giới hạn "ngưỡng số không đảm bảo tier khi roll chồng" trong tooltip và Settings. `<code:01a07056-25cd-7822-abf1-15699f5e1656>`
- Thu hẹp theo category, base và unique thay vì liệt kê mọi nhóm; unique dùng để xác định category, không có khoảng roll riêng cho unique. `<code:01a0705a-e3b2-7ed0-a6f8-aa45f7c79edf>`
- Sửa lỗi khởi động khi picker bỏ lỡ broadcast settings: thêm `settingsRequested`/`onSettingsUpdated`, và vá rò rỉ listener khi unsubscribe ngay. `<code:01a0705a-e3b2-7ed0-a6f8-aa45f7c79edf>` `<code:01a0706d-d7ed-7a00-af49-e2dd5660d35a>` `<code:01a07073-1286-7d82-b099-7ed379cc962e>`
- Chỉ khớp stat id `explicit.*` có trong snapshot; entry không có id bị bỏ.

## Giới hạn

- Chỉ PoE2. Implicit (ví dụ Stun Threshold) chưa có dữ liệu tier.
- Bundle `trade-tiers.js` khoảng 323 kB do JSON.
- Snapshot tĩnh, cần cập nhật tay khi patch đổi ladder.

## Test

`lib/tier-filter.test.ts` (validate mọi ladder có id, ngưỡng đại diện), `lib/tier-startup.test.ts` (khởi động và broadcast settings).
