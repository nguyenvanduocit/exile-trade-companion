import { describe, expect, it } from 'vitest'
import snapshot from '@/data/poe2-tiers.json'
import { conflictsWithTier, getContextTierFamilies, getTierFamilies, resolveTierTypes, tierBound, tierFamilyLabel, type KnownItemGroup, type TierFamily } from './tier-filter'

const life = 'explicit.stat_3299347043'

describe('tier families', () => {
  it('uses different life ladders for boots and body armour', () => {
    const boots = getTierFamilies(life, 'armour.boots')
    const chest = getTierFamilies(life, 'armour.chest')
    expect(boots).toHaveLength(1)
    expect(chest).toHaveLength(1)
    expect(tierBound(boots[0]!, 1)).toEqual({ field: 'min', value: 120 })
    expect(tierBound(chest[0]!, 1)).toEqual({ field: 'min', value: 200 })
    expect(boots[0]!.types).toEqual(['boots'])
    expect(tierFamilyLabel(boots[0]!)).toBe('Boots (prefix)')
  })

  it('does not mutate shared family types when narrowing a category', () => {
    const original = getTierFamilies(life).map((family) => [...family.types])
    getTierFamilies(life, 'armour.boots')
    expect(getTierFamilies(life).map((family) => family.types)).toEqual(original)
  })

  it('keeps broad-category labels within that category and bounds their length', () => {
    const armour = getTierFamilies(life, 'armour')
    expect(armour.flatMap((family) => family.types)).not.toContain('amulet')
    expect(armour.flatMap((family) => family.types)).not.toContain('belt')
    const family = { ...armour[0]!, types: ['one-hand-sword', 'one-hand-axe', 'one-hand-mace', 'shield'] }
    expect(tierFamilyLabel(family)).toBe('One Hand Sword / One Hand Axe +2 (prefix)')
  })

  it('keeps all candidate ladders for an unspecified or broad category', () => {
    expect(getTierFamilies(life).length).toBeGreaterThan(1)
    expect(getTierFamilies(life, 'armour').length).toBeGreaterThan(1)
    expect(getTierFamilies(life, 'armour').every((f) =>
      f.types.some((type) => ['gloves', 'boots', 'helmet', 'body-armour', 'shield'].includes(type)),
    )).toBe(true)
  })

  it('does not guess data for incompatible, unknown or non-explicit filters', () => {
    for (const category of ['weapon.bow', 'map.tablet', 'armour.buckler', 'new-category']) {
      expect(getTierFamilies(life, category)).toEqual([])
    }
    for (const id of ['pseudo.stat_3299347043', 'implicit.stat_3299347043', 'desecrated.stat_3299347043', 'explicit.unknown']) {
      expect(getTierFamilies(id)).toEqual([])
    }
  })

  it('keeps affix ladders separate instead of inventing combined tiers', () => {
    const families = getTierFamilies('explicit.stat_3917489142', 'accessory.ring')
    expect(new Set(families.map((family) => family.affix))).toEqual(new Set(['prefix', 'suffix']))
  })
})

