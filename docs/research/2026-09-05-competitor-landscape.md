# Bản đồ extension trade POE cạnh tranh

Khảo sát ngày 2026-09-05. Số user và rating cào trực tiếp từ Chrome Web Store (CWS) bằng ego-browser, Firefox Add-ons (AMO) và GitHub cùng ngày. Phân tích KANO rút ra từ dữ liệu này nằm ở [phân tích KANO](2026-09-05-kano-feature-analysis.md).

## Phạm vi quét

- 22 listing CWS từ 3 query tìm kiếm.
- 8 add-on Firefox AMO.
- 9 repo GitHub.
- 14 thread Reddit (r/pathofexile, r/PathOfExile2).
- Chưa quét: Edge Add-ons, Greasyfork userscript, Discord TFT. Số liệu cũ hơn 3 tháng thì cào lại CWS trước khi quote.

## Bảng đối thủ

| Extension | Users | Rating | Điểm bán chính | Điểm yếu user than |
|---|---|---|---|---|
| Better PathOfExile Trading (exile-center) | 100k CWS | 4.4 (158) | bookmark, giá quy đổi poe.ninja, highlight mod, history, pin | bỏ rơi Firefox (fork Vali-98 giữ 6.9k user), gãy sau patch, không xoá được folder, thiếu domain Korean |
| PoE Trade Extension (TFT) | 50k CWS + 5k FF | 4.2 (77) / 4.9 FF | multi live search một tab, watcher bắn desktop notification, folder lồng, hotkey, Discord blacklist, mọi feature opt-out | gãy tháng 06/2026 khi Kakao đổi domain |
| Poe Trade Plus (KroxiLabs, WXT + Svelte, MIT) | 10k CWS | 5.0 (33) | ra 04/2026, 9 ngôn ngữ, browser sync, quick filter preset, Finer Filters, CoE export, sidebar dock/resize | highlight không tắt được làm khó đọc mod fractured |
| Fuzzy Search | 20k | 5.0 (18) | tự chèn `~` vào ô tìm | |
| PoE Ninja Redirect to Trade | 7k | 4.5 (28) | một click từ build poe.ninja sang search | |
| PoE2 Trade Item Exporter | 4k + 1.5k FF | 5.0 | copy item sang PoB2 | parser gãy mỗi patch |
| EasyExile | 3k | 4.9 (7) | gom listing theo seller bán sỉ, dust value | |
| TierFill | 213 | mới | tier picker trên stat filter, badge tier ở kết quả (POE2) | |
| PoE Trade Helper (dwuong) | 118 | 4.3 | bắt price-mining scam (Mine Sweeper), whisper tracker | |

Ngoài browser: PoE Live Search Manager là desktop tool multi live search, 206 star GitHub, chứng minh nhu cầu tồn tại cả ngoài extension.

## Nhu cầu user lặp lại nhiều nhất trên Reddit

Xếp theo tần suất xuất hiện và upvote.

- **Bản Firefox.** Comment "Where the version for mozilla" đứng đầu thread Better Trading 723 upvote. Better Trading bị review 1 sao khi bỏ Firefox.
- **Multi live search trong một tab.** Hỏi từ thread Better Trading 2020. User PoE Trade Helper 2026 nói "great just for having a working multi-livesearch".
- **Link bookmark không chết.** Search ID của GGG hết hạn sau khoảng 3 đến 4 tháng, site báo "Failed to load search state". Cách cộng đồng muốn là link long-format nhúng payload query để bookmark còn sửa được mà không cần mở.
- **Sync giữa máy không cần server.** Poe Trade Plus giải bằng browser sync.
- **Open source và không tự chạy request.** Cộng đồng phản ứng mạnh với extension tự bắn search: rate limit 1800 giây, bị gọi là vi phạm TOS. Thread extension vibe-coded không mở source nhận 0 upvote và 22% upvote.
- **Giá quy đổi trên listing.** Thread ratio trade site lỗi thời ở POE2 được 667 upvote. User nói đây là lý do dùng Better Trading.
- **Gom listing theo seller.** Thread GGG QoL 186 upvote, EasyExile chứng minh nhu cầu.
- **Tier picker.** 93 upvote tháng 06/2026, ba extension khác nhau cùng thêm trong vài tháng.
- **Chỉ hiện affix hợp item class, preset waystone/tablet.** Được khen trong thread TradeUX dù thread bị dìm vì AI.
- **Domain Korean/Kakao.** TFT, Poe Trade Plus, Trade Butler đều gãy khi Kakao đổi domain tháng 06/2026.

## Nguồn

- [Better PathOfExile Trading CWS](https://chromewebstore.google.com/detail/better-pathofexile-tradin/fhlinfpmdlijegjlpgedcmglkakaghnk) · [GitHub exile-center](https://github.com/exile-center/better-trading) · [fork Firefox Vali-98](https://github.com/Vali-98/better-trading)
- [PoE Trade Extension CWS](https://chromewebstore.google.com/detail/poe-trade-extension/bikeebdigkompjnpcljicocidefgbhgl) · [AMO](https://addons.mozilla.org/en-US/firefox/addon/tft-trade-extension/) · [giới thiệu](https://blog.pacto.live/tft-trade-extension-intro/)
- [Poe Trade Plus CWS](https://chromewebstore.google.com/detail/poe-trade-plus/igofmcebdienfacijkhdppcfiglcbffb) · [Kroxitrade GitHub](https://github.com/KroxiLabs/Kroxitrade)
- [TierFill CWS](https://chromewebstore.google.com/detail/tierfill-%E2%80%94-poe2-trade-tie/gglcnglencknfbdejeepmfibimnlicjd)
- [EasyExile CWS](https://chromewebstore.google.com/detail/easyexile-trade-extension/lmmjicanpdjejcoikdmklalcgejobgpe)
- [PoE Trade Helper AMO](https://addons.mozilla.org/en-US/firefox/addon/poe-trade-helper/)
- [PoE2 Trade Item Exporter AMO](https://addons.mozilla.org/en-US/firefox/addon/poe2-trade-item-exporter/)
- [PoE Live Search Manager](https://github.com/5k-mirrors/poe-live-search-manager)
- [POE2 Trade Butler](https://github.com/NERDHEAD-lab/POE2-Trade-Butler) · [poe2-marketwright](https://github.com/WAY29/poe2-marketwright)
- Reddit: [Better Trading part II 2020](https://reddit.com/r/pathofexile/comments/hbd895/) · [PoE Trade Plus launch, long-format link](https://reddit.com/r/pathofexile/comments/1saik2t/) · [PoE Trade Helper feedback](https://reddit.com/r/pathofexile/comments/1qx4bvd/) · [tier picker](https://reddit.com/r/PathOfExile2/comments/1tzovbp/) · [ratio lỗi thời POE2](https://reddit.com/r/PathOfExile2/comments/1nl3laq/) · [bulk buying QoL](https://reddit.com/r/pathofexile/comments/1sp2hrv/) · [build cost extension, rate limit và TOS](https://reddit.com/r/pathofexile/comments/1vjwltb/)
