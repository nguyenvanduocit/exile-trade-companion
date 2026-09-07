# Import bookmark từ poe.ninja

Ngày 2026-09-05. Nghiên cứu cho feature "Import from poe.ninja" trong menu folder: user dán link character trên poe.ninja, extension parse item của character đó thành các trade search, user chọn cái nào muốn lưu vào folder.

Link mẫu dùng để đào:

- POE1: `https://poe.ninja/poe1/builds/allflame/character/Poteitik-3151/ПОТЕЙТИК?i=0`
- POE2: `https://poe.ninja/poe2/builds/forbiddenrites/character/heygyus-0416/ResurrectForbidden?i=0`

## Kết luận

Làm được, và phần khó nhất đã có sẵn trong codebase: `buildDurableUrl` ở `lib/trade-url.ts:76-84` đã dựng URL trade từ `TradeQuery` bằng gzip + base64url, đúng format site tự đọc. Việc còn lại là dựng `TradeQuery` từ item của poe.ninja.

Ba sự thật quyết định thiết kế:

1. **Trang HTML của poe.ninja không chứa dữ liệu character.** Nó là SPA rỗng 143 KB, chỉ có meta tag. Toàn bộ item đến từ hai request JSON nội bộ của poe.ninja. "Không gọi API" theo nghĩa không đụng GGG thì giữ được, nhưng vẫn phải gọi JSON của poe.ninja, không có đường parse HTML.
2. **poe.ninja không trả CORS header.** Fetch từ content script trên `pathofexile.com` sẽ bị chặn. Phải fetch từ background với host permission cho `https://poe.ninja/*`.
3. **poe.ninja không có trade stat id.** Item chỉ có mod dạng text và GGG internal stat key. Phải map text sang `explicit.stat_<hash>` bằng catalog stat. Catalog này site trade đã load sẵn ở `window.app.static_.knownStatsFlat` (`lib/trade-app.ts:8`), extension đã đọc nó ở `entrypoints/trade-stats.content.ts:88`. Không cần bundle 2 MB stats.json.

PoC map text sang stat id bằng regex thuần trên hai character mẫu: POE1 khớp 95/112 dòng mod, POE2 khớp 98/105. Phần miss nằm ở flask và mod nhiều dòng, không phải gear rare. Chi tiết ở phần PoC.

## poe.ninja cung cấp dữ liệu qua đâu

Script `poe2/.claude/skills/pob/scripts/scripts/fetch-poeninja.sh` trong workspace poe đã đào xong hai surface, bản nghiên cứu này verify lại bằng curl ngày 2026-09-05 cho cả poe1 lẫn poe2.

### Surface builds ladder

Đúng dạng link user đưa: `https://poe.ninja/{game}/builds/{leagueSlug}/character/{account}/{character}`. Hai request:

```
GET https://poe.ninja/{game}/api/data/index-state
GET https://poe.ninja/{game}/api/builds/{version}/character?account={account}&name={character}&overview={snapshotName}
```

`index-state` trả `snapshotVersions[]`, mỗi phần tử có `url` (league slug trong link, vd `allflame`, `forbiddenrites`), `version` (vd `1337-20260905-45779`, đổi mỗi lần poe.ninja rebuild index nên không hardcode được) và `snapshotName` (vd `allflame`, `forbidden-rites`). Một slug xuất hiện hai lần với version khác nhau; lấy cái đầu tiên là được.

Response character có `cache-control: public, max-age=1800`. Character không có trong ladder trả `"status":404`.

Query param `?i=0` trong link không ảnh hưởng API, parser bỏ qua, chỉ cần ba segment path.

### Surface profile

`https://poe.ninja/{game}/profile/{account}/{league}/character/{character}` dành cho character đã connect account, kể cả char thấp level không lên ladder. Cần đọc SSE `api/events/character/...` lấy `version` rồi gọi `api/profile/characters/.../model/{id}`; item nằm trong `charModel`. Nên hỗ trợ sau khi builds ladder chạy ổn, cùng parser vì `itemData` cùng shape.

### Shape của response

