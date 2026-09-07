# Fixture cho Import from poe.ninja

Character thật tải từ API nội bộ của poe.ninja ngày 2026-09-06, cắt `itemData` còn các field parser dùng.
Sinh lại bằng:

```
bun scripts/build-ninja-fixtures.ts <poe1 stats.json> <poe2 stats.json>
```

Hai file stats là dump `/api/trade/data/stats` và `/api/trade2/data/stats`, lấy qua page-context fetch
trên tab trade đã login (workspace poe: `poe1/data/trade-static/stats.json`, `poe2/data/trade-static/stats.json`).
Script không gọi thẳng GGG. Snapshot poe.ninja đổi khi người chơi đổi gear, nên chạy lại script là chấp
nhận sửa expectation trong `lib/ninja-import.dataset.test.ts` theo dataset mới.

## Character và case mỗi file mang

- `ninja-poe1.json` — Poteitik-3151 / ПОТЕЙТИК, Champion, Allflame. Unique (Abyssus, Ashes of the Stars),
  gloves rare có eldritch implicit + fractured + crafted, `(Local)` Armour and Evasion, damage range, Attack Speed
  trùng text Local/global, boots có Suppress trùng hai id, ring có `-7 to Total Mana Cost`, cluster jewel với
  enchant option và "1 Added Passive Skill is a Jewel Socket".
- `ninja-poe1-allffan.json` — fang16639-5555 / allffan, Necromancer, Allflame. Bone Ring có stat tên thuận roll âm
  (`-139 to maximum Life`, `-63% to Lightning Resistance`, `-10 to Total Mana Cost`, fractured `-79%`,
  `-1 to Minimum Endurance Charges`), Convoking Wand có mod Trigger nhiều dòng (lỗ đã biết: text catalog cũ hơn item).
- `ninja-poe1-haruto.json` — mark19981213-7010 / Haruto_Allflame, Necromancer, Allflame. Bone Ring có
  `33% reduced Cold Damage` (map vào stat increased, value âm), `-10% to all Elemental Resistances`.
- `ninja-poe2.json` — heygyus-0416 / ResurrectForbidden, Gemling Legionnaire, Forbidden Rites. Markup `[Tag|Text]`,
  section `rune` và `desecrated`, dòng Bonded, `Has 2 Charm Slots` so với catalog số ít.

## Catalog stat cắt gọn

`trade-stats-poe1.json`, `trade-stats-poe2.json` giữ: mọi entry đã có ở bản trước (superset, test cũ không đổi
kết quả), mọi entry matcher khớp với một dòng mod trong dataset, và entry cùng ba từ đầu với một dòng để test
không tự đúng vì catalog quá nhỏ. Không phải catalog đầy đủ.

`pob-poe1.txt`, `pob-poe2.txt` (nếu có) là PoB code từ field `pathOfBuildingExport` của Poteitik và
ResurrectForbidden, dùng cho `lib/pob-import.test.ts`.
