import { describe, expect, it } from 'vitest'
import {
  buildSavedSearch,
  diffFolderMeta,
  diffSearchesForFolder,
  generateShareKey,
  isBlankFolderMeta,
  isShareKeyInUse,
  planRoomChanges,
  resolveShareMode,
  toSharedFolderMeta,
  toSharedSearchFields,
} from './folder-sync'
import type { SavedSearch, SearchFolder } from '@/types/trading'

function makeSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    folderId: 'folder-1',
    url: 'https://www.pathofexile.com/trade/search/Standard/abc',
    title: 'Boots',
    game: 'poe1',
    league: 'Standard',
    mode: 'search',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function makeFolder(overrides: Partial<SearchFolder> = {}): SearchFolder {
  return { id: 'folder-1', name: 'Watchlist', color: '#aaa', order: 0, ...overrides }
}

describe('generateShareKey', () => {
  it('sinh key có prefix share_ và khác nhau mỗi lần gọi', () => {
    const a = generateShareKey()
    const b = generateShareKey()
    expect(a.startsWith('share_')).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('toSharedSearchFields / buildSavedSearch', () => {
  it('roundtrip giữ nguyên mọi field trừ id và folderId', () => {
    const search = makeSearch()
    const fields = toSharedSearchFields(search)
    expect(fields).not.toHaveProperty('id')
    expect(fields).not.toHaveProperty('folderId')
    expect(buildSavedSearch('search-1', 'folder-1', fields)).toEqual(search)
  })
})

describe('toSharedFolderMeta', () => {
  it('lấy name, color và mode được truyền vào', () => {
    expect(toSharedFolderMeta(makeFolder({ name: 'Gear', color: '#fff' }), 'live')).toEqual({ name: 'Gear', color: '#fff', note: '', mode: 'live' })
    expect(toSharedFolderMeta(makeFolder({ name: 'Gear', color: '#fff', note: 'Budget: 20 div\nUpgrade boots' }), 'once')).toEqual({ name: 'Gear', color: '#fff', note: 'Budget: 20 div\nUpgrade boots', mode: 'once' })
  })
})

describe('resolveShareMode', () => {
  it('trả "once" khi meta ghi rõ mode once', () => {
    expect(resolveShareMode({ mode: 'once' })).toBe('once')
  })

  it('trả "live" khi meta ghi rõ mode live', () => {
    expect(resolveShareMode({ mode: 'live' })).toBe('live')
  })

  it('mặc định "live" khi meta không có field mode (room share từ trước khi có tính năng này)', () => {
    expect(resolveShareMode({})).toBe('live')
  })
})

describe('isBlankFolderMeta', () => {
  it('true khi tên rỗng hoặc toàn khoảng trắng (room vừa được Liveblocks tự tạo lại, chưa có seed)', () => {
    expect(isBlankFolderMeta({ name: '' })).toBe(true)
    expect(isBlankFolderMeta({ name: '   ' })).toBe(true)
  })

  it('false khi có tên thật', () => {
    expect(isBlankFolderMeta({ name: 'Watchlist' })).toBe(false)
  })
})

describe('diffSearchesForFolder', () => {
  it('phát hiện search mới thêm', () => {
    const prev: SavedSearch[] = []
    const next = [makeSearch()]
    const diff = diffSearchesForFolder('folder-1', prev, next)
    expect(diff.added).toEqual(next)
    expect(diff.updated).toEqual([])
    expect(diff.removedIds).toEqual([])
  })

  it('phát hiện search bị xoá', () => {
    const prev = [makeSearch()]
    const next: SavedSearch[] = []
    const diff = diffSearchesForFolder('folder-1', prev, next)
    expect(diff.removedIds).toEqual(['search-1'])
  })

  it('phát hiện search đổi updatedAt là updated, giữ nguyên updatedAt thì bỏ qua', () => {
    const prev = [makeSearch({ updatedAt: 1 })]
    const changed = [makeSearch({ updatedAt: 2, note: 'x' })]
    expect(diffSearchesForFolder('folder-1', prev, changed).updated).toEqual(changed)
    expect(diffSearchesForFolder('folder-1', prev, prev).updated).toEqual([])
  })

  it('bỏ qua search thuộc folder khác', () => {
    const prev: SavedSearch[] = []
    const next = [makeSearch({ folderId: 'folder-2' })]
    expect(diffSearchesForFolder('folder-1', prev, next).added).toEqual([])
  })
})

describe('diffFolderMeta', () => {
  it('trả null khi name và color không đổi', () => {
    expect(diffFolderMeta(makeFolder(), makeFolder())).toBeNull()
  })

  it('trả meta mới khi name hoặc color đổi', () => {
    const next = makeFolder({ name: 'Renamed' })
    expect(diffFolderMeta(makeFolder(), next)).toEqual({ name: 'Renamed' })
  })

  it('syncs note edits and deletion without overwriting other metadata', () => {
    const before = makeFolder({ note: 'Old note' })
    expect(diffFolderMeta(before, makeFolder({ note: 'New note\nSecond line' }))).toEqual({ note: 'New note\nSecond line' })
    expect(diffFolderMeta(before, makeFolder({ note: '' }))).toEqual({ note: '' })
    expect(diffFolderMeta(before, makeFolder())).toEqual({ note: '' })
  })

  it('treats a missing legacy note as empty and ignores local folder fields', () => {
    expect(diffFolderMeta(makeFolder(), makeFolder({ note: '', order: 3, shareKey: 'share_new' }))).toBeNull()
  })
})

describe('planRoomChanges', () => {
  it('kết nối room mới cho folder có shareKey chưa active', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' }), makeFolder({ id: 'f2' })]
    const plan = planRoomChanges([], folders)
    expect(plan.toConnect).toEqual([{ folderId: 'f1', shareKey: 'share_a' }])
    expect(plan.toDisconnect).toEqual([])
  })

  it('ngắt room không còn folder nào tham chiếu (đã xoá folder hoặc unshare)', () => {
    const folders = [makeFolder({ id: 'f2' })]
    const plan = planRoomChanges(['share_a'], folders)
    expect(plan.toConnect).toEqual([])
    expect(plan.toDisconnect).toEqual(['share_a'])
  })

  it('không đổi gì khi room đang active vẫn khớp folder hiện tại', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' })]
    const plan = planRoomChanges(['share_a'], folders)
    expect(plan.toConnect).toEqual([])
    expect(plan.toDisconnect).toEqual([])
  })
})

describe('isShareKeyInUse', () => {
  it('true khi đã có folder local dùng đúng key đó (đang share hoặc đã join trước đó)', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' })]
    expect(isShareKeyInUse(folders, 'share_a')).toBe(true)
  })

  it('false khi chưa folder nào dùng key đó', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' }), makeFolder({ id: 'f2' })]
    expect(isShareKeyInUse(folders, 'share_b')).toBe(false)
  })

  it('false khi không có folder nào share (shareKey undefined)', () => {
    const folders = [makeFolder({ id: 'f1' })]
    expect(isShareKeyInUse(folders, 'share_a')).toBe(false)
  })
})
