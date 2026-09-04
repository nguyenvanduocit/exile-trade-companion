# Folder Share Sync

## Goal

Cho phép một folder trong extension (chứa các saved search) được chia sẻ giữa nhiều người dùng: một người bật share trên folder, nhận về một key; bất kỳ ai có key đó join được, và mọi thay đổi (thêm/sửa/xoá search, đổi tên/màu folder) đồng bộ hai chiều theo thời gian thực giữa mọi người đang có key, miễn là họ đang mở extension.

## Ngoài phạm vi (out of scope)

- Phân quyền owner/viewer, revoke quyền của một người cụ thể.
- Sync khi extension đóng hoàn toàn (không có background/service-worker sync).
- Merge nội dung phức tạp hơn last-write-wins theo field (không cần rich-text CRDT).
- Cảnh báo/audit ai đã sửa gì (không track identity).

## Kiến trúc

**Không có backend riêng.** Dùng Liveblocks ở **client-side-only mode** (public API key, không cần custom auth endpoint) — đã verify bằng spike thực tế (xem `## Spike verification`).

- Mỗi folder được share = một Liveblocks room riêng.
- **Room ID chính là key chia sẻ** — một chuỗi random đủ dài (`share_<24 ký tự random>`), không có mapping hay bảng tra riêng. Ai có chuỗi này connect được vào đúng room đó.
- Không có khái niệm owner/viewer. Ai cầm key có full quyền đọc/ghi. Không thể kick một người cụ thể — muốn "thu hồi" thì rotate sang room mới (clone nội dung hiện tại), rời room cũ. Room cũ vẫn tồn tại độc lập trên Liveblocks, những ai còn giữ key cũ dừng nhận update mới từ mình kể từ lúc đó.
- Sync engine chỉ sống trong UI context đang mở (popup hoặc content-script panel) — không có kết nối nền khi đóng hết UI. Đóng lại = ngừng nhận update; mở lại = tự pull bản mới nhất ngay lập tức khi enter lại room.

## Data model

### Thay đổi `types/trading.ts`

```ts
export interface SearchFolder {
  id: string
  name: string
  color: string
  order: number
  shareKey?: string   // room id trên Liveblocks; có field này = folder đang share
}
```

Không đổi gì ở `SavedSearch` — `folderId` vẫn là local-only, không đưa vào room storage.

### Shape trong Liveblocks room storage

Mỗi room có root storage dạng:

```ts
{
  folder: LiveObject<{ name: string; color: string }>,
  searches: LiveMap<string, LiveObject<SharedSearchFields>>,  // key = SavedSearch.id
}

type SharedSearchFields = Omit<SavedSearch, 'id' | 'folderId'>
```

`initialStorage` chỉ áp dụng lần đầu room được tạo (client đầu tiên seed nó bằng nội dung folder local hiện tại). Các lần enter sau chỉ đọc storage đã có, không ghi đè.

## Sync engine

Composable mới `composables/useFolderSync.ts`. Nguyên tắc: **tái dùng cơ chế multi-tab sync sẵn có** (`browser.storage.onChanged` trong `composables/useTradeStore.ts:37-41`) thay vì xây một đường truyền message mới giữa popup/content-script.

- Khi `useTradeStore().init()` chạy trong một context (popup mount / content-script panel mount), với mỗi folder có `shareKey` trong `state.value.folders`: `client.enterRoom(shareKey)`.
- Subscribe `room.subscribe(root, callback, { isDeep: true })`. Callback nhận thay đổi từ room → merge vào `TradeState` local qua một hàm `mergeRemoteIntoLocal()` (file mới `lib/folder-sync.ts`) → `writeState()` như bình thường (path hiện có ở `lib/storage.ts:70-73`). `browser.storage.onChanged` tự lo phần lan toả sang các context khác đang mở.
- **Tránh echo loop**: `mergeRemoteIntoLocal()` là một path ghi riêng, KHÔNG gọi lại hàm "push lên room". Các hàm mutate hiện có trong `lib/storage.ts` (`saveSearch`, `updateSearch`, `removeSearch`, `renameFolder`, ...) giữ nguyên, chỉ thêm một bước ở `useTradeStore` (`composables/useTradeStore.ts:47-49`, hàm `run()`): sau khi `writeState()` xong, nếu search/folder thuộc một folder có `shareKey`, gọi thêm `pushToRoom()` áp cùng thay đổi lên `LiveMap`/`LiveObject` tương ứng.
- Nhiều room active cùng lúc (nhiều folder được share) → nhiều `Room` instance song song, không giới hạn đặc biệt ở scale nhóm bạn nhỏ.

## Import Liveblocks đúng cách (khác spike)

Spike dùng `import('https://esm.sh/@liveblocks/client@2')` trong một trang test trần — CHỈ hợp lệ cho việc verify nhanh trong `ego-browser`, **không được copy pattern này vào code thật**. Chrome Web Store cấm remotely-hosted code trong extension. Code thật phải:

```bash
bun add @liveblocks/client
```

và `import { createClient } from '@liveblocks/client'` như bundle bình thường qua Vite/WXT.

## Manifest changes (`wxt.config.ts:16`)

