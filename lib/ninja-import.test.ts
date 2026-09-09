import { describe, expect, it } from 'vitest'
import {
  attachStatMatches,
  buildImportQuery,
  collectImportItems,
  createStatMatcher,
  flattenStatCatalog,
  importItemLabel,
  matchStatLines,
  matchedCount,
  ninjaCharacterUrl,
  normalizeModText,
  parseNinjaUrl,
  resolveNinjaSnapshot,
  type NinjaCharacter,
  type StatCatalogEntry,
} from './ninja-import'
import poe1Character from './__fixtures__/ninja-poe1.json'
import poe2Character from './__fixtures__/ninja-poe2.json'
import poe1Stats from './__fixtures__/trade-stats-poe1.json'
import poe2Stats from './__fixtures__/trade-stats-poe2.json'

const poe1Catalog: StatCatalogEntry[] = poe1Stats.result.flatMap((group) => group.entries)
const poe2Catalog: StatCatalogEntry[] = poe2Stats.result.flatMap((group) => group.entries)

describe('parseNinjaUrl', () => {
  it('đọc game, league slug, account và tên character (kể cả tên percent-encoded)', () => {
    expect(parseNinjaUrl('https://poe.ninja/poe1/builds/allflame/character/Poteitik-3151/%D0%9F%D0%9E%D0%A2%D0%95%D0%99%D0%A2%D0%98%D0%9A?i=0'))
      .toEqual({ game: 'poe1', leagueSlug: 'allflame', account: 'Poteitik-3151', character: 'ПОТЕЙТИК' })
    expect(parseNinjaUrl('https://poe.ninja/poe2/builds/forbiddenrites/character/heygyus-0416/ResurrectForbidden?i=0'))
      .toEqual({ game: 'poe2', leagueSlug: 'forbiddenrites', account: 'heygyus-0416', character: 'ResurrectForbidden' })
  })

  it('bỏ qua query string của poe.ninja (?i=&search=)', () => {
    expect(parseNinjaUrl('https://poe.ninja/poe1/builds/allflame/character/fang16639-5555/allffan?i=1&search=skills%3DRaise%2BSpectre%26class%3DNecromancer'))
      .toEqual({ game: 'poe1', leagueSlug: 'allflame', account: 'fang16639-5555', character: 'allffan' })
  })

  it('từ chối link không phải character trên builds ladder', () => {
    expect(parseNinjaUrl('https://poe.ninja/poe1/builds/allflame')).toBeNull()
    expect(parseNinjaUrl('https://poe.ninja/poe2/profile/acc/league/character/name')).toBeNull()
    expect(parseNinjaUrl('https://www.pathofexile.com/trade/search/Allflame')).toBeNull()
    expect(parseNinjaUrl('not a url')).toBeNull()
  })
})

describe('snapshot + character url', () => {
  const indexState = {
    snapshotVersions: [
      { url: 'allflame', version: '1332-20260905-16098', snapshotName: 'allflame' },
      { url: 'allflame', version: '1337-20260905-45779', snapshotName: 'allflame' },
      { url: 'allflamehc', version: '1338-20260905-22224', snapshotName: 'hardcore-allflame' },
    ],
  }

  it('lấy snapshot đầu tiên khớp slug và dựng URL character có encode tên', () => {
    const snapshot = resolveNinjaSnapshot(indexState, 'allflame')
    expect(snapshot?.version).toBe('1332-20260905-16098')
    const link = parseNinjaUrl('https://poe.ninja/poe1/builds/allflame/character/Poteitik-3151/ПОТЕЙТИК')!
    expect(ninjaCharacterUrl(link, snapshot!))
      .toBe('https://poe.ninja/poe1/api/builds/1332-20260905-16098/character?account=Poteitik-3151&name=%D0%9F%D0%9E%D0%A2%D0%95%D0%99%D0%A2%D0%98%D0%9A&overview=allflame')
    expect(resolveNinjaSnapshot(indexState, 'nope')).toBeNull()
  })
})

describe('normalizeModText', () => {
  it('bỏ markup [Tag|Text] của POE2 và tách mod nhiều dòng', () => {
    expect(normalizeModText('Adds 20 to 28 [Cold] damage to [Attack|Attacks]')).toEqual(['Adds 20 to 28 Cold damage to Attacks'])
    expect(normalizeModText('+30 to [Spirit|Spirit]')).toEqual(['+30 to Spirit'])
    expect(normalizeModText('Line one\nLine two')).toEqual(['Line one', 'Line two'])
  })
})

