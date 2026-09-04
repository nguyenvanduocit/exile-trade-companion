# Trade Site Style Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ design token của extension (bo góc, spacing, màu tab) theo đúng số đo thật từ UI `pathofexile.com/trade`, sửa root cause khiến spacing bị co 62.5% (Tailwind `rem` không bị Shadow DOM cách ly khi trang host set `html{font-size:10px}`), và loại bỏ FOUC do content-script UI fetch CSS runtime.

**Architecture:** Đổi token trung tâm trong `assets/main.css` (`@theme inline`) để một thay đổi lan ra toàn app, không sửa từng component riêng lẻ trừ những chỗ có giá trị hard-code cụ thể (radius, màu tab). Sửa FOUC bằng cách chuyển CSS content-script từ side-effect import (fetch runtime) sang import dạng string tại build-time (`?inline`), truyền thẳng cho `createShadowRootUi`.

**Tech Stack:** Tailwind v4 (`@theme`), WXT `createShadowRootUi`, Vite `?inline` CSS import.

**Spec:** `docs/superpowers/specs/2026-09-04-trade-site-style-parity.md`

## Global Constraints

- KHÔNG đổi các giá trị `text-[Npx]` hard-code hiện có trong component — type-scale riêng của app, không phải chỗ bị lỗi rem.
- Giữ nguyên `rounded-full` (chấm màu tròn) — chỉ bỏ `rounded-sm`/`rounded-[3px]` (bo góc vuông theo site).
- KHÔNG đổi `.poe-btn-primary` gradient — giá trị `#5a3806` chỉ đo được cho nav tab, không phải cho mọi nút primary; không suy rộng khi chưa có bằng chứng.
- KHÔNG tự bundle/host lại font `FontinSmallCaps` — panel content-script mượn font trang host qua `@font-face` (đã verify hoạt động qua doc WXT), popup giữ fallback stack hiện có. Đây là quyết định đã chốt trong spec, không phải việc cần làm.
- Mỗi task verify bằng `bun run check` (test + typecheck + build) trước khi coi là xong.

---

## Task 1: `assets/main.css` — spacing token + border-radius

**Files:**
- Modify: `assets/main.css:24-39` (thêm `--spacing`), `assets/main.css:56-85` (`.icon-btn`), `assets/main.css:87-124` (`.poe-btn`), `assets/main.css:136-155` (`.poe-input`)

**Interfaces:**
- Produces: biến `--spacing: 4px` khả dụng cho MỌI utility Tailwind số (`p-*`, `gap-*`, `size-*`, `h-*`, `w-*`, `leading-4`, `leading-5`...) dùng ở toàn bộ codebase — không có API riêng, đây là theme token toàn cục.

- [x] **Step 1: Thêm `--spacing: 4px` vào `@theme inline`**

Modify `assets/main.css`, khối `@theme inline` (dòng 24-39):

```css
@theme inline {
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --spacing: 4px;
  --color-bg: var(--bg);
  --color-raised: var(--bg-raised);
  --color-row: var(--bg-row);
  --color-hover: var(--bg-hover);
  --color-bronze: var(--bronze);
  --color-bronze-strong: var(--bronze-strong);
  --color-rule: var(--rule);
  --color-tan: var(--tan);
  --color-cream: var(--cream);
  --color-grey: var(--grey);
  --color-dim: var(--dim);
  --color-danger: var(--danger);
}
```

- [x] **Step 2: Đổi border-radius của `.icon-btn`, `.poe-btn`, `.poe-input` từ `3px` sang `0`**

Modify `assets/main.css:61` (trong `@utility icon-btn`):
```css
  border-radius: 0;
```

Modify `assets/main.css:95` (trong `@utility poe-btn`):
```css
  border-radius: 0;
```

Modify `assets/main.css:141` (trong `@utility poe-input`):
```css
  border-radius: 0;
```

- [x] **Step 3: Build để xác nhận CSS biên dịch được**

Run: `bun run build`
Expected: build thành công, không lỗi PostCSS/Tailwind

