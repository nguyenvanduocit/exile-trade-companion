// Test end-to-end trên character THẬT tải từ poe.ninja (lib/__fixtures__/README.md ghi nguồn và cách
// sinh lại). Mỗi case ở đây là một item thật đã thấy trên ladder, không phải catalog tự dựng.
import { describe, expect, it } from 'vitest'
import {
  attachStatMatches,
  buildImportQuery,
  collectImportItems,
  matchStatLines,
  matchedCount,
  type NinjaCharacter,
  type ResolvedImportItem,
  type StatCatalogEntry,
} from './ninja-import'
import type { TradeQuery } from '@/types/trading'
import poteitik from './__fixtures__/ninja-poe1.json'
import allffan from './__fixtures__/ninja-poe1-allffan.json'
import haruto from './__fixtures__/ninja-poe1-haruto.json'
import heygyus from './__fixtures__/ninja-poe2.json'
import poe1Stats from './__fixtures__/trade-stats-poe1.json'
import poe2Stats from './__fixtures__/trade-stats-poe2.json'

const poe1Catalog: StatCatalogEntry[] = poe1Stats.result.flatMap((group) => group.entries)
const poe2Catalog: StatCatalogEntry[] = poe2Stats.result.flatMap((group) => group.entries)

function resolve(character: NinjaCharacter, catalog: StatCatalogEntry[]): ResolvedImportItem[] {
  const items = collectImportItems(character)
  return attachStatMatches(items, matchStatLines(catalog, items.flatMap((item) => item.lines)))
}

/** Item theo base, phân biệt nhiều item cùng base bằng một dòng mod đặc trưng. */
function find(items: ResolvedImportItem[], baseType: string, lineIncludes?: string) {
  const item = items.find((entry) => entry.baseType === baseType && (!lineIncludes || entry.lines.some((line) => line.text.includes(lineIncludes))))
  if (!item) throw new Error(`fixture thiếu item ${baseType} ${lineIncludes ?? ''}`)
  return item
}

/** Filter theo id trong mọi group; trả kèm type group để kiểm and/count. */
function filterOf(query: TradeQuery, id: string) {
  for (const group of query.stats) {
    const filter = group.filters.find((entry) => entry.id === id)
    if (filter) return { group: group.type, groupValue: (group as { value?: { min?: number } }).value, value: filter.value }
  }
  return undefined
}

const P = resolve(poteitik as NinjaCharacter, poe1Catalog)
const A = resolve(allffan as NinjaCharacter, poe1Catalog)
const H = resolve(haruto as NinjaCharacter, poe1Catalog)
const G = resolve(heygyus as NinjaCharacter, poe2Catalog)

describe('dataset thật: gear rare map đủ dòng', () => {
  // Trigger Socketed Spell: item viết "when you Use a Skill", catalog GGG viết "on Using a Skill" — text catalog
  // cũ hơn item nên dòng đó là lỗ đã biết, không xử lý generic được.
  const KNOWN_GAP = /^Trigger a Socketed Spell when you Use a Skill/

  for (const [name, items] of [['Poteitik', P], ['allffan', A], ['Haruto_Allflame', H], ['ResurrectForbidden', G]] as const) {
    it(`${name}: mọi gear rare/magic khớp hết, trừ lỗ đã biết`, () => {
      for (const item of items.filter((entry) => entry.kind === 'gear' && entry.rarity !== 'unique')) {
        const misses = item.lines.filter((_, index) => !item.matches[index]).map((line) => line.text)
        expect(misses.filter((text) => !KNOWN_GAP.test(text)), `${item.slot} · ${item.baseType}`).toEqual([])
      }
    })
    it(`${name}: mọi query dùng status available, rare có rarity nonunique`, () => {
      for (const item of items) {
        const query = buildImportQuery(item, 'exact')
        expect(query.status).toBe('available')
        if (item.rarity === 'unique') {
          expect(query.name).toBe(item.name)
          expect(query.filters).toEqual({})
        } else {
          expect(query.filters).toEqual({ type_filters: { filters: { rarity: { option: 'nonunique' } } } })
        }
      }
    })
  }
})

