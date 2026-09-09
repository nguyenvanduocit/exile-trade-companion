// Logic thuần cho "Import from poe.ninja": parse link character, dựng URL API nội bộ của poe.ninja,
// map mod text của item sang trade stat id, rồi dựng TradeQuery cho từng item. Không có I/O —
// fetch nằm ở background (poe.ninja không trả CORS), catalog stat lấy từ window.app.static_ trong
// MAIN world. Chi tiết nghiên cứu: docs/research/2026-09-05-poeninja-import.md.
import type { StatDefinition, StatGroup } from '@/lib/stat-filter'
import type { Game, TradeQuery } from '@/types/trading'

export interface NinjaLink {
  game: Game
  leagueSlug: string
  account: string
  character: string
  timeMachine?: string
}

// https://poe.ninja/{poe1|poe2}/builds/{leagueSlug}/character/{account}/{character}[?i=0]
export function parseNinjaUrl(value: string): NinjaLink | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.hostname !== 'poe.ninja') return null
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
  const [game, builds, leagueSlug, character, account, name] = segments
  if ((game !== 'poe1' && game !== 'poe2') || builds !== 'builds' || character !== 'character') return null
  if (!leagueSlug || !account || !name) return null
  const timeMachine = url.searchParams.get('timemachine')
  return { game, leagueSlug, account, character: name, ...(timeMachine ? { timeMachine } : {}) }
}

export interface NinjaSnapshotVersion {
  url: string
  version: string
  snapshotName: string
}

export interface NinjaIndexState {
  snapshotVersions?: NinjaSnapshotVersion[]
}

export function ninjaIndexStateUrl(game: Game) {
  return `https://poe.ninja/${game}/api/data/index-state`
}

// Một slug có thể xuất hiện nhiều lần với version khác nhau (index đang rebuild) — lấy cái đầu.
export function resolveNinjaSnapshot(indexState: NinjaIndexState, leagueSlug: string): NinjaSnapshotVersion | null {
  return indexState.snapshotVersions?.find((snapshot) => snapshot.url === leagueSlug) ?? null
}

export function ninjaCharacterUrl(link: NinjaLink, snapshot: NinjaSnapshotVersion) {
  const params = new URLSearchParams({ account: link.account, name: link.character, overview: snapshot.snapshotName })
  if (link.timeMachine) params.set('timeMachine', link.timeMachine)
  return `https://poe.ninja/${link.game}/api/builds/${snapshot.version}/character?${params}`
}

export type NinjaFetchError = 'invalid-url' | 'league-not-found' | 'character-not-found' | 'network'

export type NinjaFetchResult =
  | { ok: true; character: NinjaCharacter }
  | { ok: false; reason: NinjaFetchError }

export type NinjaSection = 'implicit' | 'explicit' | 'fractured' | 'crafted' | 'enchant' | 'desecrated' | 'rune' | 'scourge'

export interface NinjaItemData {
  inventoryId?: string
  name?: string
  frameTypeId?: string
  baseType?: string
  typeLine?: string
  icon?: string
  corrupted?: boolean
  implicitMods?: string[]
  explicitMods?: string[]
  fracturedMods?: string[]
  craftedMods?: string[]
  enchantMods?: string[]
  desecratedMods?: string[]
  runeMods?: string[]
}

export interface NinjaItemEntry {
  itemSlot?: number
  itemData: NinjaItemData
}

export interface NinjaCharacter {
  account: string
  name: string
  league: string
  level?: number
  class?: string
  items?: NinjaItemEntry[]
  jewels?: NinjaItemEntry[]
  flasks?: NinjaItemEntry[]
}

