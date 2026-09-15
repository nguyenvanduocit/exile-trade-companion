import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultState } from '@/lib/storage'
import type { Game, SavedSearch, TradeState } from '@/types/trading'
import type { PriceSnapshot, TradePriceSearch } from '@/types/pricing'
import { usePriceSnapshot } from './usePriceSnapshot'
import { prepareNinjaSearches } from '@/lib/ninja-build'
import { attachStatMatches, collectImportItems } from '@/lib/ninja-import'
import { buildDurableUrl, parseTradeUrl } from '@/lib/trade-url'
import { snapshotQueryId } from '@/lib/price-search-match'

const mocks = vi.hoisted(() => ({
  state: { value: {} as TradeState },
  recordSnapshot: vi.fn(),
  readListingPrices: vi.fn(),
  ensureRates: vi.fn(),
  sendPriceSearchMessage: vi.fn(),
}))

vi.mock('./useTradeStore', () => ({ useTradeStore: () => mocks }))
vi.mock('./useExchangeRates', () => ({ useExchangeRates: () => mocks }))
vi.mock('@/lib/window-messaging', () => ({ sendPriceSearchMessage: mocks.sendPriceSearchMessage }))
vi.mock('@/lib/price-snapshot', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/price-snapshot')>(),
  readListingPrices: mocks.readListingPrices,
}))

const search: SavedSearch = {
  id: 'saved-1', folderId: 'watchlist', note: '', createdAt: 1, updatedAt: 1,
  url: 'https://www.pathofexile.com/trade/search/Standard/query1',
  title: 'Test search', game: 'poe1', league: 'Standard', mode: 'search', queryId: 'query1',
}

function savedWithQuery(): SavedSearch {
  return { ...search, query: {
    status: 'any', name: null, type: 'Sorcerer Boots', term: null, disc: null,
    stats: [], filters: {}, exchange: { want: {}, have: {} },
  } }
}

function loadedSearch(url: string, query: Record<string, unknown> = { status: { option: 'any' } }): TradePriceSearch {
  const page = parseTradeUrl(url)!
  return { url: page.url, queryId: page.queryId!, game: page.game, league: page.league, query }
}

async function importedSearch(game: Game = 'poe1'): Promise<SavedSearch> {
  const items = attachStatMatches(collectImportItems({
    name: 'Test character', account: 'Test account', league: 'Standard',
    items: [{ itemData: { inventoryId: 'Boots', frameTypeId: 'Rare', baseType: 'Sorcerer Boots' } }],
  }), [])
  const [page] = await prepareNinjaSearches(items, game, 'Standard', 0)
  return { ...search, ...page!, queryId: undefined }
}

const importedQuery = {
  type: 'Sorcerer Boots', status: { option: 'available' },
  filters: { type_filters: { filters: { rarity: { option: 'nonunique' } } } },
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.state.value = { ...createDefaultState(), searches: [{ ...search }] }
  mocks.readListingPrices.mockReturnValue([
    { amount: 1, currency: 'chaos' },
    { amount: 2, currency: 'chaos' },
    { amount: 1, currency: 'divine' },
  ])
  mocks.ensureRates.mockResolvedValue({ divine: 180 })
  mocks.sendPriceSearchMessage.mockResolvedValue(loadedSearch(search.url))
  mocks.recordSnapshot.mockImplementation(async (snapshot: Omit<PriceSnapshot, 'id'>) => {
    mocks.state.value.snapshots.push({ ...snapshot, id: `snapshot-${mocks.state.value.snapshots.length}` })
  })
  vi.stubGlobal('window', { location: { href: search.url } })
})

afterEach(() => vi.unstubAllGlobals())