- [x] **Step 4: Verify giá trị spacing thật bằng ego-browser**

Đây KHÔNG unit-test được (CSS runtime, cần browser thật). Dùng `ego-browser` mở lại extension đã reload trên trang `pathofexile.com/trade2/search/...`, đo qua `getComputedStyle` một phần tử có class `gap-2` hoặc `size-4` bên trong shadow root, xác nhận ra đúng px tuyệt đối (`gap-2` → `8px`, KHÔNG phải `5px` như trước khi fix — trước fix, root cause khiến nó co còn 62.5% vì tính theo `html{font-size:10px}` của trang thay vì baseline dự kiến).

- [x] **Step 5: Commit**

```bash
git add assets/main.css
git commit -m "fix: anchor Tailwind spacing scale to absolute px, square off radius"
```

(Bỏ qua nếu repo chưa init git.)

---

## Task 2: Bỏ `rounded-sm`/`rounded-[3px]` (site không bo góc)

**Files:**
- Modify: `components/ui/dropdown-menu/DropdownMenuItem.vue:14`
- Modify: `components/ui/dialog/DialogContent.vue:13`
- Modify: `components/ui/dropdown-menu/DropdownMenuContent.vue:14`
- Modify: `entrypoints/popup/App.vue:266`

Giữ nguyên `rounded-full` ở `components/FolderSection.vue:101` (chấm trạng thái sync, hình tròn có chủ đích, không thuộc hệ "vuông góc").

- [x] **Step 1: `components/ui/dropdown-menu/DropdownMenuItem.vue:14`**

Đổi:
```
class="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 font-display text-[14px] text-cream outline-none select-none transition-colors hover:bg-hover focus-visible:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
```
thành (bỏ `rounded-sm`):
```
class="flex cursor-pointer items-center gap-2 px-2.5 py-2 font-display text-[14px] text-cream outline-none select-none transition-colors hover:bg-hover focus-visible:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
```

- [x] **Step 2: `components/ui/dialog/DialogContent.vue:13`**

Đổi:
```
class="fixed top-1/2 left-1/2 z-50 w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-rule bg-raised p-4 shadow-lg shadow-black/50 outline-none"
```
thành (bỏ `rounded-sm`):
```
class="fixed top-1/2 left-1/2 z-50 w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 border border-rule bg-raised p-4 shadow-lg shadow-black/50 outline-none"
```

- [x] **Step 3: `components/ui/dropdown-menu/DropdownMenuContent.vue:14`**

Đổi:
```
class="z-50 min-w-[160px] overflow-hidden rounded-sm border border-rule bg-raised p-1 shadow-lg shadow-black/50"
```
thành (bỏ `rounded-sm`):
```
class="z-50 min-w-[160px] overflow-hidden border border-rule bg-raised p-1 shadow-lg shadow-black/50"
```

- [x] **Step 4: `entrypoints/popup/App.vue:266`**

Đổi:
```
<kbd class="rounded-[3px] border border-rule bg-row px-1.5 py-0.5 font-display text-[13px] text-cream">Alt Shift B</kbd>
```
thành (bỏ `rounded-[3px]`):
```
<kbd class="border border-rule bg-row px-1.5 py-0.5 font-display text-[13px] text-cream">Alt Shift B</kbd>
```

- [x] **Step 5: Build**

Run: `bun run build`
Expected: build thành công

- [x] **Step 6: Commit**

```bash
git add components/ui/dropdown-menu/DropdownMenuItem.vue components/ui/dialog/DialogContent.vue components/ui/dropdown-menu/DropdownMenuContent.vue entrypoints/popup/App.vue
git commit -m "style: remove border-radius to match trade site's square corners"
```

---

## Task 3: Nav tab active/inactive màu đúng site (`#5a3806` / `#e9cf9f`, không dim inactive)

**Files:**
- Modify: `entrypoints/popup/App.vue:148-149`
- Modify: `entrypoints/trade.content/App.vue:209-210`

