import { normalizeModText, type ImportItem, type ImportRarity, type NinjaSection } from '@/lib/ninja-import'

export interface CopiedItem extends ImportItem {
  typeLine: string
}

const RARITIES: Record<string, ImportRarity> = {
  normal: 'normal', magic: 'magic', rare: 'rare', unique: 'unique', relic: 'unique',
}
const MOD_TAG = /\s*\((implicit|explicit|crafted|fractured|enchant|desecrated|rune|scourge)\)$/i
const FLAGS = /^(?:Corrupted|Mirrored|Split|Unidentified|(?:Fractured|Synthesised|Shaper|Elder|Crusader|Redeemer|Hunter|Warlord|Searing Exarch|Eater of Worlds) Item)$/i
const METADATA = /^(?:Item Level:|Quality:|Armour:|Evasion Rating:|Energy Shield:|Requires(?::|\s)|Requirements:|Level:|Str:|Dex:|Int:|Sockets:|Note:)/i

// Clipboard item text uses separator blocks and suffix tags; PoB item text uses Implicits: N.
export function parseCopiedItem(value: string): CopiedItem | null {
  const blocks = value.trim().split(/^\s*-{8,}\s*$/m)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length)
  const header = [...(blocks[0] ?? [])]
  if (header[0]?.startsWith('Item Class:')) header.shift()
  const rarityText = header.shift()?.match(/^Rarity:\s*(\w+)$/i)?.[1]
  const rarity = rarityText ? RARITIES[rarityText.toLowerCase()] : undefined
  if (!rarity) return null
  if (blocks.slice(1).some((block) => block.some((line) => /^Rarity:/i.test(line)))) return null
  const named = rarity === 'rare' || rarity === 'unique'
  if (header.length !== (named ? 2 : 1)) return null
  const typeLine = header[named ? 1 : 0]!
  const levelBlock = blocks.findIndex((block) => block.some((line) => /^Item Level:\s*\d+$/i.test(line)))
  if (levelBlock < 1) return null

  const lines: CopiedItem['lines'] = []
  for (const block of blocks.slice(levelBlock)) {
    // Reminder text, flavour text and usage instructions are separate clipboard blocks.
    if (/^(?:["“(]|Right click\b|Place into\b)/i.test(block[0]!)) continue
    for (const raw of block) {
      if (FLAGS.test(raw) || METADATA.test(raw) || /^\(.*\)$/.test(raw)) continue
      const tag = raw.match(MOD_TAG)
      const section = (tag?.[1]?.toLowerCase() ?? 'explicit') as NinjaSection
      for (const text of normalizeModText(raw.replace(MOD_TAG, ''))) lines.push({ section, text })
    }
  }
  const kind = /\bJewel\b/.test(typeLine) ? 'jewel' : /\b(?:Flask|Charm)\b/.test(typeLine) ? 'flask' : 'gear'
  return {
    key: 'clipboard-item',
    kind,
    slot: kind === 'jewel' ? 'Jewel' : kind === 'flask' ? 'Flask' : 'Item',
    rarity,
    name: rarity === 'unique' ? header[0]! : '',
    baseType: rarity === 'magic' ? '' : typeLine,
    typeLine,
    corrupted: blocks.some((block) => block.some((line) => /^Corrupted$/i.test(line))),
    lines,
  }
}
