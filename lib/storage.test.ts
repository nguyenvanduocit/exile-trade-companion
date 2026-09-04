import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TradeQuery, TradeState } from '@/types/trading'

const storage = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage.value[key] })),
        set: vi.fn(async (value: Record<string, unknown>) => Object.assign(storage.value, value)),
      },
    },
  },
}))

import {
  DEFAULT_FOLDER_ID,
  STORAGE_KEY,
  addSharedFolder,
  applyRemoteFolderState,
  isSearchVisible,
  markWatchlistSeen,
  recordSnapshot,
  recordWatchlistCount,
  removeFolder,
  removeSearch,
  renameFolder,
  saveSearch,
  setExchangeRateCache,
  setFolderShareKey,
} from './storage'

function makeState(): TradeState {
  return {
    version: 1,
    folders: [
      { id: DEFAULT_FOLDER_ID, name: 'Theo dõi', color: '#aaa', order: 0 },
      { id: 'gear', name: 'Nâng cấp đồ', color: '#bbb', order: 1 },
    ],
    searches: [{
      id: 'search-1',
      folderId: 'gear',
      url: 'https://www.pathofexile.com/trade/search/Standard/abc',
      title: 'Boots',
      game: 'poe1',
      league: 'Standard',
      mode: 'search',
      note: '',
      createdAt: 1,
      updatedAt: 1,
    }],
    history: [],
    settings: {
      maxHistory: 50,
      collapsedFolderIds: ['gear'],
      hasOpenedPanel: false,
      statFilterButtonsEnabled: true,
      propertyFilterButtonsEnabled: true,
      priceLabelsEnabled: true,
      highlightSearchedModsEnabled: true,
    },
    snapshots: [],
    exchangeRate: null,
    hiddenSearchIds: [],
    watchlistState: {},
  }
}

beforeEach(() => {
  storage.value = { [STORAGE_KEY]: makeState() }
})

describe('folder storage actions', () => {
  it('trims and saves a renamed folder', async () => {
    const state = await renameFolder('gear', '  Đồ endgame  ')
    expect(state.folders.find((folder) => folder.id === 'gear')?.name).toBe('Đồ endgame')
  })

  it('moves bookmarks to the default folder before deleting a folder', async () => {
    const state = await removeFolder('gear')
    expect(state.folders.map((folder) => folder.id)).toEqual([DEFAULT_FOLDER_ID])
    expect(state.searches[0]?.folderId).toBe(DEFAULT_FOLDER_ID)
    expect(state.settings.collapsedFolderIds).toEqual([])
  })

  it('keeps the last folder', async () => {
    storage.value = {
      [STORAGE_KEY]: {
        ...makeState(),
        folders: [makeState().folders[0]],
      },
    }

    const state = await removeFolder(DEFAULT_FOLDER_ID)
    expect(state.folders).toHaveLength(1)
  })
})

describe('removeSearch', () => {
  it('xoá thật khi folder không share', async () => {
    const state = await removeSearch('search-1')
    expect(state.searches).toHaveLength(0)
    expect(state.hiddenSearchIds).toEqual([])
  })

  it('dọn watchlistState khi xoá thật search', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      watchlistState: { 'search-1': { lastCount: 5, lastNotifiedAt: 100, seen: true } },
    }

    const state = await removeSearch('search-1')
    expect(state.watchlistState).toEqual({})
  })

  it('chỉ ẩn cục bộ khi folder đang share-live, không xoá khỏi searches', async () => {
    storage.value = {
      [STORAGE_KEY]: {
        ...makeState(),
        folders: [
          makeState().folders[0]!,
          { ...makeState().folders[1]!, shareKey: 'share_a' },
        ],
      },
    }

    const state = await removeSearch('search-1')
    expect(state.searches.map((s) => s.id)).toEqual(['search-1'])
    expect(state.hiddenSearchIds).toEqual(['search-1'])
    expect(isSearchVisible(state, state.searches[0]!)).toBe(false)
  })
})

