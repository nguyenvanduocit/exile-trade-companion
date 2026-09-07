// Logic thuần cho nguồn import thứ hai: PoB code (dán tay hoặc link pobb.in). Decode base64url +
// zlib thành XML của Path of Building, đọc item text của PoB thành ImportItem cùng shape với
// poe.ninja, để matcher và buildImportQuery ở ninja-import.ts dùng chung.
//
// Format item text của PoB (verify trên export của poe.ninja và pobb.in, 2026-09-06):
//   Rarity: RARE            Rarity: MAGIC
//   <name>                  <typeLine đầy đủ, KHÔNG có dòng base riêng>
//   <base>                  Unique ID: …
//   Unique ID: …            Implicits: N
//   Item Level: 86          <N dòng implicit>
//   Implicits: N            <mod explicit>
//   <N dòng implicit>
//   <mod explicit>
// Tag đầu dòng: {crafted} {fractured} {mutated} (POE1) · {enchant} {rune} (POE2). Enchant POE1
// được PoB ghi là {crafted} nằm trong khối implicit. Item guide có thêm {variant:1,2} + "Selected
// Variant: N" và {range:0.5} với text "(10-20)".
import type { Game } from '@/types/trading'
import type { ImportItem, ImportKind, ImportRarity, NinjaSection, StatLine } from '@/lib/ninja-import'

export interface PobLink {
  kind: 'pobbin'
  url: string
}

// pobb.in/<id> có route /raw trả thẳng code (text/plain, verify 2026-09-06). Trả null nếu không
// phải link pobb.in; code dán tay đi đường looksLikePobCode.
export function parsePobLink(value: string): PobLink | null {
  const match = value.trim().match(/^https?:\/\/(?:www\.)?pobb\.in\/([A-Za-z0-9_-]+)(?:\/raw)?\/?$/)
  return match ? { kind: 'pobbin', url: `https://pobb.in/${match[1]}/raw` } : null
}

export type PobFetchResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'not-found' | 'network' }

export function looksLikePobCode(value: string) {
  const text = value.replace(/\s+/g, '')
  return text.length > 40 && /^[A-Za-z0-9+/_-]+=*$/.test(text)
}

// PoB nén zlib (header 78 9c) rồi base64 với '-' '_' thay '+' '/'. DecompressionStream('deflate')
// của Compression Streams API là zlib format (khác 'deflate-raw'), có trong Chrome và Node.
export async function decodePobCode(code: string): Promise<string> {
  const normalized = code.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Response(stream).text()
}

export interface PobBuild {
  game: Game
  className: string
  ascendClassName: string
  level: number | null
  items: PobItem[]
}

export interface PobItem extends ImportItem {
  // MAGIC/NORMAL không có dòng base trong PoB: typeLine giữ nguyên tên đầy đủ, baseType để trống
  // cho tới khi resolveBaseType tra catalog item của trade site.
  typeLine: string
  equipped: boolean
}

function decodeEntities(text: string) {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return match ? decodeEntities(match[1]!) : undefined
}

const SLOT_LABELS: Record<string, string> = {
  'Weapon 1': 'Weapon',
  'Weapon 2': 'Offhand',
  'Weapon 1 Swap': 'Weapon (swap)',
  'Weapon 2 Swap': 'Offhand (swap)',
  'Ring 1': 'Ring',
  'Ring 2': 'Ring',
  'Ring 3': 'Ring',
}

function slotOf(name: string): { slot: string; kind: ImportKind } {
  if (/Abyssal Socket/.test(name)) return { slot: 'Jewel', kind: 'jewel' }
  if (/^Flask \d/.test(name)) return { slot: 'Flask', kind: 'flask' }
  if (/^Charm \d/.test(name)) return { slot: 'Charm', kind: 'flask' }
  return { slot: SLOT_LABELS[name] ?? name, kind: 'gear' }
}

function kindOfBase(base: string): ImportKind {
  if (/\bJewel\b/.test(base)) return 'jewel'
  if (/\b(Flask|Charm)\b/.test(base)) return 'flask'
  return 'gear'
}

