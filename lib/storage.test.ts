import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { orderedFolders, orderedSearches } from './bookmark-order'
import { diffSearchesForFolder, toSharedSearchFields } from './folder-sync'
import type { TradeQuery, TradeState } from '@/types/trading'
import urls from './__fixtures__/price-capture-urls.json'
import { snapshotQueryId } from './price-search-match'

const storage = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        // structuredClone mô phỏng đúng chrome.storage.local.get() thật (đi qua IPC nên luôn trả
        // bản deep-clone) — không clone sẽ khiến các lời gọi readState() chồng lấn vô tình share
        // chung reference và che mất race điều kiện đang test ở describe('concurrent writes').
        get: vi.fn(async (key: string) => ({ [key]: structuredClone(storage.value[key]) })),
        set: vi.fn(async (value: Record<string, unknown>) => Object.assign(storage.value, value)),
      },
    },
  },
}))

import {
  FOLDER_COLORS,
  createFolder,
  nextFolderColor,
  DEFAULT_FOLDER_ID,
  STORAGE_KEY,
  addSharedFolder,
  applyRemoteFolderState,
  isSearchVisible,
  recordSnapshot,
  removeFolder,
  removeSearch,
  saveSearch,
  setExchangeRateCache,
  setFolderShareKey,
  readState,
  moveFolder,
  moveSearch,
  setSearchPurchased,
  importState,
  updateSearch,
  updateFolder,
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
      bulkSellerHighlightEnabled: true, telemetryEnabled: true,
    },
    snapshots: [],
    exchangeRate: null,
    hiddenSearchIds: [],
  }
}

beforeEach(() => {
  storage.value = { [STORAGE_KEY]: makeState() }
})

describe('legacy settings', () => {
  it.each([true, false])('bỏ setting tier picker cũ (%s), giữ dữ liệu còn lại', async (enabled) => {
    const state = await readState()
    state.settings.statFilterButtonsEnabled = false
    storage.value[STORAGE_KEY] = {
      ...state,
      settings: { ...state.settings, tierPickerEnabled: enabled },
    }
    expect(await readState()).toEqual(state)
  })
})

