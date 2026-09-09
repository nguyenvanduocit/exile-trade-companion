# Tính năng

Mỗi file mô tả một tính năng: hành vi người dùng thấy, cách hiện thực, các quyết định kèm tag session đã đưa ra quyết định đó, giới hạn và test. Tag dạng `<claude:session-id>` là session Claude Code, `<code:session-id>` là session Codex; bản đồ đầy đủ ở [../sessions.md](../sessions.md).

| Tính năng | File | Công tắc |
|---|---|---|
| Bookmark, folder, lịch sử, sao lưu | [bookmarks.md](bookmarks.md) | luôn bật |
| Bookmark bền (lưu query, dựng lại URL) | [durable-url.md](durable-url.md) | luôn bật |
| Nút + / − trên dòng mod, tô sáng mod đang search | [stat-filter-buttons.md](stat-filter-buttons.md) | hai công tắc |
| Nút + / − trên thuộc tính item | [property-filter-buttons.md](property-filter-buttons.md) | có |
| Nhãn quy đổi giá trên listing | [price-labels.md](price-labels.md) | có |
| Lịch sử giá theo bookmark | [price-history.md](price-history.md) | luôn bật |
| Đánh dấu seller bán nhiều item | [bulk-seller.md](bulk-seller.md) | có |
| Chia sẻ folder (Liveblocks) | [folder-share.md](folder-share.md) | theo folder |
| Hotlink xem folder không cần extension | [share-hotlink.md](share-hotlink.md) | theo folder |
| Import build (poe.ninja, PoB) | [import-build.md](import-build.md) | theo thao tác |
| Thống kê sử dụng ẩn danh | [telemetry.md](telemetry.md) | có |
| Onboarding, shell panel, i18n, giao diện | [onboarding-and-shell.md](onboarding-and-shell.md) | |

Tính năng đã gỡ: live search / watchlist (theo dõi bookmark ở tab nền và bắn notification). Lý do ở [../decisions.md](../decisions.md).
