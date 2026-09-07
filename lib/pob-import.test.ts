import { describe, expect, it } from 'vitest'
import { attachStatMatches, buildImportQuery, collectImportItems, matchStatLines, matchedCount, type NinjaCharacter, type StatCatalogEntry } from './ninja-import'
import poe1Character from './__fixtures__/ninja-poe1.json'
import { decodePobCode, looksLikePobCode, parsePobItem, parsePobLink, parsePobXml, resolveBaseType } from './pob-import'
import poe1Code from './__fixtures__/pob-poe1.txt?raw'
import poe2Code from './__fixtures__/pob-poe2.txt?raw'
import poe1Stats from './__fixtures__/trade-stats-poe1.json'
import poe2Stats from './__fixtures__/trade-stats-poe2.json'

const poe1Catalog: StatCatalogEntry[] = poe1Stats.result.flatMap((group) => group.entries)
const poe2Catalog: StatCatalogEntry[] = poe2Stats.result.flatMap((group) => group.entries)

describe('parsePobLink + looksLikePobCode', () => {
  it('link pobb.in về route /raw; link khác trả null', () => {
    expect(parsePobLink('https://pobb.in/8DB1sBeYNL8s')).toEqual({ kind: 'pobbin', url: 'https://pobb.in/8DB1sBeYNL8s/raw' })
    expect(parsePobLink(' https://pobb.in/8DB1sBeYNL8s/raw ')).toEqual({ kind: 'pobbin', url: 'https://pobb.in/8DB1sBeYNL8s/raw' })
    expect(parsePobLink('https://poe.ninja/poe1/builds/allflame/character/a/b')).toBeNull()
  })

  it('nhận dạng code base64url, kể cả có xuống dòng', () => {
    expect(looksLikePobCode(poe1Code)).toBe(true)
    expect(looksLikePobCode(poe1Code.slice(0, 100) + '\n' + poe1Code.slice(100))).toBe(true)
    expect(looksLikePobCode('https://pobb.in/abc')).toBe(false)
    expect(looksLikePobCode('short')).toBe(false)
  })
})

describe('decodePobCode', () => {
  it('giải nén ra XML PathOfBuilding', async () => {
    const xml = await decodePobCode(poe1Code)
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<PathOfBuilding>')
    expect((await decodePobCode(poe2Code))).toContain('<PathOfBuilding2>')
  })
})