describe('createStatMatcher', () => {
  const match = createStatMatcher(poe1Catalog)

  // Mod nội dung item không pin section: filter explicit.<hash> của site đã khớp cả dòng crafted/
  // fractured/desecrated, nên dòng fractured/crafted về id explicit khi explicit có text đó.
  it('mod nội dung item về id explicit dù poe.ninja xếp ở fractured/crafted, đọc roll', () => {
    expect(match({ section: 'explicit', text: '+44% to Cold Resistance' })).toMatchObject({ ids: ['explicit.stat_4220027924'], value: 44 })
    expect(match({ section: 'fractured', text: '+105 to maximum Life' })).toMatchObject({ ids: ['explicit.stat_3299347043'], value: 105 })
    expect(match({ section: 'crafted', text: '+15% to Fire and Chaos Resistances' })!.ids[0]).toMatch(/^explicit\./)
  })

  it('implicit và enchant giữ riêng section của mình', () => {
    expect(match({ section: 'implicit', text: '+22% to Chaos Resistance' })!.ids.every((id) => id.startsWith('implicit.'))).toBe(true)
    expect(match({ section: 'enchant', text: 'Allocates Sovereignty' })!.ids.every((id) => id.startsWith('enchant.'))).toBe(true)
  })

  it('chấp nhận số nhiều khi catalog ghi số ít', () => {
    expect(createStatMatcher(poe2Catalog)({ section: 'implicit', text: 'Has 2 Charm Slots' })).toMatchObject({ ids: ['implicit.stat_1416292992'], value: 2 })
  })

  it('catalog số nhiều "are" khớp item roll 1 "is a"', () => {
    const catalog: StatCatalogEntry[] = [{ id: 'enchant.stat_4079888060', text: '# Added Passive Skills are Jewel Sockets' }]
    expect(createStatMatcher(catalog)({ section: 'enchant', text: '1 Added Passive Skill is a Jewel Socket' })).toMatchObject({ ids: ['enchant.stat_4079888060'], value: 1 })
    expect(createStatMatcher(catalog)({ section: 'enchant', text: '2 Added Passive Skills are Jewel Sockets' })).toMatchObject({ ids: ['enchant.stat_4079888060'], value: 2 })
  })

  it('bỏ qua suffix (Local) của catalog', () => {
    expect(match({ section: 'explicit', text: '63% increased Armour and Evasion' })).toMatchObject({ ids: ['explicit.stat_2451402625'], value: 63 })
  })

  it('chấp nhận roll âm cho catalog "+#"', () => {
    expect(match({ section: 'crafted', text: 'Non-Channelling Skills have -7 to Total Mana Cost' }))
      .toMatchObject({ ids: ['explicit.stat_677564538'], value: -7 })
  })

  it('đảo increased/reduced với giá trị âm, giữ mọi id khớp', () => {
    expect(match({ section: 'explicit', text: '15% reduced Attack Speed' }))
      .toEqual({ ids: ['explicit.stat_210067635', 'explicit.stat_681332047'], text: '#% increased Attack Speed (Local)', value: -15 })
  })

  it('text trùng nhiều id (Local/global, hoặc hai stat GGG cùng text) trả hết id theo thứ tự catalog', () => {
    expect(match({ section: 'explicit', text: '18% increased Attack Speed' })).toMatchObject({ ids: ['explicit.stat_210067635', 'explicit.stat_681332047'], value: 18 })
    expect(match({ section: 'explicit', text: '+14% chance to Suppress Spell Damage' })).toMatchObject({ ids: ['explicit.stat_3680664274', 'explicit.stat_492027537'], value: 14 })
  })

  it.each(['explicit', 'crafted', 'desecrated'] as const)('rarity %s chỉ lấy mod khớp toàn bộ text', (section) => {
    const match = createStatMatcher(poe2Catalog)
    expect(match({ section, text: '12% increased Rarity of Items found' })).toEqual({
      ids: ['explicit.stat_3917489142', 'explicit.stat_2306002879'],
      text: '#% increased Rarity of Items found', value: 12,
    })
    expect(match({ section, text: '12% reduced Rarity of Items found' })?.ids)
      .toEqual(['explicit.stat_3917489142', 'explicit.stat_2306002879'])
  })

  it('rarity có đủ điều kiện vẫn khớp mod nhiều dòng', () => {
    expect(createStatMatcher(poe2Catalog)({
      section: 'explicit',
      text: '12% increased Rarity of Items found Your other Modifiers to Rarity of Items found do not apply',
    })).toMatchObject({ ids: ['explicit.stat_1602191394'], value: 12 })
  })

  it('ưu tiên toàn bộ text ở section sau và dạng đảo chiều trước một dòng của mod ghép', () => {
    const match = createStatMatcher([
      { id: 'explicit.compound', text: '#% reduced Rarity of Items found\nYour other Modifiers to Rarity of Items found do not apply' },
      { id: 'crafted.simple', text: '#% increased Rarity of Items found' },
    ])
    expect(match({ section: 'crafted', text: '12% reduced Rarity of Items found' }))
      .toEqual({ ids: ['crafted.simple'], text: '#% increased Rarity of Items found', value: -12 })
  })

  it('lấy trung bình damage range như trade site', () => {
    expect(match({ section: 'explicit', text: 'Adds 3 to 7 Physical Damage to Attacks' })).toMatchObject({ ids: ['explicit.stat_3032590688'], value: 5 })
  })

  it('mod không có số trả value null; text lạ trả null', () => {
    expect(match({ section: 'explicit', text: 'Historic' })).toMatchObject({ ids: ['explicit.stat_3787436548'], value: null })
    expect(match({ section: 'explicit', text: 'Totally made up mod' })).toBeNull()
  })

  it('họ section nội dung item thử theo thứ tự, lấy section đầu có hit; implicit/enchant/rune không lẫn', () => {
    const catalog: StatCatalogEntry[] = [
      { id: 'delve.stat_1', text: '#% increased Fossil drop rate' },
      { id: 'explicit.stat_2', text: '+#% to Fire and Chaos Resistances' },
      { id: 'veiled.stat_2', text: '+#% to Fire and Chaos Resistances' },
      { id: 'crafted.stat_3', text: 'Can have up to # additional Crafted Modifier' },
      { id: 'implicit.stat_2', text: '+#% to Fire and Chaos Resistances' },
      { id: 'rune.stat_2', text: '+#% to Fire and Chaos Resistances' },
    ]
    const match = createStatMatcher(catalog)
    expect(match({ section: 'explicit', text: '30% increased Fossil drop rate' })).toMatchObject({ ids: ['delve.stat_1'], value: 30 })
    expect(match({ section: 'explicit', text: '+15% to Fire and Chaos Resistances' })).toMatchObject({ ids: ['explicit.stat_2'], value: 15 })
    expect(match({ section: 'crafted', text: '+15% to Fire and Chaos Resistances' })).toMatchObject({ ids: ['explicit.stat_2'] })
    expect(match({ section: 'explicit', text: 'Can have up to 3 additional Crafted Modifiers' })).toMatchObject({ ids: ['crafted.stat_3'], value: 3 })
    expect(match({ section: 'implicit', text: '+15% to Fire and Chaos Resistances' })).toMatchObject({ ids: ['implicit.stat_2'] })
    expect(match({ section: 'rune', text: '+15% to Fire and Chaos Resistances' })).toMatchObject({ ids: ['rune.stat_2'] })
    expect(match({ section: 'enchant', text: '+15% to Fire and Chaos Resistances' })).toBeNull()
  })

  it('entry nhiều dòng trong catalog match được từng dòng poe.ninja tách ra, về cùng một id', () => {
    const catalog: StatCatalogEntry[] = [
      { id: 'crafted.stat_1582781759', text: 'Trigger a Socketed Spell on Using a Skill, with a # second Cooldown\nSpells Triggered this way have 150% more Cost' },
    ]
    const match = createStatMatcher(catalog)
    expect(match({ section: 'crafted', text: 'Trigger a Socketed Spell on Using a Skill, with a 8 second Cooldown' })).toMatchObject({ ids: ['crafted.stat_1582781759'], value: 8 })
    expect(match({ section: 'crafted', text: 'Spells Triggered this way have 150% more Cost' })).toMatchObject({ ids: ['crafted.stat_1582781759'], value: null })
    expect(match({ section: 'crafted', text: 'Trigger a Socketed Spell on Using a Skill, with a 8 second Cooldown Spells Triggered this way have 150% more Cost' })).toMatchObject({ ids: ['crafted.stat_1582781759'] })
  })

  it('bung stat có option từ knownStatsFlat', () => {
    const catalog = flattenStatCatalog({
      'enchant.stat_2954116742': { text: 'Allocates #', option: { options: [{ id: 32932, text: 'Sovereignty' }, { id: 1, text: 'Other' }] } },
      'explicit.stat_1': { text: '+# to maximum Life' },
    })
    expect(catalog).toEqual([
      { id: 'enchant.stat_2954116742|32932', text: 'Allocates Sovereignty' },
      { id: 'enchant.stat_2954116742|1', text: 'Allocates Other' },
      { id: 'explicit.stat_1', text: '+# to maximum Life' },
    ])
    expect(createStatMatcher(catalog)({ section: 'enchant', text: 'Allocates Sovereignty' })).toMatchObject({ ids: ['enchant.stat_2954116742|32932'] })
  })
})

