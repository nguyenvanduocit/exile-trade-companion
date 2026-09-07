# Chia sẻ folder qua Liveblocks

`composables/useFolderSync.ts`, `lib/folder-sync.ts`, `lib/liveblocks-room.ts`, `components/ShareFolderModal.vue`, `JoinFolderModal.vue`. Một folder được share là một room Liveblocks; room id chính là share key.

## Hành vi

- **Chia sẻ trực tiếp**: sinh `share_<uuid>`, tạo room với `initialStorage` seed từ folder hiện tại, gắn `shareKey` vào folder. Mọi thay đổi tên/màu/ghi chú folder và thêm/sửa/xoá bookmark đồng bộ hai chiều khi UI đang mở. Đổi key mới = tạo room mới, rời room cũ. Ngừng chia sẻ = rời room, bỏ `shareKey`, dữ liệu local giữ nguyên.
- **Chia sẻ một lần**: tạo room với `mode: 'once'`, seed dữ liệu, rời ngay. Folder gốc không đổi.
- **Tham gia**: dán key → `inspectShareKey` mở room và đọc meta. Key một lần → sao chép thành folder mới. Key trực tiếp → Fork (bản sao tĩnh) hoặc Tham gia (folder mới mang `shareKey`, đồng bộ liên tục). Key đã dùng trên máy này bị từ chối.
- Trong folder share trực tiếp: xoá bookmark chỉ thêm id vào `hiddenSearchIds` (ẩn cục bộ, không đẩy xoá lên room); kéo bookmark ra folder khác ẩn bản gốc và tạo bản sao id mới. Thứ tự và trạng thái đã mua không đồng bộ, ghi chú folder có.
- Trạng thái sync hiện trên icon share của folder: connecting, syncing, idle, error.
- Mỗi share key đi kèm một hotlink mở được bằng trình duyệt thường — xem [share-hotlink.md](share-hotlink.md).

## Cách hoạt động

- Room storage: `{ folder: LiveObject<{name,color,note,mode}>, searches: LiveMap<id, LiveObject<SharedSearchFields>> }`. `SharedSearchFields` = `SavedSearch` bỏ `id`, `folderId`, `order`, `purchased`; `query` ép sang `Json`.
- Local → room: `watch(store.state, flush:'sync')` diff `prev`/`next` bằng `diffSearchesForFolder` (theo `updatedAt`) và `diffFolderMeta`, áp lên LiveMap/LiveObject. Room → local: `room.subscribe(root, …, {isDeep:true})` → `applyRemoteFolderState` ghi thẳng vào storage; `storage.onChanged` lan sang các context khác. Hai path ghi tách biệt nên không echo loop.
- Room báo về meta rỗng (`name === ''`) nghĩa là Liveblocks vừa tự tạo lại room trống (room bị xoá, reconnect): coi local là nguồn thật và ghi ngược lên (`applyRemoteOrHeal`), không xoá sạch local.
- Client-side-only mode với public key, không auth endpoint, không backend. Host permission `api.liveblocks.io`. Badge Liveblocks bị ẩn bằng CSS chèn vào trang.

## Quyết định

- Không backend, room id là mật khẩu: "bị lộ là lộ hết" là đánh đổi chấp nhận. Không owner/viewer, muốn thu hồi thì đổi key. Đã spike hai tab thật trước khi code. `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>`
- Import `@liveblocks/client` qua bundler; không dùng CDN vì Chrome Web Store cấm remote code. v3 đổi `toObject()` thành `toJSON()` so với v2 lúc spike. `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>`
- Hai chế độ live và once, giải thích khác biệt ngay trong modal; join dùng modal, có Fork/Tham gia. `<claude:25953451-62d2-4745-a0ac-46a9ae92f3d6>` `<claude:eb99b05e-f9d1-4822-8982-1a76a8554179>`
- Xoá trong folder share chỉ ẩn cục bộ (`hiddenSearchIds`), heal room rỗng bằng dữ liệu local; sửa sau khi kiểm tra "Extension context invalidated" và số request. `<claude:9d1f4cbc-4430-41d6-b5a5-e5c4af23c6f8>`
- Ghi chú folder đồng bộ lên room. `<code:01a07174-9a17-76e1-b96a-de769265d3e2>`
- Ẩn badge Liveblocks. `<claude:c8462c53-fce7-4f56-94ff-6cd220470ad5>`
- Sync chỉ sống khi UI mở; không background sync. Field-level last-write-wins của Liveblocks là đủ cho nhóm nhỏ.

## Giới hạn

- Free tier Liveblocks: 3K phút realtime/tháng, 3M storage update/tháng. Cần project riêng cho extension, không dùng chung project khác.
- Thiếu `VITE_LIVEBLOCKS_PUBLIC_KEY` thì mọi thao tác share ném lỗi.
- Không có audit ai sửa gì.

## Test

`lib/folder-sync.test.ts`, `composables/useFolderSync.test.ts` (mock room), `lib/storage.test.ts` (hidden, move out of shared).