Field liên quan ở top level: `league` (tên đầy đủ, vd `Allflame`, `Forbidden Rites`, trùng tên league trên trade), `items[]`, `jewels[]`, `flasks[]`, `useSecondWeaponSet`. POE1 thêm `guardianItems`, POE2 thêm `enableBondedMods`.

Mỗi phần tử là `{ itemSlot, itemData }`. Slot đo được: 1 Helm, 2 Gloves, 3 BodyArmour, 4 Amulet, 5 Boots, 7 Weapon, 8 Ring, 9 Ring2, 11 Belt, 15 Weapon2, 16 Offhand2; `itemData.inventoryId` mang tên slot nên không cần bảng số.

Trong `itemData` phần dùng được cho trade:

- `frameTypeId`: `Unique` / `Rare` / `Magic` / `Normal` / `Gem`.
- `name`: tên unique hoặc tên rare do game sinh (vd `Vengeance Talons`). Rare không dùng tên này để search.
- `baseType`: base name sạch, không prefix. `typeLine` giống `baseType` trên cả hai game trong mẫu.
- Mod text theo section: `implicitMods`, `explicitMods`, `fracturedMods`, `craftedMods`, `enchantMods`. POE2 thêm `desecratedMods`, `runeMods`, `bondedMods`. Section này khớp một-một với prefix stat id của trade (`explicit.`, `fractured.`, `crafted.`, `enchant.`, `desecrated.`, `rune.`).
- `mods.{explicit,...}[]` có `id` là GGG mod id (`IncreasedLife7`) và `stats` là internal stat key (`base_maximum_life: 105`). Không phải trade hash, không map trực tiếp được, chỉ hữu ích để lấy giá trị số chính xác thay vì parse text.
- `corrupted`, `fractured`, `synthesised`, `ilvl`, `sockets[]`, `socketedItems[]`.

POE2 bọc keyword trong text bằng `[Tag|Text]` hoặc `[Tag]`: `"+30 to [Spirit|Spirit]"`, `"Adds 20 to 28 [Cold] damage to [Attack|Attacks]"`. Phải strip trước khi match. Chữ thường `damage` khác catalog `Damage`, match phải case-insensitive.

## Map mod text sang trade stat id

Catalog trade: `/api/trade/data/stats` (POE1) và `/api/trade2/data/stats` (POE2). Mỗi entry `{ id: "explicit.stat_3299347043", text: "+# to maximum Life", type: "explicit" }`. Stat có option (vd `Allocates #`) xuất hiện ở dạng phẳng `explicit.stat_2954116742|32932` với text đã điền tên notable. Bản dump có sẵn ở `poe/poe1/data/trade-static/stats.json` (7.894 explicit) và `poe/poe2/data/trade-static/stats.json` (2.980 explicit) để test offline. Lúc runtime dùng `window.app.static_.knownStatsFlat` của site vì nó luôn đúng patch và đúng game của tab đang mở.

Thuật toán: với mỗi section, biến `text` của catalog thành regex như `parseStatValue` ở `lib/stat-filter.ts:41-72` đang làm (escape, `#` thành `([+-]?\d+(?:\.\d+)?)`, khoảng trắng thành `\s+`, anchor đầu cuối, ignore case). Match thử section tương ứng trước, fallback sang `explicit` cho `rune` khi không thấy.

### PoC

Script Python tại `/tmp/poc-map.py` chạy trên dump stats.json offline (không phải catalog live của site nhưng cùng nguồn). Kết quả:

- POE1 (Poteitik, Champion Lv100): 95/112 dòng match đúng một id. Toàn bộ gear rare (gloves, boots, hai ring) chỉ miss 4 dòng, đều do ba lý do bên dưới.
- POE2 (ResurrectForbidden): 98/105. Gear rare match 100%, kể cả `desecrated` và `rune` section. Miss nằm ở flask (`70% reduced Amount Recovered`), charm slot implicit, một dòng unique nhiều câu.

Bốn nguyên nhân miss, đều xử lý được trong normalizer:

