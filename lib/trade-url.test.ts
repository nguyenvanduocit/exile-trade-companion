import { describe, expect, it } from 'vitest'
import { buildDurableUrl, parseTradeUrl } from './trade-url'
import urls from './__fixtures__/price-capture-urls.json'

describe('parseTradeUrl', () => {
  it('generates the same route and serialized query as GGG for the imported Emerald search', async () => {
    async function decode(url: string) {
      const token = url.split('/').at(-1)!
      const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    }
    const raw = JSON.parse(await decode(urls.imported))
    const page = {
      ...parseTradeUrl(urls.imported)!,
      query: {
        status: raw.status.option, name: null, type: raw.type, term: null, disc: null,
        stats: raw.stats, filters: raw.filters, exchange: { have: {}, want: {} },
      },
    }
    const before = JSON.stringify(page)
    const generated = (await buildDurableUrl(page))!
    expect(generated.slice(0, generated.lastIndexOf('/'))).toBe(urls.opened.slice(0, urls.opened.lastIndexOf('/')))
    // gzip implementations can produce different bytes across Node and Chromium.
    // Compare serialized JSON, including key order; browser QA also checks the complete URL.
    expect(await decode(generated)).toBe(await decode(urls.opened))
    expect(JSON.stringify(page)).toBe(before)
  })

  it('parses a Path of Exile 1 search', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade/search/Allflame/abc123', 'Convoking Wand - Path of Exile Trade')).toMatchObject({
      game: 'poe1',
      league: 'Allflame',
      mode: 'search',
      queryId: 'abc123',
      title: 'Convoking Wand',
    })
  })

  it('parses a Path of Exile 2 exchange', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade2/exchange/poe2/Standard/xyz')).toMatchObject({
      game: 'poe2',
      league: 'Standard',
      mode: 'exchange',
      queryId: 'xyz',
    })
  })

  it('rejects lookalike and non-trade URLs', () => {
    expect(parseTradeUrl('https://pathofexile.example/trade/search/Standard/abc')).toBeNull()
    expect(parseTradeUrl('https://www.pathofexile.com/account/view-profile/foo')).toBeNull()
  })
})
