import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExchangeBody, buildExchangeUrl, fetchExchangeRates, parseExchangeRatios } from './exchange-rate'

describe('buildExchangeUrl', () => {
  it('uses /api/trade2/exchange for poe2', () => {
    expect(buildExchangeUrl('poe2', 'Standard')).toBe('https://www.pathofexile.com/api/trade2/exchange/Standard')
  })

  it('uses /api/trade/exchange for poe1', () => {
    expect(buildExchangeUrl('poe1', 'Standard')).toBe('https://www.pathofexile.com/api/trade/exchange/Standard')
  })
})

describe('buildExchangeBody', () => {
  it('wants chaos and lists the given have currencies', () => {
    expect(buildExchangeBody(['divine', 'exalted'])).toEqual({
      query: { status: { option: 'online' }, have: ['divine', 'exalted'], want: ['chaos'] },
      sort: { have: 'asc' },
    })
  })
})

describe('parseExchangeRatios', () => {
  it('computes the median chaos-per-unit ratio for each have currency', () => {
    const response = {
      result: {
        a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 150 } }] } },
        b: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 200 } }] } },
        c: { listing: { offers: [{ exchange: { currency: 'divine', amount: 2 }, item: { currency: 'chaos', amount: 500 } }] } },
      },
    }
    expect(parseExchangeRatios(response)).toEqual({ divine: 200 })
  })

  it('ignores offers that do not resolve to chaos', () => {
    const response = {
      result: {
        a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'exalted', amount: 12 } }] } },
      },
    }
    expect(parseExchangeRatios(response)).toEqual({})
  })

  it('returns an empty map when result is missing', () => {
    expect(parseExchangeRatios({ result: {} })).toEqual({})
  })
})

describe('fetchExchangeRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns {} without calling fetch when currencies is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const rates = await fetchExchangeRates('poe2', 'Standard', [])
    expect(rates).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the built request and parses the response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 180 } }] } },
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const rates = await fetchExchangeRates('poe2', 'Standard', ['divine'])

    expect(rates).toEqual({ divine: 180 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.pathofexile.com/api/trade2/exchange/Standard',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('returns {} when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const rates = await fetchExchangeRates('poe2', 'Standard', ['divine'])
    expect(rates).toEqual({})
  })
})
