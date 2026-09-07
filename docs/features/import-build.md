# Import build từ poe.ninja và Path of Building

Biến gear, jewel, flask của một build thành các bookmark trong folder. Ba nguồn đầu vào đổ về cùng một pipeline: link poe.ninja builds ladder, link pobb.in, code PoB dán tay. Nghiên cứu gốc và nhật ký thí nghiệm ở [research/2026-09-05-poeninja-import.md](../research/2026-09-05-poeninja-import.md).

## Hành vi

- Menu folder → Import build → modal ba trạng thái: nhập, loading, danh sách item theo slot với checkbox và `N/M mod` (đỏ khi thiếu). Mặc định chọn gear và jewel, bỏ flask và đồ không đeo. Tuỳ chọn Roll: Đúng roll (mặc định, min = roll) hoặc Roll bất kỳ.
- Mỗi item chọn → một bookmark: `type` = base; unique thêm `name`; rare/magic thêm `rarity: nonunique`; mọi mod map được thành stat filter; `status` luôn `available`. Ghi chú bookmark ghi nguồn (`Từ poe.ninja: <tên> (<class> Lv<n>)` hoặc `Từ PoB: …`). League lấy từ character (poe.ninja) hoặc tab đang mở (PoB). Lưu tuần tự để không ghi đè state.
- Lỗi phân loại: link sai, code không giải mã được, pobb.in không có build, khác game với tab, league không có trên poe.ninja, character không trên ladder, catalog chưa load, mạng.

## Cách hoạt động

- Background (`fetchNinjaCharacter`): `GET /{game}/api/data/index-state` lấy `version` + `snapshotName` theo slug league, rồi `GET /{game}/api/builds/{version}/character?account&name&overview`. Character không trên ladder trả `status: 404` trong body với HTTP 200. `fetchPobCode`: `pobb.in/<id>/raw`.
- `lib/ninja-import.ts` (thuần): `parseNinjaUrl`, `collectImportItems` (implicit/explicit/fractured/crafted/enchant/desecrated/rune, strip markup `[Tag|Text]` của PoE2, tách mod nhiều dòng), `flattenStatCatalog` (bung stat có option thành `id|optionId`), `createStatMatcher`, `attachStatMatches`, `buildImportQuery`.
- `lib/pob-import.ts` (thuần): `decodePobCode` (base64url + `DecompressionStream('deflate')`), `parsePobXml` (item set active, slot, jewel socket của spec active, variant, `{range}`), `parsePobItem`, `resolveBaseType`.
- MAIN world (`trade-ninja.content.ts`): `matchNinjaStats` bằng `window.app.static_.knownStatsFlat` (luôn đúng patch và game của tab), `resolveItemBases` bằng `knownItems` cho item magic/normal không có dòng base.
- `components/ImportNinjaModal.vue` điều phối và ghi telemetry `import.load`, `import.miss` (tối đa 30 dòng mỗi lần), `import.save`, `import.error`.

### Matcher

Regex sinh từ `text` của catalog: `#` → số, bỏ `(Local)` ở cuối rồi cho phép lại dạng optional, `+#` coi như `#`, chữ `s` cuối từ tuỳ chọn hai chiều, `are` chấp nhận `is a`/`is an`, không phân biệt hoa thường, khoảng trắng linh hoạt. Không khớp thì thử đảo `reduced↔increased`, `less↔more` với dấu âm (chỉ stat một số). Entry nhiều dòng trong catalog được đăng ký thêm từng dòng.

Section: mod nội dung item không pin section. Thử theo thứ tự `explicit → crafted → fractured → desecrated → delve → sanctum → ultimatum → monster → veiled → scourge`, lấy section đầu có hit, trong section đó giữ **mọi** id cùng text. `implicit` và `enchant` match riêng; `rune` match riêng và vào query dạng filter `disabled`.

Query: mod một id vào group `and`; mod nhiều id (Local/global, hai stat GGG cùng text như Suppress, Spirit, Rarity) mỗi mod một group `count` min 1; rune vào `and` tắt. Roll âm (`-7 to Total Mana Cost`, `15% reduced X` map vào stat increased) đặt vào `max` vì đây là stat càng thấp càng tốt.

## Quyết định

- Không parse HTML poe.ninja (SPA rỗng); dùng hai request JSON nội bộ; fetch từ background vì không có CORS; host permission khai tĩnh vì `permissions.request` cần user gesture trong extension context, nút Import lại nằm trong content script. `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Map bằng catalog live của site, không bundle stats.json 2 MB; hệ quả là phải import đúng game của tab. `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Mod nhiều id → group `count` min 1 thay vì đoán Local/global theo slot. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>` `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Không pin section: thí nghiệm trên site cho thấy filter `explicit.<hash>` khớp cả dòng crafted/fractured/desecrated cùng hash (and explicit+fractured life = fractured một mình 1342 listing; crafted mana cost 10000; PoE2 desecrated 17), nhưng không khớp rune. Người mua cần mod, không cần nguồn của mod. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>` `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Unique mang stat như rare vì tên không đủ với Watcher's Eye, Forbidden Flame/Flesh, Timeless Jewel, mod Foulborn. `<claude:6be7b849-abef-4a77-ab7b-dfbc31f17faf>`
- `status: available` (Instant Buyout and In Person) thay vì `online` từng làm mọi bookmark ra "In Person". `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Roll âm vào `max`; site không có quy ước nào để theo (nút kính lúp đẩy `value: {}`). `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Test trên character thật (Poteitik, allffan, Haruto_Allflame, ResurrectForbidden) thay vì catalog tự dựng; quét thêm 5 character để kiểm roll âm và cluster jewel. `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Thêm nguồn PoB (pobb.in, code dán tay); text PoB kém thông tin hơn JSON poe.ninja (PoB1 ghi enchant là `{crafted}` trong khối implicit, PoB2 không tag crafted/desecrated, magic không có dòng base) nên poe.ninja vẫn là nguồn chính khi có link. `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Kênh window-messaging riêng namespace `exile-trade-companion/ninja`. `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`
- Scope: gear, jewel, flask; không import gem trong socket; chỉ surface builds ladder, không surface profile. Tên `ImportNinjaModal` và key locale `importNinja*` giữ nguyên dù đã nhận PoB (đổi tên là việc cơ học, chưa quyết). `<claude:04474544-723a-4420-b6c9-9c0d35300b5f>`

## Giới hạn

- poe.ninja không có contract công khai; đổi API là gãy riêng tính năng này, lỗi có message.
- Mod nhiều dòng trong PoB chỉ tag dòng đầu; dòng sau có thể không map, hiện trong N/M.
- Text catalog cũ hơn item (Trigger Socketed Spell "when you Use a Skill" vs "on Using a Skill") không xử lý generic được.
- Bookmark import không có `queryId` nên chưa có lịch sử giá.

## Test

`lib/ninja-import.test.ts`, `lib/ninja-import.dataset.test.ts` (4 character thật), `lib/pob-import.test.ts`; fixture và cách sinh ở `lib/__fixtures__/README.md`.
