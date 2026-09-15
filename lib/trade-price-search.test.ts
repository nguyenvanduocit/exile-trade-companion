import { describe, expect, it, vi } from 'vitest'
import type { TradeApp } from './trade-app'
import { readTradePriceSearch } from './trade-price-search'

vi.mock('#i18n', () => ({
  i18n: { t: () => { throw new Error('Extension i18n is unavailable in MAIN world') } },
}))

const url = 'https://www.pathofexile.com/trade/search/Standard/server-id'

function createApp() {
  return {
    $store: {
      state: {
        persistent: {
          status: 'online', name: null, type: 'Boots', term: null, disc: null,
          stats: [], filters: {}, exchange: { have: {}, want: {} },
        },
        transient: {
          search: {
            active: {
              id: 'server-id', type: 'search' as const, realm: 'pc', league: 'Standard',
              query: { status: { option: 'online' }, type: 'Ruby Ring' },
              results: [{ id: 'result-1' }], dirty: false,
            },
          },
        },
      },
      commit: () => {}, watch: () => () => {},
    },
    $refs: {}, save: () => {}, searchRequest: null,
  } satisfies TradeApp
}

describe('submitted search for manual price capture', () => {
  it('reads MAIN-world search data without extension i18n', () => {
    expect(readTradePriceSearch(createApp(), url)?.queryId).toBe('server-id')
  })

  it('reads the loaded search after its durable URL became a server ID', () => {
    expect(readTradePriceSearch(createApp(), url)).toEqual({
      url, queryId: 'server-id', game: 'poe1', league: 'Standard',
      query: { status: { option: 'online' }, type: 'Ruby Ring' },
    })
  })

  it('copies submitted query data without falling back to the editable form', () => {
    const app = createApp()
    const result = readTradePriceSearch(app, url)!
    app.$store.state.transient.search.active.query.status.option = 'any'
    app.$store.state.persistent.type = 'Gloves'

    expect(result.query).toEqual({ status: { option: 'online' }, type: 'Ruby Ring' })
  })

  it('returns the game and decoded league from a valid POE2 result route', () => {
    const app = createApp()
    app.$store.state.transient.search.active.league = 'Forbidden Rites'
    app.$store.state.transient.search.active.realm = 'poe2'
    const poe2Url = 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/server-id'

    expect(readTradePriceSearch(app, poe2Url)).toMatchObject({
      url: poe2Url, game: 'poe2', league: 'Forbidden Rites', queryId: 'server-id',
    })
  })

  it('accepts a canonical route token distinct from the loaded result ID', () => {
    const canonicalUrl = 'https://www.pathofexile.com/trade/search/Standard/canonical-query-blob'
    expect(readTradePriceSearch(createApp(), canonicalUrl)).toMatchObject({
      url: canonicalUrl, queryId: 'server-id',
      query: { status: { option: 'online' }, type: 'Ruby Ring' },
    })
  })

  it.each([
    'https://www.pathofexile.com/trade/search/OtherLeague/server-id',
    'https://www.pathofexile.com/trade2/search/poe2/Standard/server-id',
    'https://www.pathofexile.com/trade/search/Standard',
    'https://www.pathofexile.com/trade/exchange/Standard/server-id',
    'https://example.com/trade/search/Standard/server-id',
  ])('rejects routes without the loaded search: %s', (currentUrl) => {
    expect(readTradePriceSearch(createApp(), currentUrl)).toBeNull()
  })

  it.each([
    { dirty: true },
    { dirty: undefined },
    { type: 'exchange' },
    { id: null },
    { realm: 'poe2' },
    { realm: undefined },
    { results: [] },
    { results: { length: 1 } },
    { query: null },
    { query: [] },
  ])('rejects unavailable or unsubmitted query state: %j', (patch) => {
    const app = createApp()
    Object.assign(app.$store.state.transient.search.active, patch)
    expect(readTradePriceSearch(app, url)).toBeNull()
  })

  it('rejects stale results while a search request is still running', () => {
    const app: TradeApp = createApp()
    app.searchRequest = { abort: () => {} }
    expect(readTradePriceSearch(app, url)).toBeNull()
  })

  it('returns unavailable when the site has no supported active-search state', () => {
    const app: TradeApp = createApp()
    app.$store.state.transient = undefined
    expect(readTradePriceSearch(app, url)).toBeNull()
    expect(readTradePriceSearch(undefined, url)).toBeNull()
  })
})