describe('parsePobItem', () => {
  it('rare: name + base, implicit/explicit theo Implicits N, tag {crafted}/{fractured}', () => {
    const item = parsePobItem(`Rarity: RARE
Vengeance Talons
Chimerascale Gauntlets
Unique ID: abc
Item Level: 86
Implicits: 2
15% chance to Impale Enemies on Hit with Attacks
Adds 4 to 9 Physical Damage to Attacks
{fractured}+105 to maximum Life
{crafted}+15% to Fire and Chaos Resistances
18% increased Attack Speed
Corrupted`)!
    expect(item).toMatchObject({ rarity: 'rare', name: '', baseType: 'Chimerascale Gauntlets', typeLine: 'Chimerascale Gauntlets', corrupted: true })
    expect(item.lines).toEqual([
      { section: 'implicit', text: '15% chance to Impale Enemies on Hit with Attacks' },
      { section: 'implicit', text: 'Adds 4 to 9 Physical Damage to Attacks' },
      { section: 'fractured', text: '+105 to maximum Life' },
      { section: 'crafted', text: '+15% to Fire and Chaos Resistances' },
      { section: 'explicit', text: '18% increased Attack Speed' },
    ])
  })

  it('{crafted} trong khối implicit là enchant; {mutated} là scourge; {enchant}/{rune} của PoB2', () => {
    const jewel = parsePobItem(`Rarity: RARE
Kraken Bliss
Large Cluster Jewel
Implicits: 2
{crafted}Adds 8 Passive Skills
{crafted}2 Added Passive Skills are Jewel Sockets
1 Added Passive Skill is Fuel the Fight
{mutated}10% increased Damage`)!
    expect(jewel.lines.map((line) => line.section)).toEqual(['enchant', 'enchant', 'explicit', 'scourge'])
    const boots = parsePobItem(`Rarity: RARE
Wake
Serpentscale Boots
Implicits: 2
{enchant}+2 to Level of all Minion Skills
Grants Skill: Spear Throw
{rune}+12% to Cold Resistance
35% increased Movement Speed`)!
    expect(boots.lines.map((line) => line.section)).toEqual(['enchant', 'rune', 'explicit'])
  })

  it('unique giữ name; magic không có dòng base nên baseType trống, typeLine là tên đầy đủ', () => {
    const unique = parsePobItem("Rarity: UNIQUE\nLion&apos;s Roar\nGranite Flask\nImplicits: 1\n{crafted}Used when Charges reach full\nKnocks Back Enemies")!
    expect(unique).toMatchObject({ rarity: 'unique', name: "Lion's Roar", baseType: 'Granite Flask' })
    expect(unique.lines[0]).toEqual({ section: 'enchant', text: 'Used when Charges reach full' })
    const magic = parsePobItem("Rarity: MAGIC\nFlagellant&apos;s Diamond Flask of Incision\nImplicits: 0\n52% increased Critical Strike Chance during Effect")!
    expect(magic).toMatchObject({ rarity: 'magic', baseType: '', typeLine: "Flagellant's Diamond Flask of Incision" })
    expect(magic.lines).toEqual([{ section: 'explicit', text: '52% increased Critical Strike Chance during Effect' }])
  })

  it('item guide: chỉ giữ dòng của variant đã chọn, (a-b) lấy theo {range}', () => {
    const item = parsePobItem(`Rarity: UNIQUE
Watcher's Eye
Prismatic Jewel
Variant: Pre 3.0
Variant: Current
Selected Variant: 2
Implicits: 0
{variant:1}+(3-5)% to all Elemental Resistances
{variant:2}{range:0.5}(4-6)% increased maximum Energy Shield
{range:1}+(30-40) to maximum Life
{tags:life}{range:0.25}(1.5-2.5)% of Life Regenerated per second`)!
    expect(item.lines.map((line) => line.text)).toEqual([
      '5% increased maximum Energy Shield',
      '+40 to maximum Life',
      '1.8% of Life Regenerated per second',
    ])
  })
})

describe('resolveBaseType', () => {
  it('lấy base dài nhất xuất hiện nguyên từ trong typeLine', () => {
    const bases = ['Flask', 'Diamond Flask', 'Granite Flask', 'Ruby Ring', 'Ring']
    expect(resolveBaseType("Flagellant's Diamond Flask of Incision", bases)).toBe('Diamond Flask')
    expect(resolveBaseType('Seething Divine Life Flask of Staunching', bases)).toBe('Flask')
    expect(resolveBaseType('Two-Stone Ring of the Bear', bases)).toBe('Ring')
    expect(resolveBaseType('Nothing here', bases)).toBeNull()
  })
})

