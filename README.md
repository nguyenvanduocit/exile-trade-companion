# Exile Trade Companion

Extension Chrome và Firefox cho trang trade của Path of Exile 1 (`pathofexile.com/trade`) và Path of Exile 2 (`pathofexile.com/trade2`). Panel nằm ngay trên trang trade, dùng font và bảng màu của chính site. Viết bằng WXT, Vue 3 và Tailwind; mã nguồn mở theo Apache-2.0.

Extension không tự chạy search và không gọi API tìm kiếm của GGG. Dữ liệu của bạn nằm trong `chrome.storage.local`; chỉ folder bạn chủ động chia sẻ mới rời khỏi máy.

## Tính năng

- **Bookmark theo folder**: lưu search đang mở bằng một cú bấm, đặt tên tự động theo nội dung search, ghi chú, đánh dấu đã mua, kéo thả, lịch sử trang đã xem, sao lưu JSON.
- **Bookmark không chết**: lưu kèm query và dựng lại URL khi mở, nên bookmark vẫn đúng bộ lọc sau khi search ID của GGG hết hạn.
- **Nút + / − trên kết quả**: rê chuột vào dòng mod hoặc thuộc tính của item để đặt min/max vào filter mà không gõ lại. Mod đang search được tô sáng.
- **Tier picker (PoE2)**: chọn T1, T2… trên stat filter để điền ngưỡng, thu hẹp theo category, base hoặc unique đang chọn.
- **Giá quy đổi**: mỗi listing hiện thêm giá chaos hoặc divine với icon thật; tỷ giá lấy từ bulk exchange của league, cache 6 giờ.
- **Lịch sử giá**: search đã bookmark được chụp trung vị giá mỗi lần bạn mở, có biểu đồ.
- **Seller bán nhiều**: đánh dấu listing của seller có từ 2 item trong kết quả để mua gộp.
- **Chia sẻ folder**: chia sẻ trực tiếp đồng bộ hai chiều hoặc gửi bản chụp một lần, chỉ cần một share key, không tài khoản.
- **Import build**: dán link character poe.ninja, link pobb.in hoặc code Path of Building; gear, jewel, flask thành các search trong folder, mod được map sang stat filter của trade.
- Giao diện tiếng Việt và tiếng Anh, phím tắt `Alt+Shift+B`, menu chuột phải, onboarding khi cài.

Hướng dẫn chi tiết: [docs/user-guide.md](docs/user-guide.md).

## Cài đặt

Bản Chrome đang chờ duyệt trên Chrome Web Store. Trong lúc đó, hoặc với Firefox, build từ mã nguồn:

```bash
bun install
bun run build            # Chrome  → .output/chrome-mv3
bun run build:firefox    # Firefox → .output/firefox-mv2
```

Chrome: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`. Firefox (128+): `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv2/manifest.json`.

Chia sẻ folder và thống kê sử dụng cần key trong `.env` (xem `.env.example`); thiếu key thì hai phần đó tự tắt, phần còn lại chạy bình thường.

## Phát triển

```bash
bun run dev      # Chrome profile dev, hot reload
bun run check    # test + typecheck + build
```

Kiến trúc, quy ước, cách verify trên trade site và quy trình phát hành: [docs/architecture.md](docs/architecture.md) và [docs/development.md](docs/development.md). Mỗi tính năng có tài liệu riêng trong [docs/features/](docs/features/README.md); lý do đằng sau các lựa chọn ở [docs/decisions.md](docs/decisions.md).

## Quyền riêng tư

Extension gửi thống kê sử dụng ẩn danh (tính năng được dùng, số đếm, mã lỗi, text mod mà import không map được) tới Datadog qua background của extension; không gửi account, query, bookmark hay lịch sử duyệt. Tắt trong Cài đặt. Chi tiết: [PRIVACY.md](PRIVACY.md).

Request duy nhất tới `pathofexile.com` ngoài trang bạn đang mở là endpoint bulk exchange công khai để lấy tỷ giá, tối đa một lần mỗi 6 giờ cho mỗi league có bookmark.

## Ghi nhận

- Dữ liệu tier PoE2 là snapshot của [TierFill](https://github.com/Sknoww/tierfill) (MIT), notice ở `public/licenses/TierFill.txt`; base types từ [RePoE](https://repoe-fork.github.io/poe2/).
- Luồng bookmark lấy cảm hứng từ Better Trading của exile-center. Repository này không sao chép source, logo hay tên thương mại của họ.
- Cộng đồng: [Discord](https://discord.gg/CQp5MhdQK).
