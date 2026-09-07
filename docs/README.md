# Tài liệu Exile Trade Companion

| File | Dành cho | Nội dung |
|---|---|---|
| [user-guide.md](user-guide.md) | người dùng | cách dùng từng chức năng, câu hỏi thường gặp |
| [architecture.md](architecture.md) | người sửa code | entrypoint, ba world và messaging, schema dữ liệu, nội bộ trade site đã dùng, styling, manifest |
| [features/](features/README.md) | người sửa code | mỗi tính năng một file: hành vi, hiện thực, quyết định kèm tag session, giới hạn, test |
| [decisions.md](decisions.md) | mọi người | nhật ký quyết định theo thời gian, mỗi mục có tag session |
| [development.md](development.md) | người đóng góp | setup, lệnh, quy ước, verify sống, dữ liệu bundle, phát hành |
| [sessions.md](sessions.md) | truy vết | bản đồ session Claude Code và Codex đã làm việc trên repo |
| [research/](research/) | bối cảnh | bản đồ đối thủ, phân tích KANO, nghiên cứu import poe.ninja (nhật ký thí nghiệm) |
| [../PRIVACY.md](../PRIVACY.md) | người dùng, store | chính sách quyền riêng tư |
| [../data/README.md](../data/README.md) | người sửa code | nguồn và cách cập nhật dữ liệu tier |

Tag session: `<claude:session-id>` là session Claude Code, `<code:session-id>` là session Codex. Khi thêm hoặc đổi tính năng, cập nhật file tương ứng trong `features/`, thêm mục vào `decisions.md` nếu có lựa chọn đáng ghi, và thêm dòng vào `sessions.md`.