Đo được từ trade site thật: tab active nền `rgb(90,56,6)` = `#5a3806`, chữ `rgb(233,207,159)` = `#e9cf9f`; tab inactive nền trong suốt, **chữ giữ nguyên `#e9cf9f`** (site không dim text tab inactive, khác pattern `text-tan` hiện tại).

- [x] **Step 1: `entrypoints/popup/App.vue:148-149`**

Đổi:
```
          ? 'bg-[linear-gradient(180deg,#3a2c17,#23190d)] text-cream'
          : 'text-tan hover:bg-hover hover:text-cream'"
```
thành:
```
          ? 'bg-[#5a3806] text-[#e9cf9f]'
          : 'text-[#e9cf9f] hover:bg-hover'"
```

- [x] **Step 2: `entrypoints/trade.content/App.vue:209-210`**

Đổi:
```
            ? 'bg-[linear-gradient(180deg,#3a2c17,#23190d)] text-cream'
            : 'text-tan hover:bg-hover hover:text-cream'"
```
thành:
```
            ? 'bg-[#5a3806] text-[#e9cf9f]'
            : 'text-[#e9cf9f] hover:bg-hover'"
```

- [x] **Step 3: Build**

Run: `bun run build`
Expected: build thành công

- [x] **Step 4: Commit**

```bash
git add entrypoints/popup/App.vue entrypoints/trade.content/App.vue
git commit -m "style: match nav tab active/inactive colors to trade site"
```

---

## Task 4: Bo góc scrollbar + tab flyout theo site (radius 0)

**Files:**
- Modify: `entrypoints/trade.content/style.css:31` (`.trade-companion-tab`)
- Modify: `entrypoints/trade.content/style.css:93` (`.trade-companion-scroll::-webkit-scrollbar-thumb`)
- Modify: `entrypoints/popup/style.css:27` (`::-webkit-scrollbar-thumb`)

`.trade-companion-panel` (dòng 75 cùng file) đã sẵn `border-radius: 0` — không cần đổi.

- [x] **Step 1: `entrypoints/trade.content/style.css:31`**

Đổi:
```css
  border-radius: 3px 0 0 3px;
```
thành:
```css
  border-radius: 0;
```

- [x] **Step 2: `entrypoints/trade.content/style.css:93`**

Đổi (trong khối `.trade-companion-scroll::-webkit-scrollbar-thumb`):
```css
  border-radius: 4px;
```
thành:
```css
  border-radius: 0;
```

- [x] **Step 3: `entrypoints/popup/style.css:27`**

Đổi (trong khối `::-webkit-scrollbar-thumb`):
```css
  border-radius: 4px;
```
thành:
```css
  border-radius: 0;
```

- [x] **Step 4: Build**

Run: `bun run build`
Expected: build thành công

- [x] **Step 5: Commit**

```bash
git add entrypoints/trade.content/style.css entrypoints/popup/style.css
git commit -m "style: square off scrollbar and tab flyout radius"
```

---

## Task 5: Sửa FOUC — CSS inline string thay vì fetch runtime

**Files:**
- Modify: `entrypoints/trade.content/index.ts`

**Interfaces:**
- Consumes: `entrypoints/trade.content/style.css` (file đã có, không đổi nội dung)
- Produces: `createShadowRootUi` nhận CSS đồng bộ qua option `css`, không còn phụ thuộc `fetch()` runtime lúc mount.

- [x] **Step 1: Đổi cách import CSS trong `entrypoints/trade.content/index.ts`**

File hiện tại:
```ts
import { createApp } from 'vue'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import App from './App.vue'
import './style.css'

export default defineContentScript({
  matches: [
    'https://www.pathofexile.com/trade/*',
    'https://www.pathofexile.com/trade2/*',
    'https://pathofexile.com/trade/*',
    'https://pathofexile.com/trade2/*',
  ],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'exile-trade-companion',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount(container) {
        const mountPoint = document.createElement('div')
        container.append(mountPoint)
        const app = createApp(App)
        app.mount(mountPoint)
        return app
      },
      onRemove(app) {
        app?.unmount()
      },
    })

    ui.mount()
  },
})
```

