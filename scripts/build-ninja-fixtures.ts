// Sinh fixture cho lib/ninja-import.dataset.test.ts từ character THẬT trên poe.ninja.
//
//   bun scripts/build-ninja-fixtures.ts <poe1-stats.json> <poe2-stats.json> [--local <file>=<path/to/full.json> ...]
//
// `--local` dùng một response character đã tải sẵn thay cho fetch mới — giữ snapshot cũ cho file đó
// khi test khác (vd pob-import) đã chốt expectation theo snapshot ấy.
//
// Hai file stats là dump của /api/trade/data/stats và /api/trade2/data/stats (lấy qua page-context
// fetch trên tab trade đã login — không gọi thẳng GGG từ script). Script fetch từng character trong
// DATASET qua API nội bộ của poe.ninja, cắt itemData còn các field parser dùng, rồi cắt catalog stat
// còn: mọi entry đang có trong fixture cũ (superset, test cũ không đổi kết quả) + mọi entry matcher
// khớp với một dòng mod trong dataset + entry cùng 3 từ đầu với một dòng (ứng viên nhiễu để test
// không tự đúng vì catalog quá nhỏ). Snapshot poe.ninja đổi khi người chơi đổi gear — chạy lại
// script là chấp nhận cập nhật expectation trong test theo dataset mới.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { collectImportItems, matchStatLines, ninjaCharacterUrl, ninjaIndexStateUrl, parseNinjaUrl, resolveNinjaSnapshot, type NinjaCharacter, type NinjaIndexState, type NinjaItemData, type NinjaItemEntry, type NinjaSection, type StatCatalogEntry } from '../lib/ninja-import'
import type { Game } from '../types/trading'

const NINJA_SECTIONS: NinjaSection[] = ['implicit', 'explicit', 'fractured', 'crafted', 'enchant', 'desecrated', 'rune']

// Mỗi character được chọn vì mang case cụ thể (ghi ở lib/__fixtures__/README.md).
const DATASET: { file: string; url: string }[] = [
  { file: 'ninja-poe1.json', url: 'https://poe.ninja/poe1/builds/allflame/character/Poteitik-3151/%D0%9F%D0%9E%D0%A2%D0%95%D0%99%D0%A2%D0%98%D0%9A' },
  { file: 'ninja-poe1-allffan.json', url: 'https://poe.ninja/poe1/builds/allflame/character/fang16639-5555/allffan' },
  { file: 'ninja-poe1-haruto.json', url: 'https://poe.ninja/poe1/builds/allflame/character/mark19981213-7010/Haruto_Allflame' },
  { file: 'ninja-poe2.json', url: 'https://poe.ninja/poe2/builds/forbiddenrites/character/heygyus-0416/ResurrectForbidden' },
]

const KEEP: string[] = ['inventoryId', 'name', 'frameTypeId', 'baseType', 'typeLine', 'icon', 'corrupted', 'fractured', 'ilvl',
  'implicitMods', 'explicitMods', 'fracturedMods', 'craftedMods', 'enchantMods', 'desecratedMods', 'runeMods', 'bondedMods']

const fixturesDir = new URL('../lib/__fixtures__/', import.meta.url)
const args = process.argv.slice(2)
const localOverrides = new Map<string, string>()
for (let i = args.indexOf('--local'); i !== -1; i = args.indexOf('--local')) {
  const [file, path] = (args[i + 1] ?? '').split('=')
  if (!file || !path) throw new Error('--local cần dạng <file>=<path>')
  localOverrides.set(file, path)
  args.splice(i, 2)
}
const [poe1StatsPath, poe2StatsPath] = args
if (!poe1StatsPath || !poe2StatsPath) throw new Error('Usage: bun scripts/build-ninja-fixtures.ts <poe1-stats.json> <poe2-stats.json> [--local <file>=<path>]')

