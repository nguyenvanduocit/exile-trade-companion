import { describe, expect, it } from 'vitest'
import { attachStatMatches, buildImportQuery, collectImportItems, matchStatLines, ninjaCharacterUrl, parseNinjaUrl } from './ninja-import'
import { prepareNinjaSearches } from './ninja-build'

const character = {
  name: 'ResurrectForbidden', account: 'heygyus-0416', league: 'Forbidden Rites',
  items: [
    { itemData: { inventoryId: 'Gloves', frameTypeId: 'RunicRare', baseType: 'Steel Bracers', explicitMods: ['+100 to maximum Life'] } },
    ...['Ring', 'Ring2'].map(inventoryId => ({ itemData: { inventoryId, frameTypeId: 'Rare', baseType: 'Ruby Ring' } })),
  ],
}

describe('ninja build import', () => {
  it('defaults to 90% and scales positive, negative and fractional rolls in every matching filter', async () => {
    const raw = collectImportItems(character)
    raw[0]!.lines = [
      { section: 'explicit', text: '+100 to maximum Life' },
      { section: 'crafted', text: '-7 to Total Mana Cost' },
      { section: 'explicit', text: '+1.25% to Critical Strike Chance' },
      { section: 'enchant', text: 'Allocates Sovereignty' },
      { section: 'rune', text: '10% increased Attack Speed' },
    ]
    const item = attachStatMatches(raw.slice(0, 1), [
      { ids: ['explicit.life', 'explicit.otherLife'], text: '+# to maximum Life', value: 100 },
      { ids: ['explicit.cost'], text: '# to Total Mana Cost', value: -7 },
      { ids: ['explicit.crit'], text: '+#% to Critical Strike Chance', value: 1.25 },
      { ids: ['enchant.allocates|1'], text: 'Allocates Sovereignty', value: null },
      { ids: ['rune.speed'], text: '#% increased Attack Speed', value: 10 },
    ])[0]!
    const defaults = buildImportQuery(item)
    const filters = defaults.stats.flatMap(group => group.filters)
    expect(filters.filter(filter => filter.id.includes('Life') || filter.id === 'explicit.life').map(filter => filter.value)).toEqual([{ min: 90 }, { min: 90 }])
    expect(filters.find(filter => filter.id === 'explicit.cost')?.value).toEqual({ max: -6.3 })
    expect(filters.find(filter => filter.id === 'explicit.crit')?.value).toEqual({ min: 1.13 })
    expect(filters.find(filter => filter.id === 'enchant.allocates|1')?.value).toEqual({})
    expect(filters.find(filter => filter.id === 'rune.speed')).toMatchObject({ value: { min: 9 }, disabled: true })
    const searches = await prepareNinjaSearches([item], 'poe2', character.league, 80)
    expect(searches[0]?.query?.stats.flatMap(group => group.filters).find(filter => filter.id === 'explicit.cost')?.value).toEqual({ max: -5.6 })
    expect(buildImportQuery(item, 0).stats.flatMap(group => group.filters).every(filter => Object.keys(filter.value ?? {}).length === 0)).toBe(true)
  })

  it('includes runic rares and keeps identical gear slots as separate searches', async () => {
    const raw = collectImportItems(character)
    const items = attachStatMatches(raw, matchStatLines([{ id: 'explicit.life', text: '+# to maximum Life' }], raw.flatMap(item => item.lines)))
    const searches = await prepareNinjaSearches(items, 'poe2', character.league, 100)
    expect(searches).toHaveLength(3)
    expect(searches[0]?.query?.stats[0]?.filters[0]).toMatchObject({ id: 'explicit.life', value: { min: 100 } })
    expect(searches[0]?.url).toMatch(/^https:\/\/www.pathofexile.com\/trade2\/search\/Forbidden%20Rites\//)
    const encoded = searches[0]!.url.split('/').at(-1)!
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const payload = JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text())
    expect(payload.type).toBe('Steel Bracers')
    expect(payload.stats[0].filters[0].value).toEqual({ min: 100 })
    expect(searches[1]?.url).toBe(searches[2]?.url)
    const any = await prepareNinjaSearches(items, 'poe1', 'Standard', 0)
    expect(any[0]?.query?.stats[0]?.filters[0]?.value).toEqual({})
    expect(any[0]?.url).toContain('/trade/search/Standard/')
  })

  it('requests the snapshot displayed by Time Machine', () => {
    const link = parseNinjaUrl('https://poe.ninja/poe2/builds/forbiddenrites/character/heygyus-0416/ResurrectForbidden?i=0&timemachine=day-1')!
    expect(link.timeMachine).toBe('day-1')
    const url = new URL(ninjaCharacterUrl(link, { url: 'forbiddenrites', version: 'test', snapshotName: 'forbidden-rites' }))
    expect(url.searchParams.get('timeMachine')).toBe('day-1')
  })
})
