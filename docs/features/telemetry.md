# Thống kê sử dụng ẩn danh (Datadog)

Extension gửi event sử dụng tới Datadog Logs để biết tính năng nào được dùng, import thiếu mod gì và lỗi gì xảy ra. Người dùng tắt được trong Settings. Chính sách công khai ở [PRIVACY.md](../../PRIVACY.md).

## Hành vi

- Setting `telemetryEnabled` mặc định bật, hiện trong Settings với mô tả gửi gì và không gửi gì; onboarding có dòng ghi chú quyền riêng tư.
- Không có `VITE_DATADOG_CLIENT_TOKEN` lúc build thì không gửi gì.
- Mỗi install có một `installId` ngẫu nhiên trong `storage.local`, không gắn account.

## Event

| Event | Props | Nguồn |
|---|---|---|
| `import.load` | source (ninja/pobbin/code), game, items, mods, matched, unresolvedBases | ImportNinjaModal |
| `import.miss` | source, game, rarity, section, text (mod không map, tối đa 30/lần) | ImportNinjaModal |
| `import.save` | source, game, count, rolls | ImportNinjaModal |
| `import.error` | source, game, reason | ImportNinjaModal |
| `feature.use` | feature: bookmark.save (mode, game), bookmark.move, bookmark.purchased, folder.create, folder.share, folder.unshare, folder.join (searches), backup.import, stat-filter-button, property-filter-button, tier-picker | useTradeStore, MAIN world qua `featureUsed` |
| `settings.change` | setting, value (mọi công tắc boolean trừ `hasOpenedPanel`) | useTradeStore |
| `ui.error` | message (200 ký tự) | Vue `errorHandler` của panel |
| `background.error` | message | `error`/`unhandledrejection` của background |

Không gửi: account, tên character, link, query, bookmark, folder, lịch sử duyệt, URL.

## Cách hoạt động

- `lib/track.ts`: `track(name, props)` gửi message `track` về background, không await, không throw.
- MAIN world không có `browser.runtime` nên gửi `featureUsed(feature)` qua window-messaging; panel chuyển tiếp thành `feature.use`.
- Background: `createBatcher` gom 20 event hoặc 5 giây rồi `POST https://browser-intake-<site>/api/v2/logs?ddsource=browser&dd-api-key=<token>` body NDJSON (`ddsource`, `ddtags version:x,env:y`, `service: exile-trade-companion`, `status` error khi tên event kết thúc `.error`, `message`, `event`, `install_id`, `date`, props đã sanitize). Đọc setting lúc flush. Flush lỗi thì bỏ batch.
- `lib/telemetry.ts` (thuần): `intakeHost` (datadoghq.com → browser-intake-datadoghq.com, us5.datadoghq.com → browser-intake-us5-datadoghq.com…), `intakeUrl`, `sanitizeProps` (chỉ giữ primitive, cắt chuỗi 500), `buildIntakeBody`, `createBatcher` với timer tiêm được.
- Host permission `https://browser-intake-datadoghq.com/*`.

## Quyết định

- Background là proxy duy nhất gửi ra ngoài để tab `pathofexile.com` không thấy request nào tới Datadog. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`
- Gửi text mod không map được: đây là dữ liệu game công khai và là thứ duy nhất giúp sửa matcher. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`
- Mặc định bật, tắt được; ghi rõ trong Settings, onboarding và PRIVACY.md. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`
- Client token riêng tên `exile-trade-companion`, site `datadoghq.com`; token nằm trong `.env`, chỉ mẫu trong `.env.example`. Đã verify đầu cuối: sau một lần import PoB, Logs Explorer với `service:exile-trade-companion` hiện `import.load` và hai `import.miss`. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`

## Việc còn lại khi phát hành

Listing Chrome Web Store phải khai thu thập "User activity" và có link privacy policy.

## Test

`lib/telemetry.test.ts` (intake host, NDJSON, sanitize, batcher với timer giả).