describe('capture giá thủ công', () => {
  it('lưu theo đúng phiên bản bookmark đã xác minh sau khi chờ bridge', async () => {
    const original = savedWithQuery()
    mocks.state.value.searches = [original]
    mocks.sendPriceSearchMessage.mockImplementation(async () => {
      mocks.state.value.searches = [{ ...original, queryId: 'new-id', query: { ...original.query!, type: 'Emerald' } }]
      return loadedSearch(window.location.href, { status: { option: 'any' }, type: 'Emerald' })
    })

    expect(await usePriceSnapshot().captureSnapshot(original)).toBe('captured')
    expect(mocks.state.value.snapshots[0]?.queryId).toBe('new-id')
  })

  it('capture được bookmark import không có queryId khi mở chính search đó', async () => {
    const imported = await importedSearch()
    const original = structuredClone(imported)
    mocks.state.value.searches = [imported]
    window.location.href = imported.url
    mocks.sendPriceSearchMessage.mockResolvedValue(loadedSearch(imported.url, importedQuery))
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()

    expect(await canCaptureSnapshot(imported)).toBe(true)
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(await captureSnapshot(imported)).toBe('captured')
    expect(mocks.state.value.snapshots[0]?.queryId).toBe(`bookmark:${imported.id}`)
    expect(imported).toEqual(original)
  })

  it('capture được bookmark mở bằng durable URL và giữ khóa lịch sử cũ', async () => {
    const saved = savedWithQuery()
    const original = structuredClone(saved)
    mocks.state.value.searches = [saved]
    window.location.href = (await buildDurableUrl(saved))!
    mocks.sendPriceSearchMessage.mockResolvedValue(loadedSearch(window.location.href, {
      type: 'Sorcerer Boots', status: { option: 'any' }, stats: [{ type: 'and', filters: [] }],
    }))
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()

    expect(await canCaptureSnapshot(saved)).toBe(true)
    expect(await captureSnapshot(saved)).toBe('captured')
    expect(mocks.state.value.snapshots[0]?.queryId).toBe(search.queryId)
    expect(saved).toEqual(original)
  })

  it('capture được import POE2 sau redirect thêm realm và cấp ID server mới', async () => {
    const imported = await importedSearch('poe2')
    mocks.state.value.searches = [imported]
    window.location.href = 'https://www.pathofexile.com/trade2/search/poe2/Standard/new-server-id'
    mocks.sendPriceSearchMessage.mockResolvedValue({
      ...loadedSearch(window.location.href, {
        filters: importedQuery.filters,
        status: importedQuery.status,
        stats: [{ filters: [], type: 'and', disabled: false }],
        type: importedQuery.type,
      }),
      queryId: 'loaded-result-id-different-from-route',
    })
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()

    expect(await canCaptureSnapshot(imported)).toBe(true)
    expect(await captureSnapshot(imported)).toBe('captured')
    expect(mocks.state.value.snapshots[0]?.queryId).toBe(snapshotQueryId(imported))
    expect(mocks.state.value.snapshots[0]?.queryId).not.toBe('new-server-id')
    expect(imported.queryId).toBeUndefined()
    expect(imported.url).not.toBe(window.location.href)
  })

  it('giữ cùng lịch sử khi search đã lưu nhận ID server mới', async () => {
    const saved = savedWithQuery()
    const previous: PriceSnapshot = {
      id: 'previous', queryId: 'query1', capturedAt: 1,
      sampleSize: 3, medianChaos: 1, averageChaos: 1,
    }
    mocks.state.value.searches = [saved]
    mocks.state.value.snapshots = [previous]
    window.location.href = 'https://www.pathofexile.com/trade/search/Standard/new-server-id'
    mocks.sendPriceSearchMessage.mockResolvedValue(loadedSearch(window.location.href, {
      status: { option: 'any' }, type: 'Sorcerer Boots',
    }))

    expect(await usePriceSnapshot().captureSnapshot(saved)).toBe('captured')
    expect(mocks.state.value.snapshots).toHaveLength(2)
    expect(mocks.state.value.snapshots[0]).toEqual(previous)
    expect(mocks.state.value.snapshots.map(snapshot => snapshot.queryId)).toEqual(['query1', 'query1'])
    expect(saved.queryId).toBe('query1')
    expect(saved.url).toBe(search.url)
  })

  it('chỉ đọc và lưu giá khi được yêu cầu, cho phép chụp liên tiếp trong một giờ', async () => {
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
    expect(await canCaptureSnapshot(search)).toBe(true)
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()

    expect(await captureSnapshot(search)).toBe('captured')
    expect(await captureSnapshot(search)).toBe('captured')

    expect(mocks.state.value.snapshots).toHaveLength(2)
    expect(mocks.state.value.snapshots[0]).toMatchObject({
      queryId: 'query1', capturedAt: expect.any(Number),
      sampleSize: 3, medianChaos: 2, averageChaos: 61,
    })
  })

  it.each([
    'https://www.pathofexile.com/trade/search/Standard/other-query',
    'https://www.pathofexile.com/trade/search/OtherLeague/query1',
    'https://www.pathofexile.com/trade2/search/poe2/Standard/query1',
    'https://www.pathofexile.com/trade/exchange/Standard/query1',
    'https://www.pathofexile.com/trade/search/Standard',
    'https://example.com',
  ])('không lấy giá nhầm trang sau khi URL chuyển sang %s', async (url) => {
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()
    expect(await canCaptureSnapshot(search)).toBe(true)
    window.location.href = url

    expect(await canCaptureSnapshot(search)).toBe(false)
    expect(await captureSnapshot(search)).toBe('unavailable')
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
  })

  it.each([
    { queryId: 'other' },
    { url: 'https://www.pathofexile.com/trade/search/Standard/stale-query' },
    { game: 'poe2' as const },
    { league: 'OtherLeague' },
  ])('từ chối phản hồi bridge không khớp trang hiện tại: %j', async (patch) => {
    mocks.sendPriceSearchMessage.mockResolvedValue({ ...loadedSearch(search.url), ...patch })
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()
    expect(await canCaptureSnapshot(search)).toBe(false)
    expect(await captureSnapshot(search)).toBe('unavailable')
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
  })

  it('không lấy giá khi active search chưa sẵn sàng', async () => {
    mocks.sendPriceSearchMessage.mockResolvedValue(null)
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()
    expect(await canCaptureSnapshot(search)).toBe(false)
    expect(await captureSnapshot(search)).toBe('unavailable')
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
  })

  it('từ chối bộ lọc đã gửi khác bookmark dù ID vẫn trùng', async () => {
    const saved = savedWithQuery()
    saved.query!.stats = [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 80 } }] }]
    mocks.state.value.searches = [saved]
    mocks.sendPriceSearchMessage.mockResolvedValue(loadedSearch(saved.url, {
      status: { option: 'any' }, type: 'Sorcerer Boots',
      stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 100 } }] }],
    }))
    const { canCaptureSnapshot, captureSnapshot } = usePriceSnapshot()

    expect(await canCaptureSnapshot(saved)).toBe(false)
    expect(await captureSnapshot(saved)).toBe('unavailable')
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
  })

  it('không đọc DOM khi chuyển trang trong lúc chờ phản hồi bridge', async () => {
    let respond!: (result: TradePriceSearch) => void
    mocks.sendPriceSearchMessage.mockReturnValue(new Promise<TradePriceSearch>((resolve) => { respond = resolve }))
    const capture = usePriceSnapshot().captureSnapshot(search)
    window.location.href = 'https://www.pathofexile.com/trade/search/Standard/other-query'
    respond(loadedSearch(search.url))

    expect(await capture).toBe('unavailable')
    expect(mocks.readListingPrices).not.toHaveBeenCalled()
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
  })

  it.each(['hidden', 'deleted'])('không chụp bookmark đã bị %s', async (state) => {
    if (state === 'hidden') mocks.state.value.hiddenSearchIds = [search.id]
    else mocks.state.value.searches = []

    expect(await usePriceSnapshot().captureSnapshot(search)).toBe('unavailable')
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
  })

  it.each([
    { listings: [] },
    { listings: [{ amount: 1, currency: 'chaos' }, { amount: 2, currency: 'chaos' }] },
    { listings: [{ amount: 1, currency: 'chaos' }, { amount: 2, currency: 'chaos' }, { amount: 1, currency: 'unknown' }] },
  ])('báo thiếu mẫu khi chưa có đủ 3 giá quy đổi được: %j', async ({ listings }) => {
    mocks.readListingPrices.mockReturnValue(listings)
    expect(await usePriceSnapshot().captureSnapshot(search)).toBe('insufficient-listings')
    expect(mocks.recordSnapshot).not.toHaveBeenCalled()
  })

  it('trả lỗi lưu trữ cho giao diện thông báo và cho phép thử lại', async () => {
    mocks.recordSnapshot.mockRejectedValueOnce(new Error('storage unavailable'))
    const { captureSnapshot } = usePriceSnapshot()
    await expect(captureSnapshot(search)).rejects.toThrow('storage unavailable')
    expect(await captureSnapshot(search)).toBe('captured')
    expect(mocks.state.value.snapshots).toHaveLength(1)
  })
})