1. **Suffix `(Local)`** trên catalog: item ghi `63% increased Armour and Evasion`, catalog ghi `#% increased Armour and Evasion (Local)` (`explicit.stat_2451402625`). Thử match lần hai với `\s*\(Local\)$` optional.
2. **Dấu trong text**: item ghi `Non-Channelling Skills have -7 to Total Mana Cost`, catalog ghi `+# to`. Coi `+#` và `-#` như `#` khi build regex và giữ dấu trong capture group.
3. **Đảo chiều increased/reduced**: `15% reduced Attack Speed` phải match `#% increased Attack Speed` với giá trị âm. `parseStatValue` đã có logic này ở `lib/stat-filter.ts:50-62`, tái dùng.
4. **Mod nhiều dòng ghép bằng `\n`**: poe.ninja nối hai dòng của một mod thành một string. Tách theo `\n` rồi match từng dòng; dòng nào không có id thì bỏ, không chặn cả item.

Text trùng nhiều id là chuyện thường, không phải ngoại lệ: catalog POE1 có 264 cặp text trùng trong `explicit` (462 tính mọi section), POE2 có 31 (65). Trên hai character mẫu, 6/117 dòng POE1 và 11/106 dòng POE2 khớp hai id cùng lúc. Hai kiểu trùng: biến thể `(Local)` và global cùng text (Attack Speed, Armour, Evasion, Energy Shield, Accuracy) và hai stat GGG đặt text y hệt không có dấu hiệu nào (`+#% chance to Suppress Spell Damage`, `# to Spirit`, `#% increased Rarity of Items found`, `Reservation Efficiency`). Matcher trả toàn bộ `ids` khớp; `buildImportQuery` đưa mỗi mod nhiều id vào một group `count` với `value: {min: 1}` để listing khớp bất kỳ id nào, mod một id vẫn nằm trong group `and`. Không dùng heuristic theo slot: mod defence local trên body armour hay accuracy local trên weapon không đoán được từ slot mà không sai.

Không match được thì item vẫn generate được link, chỉ thiếu filter cho dòng đó. Modal phải hiện số mod đã map trên tổng số để user biết search có lỏng hơn item gốc không.

## Dựng TradeQuery từ item

`TradeQuery` ở `types/trading.ts:16-25` và `buildQueryPayload` ở `lib/trade-url.ts:52-71` quyết định field nào được đưa vào payload. Site từ chối payload có field thừa hoặc null, nên chỉ set field có nội dung.

- **Unique**: `name = itemData.name`, `type = itemData.baseType`, và mang stat filter như rare (quyết định 2026-09-06): tên không đủ với Watcher's Eye (aura mod nào), Forbidden Flame/Flesh (notable nào), Timeless Jewel (seed/tên) hay mod Foulborn. Toggle roll áp chung.
- **Rare / Magic**: `type = baseType` + `filters.type_filters.filters.rarity = { option: 'nonunique' }` để không lẫn unique cùng base. Mỗi mod map được ra một hoặc nhiều stat id (cùng text ở explicit/crafted/fractured/desecrated..., hoặc biến thể Local/global): một id thì vào group `and`, nhiều id thì mỗi mod một group `count` min 1 để listing khớp bất kỳ id nào. Roll dương vào `min`, roll âm vào `max`; damage range lấy trung bình hai đầu như `parseStatValue` (`lib/stat-filter.ts`). Dòng rune (POE2) vào group `and` với `disabled: true`. Xem mục Quyết định cho lý do từng chỗ.
- **Jewel rare, cluster jewel**: cùng cách rare. Cluster jewel cần thêm enchant `Adds # Passive Skills` và `# Added Passive Skills are Jewel Sockets` (đều match ở PoC).
- **Flask / charm**: giá trị thấp, mod prefix/suffix của flask phần lớn không có trong catalog dạng text đơn. Đưa vào danh sách nhưng đánh dấu ít filter, hoặc bỏ khỏi scope đầu.
- **Gem trong socket**: `socketedItems[]` có `typeLine`, level, quality, `corrupted`. Có thể generate search gem theo `type` + `filters.misc_filters` level/quality. Nên để sau.
- **league**: lấy từ top-level `league` của response, trùng id league trên trade (`Allflame` với `Allflame`, `Forbidden Rites` với `Forbidden Rites`). Không dùng slug trong link.
- **game**: từ segment `/poe1/` hay `/poe2/` trong link.
- **title**: `buildQueryLabel` ở `lib/query-label.ts:26-49` cho ra `name` với unique, `baseType` với rare. Nên prefix slot (`Gloves · Chimerascale Gauntlets`) để danh sách trong modal đọc được.
- **url**: kết quả `buildDurableUrl`. Không có `queryId` nên SearchCard không có price history (`components/SearchCard.vue:242` gate theo `queryId`), đúng như bookmark capture từ URL rút gọn hiện nay.

