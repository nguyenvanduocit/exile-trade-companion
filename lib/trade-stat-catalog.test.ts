import { afterEach, expect, it, vi } from 'vitest'
import { fetchTradeStatCatalog } from './trade-stat-catalog'

afterEach(() => vi.unstubAllGlobals())

it('fetches the selected game catalog, retries failures, expands options and caches success', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
    .mockResolvedValue(new Response(JSON.stringify({ result: [{ entries: [
      { id: 'explicit.life', text: '+# to maximum Life' },
      { id: 'enchant.allocates', text: 'Allocates #', option: { options: [{ id: 1, text: 'Sovereignty' }] } },
    ] }] })))
  vi.stubGlobal('fetch', fetcher)
  expect(await fetchTradeStatCatalog('poe2')).toEqual({ ok: false })
  const result = await fetchTradeStatCatalog('poe2')
  expect(result).toEqual({ ok: true, entries: [
    { id: 'explicit.life', text: '+# to maximum Life' },
    { id: 'enchant.allocates|1', text: 'Allocates Sovereignty' },
  ] })
  expect(await fetchTradeStatCatalog('poe2')).toEqual(result)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://www.pathofexile.com/api/trade2/data/stats')
})
