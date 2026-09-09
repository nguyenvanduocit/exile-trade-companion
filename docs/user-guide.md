# Hướng dẫn sử dụng Exile Trade Companion

Extension chạy trên `pathofexile.com/trade` (Path of Exile 1) và `pathofexile.com/trade2` (Path of Exile 2). Mọi chức năng đều nằm ngay trên trang trade, không có popup riêng. Dữ liệu (folder, bookmark, lịch sử, snapshot giá) lưu trong trình duyệt của bạn; chỉ folder bạn chủ động chia sẻ mới được gửi lên Liveblocks, và thống kê sử dụng ẩn danh có thể tắt trong Cài đặt.

## Mở panel

Sau khi cài, một tab dọc "Trade Companion" bám mép phải của trang trade. Bấm vào tab để mở panel; panel đẩy nội dung trang sang trái thay vì che lên. Ba cách khác để mở:

- Phím tắt `Alt+Shift+B` bật tắt panel.
- Bấm icon extension trên toolbar khi đang ở tab trade.
- Lần đầu cài, panel tự mở để bạn thấy nó tồn tại.

Panel nhớ trạng thái mở/đóng và tab đang xem trong phiên của tab trình duyệt, nên reload trang không làm mất chỗ đang đứng.

## Lưu search vào folder

Mở một search bất kỳ trên trade, panel nhận ra search đó và hiện nút lưu (icon bookmark) ở đầu mỗi folder. Bấm nút của folder nào thì search vào folder đó; site hiện toast "Đã lưu trong …" ở dưới trang. Nếu search đã có trong folder, nút đổi sang trạng thái đã lưu.

Tên bookmark được suy ra từ nội dung search theo thứ tự: tên unique hoặc item, base type, rarity cộng item category, stat filter đầu tiên, cặp currency đang exchange. Bạn đổi tên được bất cứ lúc nào.

Cách khác: chuột phải lên trang trade, chọn "Lưu vào Trade Companion". Search vào folder mặc định "Theo dõi".

Bookmark lưu kèm toàn bộ nội dung query, không chỉ link. Search ID của GGG hết hạn sau vài tháng, nhưng khi bạn mở lại bookmark, extension dựng lại URL từ query đã lưu nên bookmark cũ vẫn mở đúng bộ lọc.

## Folder

Ba folder có sẵn: Theo dõi, Nâng cấp đồ, Mua số lượng. Bấm "Folder mới" ở header panel để tạo thêm, chọn tên, màu (8 màu có sẵn hoặc màu tuỳ chọn) và ghi chú. Menu `•••` của folder có:

- Sửa folder: đổi tên, màu, ghi chú. Ghi chú hiện dưới tên folder khi mở.
- Xóa: có bước xác nhận; bookmark bên trong chuyển sang folder Theo dõi (hoặc folder còn lại), không mất. Không xoá được folder cuối cùng.
- Chia sẻ: xem phần Chia sẻ folder.
- Import build: xem phần Import build.

Bấm tên folder để thu gọn hoặc mở. Kéo tay nắm ở mép trái để sắp xếp folder.

## Bookmark

Bấm vào tên bookmark để mở search trong tab hiện tại. Khi rê chuột, các nút hiện ra:

- Ghi đè bằng search hiện tại: thay nội dung bookmark bằng search đang mở (chỉ hiện khi search đang mở khác bookmark).
- Đổi tên.
- Xóa.
- Menu `•••`: thêm hoặc sửa ghi chú, đánh dấu đã mua, lịch sử giá, sao chép link.

Đánh dấu đã mua gạch ngang tên bookmark; bấm lại để bỏ. Kéo tay nắm để sắp xếp bookmark trong folder hoặc thả vào folder khác. Bên phải bookmark hiện giá trung vị mới nhất và phần trăm thay đổi so với snapshot trước, nếu có dữ liệu.

## Lịch sử

Tab "Gần đây" ghi lại mọi trang trade bạn mở, tối đa 50 mục, hiện 15 mục mới nhất. Bấm để mở lại. Nút "Xóa lịch sử" xoá hết.