Đổi thành:
```ts
import { createApp } from 'vue'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import App from './App.vue'
import cssText from './style.css?inline'

export default defineContentScript({
  matches: [
    'https://www.pathofexile.com/trade/*',
    'https://www.pathofexile.com/trade2/*',
    'https://pathofexile.com/trade/*',
    'https://pathofexile.com/trade2/*',
  ],
  runAt: 'document_idle',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'exile-trade-companion',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      css: cssText,
      onMount(container) {
        const mountPoint = document.createElement('div')
        container.append(mountPoint)
        const app = createApp(App)
        app.mount(mountPoint)
        return app
      },
      onRemove(app) {
        app?.unmount()
      },
    })

    ui.mount()
  },
})
```

Thay đổi cụ thể: bỏ `cssInjectionMode: 'ui'` (không còn ý nghĩa vì không còn side-effect CSS import cho content script này), đổi `import './style.css'` (side-effect, kích hoạt cơ chế fetch runtime của WXT) thành `import cssText from './style.css?inline'` (Vite build-time inline — PostCSS/Tailwind vẫn xử lý file này bình thường qua transform pipeline, chỉ khác là kết quả trả về dạng string thay vì tự động inject), và truyền `css: cssText` cho `createShadowRootUi`.

- [x] **Step 2: Typecheck — xác nhận Vite/TS chấp nhận import `?inline`**

Run: `bun run typecheck`
Expected: no errors liên quan tới `entrypoints/trade.content/index.ts`. Nếu TS báo không resolve được kiểu cho suffix `?inline` (thiếu ambient type declaration), thêm vào `.wxt/wxt.d.ts` hoặc một file `.d.ts` phù hợp khai báo:
```ts
declare module '*.css?inline' {
  const content: string
  export default content
}
```
(Chỉ thêm nếu typecheck thực sự báo lỗi — không thêm trước khi biết cần.)

- [x] **Step 3: Build và xác nhận không còn `fetch()` cho `trade.css` trong bundle**

Run: `bun run build`
Expected: build thành công.

Run: `grep -o 'trade\.css' .output/chrome-mv3/content-scripts/trade.js`
Expected: **KHÔNG có kết quả nào** (trước khi fix, lệnh này trả về đúng 1 dòng khớp `fetch(...trade.css)` — xem spec phần "Root cause"). Nếu vẫn còn, nghĩa là WXT vẫn tự động thêm auto-CSS bên cạnh CSS thủ công — kiểm tra lại `cssInjectionMode` đã bỏ đúng chưa.

- [x] **Step 4: Commit**

```bash
git add entrypoints/trade.content/index.ts
git commit -m "fix: eliminate FOUC by inlining content-script CSS at build time"
```

---

## Task 6: Verify end-to-end qua ego-browser (trước/sau, đo thật)

Không phải unit test — bắt buộc theo `## Testing / verification` trong spec.

- [x] **Step 1: Build và reload extension**

Run: `bun run check` (test + typecheck + build)
Expected: tất cả pass

Dùng `ego-browser`: mở `chrome://extensions`, bấm "Reload" cho extension đã load unpacked từ `.output/chrome-mv3`.

- [x] **Step 2: Hard-refresh một tab trade thật, mở panel**

Mở/`gotoAndWait` một trang `https://www.pathofexile.com/trade2/search/poe2/Standard` MỚI (tab cũ giữ content-script cũ, sẽ báo "Extension context invalidated" — bài học từ phiên trước). Click nút tab để mở panel.

- [x] **Step 3: Đo `border-radius` của các phần tử đã đổi**

Qua `getComputedStyle` trong shadow root, kiểm `.icon-btn`, `.poe-btn` (nếu đang hiện, vd nút "New folder"), border của dropdown/dialog nếu mở — tất cả phải ra `0px`.

- [x] **Step 4: Đo spacing thật**

Kiểm một phần tử dùng `gap-2` (vd hàng chứa search card actions) hoặc `size-4` (icon) — phải ra đúng `8px`/`16px` tuyệt đối, không còn bị co 62.5%.

