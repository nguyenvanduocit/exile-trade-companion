# Bản đồ session

Mỗi tính năng và quyết định trong tài liệu được gắn tag session đã sinh ra nó. Session Claude Code (`<claude:id>`) lưu ở `~/.claude/projects/-Users-firegroup-projects-poe-poe-pro-trade/<id>.jsonl`, mở lại bằng `claude --resume <id>`. Session Codex (`<code:id>`) lưu ở `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*-<id>.jsonl`. Giờ theo UTC+7. Session chỉ đọc hoặc bỏ dở không có dòng riêng.

## 2026-09-03

| Session | Giờ | Việc | File chính |
|---|---|---|---|
| `<code:01a067b8-d05e-7211-9501-321ac8151acc>` | 21:42 | Đổi tên, xoá folder có xác nhận; bookmark dồn về Theo dõi | FolderSection, storage |
| `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>` | 21:48 → 09-04 13:24 | Viết lại sidebar theo style trade site; đào bundle trade.js; nút `+` thêm stat vào Stat Filters | main.css, SearchCard, FolderSection, trade-stats.content, stat-filter |

## 2026-09-04

| Session | Giờ | Việc | File chính |
|---|---|---|---|
| `<claude:ab8371a0-4d7e-407c-838a-dee400fdb683>` | 13:26 | Nút lưu nằm trên tiêu đề folder; nhãn search từ Vuex | trade-query.content, query-label, trade-app |
| `<claude:1e82a26d-7996-4dfc-9345-9e54bbe622ea>` | 13:40 | Mở bookmark trong tab hiện tại; giữ trạng thái panel | background, App.vue |
| `<claude:27b684a9-0cd4-4266-bee1-7d63d763c385>` | 13:45 → 15:13 | Logo, screenshot, publish Chrome Web Store dưới account AI Ocean; skill release | release-extension SKILL, tmp/preview |
| `<claude:f6544543-f394-4fac-9f7c-211ab68d286c>` | 13:46 | Ghi đè bookmark bằng search hiện tại | SearchCard |
| `<claude:08a9bc5a-78fd-4d57-b7a0-9943a33538e1>` | 13:47 → 14:06 | i18n vi/en với @wxt-dev/i18n | locales, mọi component |
| `<claude:57b37fd6-8c93-4242-8050-f3928adbe745>` | 13:51 → 14:21 | Thuật toán đặt tên bookmark | query-label |
| `<claude:68032713-914b-457f-b950-3bee580985a7>` | 13:56 | Nút `−` thêm vào group Not | stat-filter |
| `<claude:4593d951-fbb7-4015-abe4-a34eddec050b>` | 14:08 | Toast qua toastr của site | trade-query.content |
| `<claude:a9ae0a94-e37a-4ac3-bf6c-3bf1b6b568fa>` | 14:14 | Dropdown menu reka-ui | ui/dropdown-menu |
| `<claude:cc3c5b04-567f-4128-a9f0-50bc088c0820>` | 14:21 → 14:29 | Vị trí nút Folder mới | App.vue |
| `<claude:a5a0e307-6188-4c7e-8b8e-38ee0cf7f448>` | 14:29 → 14:54 | Đổi tên bookmark | SearchCard, edit-title, storage |
| `<claude:e26d1836-dcf1-43b5-8bc2-c8e3e42c1258>` | 14:43 → 14:56 | Nút `+`/`−` trên thuộc tính item | trade-properties.content, property-filter |
| `<claude:fe0fad8c-85bf-4b77-8a70-61425e2b1a9f>` | 14:57 | Gom icon vào menu `•••` | SearchCard |
| `<claude:14256158-3de5-4ed8-9216-0fa642c1d3be>` | 15:05 | Căn lề tên bookmark | SearchCard |
| `<claude:f621d05f-1660-46bd-a6fc-c329087bab54>` | 15:10 → 15:24 | Sửa `Unknown filter group: equipment_filters`; resolver PoE1/PoE2 | property-filter |
| `<claude:b31926ae-253f-43d5-9a1e-84c45fe4b94e>` | 15:17 → 17:12 | Snapshot giá, tỷ giá exchange, biểu đồ, tab Price Analysis (spec + plan) | price-snapshot, exchange-rate, format-price, usePriceSnapshot, PriceHistoryChart |
| `<claude:9b405aed-91b1-4524-b048-3ff670623e12>` | 15:38 → 15:59 | Style nút `+`/`−` không nới dòng | trade-stats/properties.content |
| `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>` | 16:02 → 18:35 | Chia sẻ folder qua Liveblocks (spike, spec, plan, code); spec style parity (`--spacing`, FOUC) | useFolderSync, folder-sync, liveblocks-room, ShareFolderModal, main.css |
| `<claude:e9fb66b0-37da-4834-a69f-1b8602b25076>` | 16:31 | Bỏ tab Price Analysis, giữ giá trên bookmark | usePriceSnapshot, App.vue |
| `<claude:25953451-62d2-4745-a0ac-46a9ae92f3d6>` | 17:51 → 18:08 | Chia sẻ trực tiếp / một lần; modal Tham gia với Fork | JoinFolderModal, ShareFolderModal, folder-sync |
| `<claude:c8462c53-fce7-4f56-94ff-6cd220470ad5>` | 18:27 | Ẩn badge Liveblocks | trade.content/index |
| `<claude:73cc0021-301b-450d-9f66-a024a7a07e62>` | 18:34 → 20:25 | Onboarding 8 bước với ảnh thật | entrypoints/onboarding, onboarding-steps |
| `<claude:886e65a7-b331-43b8-9837-ae941998dc20>` | 18:36 | Panel đẩy trang | App.vue |
| `<claude:f1c2d922-3847-4bd8-9838-4f64cc30fb11>` | 18:43 → 19:29 | GitHub open source, workflow release theo tag, cập nhật skill | release.yml, README, package.json |
| `<claude:2a11bb18-985f-4e5e-9cc2-5120c3799616>` | 19:18 → 19:27 | Badge Discord ở header | DiscordIcon, discord.ts |
| `<claude:bab81a95-1940-4747-aead-1a32021096ab>` | 19:27 | Hai nút `+`/`−` dính nhau, z-index | trade-stats/properties.content |
| `<claude:eb99b05e-f9d1-4822-8982-1a76a8554179>` | 19:30 | Giải thích lấy key ở đâu trong modal Tham gia | JoinFolderModal, locales |
| `<claude:c707e5b4-c91e-4e34-b8c6-5755dfd14d73>` | 19:34 → 20:30 | Nút Folder mới / Tham gia lên header; nút phẳng như site | App.vue, main.css |
| `<claude:4e17917f-e938-4582-b27c-c89839380de7>` | 20:31 | Icon ghi đè | SearchCard |
| `<claude:9d1f4cbc-4430-41d6-b5a5-e5c4af23c6f8>` | 20:34 → 22:15 | Sửa "Extension context invalidated"; kiểm đếm API call; ẩn cục bộ search trong folder share; heal room rỗng; JSON round-trip storage; commit 2bacb3d | storage, folder-sync, useFolderSync |

