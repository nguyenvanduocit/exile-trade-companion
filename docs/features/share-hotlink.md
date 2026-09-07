# Hotlink kèm share key

`packages/shared`, `packages/web`, `lib/share-hotlink.ts`, `lib/join-hash.ts`, `entrypoints/share-marker.content.ts`. Mỗi share key của [folder được chia sẻ](folder-share.md) có thêm một URL mở được trong trình duyệt, không cần dán key thủ công.

## Hành vi

- Hộp thoại chia sẻ giữ nguyên raw key và thêm `https://poe-trade.aiocean.io/?key=<key>` cùng nút copy riêng. Cả chế độ trực tiếp và bản chụp một lần đều có hotlink.
- Người không cài extension vẫn xem được tên folder, ghi chú và danh sách search. Mỗi search có link mở trên trang trade; bookmark cũ thiếu query sẽ hiện lý do không thể dựng URL.
- Khi extension có mặt, landing page hiện nút **Mở trong extension**. Nút này mở `pathofexile.com/trade` hoặc `trade2` với hash `#etc-join=<key>`; extension mở `JoinFolderModal`, inspect key rồi giữ nguyên lựa chọn Fork/Tham gia hiện có.
- Phát hiện extension chỉ đổi CTA. Trang không tự chuyển hướng.

## Cách hoạt động

- `packages/shared` chứa code dùng chung cho extension và landing page: đọc room Liveblocks, dựng durable trade URL, parse join hash và các type folder/search. Hai consumer import source trực tiếp qua workspace `shared`.
- `packages/web` đọc `?key=`, chụp meta/search bằng `toJSON()`, dựng URL cho từng item rồi rời room. Landing page không giữ kết nối đồng bộ.
- Content script `share-marker.content.ts` đặt `data-exile-trade-companion="installed"` ở `document_start` trên domain landing page. Web kiểm tra marker ngay và quan sát thêm trong thời gian ngắn để tránh race khi khởi động.
- Trade content script xoá join hash sau khi đọc nhưng giữ nguyên `history.state`, path và query của trang PoE.

## Quyết định

- Hotlink là lớp bổ sung; raw share key và luồng `JoinFolderModal` vẫn được giữ nguyên. `<code:01a07b58-68ad-7eb2-86e8-d7e1cb7b4015>`
- Phát hiện extension chỉ đổi CTA, không tự chuyển hướng người dùng. `<code:01a07b58-68ad-7eb2-86e8-d7e1cb7b4015>`
- Extension ở repo root, logic dùng chung ở `packages/shared`, landing app ở `packages/web`; hai app dùng cùng schema room và public key. `<code:01a07b58-68ad-7eb2-86e8-d7e1cb7b4015>`

## Cấu hình và triển khai

- Web và extension dùng cùng `VITE_LIVEBLOCKS_PUBLIC_KEY` ở `.env` root. Thiếu key, landing page hiện lỗi cấu hình thay vì báo lỗi mạng.
- `bun run web:dev` chạy landing page local; `bun run web:build` tạo `packages/web/dist`.
- Workflow `deploy-web.yml` đã sẵn sàng để build và deploy lên Cloudflare Pages project `poe-trade-share`. URL Chrome Web Store lấy từ repository variable `CHROME_WEB_STORE_URL`; khi chưa có listing public, CTA trỏ tới hướng dẫn cài trong repository.
- Tính đến 2026-09-07, chưa tạo Pages project, chưa gắn domain/DNS và chưa thêm GitHub secrets. Các bước này đang chờ phê duyệt vì thay đổi hạ tầng bên ngoài.
- Sau khi được phê duyệt, cần tạo project và custom domain, thêm `CLOUDFLARE_API_TOKEN` cùng `CLOUDFLARE_ACCOUNT_ID`, cấu hình `CHROME_WEB_STORE_URL` khi có listing, rồi kiểm tra end-to-end ở profile có và không có extension, gồm cả luồng Fork/Tham gia.

## Giới hạn

- Room id vẫn là mật khẩu. Landing page chỉ đọc snapshot, nhưng ai có hotlink hoặc raw key đều có thể dùng key để đọc hay ghi room; muốn thu hồi phải đổi key.
- Nút Join chọn PoE 1 hay PoE 2 theo search đầu tiên; folder rỗng mặc định PoE 1.
- Landing page đọc một snapshot lúc mở. Folder đang share trực tiếp không tự cập nhật trên trang web.

## Test

`packages/shared/*.test.ts`, `packages/web/src/share-page.test.ts`, `lib/share-hotlink.test.ts`, `lib/join-hash.test.ts`. `bun run check` chạy test, typecheck và build cho extension, shared package và web package.