Lưu bằng `store.saveSearch` với `folderId` của folder đang mở. `saveSearch` dedupe theo `url` (`lib/storage.ts`), nên import lại cùng character chỉ update, không nhân đôi.

## Kiến trúc đề xuất

Ba world tham gia, mỗi world một việc, dùng hai kênh messaging đã có:

1. **Background** fetch poe.ninja. Thêm message `fetchNinjaCharacter(url)` vào `ExtensionProtocolMap` ở `lib/extension-messaging.ts:8-17`, trả JSON thô. Lý do phải ở background: poe.ninja không trả CORS.
2. **MAIN world** (`trade-stats.content.ts` hoặc content script mới) map mod text sang stat id vì chỉ nó thấy `window.app.static_.knownStatsFlat`. Thêm message `resolveStatIds(lines)` vào `WindowProtocolMap` ở `lib/window-messaging.ts:14-22`; payload là mảng string nên không dính giới hạn structuredClone qua ranh giới world.
3. **Isolated world** (panel Vue) parse URL, điều phối hai bước trên, dựng `TradeQuery`, gọi `buildDurableUrl`, hiện danh sách, lưu.

Logic thuần nằm ở `lib/ninja-import.ts`: `parseNinjaUrl`, `collectImportItems`, `normalizeModText`, `createStatMatcher(catalog)`, `attachStatMatches`, `buildImportQuery`. Test bằng hai character JSON thật cắt gọn và catalog stats.json cắt gọn trong `lib/__fixtures__/`.

### Host permission

Cần `https://poe.ninja/*`. `optional_host_permissions` xin lúc bấm Import không dùng được ở đây: `browser.permissions.request` phải chạy trong extension context có user gesture, còn nút Import nằm trong content script trên `pathofexile.com`; message sang background không mang user gesture. Vì vậy khai tĩnh trong `host_permissions` ở `wxt.config.ts`. Extension chưa publish nên không có user cũ bị Chrome disable khi update; nếu sau này thêm host permission khác thì cân nhắc lại.

## UX modal

Menu folder ở `components/FolderSection.vue:97-111` thêm item `Import from poe.ninja`, mở `ImportNinjaModal` theo pattern `FolderFormModal.vue` (Dialog của reka-ui, focus input khi mở).

Ba trạng thái trong một modal:

1. Input link + nút Import. Validate URL ngay khi gõ, báo game và character đọc được từ link.
2. Loading: xin quyền nếu chưa có, fetch, resolve. Lỗi phân loại rõ: sai link, character không có trên ladder (gợi ý link profile), poe.ninja lỗi, chưa cấp quyền.
3. Danh sách item theo slot với checkbox, mặc định chọn hết gear và jewel, bỏ chọn flask. Mỗi dòng: icon, tên, base, rarity, số mod đã map trên tổng (vd `7/8 mods`). Nút `Save N to folder`. Hai tuỳ chọn nên có ngay từ đầu vì đổi cách dựng query: `Exact rolls` (min = roll) và `Any roll` (không min). Mặc định `Any roll` cho rare vì roll của char Lv100 thường quá cao để có kết quả.

## Rủi ro

- **poe.ninja đổi API nội bộ.** Không có contract công khai. Extension gãy cục bộ ở feature này, không ảnh hưởng phần còn lại. Parser phải fail có message, không ném lỗi thô.
- **Lệ thuộc tab trade để map stat.** Panel chỉ chạy trên `pathofexile.com` nên luôn có `window.app`, nhưng `knownStatsFlat` của tab `/trade` là catalog POE1. Import link poe2 khi đang ở tab `/trade` sẽ không map được. Phải check game của link khớp game của tab, hoặc chặn với message "mở trade2 để import POE2".
- **Durable URL cho trade2 chưa verify** trên server thật (ghi chú trong `.remember` ngày 2026-09-05: "trade2 unverified—server down"). Cần verify trước khi bật import POE2.
- **Chrome Web Store review.** Thêm host permission mới, kể cả optional, cần cập nhật mô tả quyền trong listing.