- [x] **Step 5: Đo màu nav tab**

Trên popup HOẶC panel, tab đang active (mặc định "Saved") phải có `background-color: rgb(90, 56, 6)`, `color: rgb(233, 207, 159)`; tab inactive (History/Settings) phải cùng `color: rgb(233, 207, 159)` nhưng nền trong suốt.

- [x] **Step 6: Xác nhận panel xuất hiện không còn "bụp" trễ**

Quan sát trực quan (screenshot ngay sau khi trang load, so với chờ 1-2s) — panel/tab button nên đã có mặt gần như ngay khi trang sẵn sàng, không phải một khoảng trễ rõ rệt sau đó mới hiện ra. Đây là kiểm tra định tính (không có con số threshold cứng) — nếu vẫn thấy trễ rõ, quay lại Task 5 kiểm tra `ctx`/`document_idle` timing, KHÔNG coi task là xong.

- [x] **Step 7: Ghi lại kết quả**

Nếu bước nào fail, quay lại task tương ứng sửa — không coi plan là xong nếu Task 6 có bước fail.

---

## Self-review

**Spec coverage:** `--spacing` fix (Task 1), radius 0 toàn bộ (Task 1, 2, 4), nav tab color (Task 3), FOUC fix (Task 5), verify thật bằng số đo (Task 6) — tất cả mục trong spec có task tương ứng. Font Fontin popup/panel: spec đã chốt KHÔNG cần sửa (ghi trong Global Constraints), không cần task.

**Placeholder scan:** không còn "TBD"/"cân nhắc" mơ hồ — mọi step đều có code cụ thể hoặc lệnh cụ thể kèm expected output.

**Type consistency:** `cssText` (Task 5) là tên biến duy nhất được định nghĩa và dùng ngay trong cùng task, không có task nào khác phụ thuộc vào nó. Các giá trị hex (`#5a3806`, `#e9cf9f`) dùng nhất quán giữa Task 3's hai file.

---

## Post-execution note (2026-09-04)

Thực thi xong cả 6 task, verify bằng `bun run check` (99/99 test, typecheck, build) sau mỗi task, không dùng git (repo không có git — commit step trong mỗi task bị bỏ qua theo đúng constraint đã ghi từ trước).

**Sự cố methodology đáng ghi lại (Task 5):** sau khi sửa FOUC, verify bằng cách `grep` text `fetch(` và `trade.css` trong bundle build ra — thấy chuỗi này VẪN CÒN, tưởng nhầm là fix chưa có tác dụng. Thực ra đây là false alarm: `createShadowRootUi` là helper DÙNG CHUNG của WXT, nhánh `if (ctx.options?.cssInjectionMode === 'ui') { await sd() }` luôn có mặt trong TEXT của bundle bất kể có dùng hay không — chỉ RUNTIME mới quyết định nhánh đó chạy hay không, dựa vào `ctx.options` (đọc lại từ chính `defineContentScript()` config). Grep tĩnh trên bundle KHÔNG chứng minh được hành vi runtime. Sửa bằng cách bật `Network.enable` qua CDP thật trong `ego-browser`, `drainEvents()` trong lúc trang load — xác nhận **0 request** tới `content-scripts/*`, tức fetch runtime đã thật sự biến mất. Bài học: với câu hỏi "code này có CHẠY không" (không phải "code này có TỒN TẠI trong bundle không"), phải đo hành vi thật (network, computed style, DOM), không suy luận từ grep source đã minify.

**Verify cuối cùng qua browser thật:** đo `getComputedStyle` xác nhận khớp chính xác spec — `icon-btn` `border-radius: 0px`, tab active `background: rgb(90,56,6)` / `color: rgb(233,207,159)`, tab inactive cùng màu chữ (không dim), `gap` tính đúng bội số của `4px` tuyệt đối (không còn co theo `rem` của trang host). Screenshot xác nhận trực quan: panel giờ cùng tông vuông/vàng đồng với UI thật của trade site, không còn cảm giác "chèn lệch" như trước.
