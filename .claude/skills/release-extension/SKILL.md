---
name: release-extension
description: Dùng khi user gõ /release-extension, hoặc yêu cầu "publish lên chrome web store", "cập nhật listing extension", "làm icon mới cho extension", "submit lên store", "bump version extension" cho exile-trade-companion (poe-pro-trade). Cover cả build+screenshot+icon design lẫn thao tác thật trên Chrome Web Store Developer Dashboard qua ego-browser.
---

# /release-extension — Exile Trade Companion → Chrome Web Store

**Bạn là agent release.** Extension build bằng WXT + Vue3. Hai đường release tồn tại song song — chọn đúng đường theo việc cần làm, đừng trộn lẫn:

- **Build + upload draft** (bump version, zip, đẩy lên CWS làm draft) → **tự động hoá được** qua GitHub Actions khi push git tag. Xem `## 0. Release tự động qua git tag`.
- **Screenshot / icon / store listing / Submit for review** → vẫn **thủ công** qua Chrome Web Store Developer Dashboard bằng ego-browser (Google không có API public cho các bước này). Xem `## 1-4`.

## Project state — verify trước khi action

```text
Extension name:    Exile Trade Companion
Package name:      exile-trade-companion (package.json)
Item ID:           lmdfepkngckhbmcjbaijloakinneodfd
Publisher:         AI Ocean
Google account:    Essie Vaill (essievaill2013u@gmail.com) — KHÔNG phải nguyenvanduocit
Dev console URL:   https://chrome.google.com/u/3/webstore/devconsole/0638d497-b4c6-4643-9f09-e46e21b32c90/lmdfepkngckhbmcjbaijloakinneodfd/edit
GitHub repo:       https://github.com/nguyenvanduocit/exile-trade-companion (public, Apache-2.0)
Build tool:        WXT (bun run build → .output/chrome-mv3, bun run zip → .output/exile-trade-companion-<ver>-chrome.zip)
Icon slot:         public/icon/{16,32,48,96,128}.png — WXT tự detect, không cần khai trong wxt.config.ts
```

`/u/3/` trong URL là account index 3 trong Chrome profile của ego-browser task space — không phải publisher ID, đừng nhầm sang account khác nếu profile đổi thứ tự đăng nhập. Nếu URL trên trỏ nhầm project khác (đã từng xảy ra — trỏ nhầm sang "AI Annotator") → STOP, xác nhận lại với user trước khi làm gì, đừng tự suy đoán item nào đúng.

## 0. Release tự động qua git tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

Push tag `v*.*.*` kích hoạt `.github/workflows/release.yml`: bump `package.json` version theo tag → `bun run test` + `bun run typecheck` → `bun run zip` (build lại nên version trong manifest đúng tag) → upload **draft** lên Chrome Web Store qua action `mnao305/chrome-extension-upload@v6.0.0` (`publish: false` — KHÔNG tự Submit for review) → tạo GitHub Release đính kèm zip.

`wxt.config.ts` **không hardcode `manifest.version`** — cố tình bỏ để WXT tự lấy version từ `package.json`; đừng thêm lại field này vào manifest config, sẽ làm version tag bơm vào vô nghĩa (build sẽ luôn dùng số hardcode thay vì version thật của tag).

**7 GitHub Secrets bắt buộc** (repo Settings → Secrets and variables → Actions), toàn bộ đã set sẵn — chỉ cần biết để debug khi action fail:

```text
CWS_EXTENSION_ID            lmdfepkngckhbmcjbaijloakinneodfd
CWS_CLIENT_ID               OAuth Web application client "exile-trade-companion-ci"
CWS_CLIENT_SECRET           (client secret tương ứng)
CWS_REFRESH_TOKEN           authorize dưới account essievaill2013u@gmail.com (đúng publisher), KHÔNG phải nguyenvanduocit
VITE_LIVEBLOCKS_PUBLIC_KEY  cùng giá trị với .env local — Vite inline vào bundle lúc build, thiếu là Share folder chết trong bản store
VITE_DATADOG_CLIENT_TOKEN   cùng giá trị với .env local
VITE_DATADOG_SITE           datadoghq.com
```

Ba secret `VITE_*` được truyền vào bước "Build + zip extension" qua `env:` trong workflow. Đổi key ở `.env` thì phải `gh secret set` lại, không có sync tự động. Verify bản CI build có key: tải zip từ GitHub Release, `grep -c pk_dev content-scripts/trade.js` phải ra 1.