## Nút + / − trên dòng mod

Trong kết quả tìm kiếm, rê chuột vào một dòng mod của item, hai nút `+` và `−` hiện ra ở cuối dòng:

- `+` thêm stat đó vào group And đầu tiên của Stat Filters với **min** bằng giá trị trên item. Nếu stat đã có trong group, chỉ cập nhật min và xoá max cũ.
- `−` đặt **max** bằng giá trị trên item. Với stat không có số (ví dụ "Cannot be Frozen"), `−` đưa stat vào group Not.

Với mod dạng "Adds X to Y Damage", giá trị là trung bình hai đầu, đúng cách trade site so sánh. Sau khi bấm, bảng filter nâng cao tự mở để bạn thấy thay đổi; extension không tự chạy search, bạn bấm Search khi muốn. Tắt trong Cài đặt nếu không cần.

## Nút + / − trên thuộc tính item

Cùng cơ chế cho các dòng thuộc tính: Armour, Evasion, Energy Shield, Block, Spirit, Quality, Item Level, DPS, Attack Speed, Requirements (Level, Str, Dex, Int)… `+` đặt min, `−` đặt max vào ô filter tương ứng ở cột bên trái; nút nào bấm thì xoá ngưỡng đối diện. Hoạt động trên cả PoE1 và PoE2 dù hai site xếp nhóm filter khác nhau.

## Tô sáng mod đang search

Dòng mod nào trên item khớp với một stat đang bật trong Stat Filters của search hiện tại được tô nền để bạn quét kết quả nhanh hơn. Stat bạn đã tắt (disabled) trong filter không được tô. Tắt trong Cài đặt.

## Nhãn quy đổi giá trên từng listing

Cạnh giá của mỗi listing hiện giá quy đổi: listing tính bằng chaos thì hiện thêm divine, tính bằng divine thì hiện thêm chaos, tính bằng currency khác thì hiện cả hai. Icon lấy từ chính catalog currency của site. Tỷ giá lấy từ bulk exchange của league đang xem, cache 6 giờ. Currency ít thanh khoản (mirror…) được quy đổi qua divine khi không có offer đổi thẳng sang chaos.

## Lịch sử giá

Với search đã bookmark, mỗi lần bạn mở trang kết quả, extension đọc giá các listing đang hiển thị, quy đổi ra chaos và lưu một snapshot gồm trung vị, trung bình và số mẫu. Tối đa một snapshot mỗi giờ cho mỗi search, cần ít nhất 3 listing có tỷ giá, giữ 90 snapshot gần nhất. Bookmark hiện trung vị mới nhất; menu `•••` → "Lịch sử giá" mở biểu đồ khi có từ 2 snapshot.

Extension không tự chạy search ở nền; snapshot chỉ được chụp khi chính bạn mở trang.

## Đánh dấu seller bán nhiều item

Trong kết quả đang xem, listing của seller có từ 2 item trở lên được đánh dấu bằng vạch màu bên trái và badge `×N` cạnh tên account, để bạn whisper một lần mua nhiều món. Số đếm chỉ tính các listing đang hiển thị trên trang.

## Chia sẻ folder

Menu `•••` của folder → Chia sẻ. Hai chế độ:

- **Chia sẻ trực tiếp**: sinh một share key. Ai có key thấy và sửa được mọi bookmark trong folder; thay đổi đồng bộ hai chiều theo thời gian thực khi cả hai bên đang mở trang trade. Key chính là mật khẩu: lộ key là lộ folder. Trong hộp thoại có nút Đổi key mới (người giữ key cũ ngừng nhận cập nhật) và Ngừng chia sẻ.
- **Chia sẻ một lần**: gửi một bản chụp tại thời điểm đó. Folder của bạn không đổi trạng thái, người nhận không đồng bộ thêm.

Người nhận bấm "Tham gia bằng key" ở header panel, dán key. Với key một lần, dữ liệu được sao chép vào folder mới. Với key trực tiếp, chọn **Fork** để lấy bản sao tĩnh hoặc **Tham gia** để đồng bộ liên tục.