describe('saveSearch', () => {
  it('un-hide lại khi lưu đè đúng URL đã bị ẩn trước đó', async () => {
    storage.value = {
      [STORAGE_KEY]: {
        ...makeState(),
        folders: [
          makeState().folders[0]!,
          { ...makeState().folders[1]!, shareKey: 'share_a' },
        ],
        hiddenSearchIds: ['search-1'],
      },
    }

    const state = await saveSearch({
      url: 'https://www.pathofexile.com/trade/search/Standard/abc',
      title: 'Boots (updated)',
      game: 'poe1',
      league: 'Standard',
      mode: 'search',
    })

    expect(state.hiddenSearchIds).toEqual([])
    expect(isSearchVisible(state, state.searches[0]!)).toBe(true)
  })

  it('lưu kèm raw query để dựng lại durable URL sau này, kể cả khi queryId hết hạn', async () => {
    const query: TradeQuery = {
      status: 'any',
      name: 'Tabula Rasa',
      type: null,
      term: null,
      disc: null,
      stats: [{ type: 'and', filters: [] }],
      filters: {},
      exchange: { want: {}, have: {} },
    }

    const state = await saveSearch({
      url: 'https://www.pathofexile.com/trade/search/Standard/new',
      title: 'Tabula Rasa',
      game: 'poe1',
      league: 'Standard',
      mode: 'search',
      query,
    })

    expect(state.searches[0]?.query).toEqual(query)
  })
})

describe('recordSnapshot', () => {
  it('adds a snapshot for a query with no prior snapshots', async () => {
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 100, sampleSize: 10, medianChaos: 5, averageChaos: 6 })
    expect(state.snapshots).toHaveLength(1)
    expect(state.snapshots[0]).toMatchObject({ queryId: 'q1', capturedAt: 100, sampleSize: 10, medianChaos: 5, averageChaos: 6 })
    expect(state.snapshots[0]!.id).toBeTruthy()
  })

  it('keeps only the newest 90 snapshots per query (FIFO)', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      snapshots: Array.from({ length: 90 }, (_, i) => ({
        id: `old-${i}`, queryId: 'q1', capturedAt: i, sampleSize: 10, medianChaos: 1, averageChaos: 1,
      })),
    }
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 999, sampleSize: 10, medianChaos: 9, averageChaos: 9 })
    const forQuery = state.snapshots.filter((s) => s.queryId === 'q1')
    expect(forQuery).toHaveLength(90)
    expect(forQuery[0]!.capturedAt).toBe(999)
    expect(forQuery.some((s) => s.id === 'old-0')).toBe(false)
  })

  it('does not affect snapshots of other queries', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      snapshots: [{ id: 'other', queryId: 'q2', capturedAt: 1, sampleSize: 10, medianChaos: 1, averageChaos: 1 }],
    }
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 2, sampleSize: 10, medianChaos: 2, averageChaos: 2 })
    expect(state.snapshots.find((s) => s.queryId === 'q2')).toBeTruthy()
    expect(state.snapshots).toHaveLength(2)
  })
})

describe('setExchangeRateCache', () => {
  it('stores the exchange rate cache', async () => {
    const state = await setExchangeRateCache({ league: 'Standard', fetchedAt: 123, rates: { divine: 180 } })
    expect(state.exchangeRate).toEqual({ league: 'Standard', fetchedAt: 123, rates: { divine: 180 } })
  })
})

describe('setFolderShareKey', () => {
  it('gán shareKey cho folder', async () => {
    const state = await setFolderShareKey('gear', 'share_abc')
    expect(state.folders.find((folder) => folder.id === 'gear')?.shareKey).toBe('share_abc')
  })

  it('xoá shareKey khi truyền undefined', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      folders: [
        { ...makeState().folders[0]!, shareKey: 'share_abc' },
        makeState().folders[1]!,
      ],
    }
    const state = await setFolderShareKey(DEFAULT_FOLDER_ID, undefined)
    expect(state.folders.find((folder) => folder.id === DEFAULT_FOLDER_ID)?.shareKey).toBeUndefined()
  })
})

