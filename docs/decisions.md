# Nhật ký quyết định

Mỗi mục: quyết định, lý do, và session đã đưa ra nó (`<claude:id>` Claude Code, `<code:id>` Codex; tra cứu ở [sessions.md](sessions.md)). Thứ tự theo thời gian. Quyết định đã bị đảo ngược được ghi ở trạng thái cuối, kèm mục đã đảo nó.

## 2026-09-03

**D1. Giao diện phải theo vernacular của trade site, không phải widget shadcn.** Bản sidebar đầu bị chê "nhỏ, AI slop". Chuẩn: FontinSmallCaps cho nhãn, Verdana 13px cho nội dung, palette đo từ site, không chữ dưới 12px, hàng tối thiểu 44px, không gradient, bo góc 0. Token ở `assets/main.css`. `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>`

**D2. Bám Vuex của site (`window.app.$store`) thay vì mô phỏng click DOM.** Đào bundle `trade.js` cho thấy site lộ store, mutation (`setStatFilter`, `pushStatGroup`, `setPropertyFilter`, `showAdvancedSearch`) và catalog `static_`. Content script phải `world: 'MAIN'`. Đây là nền cho mọi tính năng ghi vào form search. `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>`

**D3. Extension không tự chạy search và không gọi API tìm kiếm của GGG.** Cam kết sản phẩm, bám theo phản ứng của cộng đồng với extension tự bắn request. Nút + / − chỉ sửa form, người dùng tự bấm Search. Mọi request tới `pathofexile.com` ngoài trang đang mở phải được ghi ở đây. `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>`

## 2026-09-04

**D4. Toast xác nhận dùng toastr của site.** Không tự vẽ notification trong panel. `<claude:4593d951-fbb7-4015-abe4-a34eddec050b>`

**D5. i18n chuẩn `@wxt-dev/i18n`, locale mặc định `vi`, có `en`.** MAIN world script không có `browser.i18n` nên giữ bảng nhỏ riêng. `<claude:08a9bc5a-78fd-4d57-b7a0-9943a33538e1>`

**D6. Mở bookmark trong tab hiện tại; panel nhớ trạng thái qua `sessionStorage`.** `<claude:1e82a26d-7996-4dfc-9345-9e54bbe622ea>`

**D7. Khác biệt PoE1/PoE2 xử lý bằng resolver nhỏ đúng điểm khác, không tách module theo game.** Điểm khác duy nhất đã gặp: PoE2 gộp `equipment_filters`, PoE1 tách `weapon_filters`/`armour_filters`. Phần còn lại của site (stat, category, rarity, DOM class) generic. `<claude:f621d05f-1660-46bd-a6fc-c329087bab54>`

**D8. Snapshot giá lấy median trên toàn bộ listing đọc được, không bỏ N listing rẻ nhất.** GGG không expose loại giao dịch trên listing (DOM, `listing.method`, `listing.price.type` giống nhau) nên không lọc scam theo loại được. Chỉ chụp khi người dùng mở trang, throttle 1 giờ, tối thiểu 3 mẫu, giữ 90. Không `alarms`/`tabs`. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>`

**D9. Tỷ giá lấy từ API economy của poe.ninja, cache 6 giờ theo game và league.** Cập nhật 2026-09-09: bỏ median của tin rao bulk exchange. League phải khớp danh sách economy của poe.ninja; thiếu dữ liệu thì bỏ quy đổi. Cache cũ bị bỏ qua. `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>` `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

**D10. Bỏ tab Price Analysis; giá nằm ngay trên bookmark, biểu đồ mở từ menu.** Tab riêng thừa so với giá trị. `<claude:e9fb66b0-37da-4834-a69f-1b8602b25076>`

**D11. Chia sẻ folder bằng Liveblocks client-side-only, room id là share key, không backend, không owner/viewer.** Lộ key là lộ folder; thu hồi bằng đổi key. Đã spike hai tab thật. Import qua bundler, không CDN (Chrome Web Store cấm remote code). `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>`