Trước khi tag, bump `package.json` version lên đúng số tag và commit — CI tự `npm version` theo tag nên build không lệch, nhưng repo và tag phải kể cùng một số. Tag `v0.2.0` đang trỏ commit cũ (CI upload CWS fail vì item pending review) và không có release nào, đừng tái dùng số 0.2.0.

Credentials sống ở Google Cloud project `aiocean-fns` (project chung, không tách riêng — đã đụng project-limit lúc tạo nên dùng project có sẵn). OAuth consent screen ở chế độ **Testing** (External), test user gồm cả `nguyenvanduocit@gmail.com` lẫn `essievaill2013u@gmail.com`. Client type là **Web application** với Authorized redirect URI `https://developers.google.com/oauthplayground` — **không phải Desktop app**: Desktop app chỉ chấp nhận loopback redirect nên OAuth Playground báo `redirect_uri_mismatch`, đã tốn một vòng debug vì việc này.

**Refresh token có thể hết hạn/bị revoke** (Google âm thầm revoke refresh token không dùng >6 tháng, hoặc app OAuth bị đổi cấu hình). Regenerate khi action báo lỗi 401/invalid_grant ở bước upload:

1. Google Cloud Console → project `aiocean-fns` → APIs & Services → Google Auth Platform → Clients → mở client `exile-trade-companion-ci` lấy lại Client ID/Secret (hoặc tạo Web application client mới với đúng redirect URI trên nếu client cũ bị xoá).
2. `https://developers.google.com/oauthplayground/` → gear icon (góc phải) → tick "Use your own OAuth credentials" → điền Client ID/Secret → Close.
3. Ô scope → `https://www.googleapis.com/auth/chromewebstore` → Authorize APIs → **chọn đúng account `essievaill2013u@gmail.com`** (màn hình chọn account dễ mặc định sang account khác đang login sẵn — verify kỹ trước khi bấm) → Continue qua cảnh báo "hasn't verified this app" (bình thường vì app ở Testing mode) → Continue cấp quyền.
4. Step 2 "Exchange authorization code for tokens" → copy `refresh_token`.
5. `gh secret set CWS_REFRESH_TOKEN --repo nguyenvanduocit/exile-trade-companion --body "<token>"`.
6. Verify trước khi coi là xong (đừng chỉ tin dialog Playground):
   ```bash
   curl -s -X POST https://oauth2.googleapis.com/token \
     -d "client_id=$CLIENT_ID" -d "client_secret=$CLIENT_SECRET" \
     -d "refresh_token=$REFRESH_TOKEN" -d "grant_type=refresh_token"
   # lấy access_token từ response, gọi thử:
   curl -s "https://www.googleapis.com/chromewebstore/v1.1/items/lmdfepkngckhbmcjbaijloakinneodfd?projection=DRAFT" \
     -H "Authorization: Bearer $ACCESS_TOKEN" -H "x-goog-api-version: 2"
   # phải trả về JSON có "id": "lmdfepkngckhbmcjbaijloakinneodfd", không phải lỗi 401
   ```

Sau khi action chạy xong (draft đã lên CWS), flow tiếp theo vẫn quay lại thủ công: mở Dev Console, kiểm tra listing/screenshot còn hợp lệ không, rồi mới **Submit for review** — action không tự làm bước này (xem `## Submit — điểm dừng bắt buộc`).

## Flow tổng quát (đường thủ công — icon/screenshot/listing/submit)

1. Thiết kế/update icon (nếu cần) → build → screenshot thật → Save draft → **STOP xin user duyệt** → Submit for review.
2. Đừng bao giờ bấm "Submit for review" mà chưa có xác nhận rõ ràng của user trong lượt hội thoại đó — đây là thao tác external-visible, kích hoạt Google review, không tự quyết.

## 1. Thiết kế icon

Thử theo thứ tự, dừng ở bước đầu tiên chạy được:

1. **codex-image / gemini-image** skill — chất lượng tốt nhất nhưng cần Tailnet tới Mac mini (`100.83.161.104:8317`). Máy hiện tại **không có Tailscale** → thường timeout. Check nhanh: `curl -m5 http://100.83.161.104:8317/v1/models`.
2. **grok-image** skill — không cần Tailnet, dùng token OAuth `opencode` lưu ở `~/.local/share/opencode/auth.json` (provider `xai`). Token hay stale (`HTTP 400` khi refresh) → chạy `opencode models xai` một lần để force opencode tự refresh, rồi retry `generate.py`. Vẫn fail thì bỏ qua, dùng cách 3.
3. **Vẽ tay bằng Pillow** (fallback luôn chạy được, không phụ thuộc network) — medallion bronze ring + radial gradient cho cảm giác kim loại, xem `tmp/logo/make_icon_v2.py` trong lịch sử git/session trước làm mẫu: `radial_gradient()` helper, ring + inner disc + rune ticks, glyph ở giữa.
4. **Lấy asset thật từ game** (khi user muốn currency icon/item thật thay vì hình tự vẽ): tải trực tiếp từ poewiki.net, không cần qua ego-browser (ảnh tĩnh public, không phải API cần auth):
   ```bash
   curl -sL "https://www.poewiki.net/images/9/9c/Chaos_Orb_inventory_icon.png" -o tmp/logo/chaos-orb-raw.png
   ```
   Tìm URL icon: mở `https://www.poewiki.net/wiki/<Item_Name>` qua ego-browser, `document.querySelectorAll('img')` lấy `src` full-res (không phải bản `/thumb/.../16px-...`). Cảnh báo user: dùng asset gốc GGG làm logo chính thức có rủi ro Chrome Web Store từ chối vì trùng thương hiệu — hỏi trước khi làm, đừng tự quyết.

Render ở nhiều size để check độ nét trước khi chốt — nguồn nhỏ (game icon ~78×78) hoặc chi tiết rối rắm sẽ mờ thành khối tối ở 16-32px (toolbar thật), dù đẹp ở 128px (store listing). Nếu user chưa xác nhận đánh đổi này, hỏi trước khi build.

```bash
python3 -c "
from PIL import Image
im = Image.open('tmp/logo/icon-1024.png')
for s in [16,32,48,96,128]:
    im.resize((s,s), Image.LANCZOS).save(f'tmp/logo/icon-{s}.png')
"
```

Copy vào `public/icon/{size}.png`, rebuild, xem lại bằng Read tool ở size nhỏ nhất trước khi coi là xong.

## 2. Build + zip

```bash
bun run check   # test + typecheck + build, phải xanh trước khi release
bun run zip     # → .output/exile-trade-companion-<version>-chrome.zip
```

## 3. Screenshot thật cho store listing

**Đừng dùng `chrome-devtools` MCP** — máy này thường có nhiều session/pane khác cùng chạy `chrome-devtools-mcp`, tranh nhau Chrome profile mặc định → lỗi `Could not find DevToolsActivePort`. Dùng Chrome headless CLI tự quản lý, profile riêng, không đụng session khác:

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p /tmp/headless-shots-profile
timeout 25 "$CHROME_BIN" --headless=new --disable-gpu --hide-scrollbars \
  --user-data-dir=/tmp/headless-shots-profile \
  --window-size=1280,800 \
  --screenshot=tmp/logo/shot.png \
  "http://localhost:5199/?open=1"
pkill -f "user-data-dir=/tmp/headless-shots-profile"
```

Trang chụp lấy từ preview harness ở `tmp/preview/` (Vite dev server, port 5199, KHÔNG cần load extension thật):

- `tmp/preview/main.ts` mount `entrypoints/trade.content/App.vue` trong shadow DOM lên nền `trade-top.png` (ảnh chụp header pathofexile.com/trade thật). Query `?open=1` set `sessionStorage['trade-companion-ui-state'] = {open:true}` trước mount để panel hiện sẵn (không cần click).
- `tmp/preview/popup.ts` / `popup.html` mount `entrypoints/popup/App.vue` riêng cho screenshot popup.
- Alias quan trọng trong `tmp/preview/vite.config.ts`: `wxt/browser` → `browser-shim.ts` (mock `@webext-core/fake-browser` + seed data), `@/lib/trade-url` → `trade-url-shim.ts`, **`#i18n` → `i18n-shim.ts`** (đọc `locales/vi.json`, làm `i18n.t(key, args)` bằng dot-path lookup — thêm dòng này nếu thấy lỗi overlay `Failed to resolve import "#i18n"`, đây là module ảo do `@wxt-dev/i18n` sinh ra lúc build thật, preview harness không có).
- Nếu thư mục `tmp/preview/` không còn (đã bị dọn) → dựng lại 3 shim + `main.ts`/`index.html`/`popup.html` theo cấu trúc trên, `vite.config.ts` cần `@vitejs/plugin-vue` + `@tailwindcss/vite` (resolve từ `node_modules` gốc project vì `tmp/preview` không có `node_modules` riêng).