## 2026-09-05

| Session | Giờ | Việc | File chính |
|---|---|---|---|
| `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>` | 00:53 → 13:30 | Nghiên cứu đối thủ + KANO; bản Firefox; công tắc từng feature; nhãn giá per listing; bỏ popup; bookmark bền; sửa CustomEvent bị null; watchlist live (sau bị gỡ); tô sáng mod; đánh dấu seller; loạt commit 64657d4…02a3644 | nhiều |
| `<claude:4dc3fc4c-335b-461b-8001-94f2cac0bad4>` | 01:15 | Lưu kết quả nghiên cứu vào docs/research | research/*.md |
| `<claude:f369a81a-3b64-4e11-9151-d3312c129aa3>` | 02:14 → 03:04 | Quy đổi giá đúng cả ba chiều (chaos, divine, mirror) | price-labels, format-price, exchange-rate |
| `<claude:adc732e5-d22e-4d18-aba0-e7040d016a0f>` | 13:27 → 13:36 | Gỡ hẳn live search / watchlist; commit eb9d631 | storage, background, App.vue, wxt.config |
| `<claude:c346416d-8845-43d2-b505-13dbb2b382fb>` | 13:30 → 13:55 | Lỗi websocket Liveblocks; bookmark mất filter → lược field payload durable URL | trade-url, storage |
| `<claude:99fdfe8c-3e8b-48f1-8042-0c7ac9393cec>` | 13:38 | Autofocus khi đổi tên | FolderSection, SearchCard |
| `<claude:ad766582-047f-4228-9ced-d0c190d36270>` | 13:41 → 14:21 | Chuẩn hoá messaging sang @webext-core/messaging | extension-messaging, window-messaging, mọi content script |
| `<code:01a07056-25cd-7822-abf1-15699f5e1656>` | 13:51 → 14:14 | Kéo thả bookmark/folder; đánh dấu đã mua; tier picker từ TierFill | useBookmarkDrag, BookmarkDragHandle, bookmark-order, trade-tiers.content, data/ |
| `<code:01a0705a-e3b2-7ed0-a6f8-aa45f7c79edf>` | 13:56 → 14:40 | Tier picker thu hẹp theo category/base/unique; sửa khởi động; data/README | tier-filter, trade-tiers.content, poe2-base-types |
| `<code:01a0706d-d7ed-7a00-af49-e2dd5660d35a>` `<code:01a07073-1286-7d82-b099-7ed379cc962e>` | 14:17 → 14:40 | Review: vá rò rỉ listener khi unsubscribe `onSettingsUpdated` | window-messaging |
| `<code:01a070d4-b6e9-7f53-86d1-1cc49191f8c9>` | 16:09 | Bỏ menu Move up/down/Move to folder | FolderSection, SearchCard, locales |
| `<code:01a0710a-c29d-7722-a1af-6cb5a68a80fd>` `<code:01a0710b-7e60-7ae1-ac71-b583b4ab8e5d>` `<code:01a0710e-9e08-7862-9cb3-f97ceac1422f>` | 17:08 → 17:17 | `+`/`−` đặt min/max bằng giá trị cho mod; review; test tích hợp | stat-filter, property-filter, trade-stats.content, stat-buttons.test |
| `<code:01a07174-9a17-76e1-b96a-de769265d3e2>` | 19:04 → 21:42 | Ghi chú folder (sync) và bookmark, UI compact | FolderSection, SearchCard, folder-sync, storage |
| `<claude:2a8f7624-937d-4a11-a058-521a45221fcc>` | 21:47 → 22:10 | Modal tạo/sửa folder | FolderFormModal |
| `<claude:32a9abf3-bbc2-4820-aa4a-1c7111356f2f>` | 22:20 | Bỏ mũi tên thu gọn folder | FolderSection |
| `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>` | 22:27 → 09-06 01:18 | Nghiên cứu và implement import poe.ninja; PoB code và pobb.in; matcher; dataset test 4 character; doc research | ninja-import, pob-import, ImportNinjaModal, trade-ninja.content, background, fixtures |

## 2026-09-06

| Session | Giờ | Việc | File chính |
|---|---|---|---|
| `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>` | 00:04 → 01:25 | Giải thích matcher; group `count` cho mod trùng id; unique mang stat; thí nghiệm section trên site; telemetry Datadog đầu cuối; PRIVACY.md | telemetry, track, background, stat-filter, PRIVACY |
| `<claude:9e56807a-fb18-4e46-b33c-86c38aa3e0c4>` | 00:33 → 00:46 | Định dạng nhãn giá `10 chaos ≈ 0.033 div`; icon từ catalog exchange | trade-currency-icons.content, usePriceLabels, price-labels |
| `<claude:7efb3403-e37e-4a92-9e10-91769a2a9fc7>` | 01:18 → | Viết lại toàn bộ tài liệu; gộp và xoá docs/superpowers | README, docs/ |

## Session không tạo code

Bỏ dở hoặc chỉ hỏi đáp, giữ để truy vết: `<claude:8288652f-2fb7-4e90-a4bd-f7990252d2e3>`, `<claude:442251a8-610e-4c2e-855f-94af9bae3c48>`, `<code:01a067c4-3a8e-7260-a5bf-a61ba3fe512b>`, `<code:01a067c6-1891-78d1-aa39-f8d7b914133d>`, `<code:01a067ce-dacc-7100-8f3b-e0a51c271695>` (ý tưởng nút thêm từng thuộc tính vào search, ngày 09-03), `<claude:9a8d70e9-9fc4-4ffd-a9c8-f772852c50d9>` (commit all), `<claude:8b25fb0e-b1c1-4e62-b6c2-de5ae53b0b2b>` (hỏi về auto update ngoài store), `<code:01a07177-063e-7e40-9f80-32c2441366e9>` (reviewer phê duyệt lệnh cho session Codex khác).