Thêm `host_permissions` cho domain Liveblocks (MEDIUM confidence — cần xác nhận scheme chính xác lúc code bằng cách bắt request thật, tài liệu ghi domain là `api.liveblocks.io` cho cả REST và WebSocket):

```ts
manifest: {
  permissions: ['storage', 'activeTab', 'contextMenus'],
  host_permissions: ['https://api.liveblocks.io/*', 'wss://api.liveblocks.io/*'],
}
```

Public API key (`pk_...`) embed thẳng trong bundle qua biến môi trường build-time (không phải secret, an toàn để ship — đây chính là mục đích của public key).

## UI flow

- **Share folder** — nút mới trên `components/FolderSection.vue` (140 dòng hiện tại, thêm action item vào menu đã có). Sinh `shareKey`, `enterRoom` với `initialStorage` seed từ nội dung folder local hiện tại, hiện key trong modal để copy.
- **Join bằng key** — action riêng cạnh "New Folder" ở sidebar (đã có sẵn UI pattern nút dashed-border thêm folder, theo lịch sử session gần đây). Dán key → tạo folder local mới (`shareKey` = key vừa dán) → `enterRoom` → pull toàn bộ `searches` map hiện có trong room về local.
- **Rotate/unshare** — sinh key mới, clone nội dung hiện tại của folder sang room mới (`initialStorage`), chuyển `shareKey` local sang key mới, rời room cũ (`leave()`). Copy chính xác message trong `## Kiến trúc` để giải thích hệ quả cho user trong UI (không silent).

## Failure modes

- **Field-level last-write-wins** — Liveblocks tự xử lý conflict ở cấp field trong `LiveObject`/`LiveMap`, không có merge thông minh hơn. Đủ tốt cho nhóm bạn nhỏ chỉnh sửa không đồng thời liên tục; không phù hợp cho dữ liệu high-stakes.
- **Key lộ = mất quyền kiểm soát folder đó** — thiết kế chấp nhận trade-off này (đã thống nhất với user), không phải bug. Entropy của room ID (24+ ký tự random) là lớp bảo vệ duy nhất.
- **Mất kết nối/offline** — fail lặng lẽ, không chặn thao tác local trên folder. Liveblocks client tự reconnect trong phiên nếu rớt mạng tạm thời.
- **Liveblocks free-tier limit** — plan hiện tại (`nguyenvanduocit's team`, FREE) giới hạn 3K phút realtime collab/tháng, 3M data storage update/tháng. Đủ cho scale nhóm bạn nhỏ; nếu extension được nhiều người cài, cần theo dõi usage dashboard (`https://liveblocks.io/dashboard/vybWEz96Qfv8aeed61aXc/usage`).
- **Environment tách biệt** — dashboard có 2 project riêng: `Production` (đã có 15 room từ app khác — KHÔNG dùng cho feature này) và `Development` (dùng cho spike, 0 room trước khi test). Cần tạo project Liveblocks riêng cho extension này trước khi ship, không tái dùng chung project với app khác.

## Spike verification (2026-09-04)

Chạy trực tiếp trong 2 tab trình duyệt độc lập (mô phỏng 2 người dùng) qua `ego-browser`, dùng public key thật từ project Development:

1. Tab A: `client.enterRoom(roomId, { initialStorage: {...} })` với `roomId` random chưa từng tồn tại → room tự tạo thành công, không gọi bất kỳ endpoint auth/server nào.
2. Tab B: connect vào đúng `roomId` đó (dùng `initialStorage` khác để test không bị ghi đè) → thấy đúng data của Tab A, `initialStorage` của B bị bỏ qua vì room đã tồn tại — xác nhận room ID hoạt động đúng như "key/password".
3. Tab A mutate (`root.set(...)`) → Tab B đọc lại object storage đã giữ tham chiếu từ lúc enter (không re-fetch) → thấy giá trị mới ngay lập tức — xác nhận live-binding hai chiều hoạt động thật, không chỉ theo docs.

Kết luận: kiến trúc "zero backend, room ID = key" **HIGH confidence** — đã verify hành vi thật, không chỉ dựa vào tài liệu.

**Version drift phát hiện lúc code thật:** spike dùng `@liveblocks/client@2` qua esm.sh, nhưng `bun add @liveblocks/client` cài về `3.24.1`. Giữa v2 và v3, `LiveObject.toObject()` đổi tên thành `LiveObject.toJSON()` — API hành vi (room auto-create, `LiveMap.set/get/delete`, `room.subscribe(root, cb, {isDeep:true})`) không đổi, chỉ tên method đọc giá trị đổi. Bài học: luôn kiểm `node_modules/@liveblocks/core/dist/index.d.ts` thay vì tin nguyên xi API đã spike ở version khác.

## Testing strategy

- Unit test `lib/folder-sync.ts` (mapping logic `mergeRemoteIntoLocal` / `pushToRoom`) với Liveblocks storage mock — theo pattern TDD hiện có của repo (vd `lib/property-filter.ts` có test suite riêng).
- Integration test thủ công qua `ego-browser` 2-tab (như spike) trước khi merge, vì Liveblocks realtime khó mock trung thực trong vitest.
- Không cần E2E tự động hoá cho phần realtime — effort bỏ ra không tương xứng với scale nhóm bạn nhỏ của tính năng này.