describe('folder storage actions', () => {
  it('reuses an imported bookmark after GGG rewrites its URL and keeps its price history key', async () => {
    const state = makeState()
    const query: TradeQuery = {
      status: 'available', type: 'Emerald', name: null, term: null, disc: null,
      stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 15 }, disabled: false }] }],
      filters: {}, exchange: { want: {}, have: {} },
    }
    const bookmark = { ...state.searches[0]!, game: 'poe2' as const, league: 'Forbidden Rites', url: urls.imported, query }
    state.searches = [bookmark]
    storage.value[STORAGE_KEY] = state
    const saved = await saveSearch({ ...bookmark, url: urls.opened, queryId: 'rewritten-id', query: {
      ...query, stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 15 } }] }],
    } })
    expect(saved.searches).toHaveLength(1)
    expect(saved.searches[0]?.id).toBe(bookmark.id)
    expect(snapshotQueryId(saved.searches[0]!)).toBe(snapshotQueryId(bookmark))
  })

  it('persists a multiline folder note without modifying bookmarks or other folders', async () => {
    const before = await readState()
    await updateFolder('gear', { note: '  Budget: 20 div\nPrioritize boots  ' })
    const after = await readState()
    expect(after.folders.find((folder) => folder.id === 'gear')?.note).toBe('Budget: 20 div\nPrioritize boots')
    expect(after.folders[0]).toEqual(before.folders[0])
    expect(after.searches).toEqual(before.searches)
    await updateFolder('gear', { note: 'Revised budget' })
    expect((await readState()).folders[1]?.note).toBe('Revised budget')
    await updateFolder('gear', { note: '  ' })
    expect((await readState()).folders[1]?.note).toBe('')
  })

  it('ignores note updates for a removed folder', async () => {
    const before = await readState()
    expect(await updateFolder('missing', { note: 'Note' })).toEqual(before)
  })

  it('keeps folder notes through JSON backup and accepts backups without notes', async () => {
    await updateFolder('gear', { note: 'Build notes\nBudget: 20 div' })
    const backup = JSON.parse(JSON.stringify(await readState()))
    await updateFolder('gear', { note: '' })
    await importState(backup)
    expect((await readState()).folders[1]?.note).toBe('Build notes\nBudget: 20 div')
    await importState(makeState())
    expect((await readState()).folders[1]?.note ?? '').toBe('')
  })

  it('trims and saves a renamed folder', async () => {
    const state = await updateFolder('gear', { name: '  Đồ endgame  ' })
    expect(state.folders.find((folder) => folder.id === 'gear')?.name).toBe('Đồ endgame')
  })

  it('keeps the current name when the new one is blank, and updates color independently', async () => {
    const state = await updateFolder('gear', { name: '   ', color: '#123456' })
    const folder = state.folders.find((entry) => entry.id === 'gear')
    expect(folder?.name).toBe('Nâng cấp đồ')
    expect(folder?.color).toBe('#123456')
    expect(folder?.note).toBeUndefined()
  })

  it('creates a folder with name, color and note, appended at the end', async () => {
    const state = await createFolder({ name: '  Boss gear  ', color: '#d290e4', note: '  Budget 30 div  ' })
    const folder = state.folders.at(-1)
    expect(folder).toMatchObject({ name: 'Boss gear', color: '#d290e4', note: 'Budget 30 div', order: 2 })
    expect(folder?.id).toMatch(/^folder/)
  })

  it('omits an empty note when creating a folder', async () => {
    const state = await createFolder({ name: 'Plain', color: '#e67e80', note: '   ' })
    expect(state.folders.at(-1)?.note).toBeUndefined()
  })

  it('cycles the next folder color through the palette', () => {
    expect(nextFolderColor(0)).toBe(FOLDER_COLORS[0])
    expect(nextFolderColor(2)).toBe(FOLDER_COLORS[2])
    expect(nextFolderColor(FOLDER_COLORS.length)).toBe(FOLDER_COLORS[0])
  })

  it('deletes a folder together with its bookmarks', async () => {
    const state = await removeFolder('gear')
    expect(state.folders.map((folder) => folder.id)).toEqual([DEFAULT_FOLDER_ID])
    expect(state.searches).toEqual([])
    expect(state.settings.collapsedFolderIds).toEqual([])
    expect(await readState()).toEqual(state)
  })

  it.each(['gear', DEFAULT_FOLDER_ID])('deletes only contents and hidden IDs belonging to %s', async (folderId) => {
    const initial = makeState()
    const otherFolderId = folderId === 'gear' ? DEFAULT_FOLDER_ID : 'gear'
    const bookmark = initial.searches[0]!
    initial.folders.push({ id: 'bulk', name: 'Bulk', color: '#ccc', order: 2 })
    initial.searches = [
      { ...bookmark, id: 'deleted-visible', folderId, order: 0 },
      { ...bookmark, id: 'deleted-hidden', folderId, order: 1 },
      { ...bookmark, id: 'kept-first', folderId: otherFolderId, order: 0, note: 'Keep me', purchased: true },
      { ...bookmark, id: 'kept-second', folderId: otherFolderId, order: 1 },
      { ...bookmark, id: 'kept-hidden', folderId: 'bulk', order: 0 },
    ]
    initial.hiddenSearchIds = ['deleted-hidden', 'kept-hidden']
    initial.settings.collapsedFolderIds = [folderId, 'bulk']
    storage.value[STORAGE_KEY] = initial
    const before = await readState()

    const state = await removeFolder(folderId)

    expect(state.folders).toEqual(before.folders.filter(folder => folder.id !== folderId)
      .map((folder, order) => ({ ...folder, order })))
    expect(state.searches).toEqual(before.searches.filter(search => search.folderId !== folderId))
    expect(state.hiddenSearchIds).toEqual(['kept-hidden'])
    expect(state.settings.collapsedFolderIds).toEqual(['bulk'])
    expect(await readState()).toEqual(state)
  })

  it('ignores deletion of a missing folder', async () => {
    const before = await readState()
    expect(await removeFolder('missing')).toEqual(before)
    expect(await readState()).toEqual(before)
  })

  it('keeps a surviving shared copy hidden when its ID also belongs to the deleted folder', async () => {
    await setFolderShareKey('gear', 'share_gear')
    const original = (await readState()).searches[0]!
    await addSharedFolder({ id: 'fork', name: 'Fork', color: '#ccc', order: 2 }, [
      { ...original, folderId: 'fork' },
    ])
    await removeSearch(original.id)
    const before = await readState()
    const copy = before.searches.find(search => search.folderId === 'fork')!
    expect(isSearchVisible(before, copy)).toBe(false)

    const after = await removeFolder('gear')

    expect(after.searches).toEqual([copy])
    expect(after.hiddenSearchIds).toEqual([original.id])
    expect(isSearchVisible(after, after.searches[0]!)).toBe(false)
    expect(await readState()).toEqual(after)

    expect((await removeFolder('fork')).hiddenSearchIds).toEqual([])
  })

  it.each(['gear', DEFAULT_FOLDER_ID])('deletes the last folder %s and persists its empty state', async (folderId) => {
    const initial = makeState()
    initial.folders = initial.folders.filter(folder => folder.id === folderId)
    initial.searches[0]!.folderId = folderId
    initial.hiddenSearchIds = ['search-1']
    initial.settings.collapsedFolderIds = [folderId]
    storage.value[STORAGE_KEY] = initial

    const state = await removeFolder(folderId)

    expect(state.folders).toEqual([])
    expect(state.searches).toEqual([])
    expect(state.hiddenSearchIds).toEqual([])
    expect(state.settings.collapsedFolderIds).toEqual([])
    expect(await readState()).toEqual(state)
  })

  it('preserves an empty folder list through backup import and reload', async () => {
    const backup = { ...makeState(), folders: [], searches: [] }

    expect((await importState(backup)).folders).toEqual([])
    expect((await readState()).folders).toEqual([])
  })

  it('creates a new folder after deleting all folders without restoring defaults', async () => {
    await removeFolder('gear')
    await removeFolder(DEFAULT_FOLDER_ID)

    const state = await createFolder({ name: 'New build', color: '#aaa' })

    expect(state.folders).toEqual([
      { id: expect.stringMatching(/^folder-/), name: 'New build', color: '#aaa', order: 0 },
    ])
    expect(state.searches).toEqual([])
    expect(await readState()).toEqual(state)
  })
})