**D12. Sửa root cause style trong Shadow DOM thay vì vá từng component.** `rem` không bị Shadow DOM cách ly, site set `html{font-size:10px}` nên spacing co 62.5%; khai `--spacing: 4px`. FOUC do fetch CSS runtime; truyền CSS inline cho `createShadowRootUi`. Không tự host font Fontin. `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>`

**D13. Hai chế độ chia sẻ (trực tiếp, một lần) và hai cách nhận (Fork, Tham gia), giải thích ngay trong modal.** `<claude:25953451-62d2-4745-a0ac-46a9ae92f3d6>`

**D14. Panel đẩy trang thay vì che.** `<claude:886e65a7-b331-43b8-9837-ae941998dc20>`

**D15. Mã nguồn mở Apache-2.0 trên GitHub; release qua git tag, workflow chỉ upload draft, Submit for review luôn thủ công; publisher trên Chrome Web Store là account AI Ocean, không phải account cá nhân.** Quy trình chi tiết trong skill `.claude/skills/release-extension/SKILL.md`. `<claude:f1c2d922-3847-4bd8-9838-4f64cc30fb11>` `<claude:27b684a9-0cd4-4266-bee1-7d63d763c385>`

**D16. Onboarding bằng ảnh thật của UI, mở khi cài; badge Discord ở header làm điểm vào cộng đồng.** `<claude:73cc0021-301b-450d-9f66-a024a7a07e62>` `<claude:2a11bb18-985f-4e5e-9cc2-5120c3799616>`

**D17. Xoá bookmark trong folder đang share trực tiếp chỉ ẩn cục bộ; room báo rỗng thì ghi ngược dữ liệu local lên (heal).** Tránh xoá mất của người khác và tránh mất dữ liệu khi Liveblocks tạo lại room trống. `<claude:9d1f4cbc-4430-41d6-b5a5-e5c4af23c6f8>`

**D18. `writeState` JSON round-trip trước khi ghi storage.** Chromium serialize array bọc Vue Proxy thành object key số. `<claude:9d1f4cbc-4430-41d6-b5a5-e5c4af23c6f8>`

## 2026-09-05

**D19. Thứ tự làm feature theo KANO: vá must-be trước (bookmark bền, Firefox, công tắc từng feature, sửa README về exchange API), rồi attractive.** Nguồn: [research/2026-09-05-kano-feature-analysis.md](research/2026-09-05-kano-feature-analysis.md). `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

**D20. Bookmark lưu kèm query, mở lại bằng URL blob gzip+base64url ở path.** Site không đọc `?q=`; site từ chối payload có field thừa/null nên `buildQueryPayload` lược field. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>` `<claude:c346416d-8845-43d2-b505-13dbb2b382fb>`

**D21. Bỏ popup; sidebar là UI duy nhất, Settings nằm trong sidebar; khai `action: {}` tay để `browser.action` tồn tại.** `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

**D22. Mỗi tính năng chèn vào trang có công tắc riêng và gỡ retroactive khi tắt.** Snapshot giá và ghi lịch sử luôn bật vì không chèn gì và không gửi request mới. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

**D23. Không dùng `CustomEvent` để nói chuyện giữa MAIN và isolated world.** Chrome null hoá `detail` không phải primitive qua ranh giới world. Sau đó chuẩn hoá toàn bộ sang `@webext-core/messaging`: `defineExtensionMessaging` cho background ↔ isolated, `defineWindowMessaging` cho MAIN ↔ isolated; namespace request/response tách khỏi namespace broadcast; `toRaw` mọi payload reactive. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>` `<claude:ad766582-047f-4228-9ced-d0c190d36270>`

**D24. Nhãn quy đổi chỉ hiện chiều còn thiếu, icon thật từ catalog exchange của site, định dạng `10 chaos ≈ 0.033 div`.** `<claude:f369a81a-3b64-4e11-9151-d3312c129aa3>` `<claude:9e56807a-fb18-4e46-b33c-86c38aa3e0c4>`