describe('tier item context', () => {
  const knownItems: KnownItemGroup[] = [{ entries: [
    { name: 'Svalinn', type: 'Crucible Tower Shield' },
    { name: 'Shared Name', type: 'Crucible Tower Shield' },
    { name: 'Shared Name', type: 'Absent Amulet' },
    { name: 'Partial Name', type: 'Crucible Tower Shield' },
    { name: 'Partial Name', type: 'Unknown New Base' },
  ] }]

  it('resolves a selected unique using its exact base type', () => {
    const context = { name: 'Svalinn', type: 'Crucible Tower Shield' }
    expect(resolveTierTypes(context)).toEqual(['shield'])
    const families = getContextTierFamilies(life, context)
    expect(families).toHaveLength(1)
    expect(families[0]!.types).toEqual(['shield'])
    expect(tierFamilyLabel(families[0]!)).toBe('Shield (prefix)')
  })

  it('resolves base-only searches and name-only catalogue entries', () => {
    expect(resolveTierTypes({ type: 'Absent Amulet' })).toEqual(['amulet'])
    expect(resolveTierTypes({ name: 'Svalinn' }, knownItems)).toEqual(['shield'])
    expect(resolveTierTypes({ name: 'Shared Name' }, knownItems)).toEqual(['shield', 'amulet'])
    expect(resolveTierTypes({ name: 'Shared Name', category: 'armour' }, knownItems)).toEqual(['shield'])
  })

  it('intersects selected items with explicit and broad categories', () => {
    expect(resolveTierTypes({ type: 'Crucible Tower Shield', category: 'armour' })).toEqual(['shield'])
    expect(resolveTierTypes({ name: 'Svalinn', category: 'armour.shield' }, knownItems)).toEqual(['shield'])
    expect(resolveTierTypes({ type: 'Crucible Tower Shield', category: 'armour.boots' })).toEqual([])
    expect(resolveTierTypes({ type: 'Crucible Tower Shield', category: 'new-category' })).toEqual([])
    expect(resolveTierTypes({ type: 'Crucible Tower Shield', category: 'constructor' })).toEqual([])
  })

  it('does not guess unknown bases, partial names, or partially mapped variants', () => {
    for (const context of [
      { type: 'Unknown New Base' },
      { name: 'Sval' },
      { name: 'Unknown Unique', category: 'armour.shield' },
      { name: 'Partial Name' },
      { name: 'Svalinn', type: 'Unknown New Base' },
    ]) expect(resolveTierTypes(context, knownItems)).toEqual([])
    expect(resolveTierTypes({ name: 'Svalinn' })).toEqual([])
  })

  it('restores all families when both selected item and category are cleared', () => {
    expect(resolveTierTypes({ category: 'armour.boots' })).toEqual(['boots'])
    expect(resolveTierTypes({ category: null, name: null, type: null })).toBeNull()
    expect(getContextTierFamilies(life, {})).toEqual(getTierFamilies(life))
    expect(getContextTierFamilies(life, {}).length).toBeGreaterThan(1)
    expect(getContextTierFamilies(life, { type: 'Unknown New Base' })).toEqual([])
  })
})

describe('numeric thresholds', () => {
  it('averages the minimum of both flat damage rolls, retaining half steps', () => {
    const family = getTierFamilies('explicit.stat_1037193709', 'weapon.bow')[0]!
    expect(tierBound(family, 1)).toEqual({ field: 'min', value: 91 })
    const fractional = { ...family, tiers: [{ tier: 1, ilvl: 1, ranges: [[10, 20], [21, 40]] }] }
    expect(tierBound(fractional, 1)).toEqual({ field: 'min', value: 15.5 })
  })

  it('fills MAX for inverted mods, allowing more-negative stronger rolls', () => {
    const family: TierFamily = {
      ...getTierFamilies(life)[0]!, inverted: true,
      tiers: [{ tier: 1, ilvl: 1, ranges: [[-30, -25]] }],
    }
    expect(tierBound(family, 1)).toEqual({ field: 'max', value: -25 })
  })

  it('rejects missing tiers and malformed ranges instead of filling NaN', () => {
    const family = getTierFamilies(life)[0]!
    expect(tierBound(family, 999)).toBeNull()
    for (const ranges of [[], [[10]], [[20, 10]], [[NaN, 10]], [[1, Infinity]], [[1, 2], [3, 4]]]) {
      expect(tierBound({ ...family, tiers: [{ tier: 1, ilvl: 1, ranges }] }, 1)).toBeNull()
    }
  })

  it('only clears an opposite bound that would exclude the selected threshold', () => {
    const min = { field: 'min' as const, value: 120 }
    expect(conflictsWithTier(min, '119')).toBe(true)
    for (const value of ['', ' ', '120', '200']) expect(conflictsWithTier(min, value)).toBe(false)
    const max = { field: 'max' as const, value: -25 }
    expect(conflictsWithTier(max, '-20')).toBe(true)
    expect(conflictsWithTier(max, '-30')).toBe(false)
  })

  it('validates every bundled explicit ladder', () => {
    for (const family of Object.values(snapshot.stats)) {
      if (!family.tradeStatId) continue
      expect(family.tradeStatId).toMatch(/^explicit\.stat_\d+$/)
      expect(family.types.length).toBeGreaterThan(0)
      expect(family.tiers.length).toBeGreaterThan(0)
      expect(new Set(family.tiers.map((tier) => tier.tier)).size).toBe(family.tiers.length)
      for (const tier of family.tiers) {
        expect(tierBound(family, tier.tier), `${family.display} T${tier.tier}`).not.toBeNull()
      }
    }
  })
})