// Bỏ markup `[Tag|Text]` / `[Tag]` của POE2 và tách mod nhiều dòng (poe.ninja nối bằng "\n").
export function normalizeModText(raw: string): string[] {
  return raw
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export interface StatLine {
  section: NinjaSection
  text: string
}

export interface StatCatalogEntry {
  id: string
  text: string
}

// Một dòng mod có thể khớp nhiều stat id có text y hệt: biến thể "(Local)" và global (Attack Speed,
// Armour, Evasion, Energy Shield), hoặc hai stat GGG đặt cùng text (Suppress Spell Damage, Spirit,
// Rarity of Items found). Text không phân biệt được nên giữ hết; query đưa chúng vào một group
// `count` min 1 để listing khớp bất kỳ id nào.
export interface StatMatch {
  ids: string[]
  text: string
  value: number | null
}

// knownStatsFlat của site: id -> {text, option?}. Stat có option (vd "Allocates #") phải bung thành
// từng entry `id|optionId` với text đã điền tên option để match được dòng "Allocates Sovereignty".
export function flattenStatCatalog(flat: Record<string, StatDefinition>): StatCatalogEntry[] {
  const entries: StatCatalogEntry[] = []
  for (const [id, definition] of Object.entries(flat)) {
    if (!definition?.text) continue
    const options = (definition.option as { options?: { id: number | string; text: string }[] } | undefined)?.options
    if (options?.length) {
      for (const option of options) entries.push({ id: `${id}|${option.id}`, text: definition.text.replace('#', option.text) })
    } else {
      entries.push({ id, text: definition.text })
    }
  }
  return entries
}

// Người mua cần mod, không cần nguồn của mod, và trade site đã lo việc đó: filter `explicit.<hash>`
// của GGG khớp cả dòng crafted/fractured/desecrated cùng hash (thí nghiệm 2026-09-06 trên site: and
// explicit+fractured life = fractured-alone 1342; explicit+crafted mana cost = 10000 với dòng đều
// stat.crafted; POE2 explicit+desecrated = desecrated-alone 17). Nên mod nội dung item thử section
// THEO THỨ TỰ và lấy section đầu tiên có hit: có text ở explicit thì dùng id explicit; text chỉ có ở
// crafted (bench-only) mới dùng crafted; delve/sanctum/ultimatum/monster/veiled là mod site render
// chung dòng .explicitMod; scourge từ tag {mutated} của PoB. Trong section thắng vẫn giữ mọi id cùng
// text (Local/global, Suppress) cho group count. implicit và enchant là slot khác trên item nên giữ
// riêng; rune (POE2) người mua tự cắm được nên match riêng và vào query dạng filter tắt. Cùng thí
// nghiệm: explicit KHÔNG khớp dòng rune.
const ITEM_CONTENT_SECTIONS = ['explicit', 'crafted', 'fractured', 'desecrated', 'delve', 'sanctum', 'ultimatum', 'monster', 'veiled', 'scourge']

const SECTION_CANDIDATES: Record<NinjaSection, string[]> = {
  explicit: ITEM_CONTENT_SECTIONS,
  crafted: ITEM_CONTENT_SECTIONS,
  fractured: ITEM_CONTENT_SECTIONS,
  desecrated: ITEM_CONTENT_SECTIONS,
  scourge: ITEM_CONTENT_SECTIONS,
  implicit: ['implicit'],
  enchant: ['enchant'],
  rune: ['rune'],
}

const NUMBER = '([+-]?\\d+(?:\\.\\d+)?)'
const INVERSIONS: [string, string][] = [['reduced', 'increased'], ['increased', 'reduced'], ['less', 'more'], ['more', 'less']]

// Catalog ghi "+# to X" nhưng item có thể roll âm ("-7 to X"); catalog ghi "(Local)" mà item không;
// catalog ghi số ít ("Has # Charm Slot") mà item ghi số nhiều ("Has 2 Charm Slots"), hoặc catalog số
// nhiều ("# Added Passive Skills are Jewel Sockets") mà item roll 1 ghi số ít ("1 Added Passive Skill
// is a Jewel Socket") — chữ "s" cuối mỗi từ là tuỳ chọn hai chiều, "are" chấp nhận cả "is a"/"is an".
function compilePattern(text: string): RegExp {
  const source = text
    .replace(/\s*\(Local\)$/, '')
    .replace(/\+#/g, '#')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\bare\b/g, '\u0000')
    .replace(/([A-Za-z])s?(?=\s|,|\\\)|$)/g, '$1s?')
    .replace(/\u0000/g, '(?:are|is an?)')
    .replace(/#/g, NUMBER)
    .replace(/\s+/g, '\\s+')
  return new RegExp(`^${source}(?:\\s*\\(Local\\))?$`, 'i')
}

interface CompiledEntry extends StatCatalogEntry {
  pattern: RegExp
  partial: boolean
}

function toValue(text: string, captures: string[], sign: number): number | null {
  const values = captures.map((capture) => sign * Number(capture))
  if (values.length === 1) return values[0]!
  // Trade so damage range theo trung bình hai đầu, giống parseStatValue ở stat-filter.ts.
  if (values.length === 2 && /[\d#]\s+to\s+[+-]?[\d#].*\bdamage\b/i.test(text)) return (values[0]! + values[1]!) / 2
  return null
}

export function createStatMatcher(catalog: StatCatalogEntry[]): (line: StatLine) => StatMatch | null {
  const bySection = new Map<string, StatCatalogEntry[]>()
  for (const entry of catalog) {
    const section = entry.id.split('.')[0] ?? ''
    const list = bySection.get(section) ?? []
    list.push(entry)
    bySection.set(section, list)
  }
  const compiled = new Map<string, CompiledEntry[]>()
  // poe.ninja tách mod nhiều dòng, nên giữ từng dòng làm fallback. Khớp toàn bộ text được ưu tiên
  // để mod thường không gom thêm id của mod có điều kiện chỉ vì chúng trùng một dòng.
  const entriesFor = (section: string) => {
    let list = compiled.get(section)
    if (!list) {
      list = (bySection.get(section) ?? []).flatMap((entry) => {
        const lines = entry.text.split('\n').map((line) => line.trim()).filter(Boolean)
        const full = { ...entry, pattern: compilePattern(entry.text.replace(/\s*\n\s*/g, ' ')), partial: false }
        return [full, ...(lines.length > 1 ? lines.map((text) => ({ ...entry, pattern: compilePattern(text), partial: true })) : [])]
      })
      compiled.set(section, list)
    }
    return list
  }

  // Thử section theo thứ tự, lấy section đầu tiên có hit; trong section đó gom mọi entry khớp text.
  // `captures` giới hạn số nhóm bắt được (đảo chiều chỉ hợp lệ với stat một số). Trả một match mang
  // toàn bộ id, text và value của entry đầu.
  const collect = (sections: string[], text: string, sign: number, partial: boolean, captures?: number): StatMatch | null => {
    for (const section of sections) {
      let match: StatMatch | null = null
      for (const entry of entriesFor(section)) {
        if (entry.partial !== partial) continue
        const found = text.match(entry.pattern)
        if (!found || (captures !== undefined && found.length !== captures)) continue
        if (match) match.ids.push(entry.id)
        else match = { ids: [entry.id], text: entry.text, value: toValue(text, found.slice(1), sign) }
      }
      if (match) return match
    }
    return null
  }

  return (line) => {
    const text = line.text.replace(/−/g, '-').trim()
    if (!text) return null
    const sections = SECTION_CANDIDATES[line.section]
    for (const partial of [false, true]) {
      const direct = collect(sections, text, 1, partial)
      if (direct) return direct
      for (const [from, to] of INVERSIONS) {
        const alternate = text.replace(new RegExp(`\\b${from}\\b`, 'i'), to)
        if (alternate === text) continue
        const inverted = collect(sections, alternate, -1, partial, 2)
        if (inverted) return inverted
      }
    }
    return null
  }
}

export function matchStatLines(catalog: StatCatalogEntry[], lines: StatLine[]): (StatMatch | null)[] {
  const matcher = createStatMatcher(catalog)
  return lines.map(matcher)
}

export type ImportKind = 'gear' | 'jewel' | 'flask'
export type ImportRarity = 'unique' | 'rare' | 'magic' | 'normal'

export interface ImportItem {
  key: string
  kind: ImportKind
  slot: string
  rarity: ImportRarity
  name: string
  baseType: string
  icon?: string
  corrupted: boolean
  lines: StatLine[]
}

const SECTIONS: [keyof NinjaItemData, NinjaSection][] = [
  ['implicitMods', 'implicit'],
  ['explicitMods', 'explicit'],
  ['fracturedMods', 'fractured'],
  ['craftedMods', 'crafted'],
  ['enchantMods', 'enchant'],
  ['desecratedMods', 'desecrated'],
  ['runeMods', 'rune'],
]

const SLOT_LABELS: Record<string, string> = {
  Helm: 'Helmet',
  BodyArmour: 'Body Armour',
  Gloves: 'Gloves',
  Boots: 'Boots',
  Belt: 'Belt',
  Amulet: 'Amulet',
  Ring: 'Ring',
  Ring2: 'Ring',
  Weapon: 'Weapon',
  Offhand: 'Offhand',
  Weapon2: 'Weapon (swap)',
  Offhand2: 'Offhand (swap)',
  PassiveJewels: 'Jewel',
  Flask: 'Flask',
}

function toRarity(frameTypeId: string | undefined): ImportRarity | null {
  switch (frameTypeId) {
    case 'Unique': return 'unique'
    case 'RunicRare':
    case 'Rare': return 'rare'
    case 'Magic': return 'magic'
    case 'Normal': return 'normal'
    default: return null
  }
}

function toImportItem(entry: NinjaItemEntry, kind: ImportKind, index: number): ImportItem | null {
  const data = entry.itemData
  const rarity = toRarity(data.frameTypeId)
  const baseType = data.baseType?.trim() || data.typeLine?.trim() || ''
  if (!rarity || !baseType) return null
  const slotId = data.inventoryId ?? ''
  const lines: StatLine[] = []
  for (const [field, section] of SECTIONS) {
    const raws = data[field]
    if (!Array.isArray(raws)) continue
    for (const raw of raws) for (const text of normalizeModText(raw)) lines.push({ section, text })
  }
  return {
    key: `${kind}-${index}-${slotId}`,
    kind,
    slot: SLOT_LABELS[slotId] ?? (kind === 'jewel' ? 'Jewel' : kind === 'flask' ? 'Flask' : slotId || 'Item'),
    rarity,
    name: rarity === 'unique' ? data.name?.trim() ?? '' : '',
    baseType,
    icon: data.icon,
    corrupted: Boolean(data.corrupted),
    lines,
  }
}

export function collectImportItems(character: NinjaCharacter): ImportItem[] {
  const groups: [NinjaItemEntry[] | undefined, ImportKind][] = [
    [character.items, 'gear'],
    [character.jewels, 'jewel'],
    [character.flasks, 'flask'],
  ]
  const items: ImportItem[] = []
  for (const [entries, kind] of groups) {
    entries?.forEach((entry, index) => {
      const item = toImportItem(entry, kind, index)
      if (item) items.push(item)
    })
  }
  return items
}

export function importItemLabel(item: ImportItem) {
  if (item.slot === 'Item') return item.name || item.baseType
  return `${item.slot} · ${item.name || item.baseType}`
}

export const DEFAULT_IMPORT_ROLL_PERCENT = 90

export interface ResolvedImportItem extends ImportItem {
  matches: (StatMatch | null)[]
}

// Gắn kết quả match (một mảng phẳng theo đúng thứ tự lines của mọi item) trở lại từng item.
export function attachStatMatches(items: ImportItem[], matches: (StatMatch | null)[]): ResolvedImportItem[] {
  let cursor = 0
  return items.map((item) => {
    const own = matches.slice(cursor, cursor + item.lines.length)
    cursor += item.lines.length
    return { ...item, matches: own }
  })
}

export function matchedCount(item: ResolvedImportItem) {
  return item.matches.filter(Boolean).length
}

// Select trạng thái của site: available = "Instant Buyout and In Person", securable = "Instant Buyout",
// online / onlineleague = "In Person", any. Bookmark import luôn dùng available — mua in person không
// còn ai dùng, và đây là chế độ rộng nhất nên không bỏ sót listing.
export const IMPORT_SEARCH_STATUS = 'available'

function emptyQuery(): TradeQuery {
  return { status: IMPORT_SEARCH_STATUS, name: null, type: null, term: null, disc: null, stats: [], filters: {}, exchange: { want: {}, have: {} } }
}

// Roll âm ("-7 to Total Mana Cost", "15% reduced Attack Speed" map vào stat increased) là stat
// "càng thấp càng tốt": min = -7 sẽ nhận cả -6, -5 và mọi roll dương. Đặt vào max để giữ đúng chiều.
function rollBound(value: number | null, percent: number): { min?: number; max?: number } {
  if (value === null || percent === 0) return {}
  const threshold = Math.round(value * percent) / 100
  return value < 0 ? { max: threshold } : { min: threshold }
}

// Unique: name + base, và vẫn mang stat như rare vì tên không đủ với Watcher's Eye (aura mod),
// Forbidden Flame/Flesh (notable), Timeless Jewel (seed) hay mod Foulborn. Rare/magic: base + rarity
// nonunique. Mọi mod map được: mod một id vào group "and", mod nhiều id (Local/global, hai stat GGG
// cùng text) mỗi mod một group `count` min 1 để listing khớp bất kỳ id nào. Mod rune (POE2)
// người mua tự cắm được nên vào group "and" dạng filter tắt: hiện trên form, user tự bật.
// Ngưỡng theo phần trăm roll của item; 0% chỉ đòi mod có mặt.
export function buildImportQuery(item: ResolvedImportItem, rollPercent = DEFAULT_IMPORT_ROLL_PERCENT): TradeQuery {
  const query = emptyQuery()
  query.type = item.baseType
  if (item.rarity === 'unique') query.name = item.name || null
  else query.filters = { type_filters: { filters: { rarity: { option: 'nonunique' } } } }
  const seen = new Set<string>()
  const and: StatGroup['filters'] = []
  const counts: StatGroup[] = []
  item.matches.forEach((match, index) => {
    if (!match) return
    const key = match.ids.join('|')
    if (seen.has(key)) return
    seen.add(key)
    const value = rollBound(match.value, rollPercent)
    const disabled = item.lines[index]?.section === 'rune'
    const filters = match.ids.map((id) => ({ id, value, disabled }))
    if (filters.length === 1 || disabled) and.push(...filters)
    else counts.push({ type: 'count', value: { min: 1 }, filters })
  })
  query.stats = [...(and.length ? [{ type: 'and', filters: and }] : []), ...counts]
  return query
}
