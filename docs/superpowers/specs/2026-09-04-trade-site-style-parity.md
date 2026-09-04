# Trade Site Style Parity

## Goal

Style hiện tại của extension (bảng màu bronze/tan tự thiết kế, viền/bo góc riêng) đang lệch với chính trang `pathofexile.com/trade` mà nó chạy trên đó, gây cảm giác "conflict" và có FOUC (panel "bụp" xuất hiện sau một khoảng trễ). Viết lại toàn bộ design token của extension theo đúng giá trị đo được từ UI thật của trang trade, và sửa root cause kỹ thuật khiến style bị lệch khi chạy trong Shadow DOM trên trang đó.

## Root cause (đã verify, không phải suy đoán)

### 1. `rem` không bị Shadow DOM cách ly

Trang trade set `html { font-size: 10px }` (đo trực tiếp qua `getComputedStyle`). Tailwind v4 tính mọi utility spacing (`p-*`, `gap-*`, `size-*`, `h-*`, `w-*`, `leading-*` dạng số) qua biến theme `--spacing: 0.25rem` (`node_modules/tailwindcss/theme.css:325`). `rem` luôn neo vào phần tử `<html>` gốc của toàn document — **không có ngoại lệ cho Shadow DOM**, đây là hành vi CSS spec, không phải bug của WXT hay của mình.

Xác nhận từ chính doc type của WXT (`node_modules/wxt/dist/utils/content-script-ui/shadow-root.d.mts`, JSDoc của option `inheritStyles`):

> "WXT resets everything but: **`rem` Units**: they continue to scale based off the webpage's HTML `font-size`. **CSS Variables/Custom Properties**... **`@font-face` Definitions**: Fonts defined outside the shadow root can be used inside it."

Hệ quả: mọi khoảng cách/kích thước built bằng Tailwind numeric scale hiện chỉ còn **62.5%** giá trị dự kiến (16px root giả định → 10px root thật).

### 2. FOUC do fetch CSS runtime

`entrypoints/trade.content/index.ts` dùng `createShadowRootUi(ctx, { cssInjectionMode: 'ui' ở defineContentScript, import './style.css' })`. Đọc trực tiếp bundle build ra (`.output/chrome-mv3/content-scripts/trade.js`): hàm tạo UI này là `async`, bên trong `await` một `fetch(chrome-extension://.../content-scripts/trade.css)` **runtime** rồi mới build `<style>` tag. Nội dung UI chỉ mount sau khi promise này resolve, ở `document_idle` — nghĩa là panel/tab hoàn toàn không tồn tại trong DOM một khoảng thời gian sau khi trang đã load xong, rồi đột ngột xuất hiện. Đây là nguồn của cảm giác "flick".

Type doc `ShadowRootContentScriptUiOptions.css?: string` xác nhận có đường tắt: truyền CSS dạng string trực tiếp (không qua fetch) vào `createShadowRootUi`.

## Design tokens đo trực tiếp từ trade site (2026-09-04, qua `getComputedStyle` trên `pathofexile.com/trade2/search/poe2/Standard`)

| Token | Giá trị đo được | Ghi chú |
|---|---|---|
| Cỡ chữ cơ sở UI | `14.3px` | Không phải 16px |
| Font UI chrome (tab/nav) | `FontinSmallCaps, Verdana, Arial, Helvetica, sans-serif` | Khớp lựa chọn hiện tại |
| Font form input | `FontinSmallcaps, sans-serif` (lowercase variant riêng của site) | |
| Border-radius | `0px` mọi nơi đã đo (tab, input, panel) | Site hoàn toàn vuông góc |
| Tab active — nền | `rgb(90, 56, 6)` = `#5a3806` | Khác gradient bronze hiện tại |
| Tab active — chữ | `rgb(233, 207, 159)` = `#e9cf9f` | |
| Tab inactive — nền | trong suốt | |
| Tab inactive — chữ | **giữ nguyên `#e9cf9f`**, không dim | Khác pattern hiện tại (đang dim bằng `--tan`) |
| Tab padding / height | `5px 10px` / `32px` | |
| Input box nền (`.multiselect__tags`) | `rgb(30, 33, 36)` = `#1e2124` | Gần `--bg-row` (`#1c2026`) hiện tại, giữ nguyên vì đã đủ sát |
| Input box viền | `1px solid #000` (gần như vô hình trên nền tối) | Khác viền bronze rõ nét hiện tại của `.poe-input` |
| Input box padding / height | `5px 8px` / `34px` | |
| Group header (label filter) màu | `rgb(163, 141, 109)` = `#a38d6d` | **Khớp chính xác `--tan` hiện tại** — giữ nguyên |

`--tan` không đổi vì đã đo đúng từ trước. Các token còn lại (`--bg`, `--bg-raised`, `--cream`, `--grey`, `--danger`) giữ nguyên — nằm trong biên độ measurement noise hợp lý, không có bằng chứng cụ thể nào cho thấy chúng sai.

## Phạm vi áp dụng