describe('collectImportItems + match rate trên character thật', () => {
  it('POE1: gear + jewel + flask, gear rare map đủ mọi dòng', () => {
    const items = collectImportItems(poe1Character as NinjaCharacter)
    expect(items.filter((item) => item.kind === 'gear')).toHaveLength(9)
    expect(items.filter((item) => item.kind === 'jewel')).toHaveLength(9)
    expect(items.filter((item) => item.kind === 'flask')).toHaveLength(5)

    const lines = items.flatMap((item) => item.lines)
    const resolved = attachStatMatches(items, matchStatLines(poe1Catalog, lines))
    const gloves = resolved.find((item) => item.baseType === 'Chimerascale Gauntlets')!
    expect(matchedCount(gloves)).toBe(gloves.lines.length)
    expect(gloves.matches.flatMap((m) => m?.ids ?? [])).toContain('explicit.stat_681332047')
    const axe = resolved.find((item) => item.baseType === 'Vaal Axe')!
    expect(axe.matches.flatMap((m) => m?.ids ?? [])).toContain('explicit.stat_210067635')
    const ring = resolved.find((item) => item.baseType === 'Iron Ring')!
    expect(matchedCount(ring)).toBe(ring.lines.length)

    const total = lines.length
    const matched = resolved.reduce((sum, item) => sum + matchedCount(item), 0)
    expect(matched / total).toBeGreaterThan(0.85)
  })

  it('POE2: gear rare map 100% kể cả desecrated và rune', () => {
    const items = collectImportItems(poe2Character as NinjaCharacter)
    const resolved = attachStatMatches(items, matchStatLines(poe2Catalog, items.flatMap((item) => item.lines)))
    for (const item of resolved.filter((entry) => entry.kind === 'gear' && entry.rarity === 'rare')) {
      expect(matchedCount(item), item.baseType).toBe(item.lines.length)
    }
    // Fixture được tải lại theo thời gian nên không bám tên item: mọi dòng rune phải ra id rune.*
    const runeLines = resolved.flatMap((item) => item.lines.map((line, index) => [line, item.matches[index]] as const)).filter(([line]) => line.section === 'rune')
    expect(runeLines.length).toBeGreaterThan(0)
    for (const [, match] of runeLines) expect(match?.ids.every((id) => id.startsWith('rune.'))).toBe(true)
  })

  it('label theo slot và tên', () => {
    const items = collectImportItems(poe1Character as NinjaCharacter)
    expect(importItemLabel(items.find((item) => item.name === 'Abyssus')!)).toBe('Helmet · Abyssus')
    expect(importItemLabel(items.find((item) => item.baseType === 'Chimerascale Gauntlets')!)).toBe('Gloves · Chimerascale Gauntlets')
    expect(items.find((item) => item.baseType === 'Diamond Flask')?.slot).toBe('Flask')
  })
})