describe('removeSearch', () => {
  it('xoá thật khi folder không share', async () => {
    const state = await removeSearch('search-1')
    expect(state.searches).toHaveLength(0)
    expect(state.hiddenSearchIds).toEqual([])
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
  it.each([false, true])('saves a new bookmark after deleting all folders (new folder: %s)', async (createNewFolder) => {
    await removeFolder('gear')
    await removeFolder(DEFAULT_FOLDER_ID)
    if (createNewFolder) await createFolder({ name: 'New build', color: '#aaa' })

    await saveSearch({
      url: 'https://www.pathofexile.com/trade/search/Standard/new',
      title: 'New boots', game: 'poe1', league: 'Standard', mode: 'search',
    })
    const state = await readState()

    expect(state.folders).toHaveLength(1)
    expect(state.folders[0]?.name).toBe(createNewFolder ? 'New build' : 'Theo dõi')
    expect(state.searches).toHaveLength(1)
    expect(state.searches[0]).toMatchObject({ title: 'New boots', folderId: state.folders[0]!.id })
  })

  it('keeps independent bookmarks when the same URL is saved in two folders', async () => {
    await updateSearch('search-1', { note: 'For build A' })
    await setSearchPurchased('search-1', true)
    const original = (await readState()).searches[0]!
    const input = {
      url: original.url, title: 'For build B', game: original.game,
      league: original.league, mode: original.mode, folderId: DEFAULT_FOLDER_ID,
    }

    await saveSearch(input)
    const saved = await readState()
    expect(saved.searches).toHaveLength(2)
    expect(saved.searches.find((search) => search.id === original.id)).toEqual(original)
    const copy = saved.searches.find((search) => search.folderId === DEFAULT_FOLDER_ID)!
    expect(copy.id).not.toBe(original.id)
    expect(copy.note).toBe('')
    expect(copy.purchased ?? false).toBe(false)

    await saveSearch({ ...input, title: 'Updated build B' })
    const updated = await readState()
    expect(updated.searches).toHaveLength(2)
    expect(updated.searches.find((search) => search.id === copy.id)?.title).toBe('Updated build B')
    expect(updated.searches.find((search) => search.id === original.id)).toEqual(original)

    await removeSearch(copy.id)
    expect((await readState()).searches).toEqual([original])
  })

  it('leaves a hidden shared bookmark untouched when saving its URL in another folder', async () => {
    await setFolderShareKey('gear', 'share_a')
    await removeSearch('search-1')
    const before = await readState()
    const original = before.searches[0]!

    await saveSearch({
      url: original.url, title: original.title, game: original.game,
      league: original.league, mode: original.mode, folderId: DEFAULT_FOLDER_ID,
    })
    const after = await readState()
    expect(after.searches).toHaveLength(2)
    expect(after.hiddenSearchIds).toEqual(['search-1'])
    expect(after.searches.find((search) => search.id === original.id)).toEqual(original)
    expect(diffSearchesForFolder('gear', before.searches, after.searches)).toEqual({ added: [], updated: [], removedIds: [] })

    await saveSearch({
      url: original.url, title: original.title, game: original.game,
      league: original.league, mode: original.mode, folderId: 'gear',
    })
    const restored = await readState()
    expect(restored.searches).toHaveLength(2)
    expect(restored.hiddenSearchIds).toEqual([])
  })

  it('preserves the original when a second folder containing the same URL is deleted', async () => {
    const original = (await readState()).searches[0]!
    const withFolder = await createFolder({ name: 'Build B', color: '#ccc' })
    const folderId = withFolder.folders.at(-1)!.id
    const saved = await saveSearch({
      url: original.url, title: 'Build B boots', game: original.game,
      league: original.league, mode: original.mode, folderId,
    })
    const copy = saved.searches.find((search) => search.folderId === folderId)!

    await removeFolder(folderId)
    const after = await readState()
    expect(after.folders.some((folder) => folder.id === folderId)).toBe(false)
    expect(after.searches).toHaveLength(1)
    expect(after.searches.find((search) => search.id === original.id)).toEqual(original)
    expect(after.searches.some((search) => search.id === copy.id)).toBe(false)
  })

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
  it('receives folder note changes and explicit clearing from remote', async () => {
    await updateFolder('gear', { note: 'Local note' })
    const meta = { name: 'Gear', color: '#aaa', note: 'Shared note\nSecond line' }
    await applyRemoteFolderState('gear', meta, makeState().searches)
    expect((await readState()).folders[1]?.note).toBe(meta.note)
    await applyRemoteFolderState('gear', { ...meta, note: '' }, makeState().searches)
    expect((await readState()).folders[1]?.note).toBe('')
  })

  it('reads legacy room metadata without a note', async () => {
    await applyRemoteFolderState('gear', { name: 'Legacy', color: '#aaa' }, [])
    expect((await readState()).folders[1]?.note).toBe('')
  })

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
    const before = await readState()
    const state = await applyRemoteFolderState('khong-ton-tai', { name: 'x', color: '#000' }, [])
    expect(state).toEqual(before)
  })
})

