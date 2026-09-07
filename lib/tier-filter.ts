import snapshot from '@/data/poe2-tiers.json'
import baseTypes from '@/data/poe2-base-types.json'

export interface ModTier {
  tier: number
  ilvl: number | null
  ranges: number[][]
}

export interface TierFamily {
  display: string
  tradeStatId: string | null
  affix: string
  types: string[]
  isAveraged: boolean
  inverted?: boolean
  tiers: ModTier[]
}

export interface TierBound {
  field: 'min' | 'max'
  value: number
}

export interface TierContext {
  category?: string | null
  type?: string | null
  name?: string | null
}

export interface KnownItemGroup {
  entries: { type: string; name?: string }[]
}

// IDs verified against the PoE2 category selector. Unknown categories get no automatic match.
const CATEGORY_TYPES: Record<string, string[]> = {
  'weapon.claw': ['claw'], 'weapon.dagger': ['dagger'],
  'weapon.onesword': ['one-hand-sword'], 'weapon.oneaxe': ['one-hand-axe'],
  'weapon.onemace': ['one-hand-mace'], 'weapon.spear': ['spear'], 'weapon.flail': ['flail'],
  'weapon.twosword': ['two-hand-sword'], 'weapon.twoaxe': ['two-hand-axe'],
  'weapon.twomace': ['two-hand-mace'], 'weapon.warstaff': ['quarterstaff'],
  'weapon.bow': ['bow'], 'weapon.crossbow': ['crossbow'], 'weapon.wand': ['wand'],
  'weapon.sceptre': ['sceptre'], 'weapon.staff': ['staff'],
  'armour.helmet': ['helmet'], 'armour.chest': ['body-armour'],
  'armour.gloves': ['gloves'], 'armour.boots': ['boots'], 'armour.quiver': ['quiver'],
  'armour.shield': ['shield'], 'armour.focus': ['focus'],
  'accessory.amulet': ['amulet'], 'accessory.belt': ['belt'], 'accessory.ring': ['ring'],
  jewel: ['jewel'], 'flask.life': ['life-flask'], 'flask.mana': ['mana-flask'],
  'flask.charm': ['charm'],
}

CATEGORY_TYPES['weapon.onemelee'] = ['claw', 'dagger', 'one-hand-sword', 'one-hand-axe', 'one-hand-mace', 'spear', 'flail']
CATEGORY_TYPES['weapon.twomelee'] = ['two-hand-sword', 'two-hand-axe', 'two-hand-mace', 'quarterstaff']
CATEGORY_TYPES['weapon.ranged'] = ['bow', 'crossbow']
CATEGORY_TYPES['weapon.caster'] = ['wand', 'sceptre', 'staff']
for (const group of ['weapon', 'armour', 'accessory', 'flask']) {
  CATEGORY_TYPES[group] = [...new Set(Object.entries(CATEGORY_TYPES)
    .filter(([key]) => key.startsWith(`${group}.`)).flatMap(([, types]) => types))]
}

const familiesByStat = new Map<string, TierFamily[]>()
for (const family of Object.values(snapshot.stats)) {
  if (!family.tradeStatId?.startsWith('explicit.')) continue
  const families = familiesByStat.get(family.tradeStatId) ?? []
  families.push(family)
  familiesByStat.set(family.tradeStatId, families)
}

const typesByBase = new Map<string, string[]>(Object.entries(baseTypes))

export function resolveTierTypes(context: TierContext, knownItems: KnownItemGroup[] = []): string[] | null {
  const categoryTypes = context.category
    ? (Object.hasOwn(CATEGORY_TYPES, context.category) ? CATEGORY_TYPES[context.category]! : [])
    : null
  let itemTypes: string[] | null = null
  if (context.type) {
    itemTypes = typesByBase.get(context.type) ?? []
  } else if (context.name) {
    const matches = knownItems.flatMap((group) => group.entries)
      .filter((entry) => entry.name === context.name)
    const mapped = matches.map((entry) => typesByBase.get(entry.type))
    itemTypes = mapped.some((types) => !types) ? [] : [...new Set(mapped.flatMap((types) => types ?? []))]
  }
  if (categoryTypes === null) return itemTypes === null ? null : [...itemTypes]
  return itemTypes === null ? [...categoryTypes] : itemTypes.filter((type) => categoryTypes.includes(type))
}

export function getContextTierFamilies(statId: string, context: TierContext, knownItems: KnownItemGroup[] = []): TierFamily[] {
  const types = resolveTierTypes(context, knownItems)
  return (familiesByStat.get(statId) ?? []).flatMap((family) => {
    const matchingTypes = types === null ? [...family.types] : family.types.filter((type) => types.includes(type))
    return matchingTypes.length ? [{ ...family, types: matchingTypes }] : []
  })
}

export function getTierFamilies(statId: string, category?: string | null): TierFamily[] {
  return getContextTierFamilies(statId, { category })
}

export function tierFamilyLabel(family: TierFamily): string {
  const names = family.types.slice(0, 2).map((type) => type.split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
  const remaining = family.types.length > 2 ? ` +${family.types.length - 2}` : ''
  return `${names.join(' / ')}${remaining} (${family.affix})`
}

// Trade compares flat "Adds # to #" damage by the average of its two rolls.
// Inverted stats use MAX: a more negative value is the stronger roll.
export function tierBound(family: TierFamily, tierNumber: number): TierBound | null {
  const tier = family.tiers.find((entry) => entry.tier === tierNumber)
  if (!tier) return null
  const ranges = tier.ranges
  const expectedRanges = family.isAveraged ? 2 : 1
  if (ranges.length !== expectedRanges || ranges.some((range) =>
    range.length !== 2 || !range.every(Number.isFinite) || range[0]! > range[1]!,
  )) return null
  const edge = family.inverted ? 1 : 0
  return {
    field: family.inverted ? 'max' : 'min',
    value: ranges.reduce((sum, range) => sum + range[edge]!, 0) / ranges.length,
  }
}

export function conflictsWithTier(bound: TierBound, opposite: string): boolean {
  if (opposite.trim() === '') return false
  const value = Number(opposite)
  return Number.isFinite(value) && (bound.field === 'min' ? value < bound.value : value > bound.value)
}