- **Widget có tương đương thật trên site** (button, input, tab/toggle, panel border) → áp đúng token đo được ở trên.
- **Widget chỉ tồn tại trong app mình** (folder row, search card, share modal, dropdown menu) → không có gì để "clone" trực tiếp — áp cùng bộ token nền tảng (radius 0, `--spacing` đúng px, màu, font) để nhất quán trong toàn app, không tự sáng tác chi tiết riêng.
- **Font `FontinSmallCaps` giữa popup và content-script panel — chấp nhận lệch, không tự bundle font** — panel "mượn" được `@font-face` mà chính trang trade đã load (xác nhận qua WXT docs, hoạt động đúng, không cần làm gì thêm). Popup là document riêng biệt, không tiếp cận được font đó, và Fontin là font asset của game (khả năng có ràng buộc bản quyền) — không tự host lại. Popup dùng fallback stack hiện có (`"Palatino Linotype", Palatino, Georgia, serif`) như một lựa chọn đã biết, không phải bug ẩn.

## Thay đổi kỹ thuật cụ thể

### `assets/main.css`
- Thêm `--spacing: 4px;` vào block `@theme inline` — sửa TOÀN BỘ utility spacing/sizing/leading (Tailwind v4 dùng chung một scale primitive cho `p-*`/`gap-*`/`size-*`/`h-*`/`w-*`/`leading-4`/`leading-5`...) trong một lần, không cần sửa từng file component.
- `.icon-btn`, `.poe-btn`, `.poe-input`: `border-radius: 3px` → `0`.
- KHÔNG đổi các giá trị `text-[Npx]` đã hard-code khắp component (13px, 14px, 16px...) — đó là type-scale riêng của app, không phải chỗ bị lỗi rem. `14.3px` đo được từ site chỉ dùng làm tài liệu tham chiếu, không áp đặt lại toàn bộ cỡ chữ hiện có.

### `components/*.vue`
- Xoá 4 chỗ `rounded-sm` / `rounded-[3px]` (giữ nguyên `rounded-full` — chấm màu folder là hình tròn có chủ đích, không thuộc hệ "vuông góc").
- Nav tab active/inactive (2 chỗ, `entrypoints/popup/App.vue` + `entrypoints/trade.content/App.vue`, class binding trên nút `Saved/History/Settings`): đổi từ gradient bronze hiện tại + dim text sang `background: #5a3806` (active) / transparent (inactive), text màu `#e9cf9f` cố định cả hai trạng thái.

### `entrypoints/trade.content/style.css`
- `.trade-companion-tab`: `border-radius: 3px 0 0 3px` → `0`.
- `.trade-companion-scroll::-webkit-scrollbar-thumb`: `border-radius: 4px` → `0`.

### `entrypoints/popup/style.css`
- `::-webkit-scrollbar-thumb`: `border-radius: 4px` → `0`.

### `entrypoints/trade.content/index.ts` (fix FOUC)
- Import CSS dạng string tại build-time: `import cssText from './style.css?inline'` (Vite feature chuẩn, PostCSS/Tailwind vẫn chạy qua transform pipeline bình thường, chỉ khác output là string thay vì side-effect injection).
- Bỏ side-effect `import './style.css'`.
- Truyền `css: cssText` vào `createShadowRootUi(ctx, { ... css: cssText })` — loại bỏ hoàn toàn runtime `fetch()`, CSS sẵn sàng đồng bộ trước khi `ui.mount()` chạy.
- Cân nhắc bỏ `cssInjectionMode: 'ui'` khỏi `defineContentScript` nếu không còn ý nghĩa khi không còn side-effect import — verify lúc build (xem có warning không), không đoán trước.

## Testing / verification

- `bun run check` (test/typecheck/build) sau mỗi nhóm thay đổi.
- Verify trực quan qua `ego-browser` trên trang trade thật: chụp before/after, đo lại `getComputedStyle` một vài phần tử (icon-btn, poe-btn, tab active) để xác nhận `border-radius: 0px` và spacing đã đúng px tuyệt đối (vd `gap-2` phải ra `8px` chứ không phải `5px`).
- Xác nhận FOUC: quan sát Network/Performance timing của tab button — thời điểm nó xuất hiện trong DOM phải không còn phụ thuộc vào một `fetch()` runtime (kiểm bằng cách tìm dòng `fetch(` liên quan tới `trade.css` trong bundle build ra — phải KHÔNG còn nữa sau fix, khác với hiện trạng đã xác nhận có).

## Failure modes / rủi ro

- **`--spacing: 4px` là thay đổi diện rộng, một dòng ảnh hưởng toàn app** — rủi ro cao nhất là một vài chỗ NGOÀI dự kiến co lại đúng bằng ý muốn nhưng LAYOUT tổng thể trông khác hẳn so với trước (vì trước giờ mọi người quen nhìn app ở tỷ lệ bị lỗi 62.5%, không phải tỷ lệ đúng). Cần review trực quan toàn bộ các màn hình chính sau khi đổi, không chỉ tin vào con số đúng.
- **Đo trên MỘT trang cụ thể** (`trade2/search/poe2/Standard`) — trang `trade/` (POE1) hoặc `trade2/exchange` có thể có token hơi khác (site có nhiều theme/phiên bản UI qua các năm). Chấp nhận rủi ro này, không đo lại toàn bộ mọi route.
- **Font Fontin lệch giữa popup/panel vẫn còn treo** — quyết định chấp nhận (xem phần Phạm vi áp dụng), không phải lỗi bỏ sót.
- **`--spacing` override có thể ảnh hưởng cả các utility KHÔNG liên quan tới bug gốc** (vd `leading-4`/`leading-5` dùng cho line-height, không phải spacing theo nghĩa hẹp) — chấp nhận vì Tailwind v4 cố tình dùng chung một primitive scale cho mọi utility số; tách riêng sẽ phức tạp hoá không cần thiết.
