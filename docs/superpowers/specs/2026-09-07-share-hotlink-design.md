# Share hotlink — landing page + auto-join qua URL

## Vấn đề

Chia sẻ folder hiện tại (`docs/features/folder-share.md`) chỉ sinh ra một share key thô (`share_<uuid>`) — người nhận phải mở extension, dán key vào `JoinFolderModal` mới xem được nội dung. Người không cài extension không xem được gì cả. Mục tiêu: thêm một **link** đi kèm mỗi share key, mở được bằng trình duyệt thường:

- **Không có extension**: thấy trang liệt kê các search trong folder, mỗi search có nút mở thẳng `pathofexile.com/trade`.
- **Có extension**: có thêm một nút để mở trực tiếp luồng Join/Fork sẵn có trong panel, không phải copy-paste key thủ công.

Không thay thế cơ chế share key/JoinFolderModal hiện có — hotlink là lớp phủ thêm lên trên, share key thô vẫn hiển thị và dùng được như cũ.

## Kiến trúc

Bun workspace, thêm 2 package mới cạnh extension hiện có; extension ở root **không di chuyển**:

```
poe-pro-trade/
├── package.json                    # + "workspaces": ["packages/*"]
├── entrypoints/, components/, lib/ # extension — giữ nguyên, chỉ sửa import ở 2 file
└── packages/
    ├── shared/                     # thuần TS + 1 component Vue, không build step riêng
    │   ├── package.json            # name: "shared", export .ts trực tiếp (không dist/)
    │   ├── trade-url.ts            # move buildDurableUrl, buildQueryPayload, gzipBase64Url
    │   ├── liveblocks-room.ts      # move enterFolderRoom, FolderRoomStorage type
    │   ├── folder-sync-types.ts    # move SharedFolderMeta, SharedSearchFields, resolveShareMode
    │   └── ShareItemRow.vue        # MỚI — hiển thị 1 search: title, note, nút mở trade site
    └── web/                        # Vite + Vue thuần (không WXT, không cần extension API)
        ├── index.html
        ├── src/App.vue
        └── vite.config.ts
```

`lib/trade-url.ts` và `lib/liveblocks-room.ts` trong extension đổi thành re-export từ package `shared`. `parseTradeUrl`/`normalizeTradeUrl`/`isTradeUrl` (dùng `#i18n`, chỉ phục vụ import build) ở lại extension, không move.

## Luồng dữ liệu

1. **Tạo hotlink** — `ShareFolderModal.vue`: sau khi có `shareKey`/`onceKey`, thêm ô thứ hai `https://poe-trade.aiocean.io/?key=<key>` kèm nút copy riêng, bên cạnh raw key hiện có (không thay thế).
2. **Mở link, không có extension** — `packages/web` đọc `?key=`, gọi `enterFolderRoom(key)` (cùng public key extension đang dùng) lấy `folder` meta + `searches`, render bằng `ShareItemRow.vue`. Mỗi dòng có nút mở `pathofexile.com/trade[2]/...` build qua `buildDurableUrl`. Có banner "Cài extension để đồng bộ trực tiếp" trỏ Chrome Web Store listing.
3. **Mở link, có extension** — content-script mới `entrypoints/share-marker.content.ts` (match `https://poe-trade.aiocean.io/*`) chỉ set `document.documentElement.dataset.exileTradeCompanion = 'installed'`. Trang landing thấy marker → hiện thêm nút "Mở trong extension" (không tự động redirect) → điều hướng `https://www.pathofexile.com/trade[2]/#etc-join=<key>`. Game (`trade` hay `trade2`) suy từ field `game` của search đầu tiên trong room.
4. **Trade site nhận hash** — `entrypoints/trade.content/index.ts` lúc mount đọc `location.hash`; nếu match `#etc-join=<key>`, tự mở `JoinFolderModal` với key đó (dùng lại `inspectShareKey` sẵn có, Fork/Join UI không đổi), rồi xoá hash khỏi URL bằng `history.replaceState`.

## Error handling

- `key` thiếu hoặc sai format → landing page hiện "Link không hợp lệ".
- Room không tồn tại/rỗng (key bị thu hồi hoặc rotate) → "Link đã hết hạn hoặc đã bị thu hồi".
- Lỗi mạng/Liveblocks quota → thông báo lỗi chung + nút thử lại.
- Thiếu `VITE_LIVEBLOCKS_PUBLIC_KEY` lúc build `packages/web` → trang hiện lỗi cấu hình rõ ràng, không throw trắng trang.

## Testing

- `packages/shared`: giữ test hiện có của `buildDurableUrl` (split từ `lib/trade-url.test.ts`), thêm test cho hàm parse `#etc-join=<key>` (pure function).
- `packages/web`: vitest cho parse `?key=`, render danh sách, mock có/không marker.
- Extension: test hash-handling khi mount `trade.content` (mở `JoinFolderModal` đúng key, xoá hash).
- Live verify qua `ego-browser`: mở landing page thật sau khi deploy, với và không có extension load (theo rule bắt buộc trong CLAUDE.md cho thay đổi UI/frontend).

## Deploy

- Host: **Cloudflare Pages**, custom domain `poe-trade.aiocean.io` (domain người dùng sở hữu, quản lý qua Cloudflare).
- Setup lần đầu (thủ công, qua skill `deploy-cloudflare-page`): tạo Cloudflare Pages project cho `packages/web`, gắn custom domain — xác nhận với user trước khi chạy vì đây là thao tác hạ tầng thật (tạo resource, sửa DNS).
- CI/CD định kỳ: `.github/workflows/deploy-web.yml` — push vào `main` đụng `packages/web/**`/`packages/shared/**` → build → deploy qua Wrangler, dùng secret `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (thêm mới vào repo secrets, cạnh các secret khác `release.yml` đang dùng).

## Ngoài phạm vi

- Không làm chiều ngược "PoB code" (ý tưởng ban đầu, đã bị thay bằng hotlink theo quyết định của user).
- Không thêm auth/owner cho share key — giữ nguyên triết lý "room id là mật khẩu" của `folder-share.md`.
- Không tự động redirect khi phát hiện extension — luôn cần người dùng bấm nút (đã chốt trong brainstorm).
