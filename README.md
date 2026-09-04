# Exile Trade Companion

Extension quản lý Path of Exile trade searches cho Chrome và Firefox, lấy cảm hứng từ luồng bookmark của Better Trading nhưng được viết mới bằng WXT, Vue 3 và Tailwind. Giao diện dùng lại font FontinSmallCaps và bảng màu của chính trang trade nên panel nhìn như một phần của site.

## Có gì trong bản đầu

- Lưu search đang mở vào thư mục.
- Panel nổi trên `pathofexile.com/trade` và `trade2` với Shadow DOM cô lập CSS.
- Popup quản lý bookmark, ghim search, lọc nhanh và mở lại trong tab mới.
- Ghi lịch sử search khi URL thay đổi trên SPA.
- Nút `+` trên từng dòng mod trong kết quả trade: hover vào mod, bấm là stat đó vào Stat Filters của search hiện tại (group And đầu tiên, min/max để trống, không tự chạy search). Chạy trên cả trade và trade2.
- Menu chuột phải và phím tắt `Alt+Shift+B`.
- Nhập/xuất backup JSON.
- Dữ liệu nằm trong `chrome.storage.local`; extension không gọi GGG Trade API.

## Chạy local

### Chrome

```bash
bun install
bun run dev
```

WXT sẽ mở một profile Chrome dev và load extension tự động. Nếu muốn load thủ công:

```bash
bun run build
```

Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked**, rồi trỏ tới `.output/chrome-mv3` (dev và build đều ghi vào đây).

### Firefox

```bash
bun run dev:firefox
```

WXT sẽ mở một profile Firefox dev và load extension tự động. Nếu muốn load thủ công:

```bash
bun run build:firefox
```

Mở `about:debugging#/runtime/this-firefox`, bấm **Load Temporary Add-on**, chọn file `.output/firefox-mv2/manifest.json`. WXT tự build Firefox dưới dạng manifest v2 (mặc định của WXT cho Firefox); content script `world: MAIN` (nút `+` thêm stat filter) cần Firefox 128 trở lên. Add-on tạm sẽ mất khi đóng Firefox, phải load lại mỗi lần khởi động.

## Kiểm tra

```bash
bun run check
```

Lệnh trên chạy unit test, Vue typecheck và production build Chrome. Tạo gói để phát hành bằng `bun run zip` (Chrome) hoặc `bun run zip:firefox` (Firefox).

## Phát hành

Push tag dạng `vX.Y.Z` sẽ chạy workflow `.github/workflows/release.yml`: bump version trong `package.json` theo tag, chạy test + typecheck + build, zip extension, upload draft lên Chrome Web Store (không tự publish) và tạo GitHub Release đính kèm zip.

```bash
git tag v0.2.0
git push origin v0.2.0
```

Sau khi workflow chạy xong, vào [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) bấm **Submit for review** thủ công. Workflow cần bốn secret trong repo settings: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.

Workflow trên chỉ build và upload bản Chrome. Bản Firefox (`bun run zip:firefox`) hiện đóng gói thủ công, chưa có bước nào tự động upload lên [addons.mozilla.org](https://addons.mozilla.org).

## Cấu trúc chính

- `entrypoints/popup/`: popup quản lý đầy đủ.
- `entrypoints/trade.content/`: panel inject vào trang trade.
- `entrypoints/trade-stats.content.ts`: content script `world: MAIN`, gắn nút `+` vào dòng mod và commit vào Vuex store của site (`window.app.$store`, mutation `setStatFilter`). Logic thuần ở `lib/stat-filter.ts`.
- `entrypoints/background.ts`: menu chuột phải, phím tắt và mở tab.
- `components/`: `CurrentSearch` (khối lưu search đang mở), `FolderSection`, `SearchCard`; `components/ui/collapsible` bọc reka-ui.
- `assets/main.css`: bảng màu, font và các utility `poe-btn`, `poe-input`, `icon-btn` dùng chung cho popup lẫn panel.
- `lib/storage.ts`: schema và toàn bộ thao tác local storage.
- `lib/trade-url.ts`: nhận diện URL trade POE1/POE2.

Better Trading là dự án độc lập của exile-center. Repository này không sao chép source, logo hoặc tên thương mại của Better Trading.