function toRarity(value: string): ImportRarity | null {
  switch (value.toUpperCase()) {
    case 'UNIQUE':
    case 'RELIC': return 'unique'
    case 'RARE': return 'rare'
    case 'MAGIC': return 'magic'
    case 'NORMAL': return 'normal'
    default: return null
  }
}

// Dòng cờ PoB thêm sau khối mod, không phải mod.
const FLAG_LINES = /^(Grants Skill: .*|Rune: .*|Corrupted|Mirrored|Split|Fractured Item|Synthesised Item|Shaper Item|Elder Item|Crusader Item|Redeemer Item|Hunter Item|Warlord Item|Searing Exarch Item|Eater of Worlds Item|Unidentified|Has Alt Variant: .*|Selected Alt Variant: .*|Requires .*|Note: .*|Source: .*|League: .*|Prefix: .*|Suffix: .*)$/

interface ParsedLine {
  section: NinjaSection
  text: string
}

// Tag → section. Trong khối implicit, PoB ghi enchant là {crafted}; ngoài khối implicit {crafted}
// là craft thật. {mutated} là mod scourge. PoB2 không tag crafted/desecrated, nhưng matcher không
// pin section cho mod nội dung item nên dòng không tag đi explicit là đủ.
function sectionOf(tag: string | null, implicit: boolean): NinjaSection {
  if (implicit) return tag === 'crafted' || tag === 'enchant' ? 'enchant' : tag === 'rune' ? 'rune' : tag === 'desecrated' ? 'desecrated' : 'implicit'
  switch (tag) {
    case 'crafted': return 'crafted'
    case 'fractured': return 'fractured'
    case 'enchant': return 'enchant'
    case 'rune': return 'rune'
    case 'desecrated': return 'desecrated'
    case 'mutated': return 'scourge'
    default: return 'explicit'
  }
}

// "(10-20)" với {range:0.5} → 15. PoB làm tròn theo số lẻ của hai đầu.
function resolveRanges(text: string, range: number) {
  return text.replace(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g, (_, low: string, high: string) => {
    const value = Number(low) + (Number(high) - Number(low)) * range
    const decimals = Math.max((low.split('.')[1] ?? '').length, (high.split('.')[1] ?? '').length)
    return value.toFixed(decimals)
  })
}

function parseModLine(raw: string, implicit: boolean, selectedVariants: Set<number>): ParsedLine | null {
  let text = raw
  let section: string | null = null
  let range = 0.5
  let allowed = true
  for (;;) {
    const tag = text.match(/^\{([a-zA-Z]+)(?::([^}]*))?\}/)
    if (!tag) break
    text = text.slice(tag[0].length)
    const [, name, arg] = tag
    if (name === 'variant') allowed = arg!.split(',').some((id) => selectedVariants.has(Number(id)))
    else if (name === 'range') range = Number(arg)
    else if (name === 'tags' || name === 'custom') continue
    else section = name!
  }
  if (!allowed) return null
  text = resolveRanges(decodeEntities(text).trim(), range)
  if (!text || FLAG_LINES.test(text)) return null
  return { section: sectionOf(section, implicit), text }
}

export function parsePobItem(body: string): Omit<PobItem, 'key' | 'slot' | 'kind' | 'equipped'> | null {
  const lines = body.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('<'))
  const rarity = toRarity(lines[0]?.replace(/^Rarity:\s*/, '') ?? '')
  if (!rarity || !lines[1]) return null
  const named = rarity === 'unique' || rarity === 'rare'
  const name = decodeEntities(lines[1])
  const typeLine = named ? decodeEntities(lines[2] ?? '') : name
  const implicitsAt = lines.findIndex((line) => /^Implicits:\s*\d+$/.test(line))
  const header = lines.slice(0, implicitsAt === -1 ? lines.length : implicitsAt)
  const implicitCount = implicitsAt === -1 ? 0 : Number(lines[implicitsAt]!.replace(/^Implicits:\s*/, ''))
  const selected = new Set<number>()
  for (const line of header) {
    const variant = line.match(/^Selected (?:Alt )?Variant:\s*(\d+)$/)
    if (variant) selected.add(Number(variant[1]))
  }
  if (!selected.size) selected.add(1)
  const modLines = implicitsAt === -1 ? [] : lines.slice(implicitsAt + 1)
  const parsed: StatLine[] = []
  let seen = 0
  for (const raw of modLines) {
    const inImplicit = seen < implicitCount
    if (inImplicit) seen++
    const line = parseModLine(raw, inImplicit, selected)
    if (line) parsed.push(line)
  }
  return {
    rarity,
    name: rarity === 'unique' ? name : '',
    baseType: named ? typeLine : '',
    typeLine,
    corrupted: modLines.includes('Corrupted'),
    lines: parsed,
  }
}