Chạy server: `bunx vite --config tmp/preview/vite.config.ts &` (port mặc định 5199, kill bằng `pkill -f "vite --config tmp/preview/vite.config.ts"` khi xong).

Kích thước Chrome Web Store chấp nhận: **1280×800 hoặc 640×400**, JPEG hoặc PNG 24-bit không alpha, tối đa 5 ảnh mỗi mục **Localized** và **Global** (2 mục tách biệt, không tự sync). Icon store 128×128. Small promo tile 440×280 (optional nhưng nên có). Marquee 1400×560 (optional, thường bỏ qua).

## 4. Publish qua Chrome Web Store Developer Dashboard (ego-browser)

Mọi thao tác dùng `ego-browser nodejs` heredoc, task space đặt tên cố định (vd `'publish exile-trade-companion to chrome web store'`) để resume xuyên nhiều round.

### Layout DevConsole cần biết

- Page KHÔNG scroll ở `document.body` — nội dung nằm trong `c-wiz.zQTmif.SSPGKf.eejsDc` (class có thể đổi giữa các lần Google update UI, verify lại bằng script tìm phần tử có `scrollHeight > clientHeight`). Scroll bằng `document.querySelector('c-wiz...')?.scrollTo(0, Y)`, không phải `scrollBy` cấp trang.
- `captureScreenshot()` của ego-browser trả về **đường dẫn file** (string), không phải buffer/base64 — `Read` thẳng path đó, đừng `Buffer.from(Object.values(shot))` (sai, ra file rác vài chục byte).
- Category dropdown và vài overlay Material render ngoài accessibility tree (`snapshotText()` không thấy option) → chụp screenshot, đọc toạ độ hiển thị, nhân **1.27** (tỷ lệ 2544/2000 cho canvas 2544×1251 thực tế) để ra toạ độ thật rồi `click([x, y])`.
- Checkbox certify (data usage) đôi khi click qua `ref` không ăn (element re-render) → fallback click theo toạ độ pixel, verify lại bằng screenshot sau khi click.

### Upload file — 2 cơ chế khác nhau, đừng lẫn

- **"Add a new item" (lần đầu tạo item, upload zip ban đầu)**: dùng File System Access API (`showOpenFilePicker`) → mở **native macOS file dialog**, ngoài tầm CDP. Bấm nút xong PHẢI `handOffTaskSpace(task.id)` ngay, báo user chọn file thủ công, chờ họ báo "xong"/"tiếp" rồi `takeOverTaskSpace(id)` (dùng số id, không dùng lại tên string nếu lỗi `Cannot read properties of undefined` — check `listTaskSpaces()` lấy `id` số).
- **Icon / Screenshot / Promo tile trên tab Store listing**: đây LÀ `<input type="file">` thật (ẩn, không style), tự động hoá được bằng `uploadFile('xpath=(//input[@type="file"])[N]', path)`. Thứ tự N theo DOM: `[1]`=Store icon, `[2]`=slot trống kế tiếp của Localized screenshots, `[3]`=slot trống kế tiếp của Global screenshots, `[4]`=Small promo tile, `[5]`=Marquee promo tile. Mỗi lần upload thành công, slot đó "dùng hết" và một input trống mới xuất hiện đúng vị trí đó trong DOM order — N giữ nguyên nghĩa "slot trống tiếp theo của mục đó" qua nhiều lần upload liên tiếp, cứ gọi lại đúng index sau khi ảnh trước `Processing...` xong (đợi `wait(2)`).
- Thay ảnh đã có: có thể click "Remove image <Label>" trước (dialog confirm "cannot be undone" xuất hiện tuỳ chỗ, `Cancel` nếu bấm nhầm) — nhưng thường **không cần**, upload thẳng vào cùng index sẽ tự thay ảnh cũ.

### Privacy tab — bắt buộc trước khi submit được

Dialog "Unable to publish" (bấm "Why can't I submit?") liệt kê chính xác field còn thiếu. Trạng thái đã điền cho 0.3.0 (submit 2026-09-07), mọi field đều ở tab Privacy:

