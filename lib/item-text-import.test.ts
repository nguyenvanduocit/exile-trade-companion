import { describe, expect, it } from 'vitest'
import { parseCopiedItem } from './item-text-import'
import { attachStatMatches, buildImportQuery, importItemLabel, matchStatLines } from './ninja-import'
import poe2Stats from './__fixtures__/trade-stats-poe2.json'

const copied = `Rarity: Rare
Oblivion Touch
Elegant Wraps
--------
Quality: +20% (augmented)
Evasion Rating: 269 (augmented)
Energy Shield: 94 (augmented)
--------
Requires: Level 70, 48 Dex, 48 Int
--------
Sockets: S S
--------
Item Level: 80
--------
Destroys all Augment Sockets on the item to create a Jewel Socket (rune)
--------
+44 to Evasion Rating
+19 to maximum Energy Shield
74% increased Evasion and Energy Shield
Adds 6 to 17 Physical Damage to Attacks
18% increased Rarity of Items found
Gain Deflection Rating equal to 18% of Evasion Rating
+32% to Fire Resistance (desecrated)`

describe('parseCopiedItem', () => {
  it('tiêu đề unique copy chỉ dùng tên, không thêm slot mặc định Item', () => {
    const item = parseCopiedItem('Rarity: Unique\nMorior Invictus\nGrand Regalia\n--------\nItem Level: 80')!
    expect(item.name).toBe('Morior Invictus')
    expect(importItemLabel(item)).toBe('Morior Invictus')
    expect(buildImportQuery(attachStatMatches([item], [])[0]!, 100)).toMatchObject({
      name: 'Morior Invictus', type: 'Grand Regalia',
    })
  })

  it('tiêu đề rare copy dùng base, không thêm slot mặc định Item', () => {
    expect(importItemLabel(parseCopiedItem(copied)!)).toBe('Elegant Wraps')
  })

  it('đọc mẫu poe.ninja, bỏ properties và giữ section của cả 8 mod', () => {
    expect(parseCopiedItem(copied)).toEqual({
      key: 'clipboard-item', kind: 'gear', slot: 'Item', rarity: 'rare',
      name: '', baseType: 'Elegant Wraps', typeLine: 'Elegant Wraps', corrupted: false,
      lines: [
        { section: 'rune', text: 'Destroys all Augment Sockets on the item to create a Jewel Socket' },
        { section: 'explicit', text: '+44 to Evasion Rating' },
        { section: 'explicit', text: '+19 to maximum Energy Shield' },
        { section: 'explicit', text: '74% increased Evasion and Energy Shield' },
        { section: 'explicit', text: 'Adds 6 to 17 Physical Damage to Attacks' },
        { section: 'explicit', text: '18% increased Rarity of Items found' },
        { section: 'explicit', text: 'Gain Deflection Rating equal to 18% of Evasion Rating' },
        { section: 'desecrated', text: '+32% to Fire Resistance' },
      ],
    })
  })

  it('chấp nhận CRLF, khoảng trắng và Item Class tùy chọn', () => {
    expect(parseCopiedItem(`\nItem Class: Gloves\n${copied}\n`.replaceAll('\n', '\r\n'))).toEqual(parseCopiedItem(copied))
  })

  it('giữ implicit/enchant/crafted/fractured, bỏ reminder và cờ khỏi mod', () => {
    const item = parseCopiedItem(`Rarity: Rare
Test Ring
Gold Ring
--------
Item Level: 80
--------
10% increased Rarity of Items found (implicit)
Allocates Test (enchant)
+30 to maximum Life (fractured)
+10 to maximum Mana (crafted)
(This is reminder text)
--------
Corrupted
--------
"Flavour text"
continued flavour text`)!
    expect(item.corrupted).toBe(true)
    expect(item.lines.map((line) => line.section)).toEqual(['implicit', 'enchant', 'fractured', 'crafted'])
    expect(item.lines[2]?.text).toBe('+30 to maximum Life')
  })

  it('giữ tên unique, base normal và typeLine magic để tra catalog', () => {
    expect(parseCopiedItem('Rarity: Unique\nTest Jewel\nRuby Jewel\n--------\nItem Level: 80'))
      .toMatchObject({ name: 'Test Jewel', baseType: 'Ruby Jewel', kind: 'jewel', lines: [] })
    expect(parseCopiedItem('Rarity: Normal\nGold Ring\n--------\nItem Level: 80'))
      .toMatchObject({ name: '', baseType: 'Gold Ring', rarity: 'normal' })
    expect(parseCopiedItem("Rarity: Magic\nBubbling Life Flask of Heat\n--------\nItem Level: 80"))
      .toMatchObject({ name: '', baseType: '', typeLine: 'Bubbling Life Flask of Heat', kind: 'flask' })
  })

  it.each([
    '', 'https://pobb.in/test', 'not an item',
    'Rarity: Rare\nOblivion Touch\nElegant Wraps',
    'Rarity: Rare\nOblivion Touch\n--------\nItem Level: 80',
    'Rarity: Gem\nFireball\n--------\nItem Level: 20',
    'Rarity: RARE\nOblivion Touch\nElegant Wraps\nItem Level: 80\nImplicits: 0\n+32% to Fire Resistance',
    `${copied}\n${copied}`,
  ])('không nhận input sai hoặc format PoB (case %#)', (input) => {
    expect(parseCopiedItem(input)).toBeNull()
  })

  it('đưa mod của mẫu qua catalog PoE2 và query builder với đúng roll', () => {
    const item = parseCopiedItem(copied)!
    const catalog = poe2Stats.result.flatMap((group) => group.entries)
    const matches = matchStatLines(catalog, item.lines)
    // Fixture catalog cũ chưa có rune tạo Jewel Socket; mod còn lại đều phải khớp.
    expect(matches.slice(1).map((match) => match?.value)).toEqual([44, 19, 74, 11.5, 18, 18, 32])
    const resolved = attachStatMatches([item], matches)[0]!
    const query = buildImportQuery(resolved, 100)
    expect(query.type).toBe('Elegant Wraps')
    expect(query.name).toBeNull()
    expect(query.filters).toEqual({ type_filters: { filters: { rarity: { option: 'nonunique' } } } })
    const filters = query.stats.flatMap((group) => group.filters)
    for (const match of matches.slice(1)) {
      for (const id of match!.ids) expect(filters).toContainEqual({ id, value: { min: match!.value }, disabled: false })
    }
    expect(buildImportQuery(resolved, 0).stats.flatMap((group) => group.filters).every((filter) => Object.keys(filter.value ?? {}).length === 0)).toBe(true)
  })

  it('Chimeric Band không đưa mod rarity có điều kiện vào query', () => {
    const item = parseCopiedItem(`Rarity: Rare
Chimeric Band
Gold Ring
--------
Requires: Level 60
--------
Item Level: 82
--------
14% increased Rarity of Items found (implicit)
--------
Adds 13 to 26 Fire damage to Attacks
+169 to maximum Mana
12% increased Rarity of Items found
17.3 Life Regeneration per second
11% increased Cooldown Recovery Rate (desecrated)
18% increased Rarity of Items found (crafted)`)!
    const catalog = poe2Stats.result.flatMap((group) => group.entries)
    const matches = matchStatLines(catalog, item.lines)
    const rarity = matches.filter((_, index) => item.lines[index]!.text.includes('Rarity of Items found'))
    expect(rarity.map((match) => match?.ids)).toEqual([
      ['implicit.stat_3917489142'],
      ['explicit.stat_3917489142', 'explicit.stat_2306002879'],
      ['explicit.stat_3917489142', 'explicit.stat_2306002879'],
    ])
    const query = buildImportQuery(attachStatMatches([item], matches)[0]!, 100)
    const ids = query.stats.flatMap((group) => group.filters.map((filter) => filter.id))
    expect(ids).not.toContain('explicit.stat_1602191394')
    expect(ids).toEqual(expect.arrayContaining(['implicit.stat_3917489142', 'explicit.stat_3917489142', 'explicit.stat_2306002879']))
  })

  it('rune khớp catalog trở thành filter tắt', () => {
    const item = parseCopiedItem(copied.replace('Destroys all Augment Sockets on the item to create a Jewel Socket', '+12% to Fire Resistance'))!
    const catalog = poe2Stats.result.flatMap((group) => group.entries)
    const matches = matchStatLines(catalog, item.lines)
    expect(matches[0]?.ids.length).toBeGreaterThan(0)
    const query = buildImportQuery(attachStatMatches([item], matches)[0]!, 100)
    for (const id of matches[0]!.ids) {
      expect(query.stats.flatMap((group) => group.filters)).toContainEqual({ id, value: { min: 12 }, disabled: true })
    }
  })
})
