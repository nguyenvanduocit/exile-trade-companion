import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExchangeUrl, fetchExchangeRates, parseExchangeRates } from './exchange-rate'
import { buildPriceLabelParts } from './price-labels'
import type { Game } from '@/types/trading'
import poe2Overview from './__fixtures__/exchange-poe2-forbidden-rites.json'
import poe1Overview from './__fixtures__/exchange-poe1-allflame.json'

describe('buildExchangeUrl', () => {
  it.each(['poe1', 'poe2'] as const)('uses the public %s currency overview', (game) => {
    expect(buildExchangeUrl(game, 'Forbidden Rites'))
      .toBe(`https://poe.ninja/${game}/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=Currency`)
  })

  it('rejects game paths outside the supported games', () => {
    expect(() => buildExchangeUrl('../private' as Game, 'Standard')).toThrow()
  })

  it('encodes league names as query data', () => {
    expect(buildExchangeUrl('poe1', 'A&B#C')).toContain('league=A%26B%23C&type=Currency')
  })
})

describe('parseExchangeRates', () => {
  it('converts the live PoE2 reference currencies to chaos per unit', () => {
    const rates = parseExchangeRates(poe2Overview)
    expect(rates.divine).toBe(12.56)
    expect(rates.chaos).toBe(1)
    expect(rates.exalted).toBe(12.56 / 188.6)
    expect(rates.alch).toBeCloseTo(0.003271 * 12.56)
    expect(229 * rates.divine!).toBeCloseTo(2876.24)
    expect(buildPriceLabelParts(229, 'divine', rates)).toEqual([
      { currency: 'chaos', text: '2.9k' },
    ])
  })

  it('converts the live PoE1 overview while retaining core divine precision', () => {
    const rates = parseExchangeRates(poe1Overview)
    expect(rates.chaos).toBe(1)
    expect(rates.divine).toBe(1 / 0.002808)
    expect(rates.blessed).toBe(0.3061)
  })

  it('supports a PoE1 overview whose primary currency is chaos', () => {
    expect(parseExchangeRates({
      core: { primary: 'chaos', rates: { divine: 0.005 } },
      lines: [{ id: 'divine', primaryValue: 199.9 }, { id: 'alch', primaryValue: 0.2 }],
    })).toEqual({ chaos: 1, divine: 200, alch: 0.2 })
  })

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '12.56'])('rejects an invalid chaos anchor (%s)', (chaos) => {
    expect(parseExchangeRates({
      core: { primary: 'divine', rates: { chaos } },
      lines: [{ id: 'divine', primaryValue: 1 }],
    })).toEqual({})
  })

  it('skips malformed currency amounts and unusable lines', () => {
    expect(parseExchangeRates({
      core: { primary: 'chaos', rates: { zero: 0, negative: -1, infinite: Infinity, tiny: Number.MIN_VALUE } },
      lines: [null, {}, { id: '', primaryValue: 1 },
        { id: 'zero', primaryValue: 0 }, { id: 'negative', primaryValue: -1 },
        { id: 'infinite', primaryValue: Infinity }, { id: 'nan', primaryValue: NaN },
        { id: 'string', primaryValue: '10' }, { id: 'valid', primaryValue: 2 }],
    })).toEqual({ chaos: 1, valid: 2 })
  })

  it.each([null, undefined, [], {}, { core: null }, { core: { primary: 'divine', rates: {} } },
    { result: { a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 1 } }] } } } },
  ])('returns no rates for missing or legacy data', (response) => {
    expect(parseExchangeRates(response)).toEqual({})
  })
})

describe('fetchExchangeRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('gets the full currency overview without credentials and with a 15-second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'Forbidden Rites', name: 'Forbidden Rites' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => poe2Overview })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchExchangeRates('poe2', 'Forbidden Rites')).toEqual(parseExchangeRates(poe2Overview))
    expect(timeout).toHaveBeenCalledWith(15_000)
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://poe.ninja/poe2/api/economy/leagues', expect.objectContaining({ credentials: 'omit' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(buildExchangeUrl('poe2', 'Forbidden Rites'), {
      method: 'GET', credentials: 'omit', signal: expect.any(AbortSignal),
    })
  })

  it('uses the exact economy league id rather than choosing the first league', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [
        { id: 'Other League', name: 'Other League' },
        { id: 'Actual League ID', name: 'Actual League' },
      ] })
      .mockResolvedValueOnce({ ok: true, json: async () => poe2Overview })
    vi.stubGlobal('fetch', fetchMock)
    await fetchExchangeRates('poe2', 'Actual League')
    expect(fetchMock).toHaveBeenLastCalledWith(buildExchangeUrl('poe2', 'Actual League ID'), expect.any(Object))
  })

  it.each(['Unknown', 'Standard', 'HC Other League', ''])('does not request prices for an unmatched league (%s)', async (league) => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ id: 'Other League', name: 'Other League' }] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchExchangeRates('poe2', league)).toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(league ? 1 : 0)
    if (league) expect(fetchMock).toHaveBeenCalledWith('https://poe.ninja/poe2/api/economy/leagues', expect.any(Object))
  })

  it('returns no rates when the matched league overview fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'Standard', name: 'Standard' }] })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchExchangeRates('poe1', 'Standard')).toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns no rates for HTTP errors', async () => {
    const json = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json })))
    expect(await fetchExchangeRates('poe2', 'Standard')).toEqual({})
    expect(json).not.toHaveBeenCalled()
  })

  it('returns no rates for network failures or timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')))
    expect(await fetchExchangeRates('poe2', 'Standard')).toEqual({})
  })

  it('returns no rates for invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })))
    expect(await fetchExchangeRates('poe2', 'Standard')).toEqual({})
  })

  it('does not request unsupported game paths', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchExchangeRates('../private' as Game, 'Standard')).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