// Item text của PoB không có dòng base cho MAGIC/NORMAL ("Flagellant's Diamond Flask of Incision").
// Base là tên dài nhất trong catalog item của trade site xuất hiện nguyên từ trong typeLine.
export function resolveBaseType(typeLine: string, knownBases: string[]): string | null {
  let best: string | null = null
  for (const base of knownBases) {
    if (!base || (best && base.length <= best.length)) continue
    if (new RegExp(`(^|\\s)${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(typeLine)) best = base
  }
  return best
}

export function parsePobXml(xml: string): PobBuild | null {
  const root = xml.match(/<PathOfBuilding(2)?[\s>]/)
  if (!root) return null
  const game: Game = root[1] ? 'poe2' : 'poe1'
  const build = xml.match(/<Build\b[^>]*>/)?.[0] ?? ''
  const level = Number(attr(build, 'level'))

  // Slot của item set đang active; PoB cũ không có <ItemSet>, Slot nằm thẳng dưới <Items>.
  const itemsTag = xml.match(/<Items\b[^>]*>/)?.[0] ?? ''
  const activeSet = attr(itemsTag, 'activeItemSet') ?? '1'
  const setBlock = xml.match(new RegExp(`<ItemSet\\b[^>]*\\bid="${activeSet}"[^>]*>([\\s\\S]*?)</ItemSet>`))?.[1]
    ?? xml.match(/<Items\b[^>]*>([\s\S]*?)<\/Items>/)?.[1] ?? ''
  const slotOfItem = new Map<string, string>()
  for (const slot of setBlock.match(/<Slot\b[^>]*\/>/g) ?? []) {
    const itemId = attr(slot, 'itemId')
    const name = attr(slot, 'name')
    if (itemId && itemId !== '0' && name && !slotOfItem.has(itemId)) slotOfItem.set(itemId, name)
  }
  // Jewel cắm trên tree của spec đang active.
  const treeTag = xml.match(/<Tree\b[^>]*>/)?.[0] ?? ''
  const activeSpec = Number(attr(treeTag, 'activeSpec') ?? '1')
  const specs = xml.match(/<Spec\b[^>]*>[\s\S]*?<\/Spec>/g) ?? []
  const spec = specs[activeSpec - 1] ?? specs[0] ?? ''
  const socketed = new Set<string>()
  for (const socket of spec.match(/<Socket\b[^>]*\/>/g) ?? []) {
    const itemId = attr(socket, 'itemId')
    if (itemId && itemId !== '0') socketed.add(itemId)
  }

  const items: PobItem[] = []
  for (const match of xml.matchAll(/<Item\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/Item>/g)) {
    const [, id, body] = match
    const parsed = parsePobItem(body!)
    if (!parsed) continue
    const slotName = slotOfItem.get(id!)
    const placement = slotName
      ? slotOf(slotName)
      : socketed.has(id!)
        ? { slot: 'Jewel', kind: 'jewel' as const }
        : { slot: 'Unequipped', kind: kindOfBase(parsed.typeLine) }
    items.push({ ...parsed, key: `pob-${id}`, ...placement, equipped: Boolean(slotName) || socketed.has(id!) })
  }
  // Gear trước theo thứ tự slot, rồi jewel, flask, cuối là đồ không đeo.
  const order = (item: PobItem) => (!item.equipped ? 3 : item.kind === 'gear' ? 0 : item.kind === 'jewel' ? 1 : 2)
  items.sort((a, b) => order(a) - order(b))
  return {
    game,
    className: attr(build, 'className') ?? '',
    ascendClassName: attr(build, 'ascendClassName') ?? '',
    level: Number.isFinite(level) && level > 0 ? level : null,
    items,
  }
}