**D25. Gỡ hẳn live search / watchlist.** Tính năng "theo dõi bookmark ở tab nền, bắn notification" đã được merge (mở N tab live thật, không tự gọi API) nhưng phụ thuộc vào việc site rewrite URL, kích hoạt Live Search của site và tự mở lại tab người dùng đã đóng; có bug tab zombie do `storage.session` bị xoá khi reload. Người dùng quyết định bỏ toàn bộ thay vì tiếp tục vá. Muốn one-tab thật phải tự mở WebSocket tới API, trái D3. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>` `<claude:adc732e5-d22e-4d18-aba0-e7040d016a0f>`

**D26. Kéo thả thay cho menu di chuyển; không folder lồng nhau; "đã mua" là gạch ngang, toggle trong menu.** `<code:01a07056-25cd-7822-abf1-15699f5e1656>` `<code:01a070d4-b6e9-7f53-86d1-1cc49191f8c9>`

**D27. Tier picker PoE2 dùng snapshot TierFill (MIT) và base types từ RePoE, thu hẹp theo category/base/unique, ghi rõ giới hạn "ngưỡng số không đảm bảo tier".** `<code:01a07056-25cd-7822-abf1-15699f5e1656>` `<code:01a0705a-e3b2-7ed0-a6f8-aa45f7c79edf>`

**D28. Nút `+`/`−` đặt min/max bằng giá trị trên item cho cả mod lẫn thuộc tính, cập nhật filter đã có thay vì tạo trùng.** `<code:01a0710a-c29d-7722-a1af-6cb5a68a80fd>`

**D29. Ghi chú cho folder (đồng bộ qua room) và bookmark, UI compact cùng kiểu nút nhỏ; tạo folder bằng modal.** `<code:01a07174-9a17-76e1-b96a-de769265d3e2>` `<claude:2a8f7624-937d-4a11-a058-521a45221fcc>`

**D30. Import build: dữ liệu từ hai request JSON nội bộ của poe.ninja (không parse HTML), fetch ở background, host permission khai tĩnh; map mod bằng catalog live của tab nên phải import đúng game.** `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`

**D31. Matcher không hardcode: regex sinh từ text catalog, xử lý Local, dấu, số ít/nhiều, đảo increased/reduced; mod nhiều id vào group `count` min 1; không pin section vì filter `explicit.<hash>` của site đã khớp crafted/fractured/desecrated; rune vào query dạng tắt; unique mang stat; roll âm vào `max`; status `available`.** Mỗi điểm có thí nghiệm trên site hoặc trên character thật, ghi ở [research/2026-09-05-poeninja-import.md](research/2026-09-05-poeninja-import.md). `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>` `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`

**D32. Thêm nguồn PoB (pobb.in, code dán tay) đổ về cùng pipeline; poe.ninja vẫn là nguồn chính khi có link vì text PoB kém thông tin hơn.** `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`

**D33. Test import trên character thật từ ladder, fixture sinh bằng script, chấp nhận sửa expectation khi snapshot đổi.** `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`

## 2026-09-06

**D34. Telemetry ẩn danh qua Datadog, background là proxy duy nhất, mặc định bật và tắt được, gửi text mod không map được, không gửi account/query/bookmark; công bố trong PRIVACY.md.** `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`

**D35. Tài liệu gắn tag session cho mỗi quyết định và tính năng.** Format `<claude:session-id>` và `<code:session-id>` để truy được cuộc hội thoại đã sinh ra quyết định. Spec và plan cũ trong `docs/superpowers/` được gộp vào đây và xoá vì mô tả trạng thái đã qua (tab Price Analysis, popup). `<claude:7efb3403-e37e-4a92-9e10-91769a2a9fc7>`

## Chưa quyết

- Đổi tên `ImportNinjaModal` và key locale `importNinja*` cho đúng với việc đã nhận PoB.
- Surface profile của poe.ninja (character chưa lên ladder).
- Tách domain trade ra config để hỗ trợ domain Kakao/Korean.
- Tự động upload bản Firefox lên addons.mozilla.org.