describe('Poteitik (POE1 Champion): họ section, (Local), damage range, text trùng nhiều id', () => {
  const gloves = find(P, 'Chimerascale Gauntlets')
  const query = buildImportQuery(gloves, 'exact')

  it('implicit giữ section riêng trong group and', () => {
    expect(filterOf(query, 'implicit.stat_3739863694')).toMatchObject({ group: 'and', value: { min: 15 } })
  })

  it('mod nội dung item không pin section: fractured life trên item ra id explicit trong group and', () => {
    // Filter explicit của GGG đã khớp dòng fractured/crafted/desecrated (thí nghiệm ghi trong doc), nên id
    // explicit là đủ và không cần group count gom section.
    expect(filterOf(query, 'explicit.stat_3299347043')).toMatchObject({ group: 'and', value: { min: 105 } })
    expect(filterOf(query, 'fractured.stat_3299347043')).toBeUndefined()
    expect(filterOf(query, 'crafted.stat_3299347043')).toBeUndefined()
  })

  it('crafted "+15% to Fire and Chaos Resistances" trên item cũng ra id explicit', () => {
    expect(filterOf(query, 'explicit.stat_378817135')).toMatchObject({ group: 'and', value: { min: 15 } })
    expect(filterOf(query, 'crafted.stat_378817135')).toBeUndefined()
  })

  it('count group chỉ còn cho text trùng nhiều hash thật, không có id section khác lẫn vào', () => {
    for (const group of query.stats.filter((entry) => entry.type === 'count')) {
      expect(group.filters.every((filter) => filter.id.startsWith('explicit.'))).toBe(true)
      expect(new Set(group.filters.map((filter) => filter.id.split('.stat_')[1])).size).toBeGreaterThan(1)
    }
  })

  it('"63% increased Armour and Evasion" khớp entry có suffix (Local)', () => {
    expect(filterOf(query, 'explicit.stat_2451402625')).toMatchObject({ value: { min: 63 } })
  })

  it('"Adds 3 to 7 Physical Damage to Attacks" lấy trung bình 5; implicit cùng text tách id theo section', () => {
    expect(filterOf(query, 'explicit.stat_3032590688')).toMatchObject({ value: { min: 5 } })
    expect(filterOf(query, 'implicit.stat_3032590688')).toMatchObject({ value: { min: 6.5 } })
  })

  it('"18% increased Attack Speed" trùng text Local/global → một group count min 1 chứa cả hai id', () => {
    const local = filterOf(query, 'explicit.stat_210067635')
    const global = filterOf(query, 'explicit.stat_681332047')
    expect(local).toMatchObject({ group: 'count', groupValue: { min: 1 }, value: { min: 18 } })
    expect(global).toMatchObject({ group: 'count', groupValue: { min: 1 }, value: { min: 18 } })
  })

  it('"+14% chance to Suppress Spell Damage" là hai stat GGG cùng text → count group', () => {
    const boots = buildImportQuery(find(P, 'Wyvernscale Boots'), 'exact')
    expect(filterOf(boots, 'explicit.stat_3680664274')).toMatchObject({ group: 'count', value: { min: 14 } })
    expect(filterOf(boots, 'explicit.stat_492027537')).toMatchObject({ group: 'count', value: { min: 14 } })
  })

  it('cluster jewel: "1 Added Passive Skill is a Jewel Socket" khớp catalog số nhiều; enchant option; entry hai dòng', () => {
    const medium = find(P, 'Medium Cluster Jewel', 'Exerted Attacks')
    expect(matchedCount(medium)).toBe(medium.lines.length)
    const mediumQuery = buildImportQuery(medium, 'exact')
    expect(filterOf(mediumQuery, 'enchant.stat_4079888060')).toMatchObject({ value: { min: 1 } })
    expect(filterOf(mediumQuery, 'enchant.stat_3948993189|28')).toBeDefined()

    const large = find(P, 'Large Cluster Jewel')
    expect(matchedCount(large)).toBe(large.lines.length)
    expect(filterOf(buildImportQuery(large, 'exact'), 'enchant.stat_3948993189|1')).toBeDefined()
  })

  it('unique giữ name + type, không có rarity filter, nhưng vẫn mang stat để phân biệt roll/biến thể', () => {
    const abyssus = P.find((item) => item.name === 'Abyssus')!
    const query = buildImportQuery(abyssus, 'exact')
    expect(query).toMatchObject({ name: 'Abyssus', type: 'Ezomyte Burgonet', filters: {} })
    expect(query.stats.flatMap((group) => group.filters).length).toBeGreaterThan(0)
    // Watcher's Eye: tên không định danh được mod, stat mới là thứ người mua cần.
    const eye = buildImportQuery(P.find((item) => item.name === "Watcher's Eye")!, 'exact')
    expect(eye.name).toBe("Watcher's Eye")
    expect(filterOf(eye, 'explicit.stat_1413864591')).toMatchObject({ value: { min: 45 } })
  })

  it('"-7 to Total Mana Cost" (crafted trên item) ra explicit id với max -7', () => {
    expect(filterOf(buildImportQuery(find(P, 'Amethyst Ring'), 'exact'), 'explicit.stat_677564538')).toMatchObject({ group: 'and', value: { max: -7 } })
  })
})