describe('saveSearch với query đến từ Vue ref (reactive proxy)', () => {
  it('lưu query.stats như mảng thật, không phải object key số', async () => {
    // App.vue giữ query đã capture trong detectedQuery = ref<TradeQuery|null>(...) — Vue 3 tự bọc
    // reactive() quanh mọi object/array gán vào ref. chrome.storage.local.set() thật (không phải
    // mock JSON-passthrough ở đây) từng biến array bọc Proxy này thành object key số ("0","1"...)
    // vì converter phía Chromium không nhận diện Proxy là array. writeState() phải tự cắt reactivity
    // bằng JSON round-trip trước khi set, nên input reactive() ở đây không được ảnh hưởng gì.
    const reactiveQuery = reactive<TradeQuery>({
      status: 'available',
      name: 'Headhunter',
      type: 'Heavy Belt',
      term: null,
      disc: null,
      stats: [{ type: 'and', filters: [{ id: 'explicit.stat_4080418644', value: { min: 40 }, disabled: false }] }],
      filters: {},
      exchange: { want: {}, have: {} },
    })

    await saveSearch({
      url: 'https://www.pathofexile.com/trade2/search/poe2/Standard/hh',
      title: 'Headhunter',
      game: 'poe2',
      league: 'Standard',
      mode: 'search',
      query: reactiveQuery,
    })

    const state = await readState()
    const saved = state.searches.find((search) => search.title === 'Headhunter')
    expect(Array.isArray(saved?.query?.stats)).toBe(true)
    expect(Array.isArray(saved?.query?.stats[0]?.filters)).toBe(true)
    expect(saved?.query?.stats[0]?.filters[0]).toEqual({ id: 'explicit.stat_4080418644', value: { min: 40 }, disabled: false })

    // Đổi tiếp reactiveQuery sau khi đã lưu — nếu writeState còn giữ reference (Proxy) thay vì
    // snapshot, thay đổi này sẽ rò vào state đã lưu.
    reactiveQuery.stats.push({ type: 'and', filters: [] })
    const stateAfterMutation = await readState()
    const savedAfterMutation = stateAfterMutation.searches.find((search) => search.title === 'Headhunter')
    expect(savedAfterMutation?.query?.stats).toHaveLength(1)
  })
})