describe('addSharedFolder', () => {
  it('thêm folder mới kèm search của nó vào state', async () => {
    const newFolder = { id: 'joined-1', name: 'Từ bạn bè', color: '#e67e80', order: 2, shareKey: 'share_xyz' }
    const newSearch: TradeState['searches'][number] = {
      id: 'remote-search-1',
      folderId: 'joined-1',
      url: 'https://www.pathofexile.com/trade/search/Standard/xyz',
      title: 'Chest',
      game: 'poe1',
      league: 'Standard',
      mode: 'search',
      note: '',
      createdAt: 5,
      updatedAt: 5,
    }
    const state = await addSharedFolder(newFolder, [newSearch])
    expect(state.folders.find((folder) => folder.id === 'joined-1')).toEqual(newFolder)
    expect(state.searches.find((search) => search.id === 'remote-search-1')).toEqual(newSearch)
  })
})

describe('applyRemoteFolderState', () => {
  it('ghi đè meta folder và thay toàn bộ search của folder đó bằng dữ liệu remote', async () => {
    const state = await applyRemoteFolderState(
      'gear',
      { name: 'Đổi tên từ xa', color: '#123456' },
      [{
        id: 'search-1',
        folderId: 'gear',
        url: 'https://www.pathofexile.com/trade/search/Standard/abc',
        title: 'Boots (updated)',
        game: 'poe1',
        league: 'Standard',
        mode: 'search',
        note: 'ghi chú mới',
        createdAt: 1,
        updatedAt: 9,
      }],
    )
    const folder = state.folders.find((entry) => entry.id === 'gear')
    expect(folder?.name).toBe('Đổi tên từ xa')
    expect(folder?.color).toBe('#123456')
    expect(state.searches.filter((search) => search.folderId === 'gear')).toHaveLength(1)
    expect(state.searches.find((search) => search.id === 'search-1')?.title).toBe('Boots (updated)')
  })

  it('bỏ qua nếu folder không còn tồn tại local', async () => {
    const before = storage.value[STORAGE_KEY]
    const state = await applyRemoteFolderState('khong-ton-tai', { name: 'x', color: '#000' }, [])
    expect(state).toEqual(before)
  })
})

describe('recordWatchlistCount', () => {
  it('thiết lập baseline cho lần report đầu tiên, không báo isNew', async () => {
    const { isNew, state } = await recordWatchlistCount('search-1', 7)
    expect(isNew).toBe(false)
    expect(state.watchlistState['search-1']).toEqual({ lastCount: 7, lastNotifiedAt: 0, seen: true })
  })

  it('báo isNew và đánh dấu chưa xem khi số listing tăng so với lần trước', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      watchlistState: { 'search-1': { lastCount: 5, lastNotifiedAt: 50, seen: true } },
    }

    const { isNew, state } = await recordWatchlistCount('search-1', 8)
    expect(isNew).toBe(true)
    expect(state.watchlistState['search-1']?.lastCount).toBe(8)
    expect(state.watchlistState['search-1']?.seen).toBe(false)
    expect(state.watchlistState['search-1']?.lastNotifiedAt).toBeGreaterThan(50)
  })

  it('không báo isNew và giữ nguyên seen/lastNotifiedAt khi số listing không tăng', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      watchlistState: { 'search-1': { lastCount: 5, lastNotifiedAt: 50, seen: true } },
    }

    const { isNew, state } = await recordWatchlistCount('search-1', 3)
    expect(isNew).toBe(false)
    expect(state.watchlistState['search-1']).toEqual({ lastCount: 3, lastNotifiedAt: 50, seen: true })
  })
})

describe('markWatchlistSeen', () => {
  it('đánh dấu đã xem', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      watchlistState: { 'search-1': { lastCount: 5, lastNotifiedAt: 50, seen: false } },
    }

    const state = await markWatchlistSeen('search-1')
    expect(state.watchlistState['search-1']?.seen).toBe(true)
  })

  it('không làm gì nếu search chưa từng có watchlistState', async () => {
    const before = storage.value[STORAGE_KEY]
    const state = await markWatchlistSeen('khong-ton-tai')
    expect(state).toEqual(before)
  })
})