Trong folder đang chia sẻ trực tiếp, xoá bookmark chỉ ẩn nó trên máy bạn để không xoá mất của người khác; kéo bookmark sang folder khác tạo bản sao riêng của bạn. Thứ tự sắp xếp và trạng thái "đã mua" là của riêng mỗi máy, không đồng bộ. Ghi chú folder có đồng bộ.

## Import build

Menu `•••` của folder → "Import build (poe.ninja / PoB)". Dán một trong ba thứ:

- Link character trên builds ladder của poe.ninja, dạng `https://poe.ninja/poe1/builds/<league>/character/<account>/<name>` (hoặc `poe2`).
- Link `pobb.in/<id>`.
- Code Path of Building dán tay.

Extension lấy gear, jewel, flask của build, hiện danh sách theo slot kèm số mod đã map được trên tổng số mod. Chọn món muốn lưu (mặc định chọn gear và jewel, bỏ flask và đồ không đeo) rồi bấm "Lưu N vào folder". Mỗi món thành một bookmark: unique tìm theo tên, base và mod; rare/magic tìm theo base, rarity non-unique và mọi mod map được. Tuỳ chọn Roll: "Đúng roll" đặt min bằng roll của item, "Roll bất kỳ" chỉ đòi mod có mặt.

Lưu ý:

- Phải import khi đang ở trang trade đúng game: link `poe1` trên `/trade`, link `poe2` trên `/trade2`, vì catalog stat dùng để map là của tab đang mở.
- Mod không map được không chặn việc lưu, chỉ làm search lỏng hơn item gốc; con số N/M cho biết điều đó.
- Rune (PoE2) được đưa vào search ở trạng thái tắt, bạn tự bật nếu muốn đòi đúng rune.
- Bookmark import không có lịch sử giá cho tới khi bạn lưu lại từ trang kết quả.

## Cài đặt

Icon bánh răng ở header panel. Mỗi tính năng trên trang có công tắc riêng: nút stat filter, nút property filter, nhãn quy đổi giá, tô sáng mod, đánh dấu seller, thống kê sử dụng ẩn danh. Mục Sao lưu xuất toàn bộ dữ liệu ra JSON và nhập lại (nhập sẽ thay thế dữ liệu hiện tại). Nút "Xem lại hướng dẫn" mở lại màn onboarding.

## Quyền riêng tư

Extension không gọi API tìm kiếm của GGG và không tự chạy search. Hai ngoại lệ có chủ đích: gọi endpoint bulk exchange công khai của chính trade site để lấy tỷ giá (tối đa một lần mỗi 6 giờ mỗi league), và gọi JSON của poe.ninja hoặc pobb.in khi bạn bấm Import. Thống kê sử dụng ẩn danh gửi tới Datadog qua background của extension gồm tên tính năng, số đếm, mã lỗi và text mod không map được; không bao giờ gửi account, query, bookmark hay lịch sử duyệt. Chi tiết ở [PRIVACY.md](../PRIVACY.md).

## Câu hỏi thường gặp

**Bookmark cũ mở ra trang trống?** Bookmark lưu trước khi extension ghi kèm query chỉ có link ngắn; link đó hết hạn theo GGG. Mở lại search và bấm "Ghi đè bằng search hiện tại" để lưu kèm query.

**Nút + / − không hiện?** Kiểm tra công tắc trong Cài đặt, rồi reload trang trade. Nút chỉ hiện khi rê chuột vào đúng dòng mod hoặc dòng thuộc tính.

**Import báo "Link này thuộc POE2"?** Mở `pathofexile.com/trade2` rồi import lại.

**Share key bị lộ thì sao?** Bấm "Đổi key mới" trong hộp thoại chia sẻ. Người giữ key cũ không nhận cập nhật từ bạn nữa, nhưng bản họ đã có vẫn còn trên máy họ.

**Firefox?** Có bản Firefox (manifest v2), cần Firefox 128 trở lên. Hiện chưa có trên addons.mozilla.org, phải cài thủ công; xem [development.md](development.md).
