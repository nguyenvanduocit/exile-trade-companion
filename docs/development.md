# Phát triển và phát hành

## Chuẩn bị

```bash
bun install          # postinstall chạy wxt prepare
cp .env.example .env # điền key bên dưới
```

Biến môi trường (`.env`, không commit):

- `VITE_LIVEBLOCKS_PUBLIC_KEY`: public key của project Liveblocks dành riêng cho extension. Thiếu thì mọi thao tác chia sẻ folder ném lỗi ngay khi tạo client; phần còn lại của extension vẫn chạy.
- `VITE_DATADOG_CLIENT_TOKEN` và `VITE_DATADOG_SITE`: client token Datadog cho telemetry. Thiếu token thì telemetry tự tắt.

Cả hai loại key được thiết kế để lộ trong bundle client, không phải secret server.

## Lệnh

| Lệnh | Việc |
|---|---|
| `bun run dev` | WXT mở Chrome profile dev và load extension, hot reload |
| `bun run dev:firefox` | tương tự với Firefox |
| `bun run build` / `build:firefox` | build production vào `.output/chrome-mv3` hoặc `.output/firefox-mv2` |
| `bun run test` | vitest |
| `bun run typecheck` | vue-tsc |
| `bun run check` | test + typecheck + build Chrome, chạy trước khi commit |
| `bun run zip` / `zip:firefox` | tạo zip phát hành trong `.output/` |

Load thủ công: Chrome `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3` (dev và build đều ghi vào đây). Firefox `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv2/manifest.json`; add-on tạm mất khi đóng Firefox. Content script `world: 'MAIN'` cần Firefox 128 trở lên.

## Quy ước code

- Logic thuần vào `lib/*.ts` kèm `*.test.ts` cùng tên; I/O (DOM, fetch, storage, Vuex) ở entrypoint và composable. Test mô tả bằng tiếng Việt.
- Comment giải thích *vì sao* bằng tiếng Việt, kèm ngày verify khi dựa vào hành vi quan sát được của site.
- Mọi chuỗi UI mới thêm vào cả `locales/vi.json` lẫn `locales/en.json`, rồi `bunx wxt prepare` trước khi typecheck.
- Không gọi API tìm kiếm của GGG, không tự chạy search, không polling nền. Ngoại lệ duy nhất đang có là endpoint bulk exchange để lấy tỷ giá; thêm request mới tới `pathofexile.com` là quyết định sản phẩm, ghi vào [decisions.md](decisions.md).
- Chỉ thêm host permission khi thật sự phải fetch từ background; ghi lý do vào `wxt.config.ts`.
- Feature chèn vào DOM trang phải có công tắc trong Settings và hàm gỡ sạch khi tắt.
- Đọc `window.app` chỉ trong MAIN world, luôn kiểm `app?.$store`. Gửi object qua messaging thì `toRaw` trước.
- Khác biệt PoE1/PoE2: giữ core chung, rẽ nhánh đúng điểm khác biệt bằng cờ `isPoe2` (xem `resolvePropertyGroup`), không tách module theo game.

## Verify sống trên trade site

Extension đang được load unpacked trong Chrome profile của ego-browser, trỏ `.output/chrome-mv3`. Sau `bun run build` phải reload thủ công: mở `chrome://extensions`, đi qua shadow DOM `extensions-manager → extensions-item-list → extensions-item#<id>` và click `#dev-reload-button`. Panel trên trade site là custom element `exile-trade-companion` có shadowRoot, mặc định thu gọn; mọi thao tác trong panel phải `js()` vào shadowRoot.

Ép trang kết quả có listing giá chaos để test nhãn giá hoặc snapshot: trên trang search chạy `window.app.$set(app.$store.state.persistent.filters.trade_filters.filters, 'price', {option:'chaos', min:5, max:50})` (tạo `trade_filters` bằng `$set` nếu chưa có) rồi click Search và chờ vài giây.

Test nhanh một content script MAIN world mà không reload extension: `js()` nội dung `.output/chrome-mv3/content-scripts/<file>.js` vào tab trade.

Chụp screenshot cho store listing dùng harness Vite ở `tmp/preview/` (mount `trade.content/App.vue` trong shadow DOM lên ảnh header trade thật, shim `wxt/browser` và `#i18n`); thư mục `tmp/` không commit nên có thể phải dựng lại, cấu trúc mô tả trong skill `.claude/skills/release-extension/SKILL.md`.

Account đã từng bị GGG flag. Khi thao tác DOM trên trade site bằng automation, chờ 1–2 giây giữa mỗi action, không gọi song song.

## Dữ liệu bundle

- `data/poe2-tiers.json`: snapshot của TierFill (MIT, notice ở `public/licenses/TierFill.txt`). Cập nhật: thay JSON, ghi commit và SHA-256 mới vào `data/README.md`, chạy `bun run check`, xem lại breakpoint đổi trong `lib/tier-filter.test.ts`.
- `data/poe2-base-types.json`: sinh từ RePoE bằng `node scripts/build-poe2-base-types.mjs <base_items.json>`.
- `lib/__fixtures__/`: character thật từ poe.ninja và catalog stat cắt gọn, sinh bằng `bun scripts/build-ninja-fixtures.ts <poe1 stats.json> <poe2 stats.json>`; hai file stats là dump `/api/trade/data/stats` và `/api/trade2/data/stats` lấy qua page-context fetch trên tab trade đã login (workspace `poe/poe1/data/trade-static/` và `poe/poe2/data/trade-static/`). Snapshot poe.ninja đổi theo gear người chơi, chạy lại script đồng nghĩa sửa expectation trong `lib/ninja-import.dataset.test.ts`.

## Phát hành

### Chrome Web Store qua git tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` chạy khi push tag `v*.*.*`: đặt version trong `package.json` theo tag, `bun run test`, `bun run typecheck`, `bun run zip`, upload **draft** lên Chrome Web Store (action `mnao305/chrome-extension-upload`, `publish: false`), tạo GitHub Release đính kèm zip. Sau đó vào Developer Dashboard kiểm tra listing và bấm Submit for review thủ công.

Bốn secret trong repo: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`. Extension đăng dưới publisher AI Ocean, item id `lmdfepkngckhbmcjbaijloakinneodfd`. Refresh token có thể bị Google revoke; cách tạo lại, layout Dev Console, upload screenshot và điền tab Privacy nằm trong skill `.claude/skills/release-extension/SKILL.md`.

Khi release bản có telemetry: listing Chrome Web Store phải khai thu thập "User activity" và có link privacy policy (nội dung ở `PRIVACY.md`).

### Firefox

`bun run zip:firefox` tạo gói MV2. Chưa có bước upload tự động lên addons.mozilla.org.

## Tài liệu

Cấu trúc và mục đích từng file ở [docs/README.md](README.md). Khi thêm hoặc đổi tính năng: cập nhật file trong `docs/features/`, thêm mục vào `decisions.md` nếu có lựa chọn đáng ghi, và thêm dòng vào `sessions.md` với tag session dạng `<claude:session-id>` hoặc `<code:session-id>`.
