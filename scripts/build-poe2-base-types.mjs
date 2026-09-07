import { readFile, writeFile } from 'node:fs/promises'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/build-poe2-base-types.mjs /path/to/poe2/base_items.json')
const bases = JSON.parse(await readFile(input, 'utf8'))
const tiers = JSON.parse(await readFile(new URL('../data/poe2-tiers.json', import.meta.url), 'utf8'))
const supported = new Set(Object.values(tiers.stats).flatMap((family) => family.types))
const aliases = { Warstaff: 'quarterstaff', UtilityFlask: 'charm' }
const typesByName = new Map()
for (const item of Object.values(bases)) {
  const type = aliases[item.item_class] ?? item.item_class
    .replace(/([a-z])([A-Z])/g, '$1-$2').replaceAll(' ', '-').toLowerCase()
  if (!supported.has(type)) continue
  const types = typesByName.get(item.name) ?? new Set()
  types.add(type)
  typesByName.set(item.name, types)
}
const entries = [...typesByName.keys()].sort().map((name) => [name, [...typesByName.get(name)].sort()])
await writeFile(new URL('../data/poe2-base-types.json', import.meta.url), JSON.stringify(Object.fromEntries(entries), null, 2) + '\n')
console.log(`Wrote ${entries.length} base names`)
