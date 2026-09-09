import { describe, expect, it } from 'vitest'
import { buildDonationTradeUrl } from './donation'
import { parseTradeUrl } from './trade-url'

describe('buildDonationTradeUrl', () => {
  it.each([
    ['https://www.pathofexile.com/trade/search/Keepers/old-id', 'trade', 'Keepers'],
    ['https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/old-id', 'trade2', 'Rise%20of%20the%20Abyssal'],
    ['https://www.pathofexile.com/trade2/exchange/Standard/old-id', 'trade2', 'Standard'],
  ])('opens an account-only item search from %s', async (source, root, league) => {
    const page = parseTradeUrl(source)!
    page.query = {
      status: 'online', name: 'Tabula Rasa', type: null, term: null, disc: null,
      stats: [], filters: { type_filters: { filters: { rarity: { option: 'unique' } } } },
      exchange: { have: { chaos: { amount: 10 } }, want: {} },
    }
    const url = await buildDonationTradeUrl(page)
    expect(url).toMatch(new RegExp(`^https://www.pathofexile.com/${root}/search/${league}/[\\w-]+$`))
    const encoded = url!.split('/').pop()!.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    expect(JSON.parse(await new Response(stream).text())).toEqual({
      status: { option: 'any' },
      filters: { trade_filters: { filters: { account: { input: 'hopthuxacnhan#3062' } } } },
    })
    expect(page.query.name).toBe('Tabula Rasa')
  })
})
