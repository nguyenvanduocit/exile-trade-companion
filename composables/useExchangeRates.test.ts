import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExchangeRateCache } from '@/types/pricing'

const mocks = vi.hoisted(() => ({
  state: { value: { exchangeRate: null as ExchangeRateCache | null } },
  sendMessage: vi.fn(),
  setExchangeRateCache: vi.fn(),
}))
vi.mock('@/lib/extension-messaging', () => ({ sendMessage: mocks.sendMessage }))
vi.mock('./useTradeStore', () => ({ useTradeStore: () => mocks }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.state.value.exchangeRate = null
  mocks.setExchangeRateCache.mockImplementation(async (cache: ExchangeRateCache) => {
    mocks.state.value.exchangeRate = cache
  })
  mocks.sendMessage.mockResolvedValue({ chaos: 1, divine: 12.56, exalted: 12.56 / 188.6 })
})

describe('useExchangeRates', () => {
  it('replaces the legacy 1:1 cache even when it is fresh', async () => {
    mocks.state.value.exchangeRate = { league: 'Forbidden Rites', fetchedAt: Date.now(), rates: { divine: 1 } }
    const { useExchangeRates } = await import('./useExchangeRates')
    const rates = await useExchangeRates().ensureRates({ game: 'poe2', league: 'Forbidden Rites' })
    expect(rates.divine).toBe(12.56)
    expect(mocks.state.value.exchangeRate).toMatchObject({ game: 'poe2', source: 'poe.ninja', rates: { divine: 12.56 } })
  })

  it('shares the complete quote between labels and snapshots without another request', async () => {
    const { useExchangeRates } = await import('./useExchangeRates')
    const page = { game: 'poe2' as const, league: 'Forbidden Rites' }
    const [labels, snapshot] = await Promise.all([
      useExchangeRates().ensureRates(page),
      useExchangeRates().ensureRates(page),
    ])
    expect(labels).toEqual(snapshot)
    await useExchangeRates().ensureRates(page)
    expect(mocks.sendMessage).toHaveBeenCalledExactlyOnceWith('fetchExchangeRates', page)
    expect(mocks.setExchangeRateCache).toHaveBeenCalledOnce()
  })

  it('does not reuse PoE1 Standard rates for PoE2 Standard', async () => {
    const { useExchangeRates } = await import('./useExchangeRates')
    mocks.sendMessage.mockResolvedValueOnce({ chaos: 1, divine: 200 })
    await useExchangeRates().ensureRates({ game: 'poe1', league: 'Standard' })
    const rates = await useExchangeRates().ensureRates({ game: 'poe2', league: 'Standard' })
    expect(rates.divine).toBe(12.56)
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('keeps page queries out of the rate request and cache', async () => {
    const { useExchangeRates } = await import('./useExchangeRates')
    const page = { game: 'poe2' as const, league: 'Forbidden Rites', query: { name: 'Test item' }, url: 'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/test' }
    await useExchangeRates().ensureRates(page)
    expect(mocks.sendMessage).toHaveBeenCalledExactlyOnceWith('fetchExchangeRates', { game: 'poe2', league: 'Forbidden Rites' })
    expect(Object.keys(mocks.state.value.exchangeRate!).sort()).toEqual(['fetchedAt', 'game', 'league', 'rates', 'source'])
  })

  it('refreshes an expired quote as a whole', async () => {
    const { useExchangeRates } = await import('./useExchangeRates')
    const page = { game: 'poe2' as const, league: 'Forbidden Rites' }
    await useExchangeRates().ensureRates(page)
    mocks.state.value.exchangeRate!.fetchedAt -= 6 * 60 * 60 * 1000
    mocks.sendMessage.mockResolvedValueOnce({ chaos: 1, divine: 15 })
    expect(await useExchangeRates().ensureRates(page)).toEqual({ chaos: 1, divine: 15 })
  })

  it.each([{}, null])('keeps missing quotes unavailable and throttles retries (%j)', async (result) => {
    mocks.sendMessage.mockResolvedValue(result)
    const { useExchangeRates } = await import('./useExchangeRates')
    const page = { game: 'poe2' as const, league: 'Standard' }
    expect(await useExchangeRates().ensureRates(page)).toEqual({})
    expect(await useExchangeRates().ensureRates(page)).toEqual({})
    expect(mocks.setExchangeRateCache).not.toHaveBeenCalled()
    expect(mocks.sendMessage).toHaveBeenCalledOnce()
  })

  it('handles an unavailable background without displaying old rates', async () => {
    mocks.sendMessage.mockRejectedValue(new Error('background unavailable'))
    const { useExchangeRates } = await import('./useExchangeRates')
    expect(await useExchangeRates().ensureRates({ game: 'poe2', league: 'Standard' })).toEqual({})
    expect(mocks.setExchangeRateCache).not.toHaveBeenCalled()
  })
})