## Quyết định đã chốt (2026-09-05)

- Filter `explicit.<hash>` của GGG đã khớp cả dòng crafted, fractured (POE1) và desecrated (POE2), nhưng KHÔNG khớp rune (thí nghiệm 2026-09-06 trên site thật: group `and` chứa `explicit.X` + `fractured.X` cho life trên Amethyst Ring trả 1342 listing bằng đúng `fractured.X` một mình, dòng life trên mọi row mang data-field `stat.fractured`; tương tự crafted mana cost 10000 và desecrated all-res 17 trên Ruby Ring; còn `explicit.X` + `rune.X` chỉ ra 1 listing có cả hai dòng). Hệ quả: mod nội dung item chỉ cần id `explicit` là đã không phụ thuộc nguồn; count group chỉ còn cho text trùng nhiều hash (Local/global, Suppress). Section khác chỉ dùng khi explicit không có text đó.

- Test chạy trên character thật, không phải catalog tự dựng (2026-09-06): `lib/ninja-import.dataset.test.ts` đi qua bốn character tải từ poe.ninja (Poteitik, allffan, Haruto_Allflame, ResurrectForbidden), mỗi case của matcher và query builder gắn với một item thật trên ladder. Fixture và catalog cắt gọn sinh bằng `scripts/build-ninja-fixtures.ts`, nguồn ghi ở `lib/__fixtures__/README.md`.

- Scope: gear, jewel, flask. Gem trong socket không import. Đã implement: `lib/ninja-import.ts` (logic thuần + test), `entrypoints/trade-ninja.content.ts` (MAIN world, map stat), `components/ImportNinjaModal.vue`, menu item trong `FolderSection.vue`, handler `fetchNinjaCharacter` trong `background.ts`.
- Rare mặc định `Exact rolls` (min = roll của item), toggle `Any roll` chỉ đòi mod có mặt. Flask mặc định bỏ tick.
- Chỉ surface builds ladder. Surface profile để sau.
- Trạng thái listing (select trên đầu form: `available` = Instant Buyout and In Person, `securable` = Instant Buyout, `online`/`onlineleague` = In Person, `any`) luôn là `available`: không ai mua in person nữa và đây là chế độ rộng nhất. Hardcode `online` từng làm mọi bookmark import ra "In Person".
- Giá trị âm (`-7 to Total Mana Cost`, `15% reduced X` map vào stat increased) đặt vào `max` thay vì `min`: đây là stat càng thấp càng tốt, min = -7 sẽ nhận cả roll tệ hơn và mọi roll dương. Nút kính lúp của site (`searchByMe` trong bundle trade) đẩy mọi stat với `value: {}` nên site không có quy ước nào để theo.
- Section (đổi 2026-09-06): mod nội dung item KHÔNG pin section — người mua cần mod, không cần nguồn của mod, và filter `explicit.<hash>` của GGG đã khớp cả dòng crafted/fractured/desecrated cùng hash (thí nghiệm trên site cùng ngày, xem bullet của session poe-pro-trade-61). Matcher thử theo thứ tự `explicit → crafted → fractured → desecrated → delve → sanctum → ultimatum → monster → veiled → scourge`, lấy section đầu có hit; trong section đó giữ mọi id cùng text (Local/global, Suppress) cho group `count` min 1. implicit và enchant giữ riêng vì là slot khác trên item; rune (POE2) người mua tự cắm được nên vào group `and` dạng filter `disabled: true`, và explicit không khớp dòng rune. Hệ quả: cùng item, đường poe.ninja và đường PoB cho cùng query.
- Quét thêm 5 character ladder Allflame (Poteitik, allffan, Haruto_Allflame, BrainAllFlamed, rrrocas; script `tmp/scan-rings.ts`) để kiểm roll âm và cluster jewel. Nhẫn Bone Ring của build Necromancer có mod bị đảo dấu (`-139 to maximum Life`, `-63% to Lightning Resistance`, `33% reduced Cold Damage` map vào stat increased value -33) đều ra `max`; `10% reduced Enemy Stun Threshold` (catalog vốn viết reduced) giữ value dương → `min`. Cluster jewel rare khớp đủ mọi dòng, kể cả enchant option hai dòng `enchant.stat_3948993189|1`; entry nhiều dòng trong catalog được đăng ký thêm từng dòng về cùng id. "1 Added Passive Skill is a Jewel Socket" khớp catalog "# Added Passive Skills are Jewel Sockets" nhờ chữ "s" cuối từ tuỳ chọn hai chiều và "are" chấp nhận "is a". Miss còn lại: Trigger Socketed Spell (item viết "when you Use a Skill", catalog viết "on Using a Skill" — text catalog cũ hơn item, không xử lý generic được).
- Kênh window-messaging cho map stat dùng namespace riêng `exile-trade-companion/ninja`: trong một namespace, mọi bundle có listener đều trả lời mọi request (bundle không có handler cho type đó trả `undefined`, sender nhận "No response"), và sender lấy response đầu tiên.
- Verify sống 2026-09-05 trên `/trade` POE1 với link Poteitik: 23 item, gear rare map 100% bằng catalog live; lưu 18 search; mở bookmark rare gloves thì site load đúng `type`, rarity `nonunique` và 8 stat filter.
- Mod khớp nhiều id (2026-09-06): mỗi mod một group `count` min 1 chứa mọi id, cùng min/max roll. Group `and` chỉ còn mod một id (thường là implicit/enchant) và filter rune đã tắt.

