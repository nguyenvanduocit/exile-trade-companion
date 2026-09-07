import { describe, expect, it } from 'vitest'
import type { SharedTradePage, SharedTradeQuery } from './types'
import { buildDurableUrl } from './trade-url'

async function decodeDurableSegment(url: string): Promise<unknown> {
  const segment = url.split('/').pop()!
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text())
}

function makeQuery(overrides: Partial<SharedTradeQuery> = {}): SharedTradeQuery {
  return {
    status: 'any',
    name: null,
    type: null,
    term: null,
    disc: null,
    stats: [{ filters: [] }],
    filters: {},
    exchange: { want: {}, have: {} },
    ...overrides,
  }
}

describe('buildDurableUrl', () => {
  const basePage: Omit<SharedTradePage, 'query'> = {
    url: 'https://www.pathofexile.com/trade/search/Standard/expired-id',
    title: 'Stat search',
    game: 'poe1',
    league: 'Standard',
    mode: 'search',
  }

  it('returns null when there is no query to encode', async () => {
    await expect(buildDurableUrl(basePage)).resolves.toBeNull()
  })

  it('round-trips a search query into a self-contained URL, matching the shape GGG accepts', async () => {
    const page: SharedTradePage = {
      ...basePage,
      query: makeQuery({
        name: 'Tabula Rasa',
        stats: [{ filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
      }),
    }

    const url = await buildDurableUrl(page)
    expect(url).toMatch(/^https:\/\/www\.pathofexile\.com\/trade\/search\/Standard\/[\w-]+$/)

    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({
      status: { option: 'any' },
      name: 'Tabula Rasa',
      stats: [{ filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
    })
  })

  it('encodes poe2 exchange mode as currency id arrays, dropping amounts', async () => {
    const page: SharedTradePage = {
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
    const page: SharedTradePage = {
      ...basePage,
      query: makeQuery({ stats: {} as unknown as SharedTradeQuery['stats'] }),
    }

    const url = await buildDurableUrl(page)
    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' } })
  })
})
