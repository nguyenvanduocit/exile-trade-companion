import { describe, expect, it } from 'vitest'
import type { TradePage, TradeQuery } from '@/types/trading'
import { buildDurableUrl, parseTradeUrl } from './trade-url'

async function decodeDurableSegment(url: string): Promise<unknown> {
  const segment = url.split('/').pop()!
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text())
}

function makeQuery(overrides: Partial<TradeQuery> = {}): TradeQuery {
  return {
    status: 'any',
    name: null,
    type: null,
    term: null,
    disc: null,
    stats: [{ type: 'and', filters: [] }],
    filters: {},
    exchange: { want: {}, have: {} },
    ...overrides,
  }
}

describe('parseTradeUrl', () => {
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

describe('buildDurableUrl', () => {
  const basePage: Omit<TradePage, 'query'> = {
    url: 'https://www.pathofexile.com/trade/search/Standard/expired-id',
    title: 'Stat search',
    game: 'poe1',
    league: 'Standard',
    mode: 'search',
  }

  it('returns null when the bookmark never captured a query (fallback to original url)', async () => {
    await expect(buildDurableUrl(basePage)).resolves.toBeNull()
  })

  it('round-trips a search query into a self-contained URL, matching the shape GGG accepts', async () => {
    const page: TradePage = {
      ...basePage,
      query: makeQuery({
        name: 'Tabula Rasa',
        stats: [{ type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
      }),
    }

    const url = await buildDurableUrl(page)
    expect(url).toMatch(/^https:\/\/www\.pathofexile\.com\/trade\/search\/Standard\/[\w-]+$/)

    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({
      status: { option: 'any' },
      name: 'Tabula Rasa',
      stats: [{ type: 'and', filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
    })
  })

  it('encodes poe2 exchange mode as currency id arrays, dropping amounts', async () => {
    const page: TradePage = {
      ...basePage,
      game: 'poe2',
      mode: 'exchange',
      query: makeQuery({
        exchange: { have: { chaos: { amount: null } }, want: { divine: { amount: null } } },
      }),
    }

    const url = await buildDurableUrl(page)
    expect(url).toMatch(/^https:\/\/www\.pathofexile\.com\/trade2\/exchange\/Standard\/[\w-]+$/)

    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' }, have: ['chaos'], want: ['divine'] })
  })

  it('omits empty/default fields entirely — the site rejects payloads that include them explicitly', async () => {
    const url = await buildDurableUrl({ ...basePage, query: makeQuery() })
    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' } })
  })

  it('tolerates a non-array stats captured from the site\'s own state (window.app is third-party, not contract-guaranteed)', async () => {
    const page: TradePage = {
      ...basePage,
      query: makeQuery({ stats: {} as unknown as TradeQuery['stats'] }),
    }

    const url = await buildDurableUrl(page)
    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' } })
  })
})