## Nguồn thứ hai: PoB code (2026-09-06)

PoB code là XML nén zlib rồi base64url; item nằm ở `<Items><Item id>` dạng text của Path of Building, slot ở `<ItemSet><Slot itemId name>`, jewel ở `<Tree><Spec><Socket itemId>`. Logic thuần ở `lib/pob-import.ts` (decode qua `DecompressionStream('deflate')`, parse text, resolve base), đổ ra cùng `ImportItem[]` với poe.ninja nên matcher và `buildImportQuery` dùng chung. Input của modal nhận cả ba dạng: link poe.ninja, link `pobb.in/<id>` (background tải `/raw`, host permission `https://pobb.in/*`), hoặc code dán tay.

So với JSON của poe.ninja, text PoB **kém thông tin hơn**, đo trên `pathOfBuildingExport` của đúng hai character mẫu:

- PoB1 chỉ có tag `{crafted}` `{fractured}` `{mutated}`. Enchant ghi thành `{crafted}` nằm trong khối `Implicits: N` (Allocates Sovereignty trên amulet, cluster jewel, flask) — parser suy ra: `{crafted}` trong khối implicit là enchant.
- PoB2 chỉ có `{enchant}` `{rune}`; crafted và desecrated **không có tag** (Soaring Spear: poe.ninja có `craftedMods` +400 Accuracy, PoB2 text không đánh dấu). Không sao vì matcher không pin section cho mod nội dung item: dòng không tag đi `explicit`, và filter explicit của site khớp cả dòng crafted/desecrated.
- MAGIC/NORMAL không có dòng base (`Flagellant's Diamond Flask of Incision`). Message `resolveItemBases` trong MAIN world tra `window.app.static_.knownItems` lấy base dài nhất xuất hiện nguyên từ trong typeLine; không ra thì giữ typeLine.
- Mod nhiều dòng: PoB tách thành hai dòng, chỉ dòng đầu có tag, nên dòng sau (vd `Added Small Passive Skills grant: Sword Attacks…`) đi vào implicit/explicit và có thể không map — hiện trong đếm N/M.
- Không có league: bookmark lấy league của tab đang mở. Không có tên character: note ghi class + ascendancy + level.
- Item guide: `{variant:1,2}` lọc theo `Selected Variant`/`Selected Alt Variant`; `(a-b)` với `{range:x}` thành `a + (b-a)*x`; `{tags:…}` bỏ. Item không nằm trong slot/socket của set và spec đang active hiện là "Không đeo", mặc định bỏ tick.

Vì vậy giữ JSON cho link poe.ninja (chính xác hơn) và PoB code chỉ là nguồn bổ sung cho guide, pobb.in, Discord, PoB của mình.