describe('parsePobXml trên export thật của poe.ninja', () => {
  it('POE1 Poteitik: game, class, level, slot/jewel/flask, cùng shape với poe.ninja', async () => {
    const build = parsePobXml(await decodePobCode(poe1Code))!
    expect(build).toMatchObject({ game: 'poe1', className: 'Duelist', ascendClassName: 'Champion', level: 100 })
    expect(build.items).toHaveLength(23)
    const gloves = build.items.find((item) => item.baseType === 'Chimerascale Gauntlets')!
    expect(gloves).toMatchObject({ slot: 'Gloves', kind: 'gear', rarity: 'rare', equipped: true })
    expect(gloves.lines).toContainEqual({ section: 'fractured', text: '+105 to maximum Life' })
    expect(gloves.lines).toContainEqual({ section: 'crafted', text: '+15% to Fire and Chaos Resistances' })
    expect(build.items.find((item) => item.name === 'Abyssus')).toMatchObject({ slot: 'Helmet', baseType: 'Ezomyte Burgonet' })
    expect(build.items.filter((item) => item.kind === 'jewel')).toHaveLength(9)
    expect(build.items.filter((item) => item.kind === 'flask')).toHaveLength(5)
    const amulet = build.items.find((item) => item.name === 'Ashes of the Stars')!
    expect(amulet.lines[0]).toEqual({ section: 'enchant', text: 'Allocates Sovereignty' })
  })

  it('POE1: gear rare map mod bằng catalog và ra query giống đường poe.ninja', async () => {
    const build = parsePobXml(await decodePobCode(poe1Code))!
    const resolved = attachStatMatches(build.items, matchStatLines(poe1Catalog, build.items.flatMap((item) => item.lines)))
    const gloves = resolved.find((item) => item.baseType === 'Chimerascale Gauntlets')!
    expect(matchedCount(gloves)).toBe(gloves.lines.length)
    const query = buildImportQuery(gloves, 'exact')
    expect(query.type).toBe('Chimerascale Gauntlets')
    expect(query.stats.flatMap((group) => group.filters).find((filter) => filter.id === 'explicit.stat_3299347043')?.value).toEqual({ min: 105 })
    const speed = query.stats.find((group) => group.filters.some((filter) => filter.id === 'explicit.stat_210067635'))!
    expect(speed.type).toBe('count')
    expect(speed.filters.map((filter) => filter.id)).toEqual(expect.arrayContaining(['explicit.stat_210067635', 'explicit.stat_681332047']))
    // Cùng item, hai đường import (poe.ninja JSON và PoB) cho query giống nhau.
    const ninjaItems = collectImportItems(poe1Character as NinjaCharacter)
    const ninjaGloves = attachStatMatches(ninjaItems, matchStatLines(poe1Catalog, ninjaItems.flatMap((item) => item.lines))).find((item) => item.baseType === 'Chimerascale Gauntlets')!
    const sortGroups = (stats: typeof query.stats) => stats
      .map((group) => ({ ...group, filters: [...group.filters].sort((a, b) => a.id.localeCompare(b.id)) }))
      .sort((a, b) => a.filters[0]!.id.localeCompare(b.filters[0]!.id))
    const ninjaQuery = buildImportQuery(ninjaGloves, 'exact')
    expect(sortGroups(ninjaQuery.stats)).toEqual(sortGroups(query.stats))
    expect({ ...ninjaQuery, stats: [] }).toEqual({ ...query, stats: [] })
  })

  it('POE2 ResurrectForbidden: PathOfBuilding2, {rune}/{enchant}, charm là flask, weapon swap', async () => {
    const build = parsePobXml(await decodePobCode(poe2Code))!
    expect(build).toMatchObject({ game: 'poe2', className: 'Mercenary', ascendClassName: 'Gemling Legionnaire', level: 96 })
    expect(build.items.map((item) => item.slot)).toContain('Weapon (swap)')
    expect(build.items.filter((item) => item.slot === 'Charm')).toHaveLength(3)
    const resolved = attachStatMatches(build.items, matchStatLines(poe2Catalog, build.items.flatMap((item) => item.lines)))
    for (const item of resolved.filter((entry) => entry.kind === 'gear' && entry.rarity === 'rare')) {
      expect(matchedCount(item), item.baseType).toBe(item.lines.length)
    }
    const boots = build.items.find((item) => item.name === 'Wake of Destruction')!
    expect(boots.lines.some((line) => line.section === 'rune')).toBe(true)
    // PoB2 không tag crafted: "+400 to Accuracy Rating" của spear vẫn ra id explicit (site khớp cả
    // dòng crafted cùng hash), count chỉ vì Local/global.
    const spear = resolved.find((item) => item.baseType === 'Soaring Spear')!
    const accuracy = buildImportQuery(spear, 'exact').stats.find((group) => group.filters.some((filter) => filter.id === 'explicit.stat_803737631'))!
    expect(accuracy.filters.every((filter) => filter.id.startsWith('explicit.'))).toBe(true)
    expect(accuracy.filters.some((filter) => filter.id === 'explicit.stat_691932474')).toBe(true)
  })
})