describe('bookmark organization', () => {
  async function addSearch(id: string, folderId = 'gear') {
    await saveSearch({
      url: `https://www.pathofexile.com/trade/search/Standard/${id}`,
      title: id, game: 'poe1', league: 'Standard', mode: 'search', folderId,
    })
    return (await readState()).searches.find((entry) => entry.title === id)!
  }

  it('migrates legacy searches in their displayed order and preserves that order on edits', async () => {
    const state = makeState()
    state.searches.push({ ...state.searches[0]!, id: 'newer', updatedAt: 5 })
    storage.value[STORAGE_KEY] = state
    expect(orderedSearches((await readState()).searches, 'gear').map((s) => s.id)).toEqual(['newer', 'search-1'])
    await updateSearch('search-1', { title: 'Renamed' })
    expect(orderedSearches((await readState()).searches, 'gear').map((s) => s.id)).toEqual(['newer', 'search-1'])
  })

  it('persists folder order before and after a target without losing contents', async () => {
    await moveFolder('gear', DEFAULT_FOLDER_ID, 'before')
    expect(orderedFolders((await readState()).folders).map((f) => f.id)).toEqual(['gear', DEFAULT_FOLDER_ID])
    await moveFolder('gear', DEFAULT_FOLDER_ID, 'after')
    const state = await readState()
    expect(orderedFolders(state.folders).map((f) => f.id)).toEqual([DEFAULT_FOLDER_ID, 'gear'])
    expect(state.searches[0]?.folderId).toBe('gear')
  })

  it('persists bookmark reordering in both directions and prepends new bookmarks', async () => {
    const second = await addSearch('second')
    await moveSearch('search-1', 'gear', second.id, 'before')
    expect(orderedSearches((await readState()).searches, 'gear').map((s) => s.id)).toEqual(['search-1', second.id])
    await moveSearch('search-1', 'gear', second.id, 'after')
    const third = await addSearch('third')
    expect(orderedSearches((await readState()).searches, 'gear').map((s) => s.id)).toEqual([third.id, second.id, 'search-1'])
  })

  it('moves a bookmark to an empty collapsed folder and opens that folder', async () => {
    const state = makeState()
    state.settings.collapsedFolderIds.push(DEFAULT_FOLDER_ID)
    storage.value[STORAGE_KEY] = state
    await setSearchPurchased('search-1', true)
    await moveSearch('search-1', DEFAULT_FOLDER_ID)
    const result = await readState()
    expect(result.searches).toHaveLength(1)
    expect(result.searches[0]).toMatchObject({ id: 'search-1', folderId: DEFAULT_FOLDER_ID, purchased: true, title: 'Boots' })
    expect(result.settings.collapsedFolderIds).not.toContain(DEFAULT_FOLDER_ID)
  })

  it('inserts across folders before or after the chosen bookmark', async () => {
    const target = await addSearch('target', DEFAULT_FOLDER_ID)
    await moveSearch('search-1', DEFAULT_FOLDER_ID, target.id, 'before')
    expect(orderedSearches((await readState()).searches, DEFAULT_FOLDER_ID).map((s) => s.id)).toEqual(['search-1', target.id])
    await moveSearch('search-1', 'gear')
    await moveSearch('search-1', DEFAULT_FOLDER_ID, target.id, 'after')
    expect(orderedSearches((await readState()).searches, DEFAULT_FOLDER_ID).map((s) => s.id)).toEqual([target.id, 'search-1'])
  })

  it('ignores stale, self, hidden and invalid drop targets', async () => {
    const before = await readState()
    await moveFolder('gear', 'gear')
    await moveFolder('gear', 'missing')
    await moveSearch('missing', DEFAULT_FOLDER_ID)
    await moveSearch('search-1', 'missing')
    await moveSearch('search-1', 'gear', 'search-1')
    await moveSearch('search-1', DEFAULT_FOLDER_ID, 'search-1')
    await moveSearch('search-1', DEFAULT_FOLDER_ID, 'missing')
    expect(await readState()).toEqual(before)
    storage.value[STORAGE_KEY] = { ...before, hiddenSearchIds: ['search-1'] }
    await moveSearch('search-1', DEFAULT_FOLDER_ID)
    expect((await readState()).searches[0]?.folderId).toBe('gear')
  })

  it('roundtrips order and purchased status through backup and allows unchecking', async () => {
    const second = await addSearch('second')
    await moveSearch('search-1', 'gear', second.id)
    await setSearchPurchased('search-1', true)
    const backup = JSON.parse(JSON.stringify(await readState()))
    storage.value = {}
    await importState(backup)
    expect(orderedSearches((await readState()).searches, 'gear').map((s) => s.id)).toEqual(['search-1', second.id])
    expect((await readState()).searches.find((s) => s.id === 'search-1')?.purchased).toBe(true)
    await setSearchPurchased('search-1', false)
    expect((await readState()).searches.find((s) => s.id === 'search-1')?.purchased).toBe(false)
  })

  it('does not broadcast personal order or purchased status to shared folders', async () => {
    const second = await addSearch('second')
    await setFolderShareKey('gear', 'share_test')
    const before = await readState()
    await moveSearch('search-1', 'gear', second.id)
    await setSearchPurchased('search-1', true)
    const after = await readState()
    expect(diffSearchesForFolder('gear', before.searches, after.searches)).toEqual({ added: [], updated: [], removedIds: [] })
    const fields = toSharedSearchFields(after.searches.find((s) => s.id === 'search-1')!)
    expect(fields).not.toHaveProperty('order')
    expect(fields).not.toHaveProperty('purchased')
  })

  it('preserves local order and purchased status when remote content changes', async () => {
    const second = await addSearch('second')
    await moveSearch('search-1', 'gear', second.id)
    await setSearchPurchased('search-1', true)
    await applyRemoteFolderState('gear', { name: 'Updated', color: '#fff' }, [
      { ...second, title: 'Remote title', updatedAt: 100 },
      { ...makeState().searches[0]!, updatedAt: 100 },
    ])
    const result = await readState()
    expect(orderedSearches(result.searches, 'gear').map((s) => s.id)).toEqual(['search-1', second.id])
    expect(result.searches.find((s) => s.id === 'search-1')?.purchased).toBe(true)
    expect(result.searches.find((s) => s.id === second.id)?.title).toBe('Remote title')
  })

  it('moving out of a shared folder keeps the remote original and creates a local copy', async () => {
    await setFolderShareKey('gear', 'share_test')
    const before = await readState()
    await moveSearch('search-1', DEFAULT_FOLDER_ID)
    const after = await readState()
    expect(after.hiddenSearchIds).toContain('search-1')
    expect(after.searches.find((s) => s.id === 'search-1')?.folderId).toBe('gear')
    const visible = after.searches.filter((s) => isSearchVisible(after, s))
    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({ folderId: DEFAULT_FOLDER_ID, title: 'Boots' })
    expect(visible[0]?.id).not.toBe('search-1')
    expect(diffSearchesForFolder('gear', before.searches, after.searches).removedIds).toEqual([])
  })
})

describe('concurrent writes', () => {
  it('không mất thay đổi ở folder khác khi race với applyRemoteFolderState (readState/writeState race)', async () => {
    // Đây chính là bug "share folder xong item liên tục đổi qua đổi lại": folder-sync gọi
    // applyRemoteFolderState() mỗi khi room Liveblocks bắn deep-storage event (kể cả echo của
    // chính client này), song song với thao tác khác của người dùng — cả hai đều đi qua
    // readState()/writeState() trên cùng key browser.storage.local. Không serialize thì hai lời
    // gọi đọc cùng snapshot cũ, ai ghi sau thắng toàn bộ state — đổi tên một folder KHÔNG LIÊN
    // QUAN đến folder đang share cũng bị âm thầm revert theo.
    await Promise.all([
      updateFolder(DEFAULT_FOLDER_ID, { name: 'Renamed locally' }),
      applyRemoteFolderState('gear', { name: 'Đổi tên từ xa', color: '#123456' }, makeState().searches),
    ])
    const result = await readState()
    expect(result.folders.find((folder) => folder.id === DEFAULT_FOLDER_ID)?.name).toBe('Renamed locally')
  })
})
