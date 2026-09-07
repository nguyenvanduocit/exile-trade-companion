# Onboarding, shell của panel, i18n và giao diện

## Onboarding

- `entrypoints/onboarding/` mở trong tab mới khi cài (`runtime.onInstalled`, reason `install`) và từ nút "Xem lại hướng dẫn" trong Settings.
- 8 bước (`lib/onboarding-steps.ts`): chào mừng, lưu search, panel, nút stat filter, nút property filter, lịch sử giá, chia sẻ folder, phím tắt. Mỗi bước một ảnh trong `public/onboarding/`. Điều hướng bằng nút, chấm tiến độ, phím mũi tên; bước cuối mở `pathofexile.com/trade` và đóng tab onboarding.
- Dòng ghi chú quyền riêng tư ở cuối màn.
- Lần đầu vào trade site sau khi cài, panel tự mở (`settings.hasOpenedPanel`).

Quyết định: onboarding dùng ảnh thật của UI, sinh động thay vì text. `<claude:73cc0021-301b-450d-9f66-a024a7a07e62>`

## Shell của panel

- Tab dọc bám mép phải, thụt 4px lúc nghỉ, trượt ra khi hover; mở panel thì tab dịch sang bám mép trái panel và đóng vai nút đóng.
- Panel rộng `min(420px, 100vw)`, cao full, đẩy trang bằng `margin-right` trên `<html>`.
- Header: badge Discord (mở `https://discord.gg/CQp5MhdQK` qua background), nút Folder mới và Tham gia bằng key khi ở tab Đã lưu, nút Settings đổi thành nút Quay lại khi đang trong Settings.
- Hai tab: Đã lưu (kèm số bookmark) và Gần đây.
- Mở/đóng qua `togglePanel` (phím tắt) và `openPanel` (icon toolbar, chỉ khi tab là trang trade).

Quyết định:

- Badge Discord ở header, căn trái, nổi bật, làm điểm vào cộng đồng. `<claude:2a11bb18-985f-4e5e-9cc2-5120c3799616>`
- Nút Folder mới và Tham gia bằng key ở header thay vì card dưới cùng danh sách. `<claude:cc3c5b04-567f-4128-a9f0-50bc088c0820>` `<claude:c707e5b4-c91e-4e34-b8c6-5755dfd14d73>`
- Nút quay lại thay icon Settings khi đang ở Settings. `<claude:9d5ec176-ba3b-4912-aaa5-68ccdc9e7fa0>`

## Giao diện theo trade site

- Panel phải nhìn như một phần của `pathofexile.com/trade`, không phải widget shadcn cắm lên: font `FontinSmallCaps` cho nhãn/tab/heading (site đã load, đủ glyph tiếng Việt), Verdana 13px cho nội dung; palette đo từ site (nền `#0e1115`, viền đồng `#634928`, tan `#a38d6d`, kem `#fff8e1`, tab active `#5a3806` chữ `#e9cf9f`); không chữ dưới 12px; bo góc 0. `<claude:e48b3606-9238-404a-99a4-90c88ed40a75>`
- Sửa root cause spacing bị co 62.5% trong Shadow DOM (`rem` neo vào `html{font-size:10px}` của site) bằng `--spacing: 4px` trong `@theme`; sửa FOUC bằng CSS inline cho `createShadowRootUi`. `<claude:ed08a5f4-0df6-4020-bfaa-660b1d6038cd>`
- Nút phẳng như site, không gradient. `<claude:c707e5b4-c91e-4e34-b8c6-5755dfd14d73>`
- Font trong panel mượn `@font-face` của trang; không tự host Fontin.

## i18n

`@wxt-dev/i18n`, locale mặc định `vi`, có `en`. Manifest name/description qua `__MSG_*__`. Mọi chuỗi UI trong `locales/*.json`; MAIN world script giữ bảng nhỏ riêng chọn theo `navigator.language`. `<claude:08a9bc5a-78fd-4d57-b7a0-9943a33538e1>`

## Menu chuột phải và phím tắt

- Context menu "Lưu vào Trade Companion" trên trang trade: background hỏi content script `getCurrentPage` để lấy query kèm theo, fallback parse URL.
- `Alt+Shift+B` bật tắt panel ở tab đang active.
- Icon toolbar mở panel; ngoài trang trade không làm gì.