describe('buildImportQuery', () => {
  const items = collectImportItems(poe1Character as NinjaCharacter)
  const resolved = attachStatMatches(items, matchStatLines(poe1Catalog, items.flatMap((item) => item.lines)))

  it('status luôn là available (Instant Buyout and In Person)', () => {
    expect(buildImportQuery(resolved[0]!, 0).status).toBe('available')
    expect(buildImportQuery(resolved[0]!, 100).status).toBe('available')
  })

  it('unique: name + type và vẫn mang stat (Watcher\'s Eye, Forbidden Flesh, mod Foulborn cần mod)', () => {
    const query = buildImportQuery(resolved.find((item) => item.name === 'Abyssus')!, 100)
    expect(query.name).toBe('Abyssus')
    expect(query.type).toBe('Ezomyte Burgonet')
    expect(query.filters).toEqual({})
    const filters = query.stats.flatMap((group) => group.filters)
    expect(filters.length).toBeGreaterThan(0)
    expect(filters.every((filter) => filter.value && ('min' in filter.value || 'max' in filter.value))).toBe(true)
    const any = buildImportQuery(resolved.find((item) => item.name === 'Abyssus')!, 0)
    expect(any.stats.flatMap((group) => group.filters).every((filter) => Object.keys(filter.value ?? {}).length === 0)).toBe(true)
  })

  it('rare: base + rarity nonunique + mọi mod map được, any roll không đặt min', () => {
    const query = buildImportQuery(resolved.find((item) => item.baseType === 'Chimerascale Gauntlets')!, 0)
    expect(query.name).toBeNull()
    expect(query.type).toBe('Chimerascale Gauntlets')
    expect(query.filters).toEqual({ type_filters: { filters: { rarity: { option: 'nonunique' } } } })
    const allFilters = query.stats.flatMap((group) => group.filters)
    expect(allFilters.map((filter) => filter.id)).toContain('explicit.stat_3299347043')
    expect(allFilters.every((filter) => filter.value && Object.keys(filter.value).length === 0)).toBe(true)
  })

  it('rare: mod nhiều id (Local/global, Suppress) là group count min 1 cùng roll; mod một id vào and', () => {
    const query = buildImportQuery(resolved.find((item) => item.baseType === 'Chimerascale Gauntlets')!, 100)
    const and = query.stats.find((group) => group.type === 'and')!
    expect(and.filters.find((filter) => filter.id === 'explicit.stat_3299347043')?.value).toEqual({ min: 105 })
    expect(and.filters.map((filter) => filter.id)).toContain('implicit.stat_3739863694')
    const count = query.stats.find((group) => group.type === 'count')!
    expect(count.value).toEqual({ min: 1 })
    expect(count.filters).toEqual([
      { id: 'explicit.stat_210067635', value: { min: 18 }, disabled: false },
      { id: 'explicit.stat_681332047', value: { min: 18 }, disabled: false },
    ])
    expect(and.filters.map((filter) => filter.id)).not.toContain('explicit.stat_681332047')
    const boots = buildImportQuery(resolved.find((item) => item.baseType === 'Wyvernscale Boots')!, 100)
    expect(boots.stats.find((group) => group.type === 'count')?.filters.map((filter) => filter.id))
      .toEqual(['explicit.stat_3680664274', 'explicit.stat_492027537'])
  })

  it('rare exact: damage range dùng trung bình, mỗi mod chỉ một group', () => {
    const query = buildImportQuery(resolved.find((item) => item.baseType === 'Chimerascale Gauntlets')!, 100)
    const damage = query.stats.flatMap((group) => group.filters).filter((filter) => filter.id === 'explicit.stat_3032590688')
    expect(damage).toHaveLength(1)
    expect(damage[0]!.value).toEqual({ min: 5 })
    const keys = query.stats.map((group) => group.filters.map((filter) => filter.id).join('|'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('rare exact: roll âm đi vào max thay vì min', () => {
    const ring = resolved.find((item) => item.baseType === 'Amethyst Ring')!
    const filters = buildImportQuery(ring, 100).stats.flatMap((group) => group.filters)
    expect(filters.find((filter) => filter.id === 'explicit.stat_677564538')?.value).toEqual({ max: -7 })
    expect(filters.find((filter) => filter.id === 'explicit.stat_3299347043')?.value).toEqual({ min: 101 })
  })

  it('rune (POE2): vào group and dạng filter tắt, user tự bật', () => {
    const items2 = collectImportItems(poe2Character as NinjaCharacter)
    const resolved2 = attachStatMatches(items2, matchStatLines(poe2Catalog, items2.flatMap((item) => item.lines)))
    const withRune = resolved2.find((item) => item.rarity === 'rare' && item.lines.some((line) => line.section === 'rune'))!
    const query = buildImportQuery(withRune, 100)
    const runeFilters = query.stats.flatMap((group) => group.filters).filter((filter) => filter.id.startsWith('rune.'))
    expect(runeFilters.length).toBeGreaterThan(0)
    expect(runeFilters.every((filter) => filter.disabled === true)).toBe(true)
    expect(query.stats.filter((group) => group.type === 'count').flatMap((group) => group.filters).some((filter) => filter.id.startsWith('rune.'))).toBe(false)
  })

  it('flask magic: base + mod; flask không map được dòng nào vẫn ra type-only', () => {
    const flask = resolved.find((item) => item.baseType === 'Diamond Flask')!
    const query = buildImportQuery(flask, 0)
    expect(query.type).toBe('Diamond Flask')
    expect(query.stats.flatMap((group) => group.filters).map((filter) => filter.id)).toContain('explicit.stat_2008255263')
  })
})