describe('allffan (POE1 Necromancer): Bone Ring roll âm trên stat tên thuận', () => {
  const ring = find(A, 'Bone Ring', '-139 to maximum Life')
  const query = buildImportQuery(ring, 'exact')

  it('"-139 to maximum Life" và "-63% to Lightning Resistance" vào max, mod minion dương vào min', () => {
    expect(filterOf(query, 'explicit.stat_3299347043')).toMatchObject({ value: { max: -139 } })
    expect(filterOf(query, 'explicit.stat_1671376347')).toMatchObject({ value: { max: -63 } })
    expect(filterOf(query, 'explicit.stat_770672621')).toMatchObject({ value: { min: 39 } })
  })

  it('"Non-Channelling Skills have -10 to Total Mana Cost" là crafted trên item, query dùng explicit id với max -10', () => {
    expect(filterOf(query, 'explicit.stat_677564538')).toMatchObject({ group: 'and', value: { max: -10 } })
    expect(filterOf(query, 'crafted.stat_677564538')).toBeUndefined()
  })

  it('fractured âm và "-1 to Minimum Endurance Charges" cũng vào max, đều qua explicit id', () => {
    const other = buildImportQuery(find(A, 'Bone Ring', '-79% to Lightning Resistance'), 'exact')
    expect(filterOf(other, 'explicit.stat_1671376347')).toMatchObject({ value: { max: -79 } })
    expect(filterOf(other, 'explicit.stat_3706959521')).toMatchObject({ value: { max: -1 } })
  })

  it('any roll: cùng item nhưng không có min/max', () => {
    const any = buildImportQuery(ring, 'any')
    expect(any.stats.flatMap((group) => group.filters).every((filter) => filter.value && Object.keys(filter.value).length === 0)).toBe(true)
  })
})

describe('Haruto_Allflame (POE1 Necromancer): reduced trên stat increased', () => {
  const ring = find(H, 'Bone Ring', 'reduced Cold Damage')
  const query = buildImportQuery(ring, 'exact')

  it('"33% reduced Cold Damage" map vào "#% increased Cold Damage" với max -33', () => {
    expect(filterOf(query, 'explicit.stat_3291658075')).toMatchObject({ value: { max: -33 } })
  })

  it('"-10% to all Elemental Resistances" vào max, "+169 to maximum Life" vào min', () => {
    expect(filterOf(query, 'explicit.stat_2901986750')).toMatchObject({ value: { max: -10 } })
    expect(filterOf(query, 'explicit.stat_3299347043')).toMatchObject({ value: { min: 169 } })
  })
})

describe('ResurrectForbidden (POE2 Gemling): markup [Tag|Text], rune/desecrated, số nhiều', () => {
  it('Blacksteel Gauntlets: rune vào query dạng disabled (người mua tự cắm rune), desecrated ra explicit id', () => {
    const gloves = find(G, 'Blacksteel Gauntlets')
    expect(matchedCount(gloves)).toBe(gloves.lines.length)
    const query = buildImportQuery(gloves, 'exact')
    expect(filterOf(query, 'rune.stat_1671376347')).toMatchObject({ group: 'and', value: { min: 18 } })
    expect(query.stats[0]!.filters.filter((filter) => filter.id.startsWith('rune.')).every((filter) => filter.disabled === true)).toBe(true)
    expect(filterOf(query, 'explicit.stat_3372524247')).toMatchObject({ group: 'and', value: { min: 12 } })
    expect(filterOf(query, 'desecrated.stat_3372524247')).toBeUndefined()
    expect(filterOf(query, 'explicit.stat_4067062424')).toMatchObject({ value: { min: 24 } })
  })

  it('Heavy Belt: "Has 2 Charm Slots" khớp catalog "Has # Charm Slot"', () => {
    expect(filterOf(buildImportQuery(find(G, 'Heavy Belt'), 'exact'), 'implicit.stat_1416292992')).toMatchObject({ value: { min: 2 } })
  })

  it('unique POE2 giữ name + type và mang stat', () => {
    const amulet = G.find((item) => item.name === 'Beacon of Azis')!
    const query = buildImportQuery(amulet, 'exact')
    expect(query).toMatchObject({ name: 'Beacon of Azis', type: 'Solar Amulet', filters: {} })
    expect(query.stats.flatMap((group) => group.filters).length).toBeGreaterThan(0)
  })
})