type StatsFile = { result: { id: string; label: string; entries: (StatCatalogEntry & { type?: string; option?: unknown })[] }[] }
const fullCatalog: Record<Game, StatsFile> = {
  poe1: JSON.parse(readFileSync(poe1StatsPath, 'utf8')),
  poe2: JSON.parse(readFileSync(poe2StatsPath, 'utf8')),
}

function trim(entry: NinjaItemEntry): NinjaItemEntry {
  const source = entry.itemData as Record<string, unknown>
  const data: Record<string, unknown> = {}
  for (const key of KEEP) if (key in source) data[key] = source[key]
  return { itemSlot: entry.itemSlot, itemData: data as NinjaItemData }
}

async function fetchCharacter(url: string): Promise<NinjaCharacter> {
  const link = parseNinjaUrl(url)
  if (!link) throw new Error(`Bad poe.ninja url: ${url}`)
  const indexState = (await (await fetch(ninjaIndexStateUrl(link.game))).json()) as NinjaIndexState
  const snapshot = resolveNinjaSnapshot(indexState, link.leagueSlug)
  if (!snapshot) throw new Error(`League slug not in index-state: ${link.leagueSlug}`)
  const character = (await (await fetch(ninjaCharacterUrl(link, snapshot))).json()) as NinjaCharacter & { status?: number }
  if (character.status === 404 || !Array.isArray(character.items)) throw new Error(`Character not on ladder: ${url}`)
  return character
}

const linesByGame: Record<Game, string[]> = { poe1: [], poe2: [] }
for (const { file, url } of DATASET) {
  const game = parseNinjaUrl(url)!.game
  const local = localOverrides.get(file)
  const full = local ? (JSON.parse(readFileSync(local, 'utf8')) as NinjaCharacter) : await fetchCharacter(url)
  const trimmed = {
    account: full.account, name: full.name, league: full.league, level: full.level, class: full.class, source: url, fetchedAt: local ? 'local snapshot' : new Date().toISOString().slice(0, 10),
    items: (full.items ?? []).map(trim), jewels: (full.jewels ?? []).map(trim), flasks: (full.flasks ?? []).map(trim),
  }
  writeFileSync(new URL(file, fixturesDir), JSON.stringify(trimmed, null, 1) + '\n')
  linesByGame[game].push(...collectImportItems(trimmed).flatMap((item) => item.lines.map((line) => line.text)))
  console.log(`${file}: ${trimmed.items.length} items, ${trimmed.jewels.length} jewels, ${trimmed.flasks.length} flasks`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

const prefix = (text: string) => text.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
for (const game of ['poe1', 'poe2'] as Game[]) {
  const file = new URL(`trade-stats-${game}.json`, fixturesDir)
  const previous = new Set<string>(existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as StatsFile).result.flatMap((g) => g.entries.map((e) => e.id)) : [])
  const catalog = fullCatalog[game].result.flatMap((g) => g.entries.map(({ id, text }) => ({ id, text })))
  const lines = [...new Set(linesByGame[game])]
  // Thử mọi section poe.ninja có thể gán cho một dòng: dataset đã cắt nên chỉ giữ text, không giữ
  // section gốc; explicit tự lan sang delve/sanctum/... theo SECTION_CANDIDATES của matcher.
  const matched = new Set<string>()
  for (const section of NINJA_SECTIONS) {
    for (const match of matchStatLines(catalog, lines.map((text) => ({ section, text })))) match?.ids.forEach((id) => matched.add(id))
  }
  const prefixes = new Set(lines.map(prefix))
  const keep = fullCatalog[game].result
    .map((g) => ({ ...g, entries: g.entries.filter((e) => previous.has(e.id) || matched.has(e.id) || prefixes.has(prefix(e.text))) }))
    .filter((g) => g.entries.length)
  writeFileSync(file, JSON.stringify({ result: keep }, null, 1) + '\n')
  console.log(`trade-stats-${game}.json: ${keep.reduce((n, g) => n + g.entries.length, 0)} entries (matched ${matched.size}, previous ${previous.size})`)
}