- Single purpose description
- Justification riêng từng permission: storage, activeTab, contextMenus
- **Host permission justification phải liệt kê ĐỦ mọi host trong `host_permissions` của manifest**, Google đối chiếu với manifest: `pathofexile.com/trade*` (content script duy nhất), `api.liveblocks.io` https+wss (Share folder), `poe.ninja` + `pobb.in` (Import build, fetch từ background vì site không trả CORS), `browser-intake-datadoghq.com` (telemetry ẩn danh, tắt được trong Settings). Thêm host mới vào manifest → sửa ô này cùng lượt, đừng để câu "không truy cập host nào khác" sót lại.
- "Are you using remote code?" → **No** (WXT build tĩnh, không load remote script)
- Data usage: tick **User activity** (telemetry gửi tên feature, số đếm, mã lỗi, install id ngẫu nhiên tới Datadog). Không tick loại nào khác. 3 checkbox certify đều tick.
- **Privacy policy URL** = `https://github.com/nguyenvanduocit/exile-trade-companion/blob/main/PRIVACY.md` — bắt buộc khi có tick data usage. Đổi nội dung thu thập → sửa `PRIVACY.md` trước, listing chỉ trỏ tới nó.

Selector trên tab Privacy: `textarea[aria-label="..."]` KHÔNG resolve được bằng `fillInput` (aria-label rỗng trong DOM thật) → dùng `xpath=(//textarea)[N]` theo thứ tự: 1 single purpose, 2 storage, 3 activeTab, 4 contextMenus, 5 host permission, 6 remote code justification. Privacy policy URL là `input[type=text]` duy nhất trên trang. Checkbox data usage click được bằng `input[aria-label="User activity"]`, verify bằng `.checked`.

Sau khi Save draft, nút "Submit for review" chuyển từ xám sang xanh khi hết blocker — đây là tín hiệu đáng tin để biết đã điền đủ, nhưng vẫn double-check bằng "Why can't I submit?" một lần trước khi báo user sẵn sàng submit.

### Submit — điểm dừng bắt buộc

1. Bấm "Submit for review" → dialog confirm với checkbox "Publish automatically after it has passed review" (mặc định tick — giữ nguyên trừ khi user nói khác). Dialog này KHÔNG có `role=dialog` → verify bằng screenshot, tìm nút confirm bằng `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Submit For Review')` rồi click theo toạ độ `getBoundingClientRect()` (screenshot và viewport cùng tỷ lệ CSS px, không cần nhân 1.27 ở đây).
2. Bấm "Submit For Review" trong dialog → toast "Item submitted." → `document.body.innerText` có **Status: Pending review**.
3. Đóng dialog "Your extension was submitted for review", `completeTaskSpace(id, {keep:false})`.

**KHÔNG được tự động chạy bước 1-3 nếu user chưa nói "submit"/"submit đi" trong lượt hiện tại** — mọi bước trước đó (build, screenshot, upload, save draft) làm tự do, nhưng submit luôn cần lời xác nhận tường minh mới nhất.

## Extension item limit — nếu gặp "N/13 extension limit"

- **Archive KHÔNG giải phóng quota** — chỉ ẩn item khỏi danh sách dashboard mặc định (`"This item will be filtered out on the dashboard's item list by default"`). Đã verify: archive 4 item, quota vẫn giữ nguyên.
- Menu "⋮ View more menu options" trên item Draft/Rejected chỉ có: Preview, Archive/Unarchive, Transfer to another publisher — **không có** nút Delete tự phục vụ qua UI thường.
- Muốn giải phóng slot thật: user tự thao tác qua kênh khác (đã từng thấy quota tự giảm 13→12 sau khi user tự xử lý, cơ chế cụ thể chưa rõ — không tự bịa cách, hỏi user nếu cần lặp lại).
- Nếu account bị full, đừng cố tạo item mới bằng mọi giá — báo user, hỏi hướng (account khác / archive item cũ / đợi user tự xử lý).

## Output format

Khi user gõ `/release-extension` không kèm chi tiết cụ thể, default action:

1. Chạy `bun run check`, báo pass/fail.
2. Hỏi user: chỉ bump version (không đổi icon/screenshot/listing) → đề xuất đi đường `git tag` ở `## 0` (nhanh, tự động, không cần ego-browser); có đổi icon/screenshot/listing → đi đường thủ công `## 1-4`.
3. Đường tag: sau khi push tag và action chạy xanh, báo user draft đã lên CWS, hỏi có muốn mở Dev Console kiểm tra + Submit for review luôn không.
4. Đường thủ công: build+upload+điền listing xong → Save draft, báo user tóm tắt đã đổi gì, dừng chờ xác nhận trước khi Submit for review.
