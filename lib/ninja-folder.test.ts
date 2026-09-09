import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { createDefaultState, readState, replaceFolderContents, writeState } from './storage'
import { diffSearchesForFolder } from './folder-sync'
import type { SaveSearchInput } from '@/types/trading'

const item: SaveSearchInput = {
  url: 'https://www.pathofexile.com/trade2/search/Standard/test', title: 'Ring', game: 'poe2', league: 'Standard', mode: 'search',
  query: { status: 'available', name: null, type: 'Ruby Ring', term: null, disc: null, stats: [], filters: {}, exchange: { want: {}, have: {} } },
}

beforeEach(async () => { await writeState(createDefaultState()) })

describe('replace character folder contents', () => {
  it('creates a named folder and keeps two identical items without URL deduplication', async () => {
    await replaceFolderContents('ResurrectForbidden', [item, item])
    const state = await readState()
    const folder = state.folders.find(folder => folder.name === 'ResurrectForbidden')!
    expect(folder.id).toMatch(/^folder-/)
    expect(state.searches.map(search => search.folderId)).toEqual([folder.id, folder.id])
    expect(new Set(state.searches.map(search => search.id)).size).toBe(2)
  })

  it('preserves every folder field and replaces shared content in one write, including hidden items', async () => {
    await replaceFolderContents('ResurrectForbidden', [item])
    const initial = await readState()
    const folder = initial.folders.find(folder => folder.name === 'ResurrectForbidden')!
    Object.assign(folder, { shareKey: 'share_keep_this', note: 'My notes', color: '#abcdef', order: 8 })
    initial.hiddenSearchIds = [initial.searches[0]!.id, 'unrelated-hidden']
    initial.searches.push({ ...initial.searches[0]!, id: 'unrelated', folderId: 'watchlist' })
    initial.settings.collapsedFolderIds.push(folder.id)
    await writeState(initial)
    const before = await readState()
    const write = vi.spyOn(browser.storage.local, 'set')
    await replaceFolderContents(folder.name, [item, { ...item, title: 'Boots' }])
    expect(write).toHaveBeenCalledTimes(1)
    write.mockRestore()
    const after = await readState()
    expect(after.folders).toEqual(before.folders)
    expect(after.settings).toEqual(before.settings)
    expect(after.hiddenSearchIds).toEqual(['unrelated-hidden'])
    expect(after.searches.find(search => search.id === 'unrelated')).toEqual(before.searches.find(search => search.id === 'unrelated'))
    const diff = diffSearchesForFolder(folder.id, before.searches, after.searches)
    expect(diff.added).toHaveLength(2)
    expect(diff.removedIds).toEqual([before.searches[0]!.id])
    expect(after.searches.filter(search => search.folderId === folder.id).map(search => search.order)).toEqual([0, 1])
    await replaceFolderContents(folder.name, [item])
    const again = await readState()
    expect(again.folders).toEqual(before.folders)
    expect(again.searches.filter(search => search.folderId === folder.id)).toHaveLength(1)
  })

  it('leaves existing data untouched when the import is empty or incomplete', async () => {
    const before = await readState()
    await expect(replaceFolderContents('Build', [])).rejects.toThrow('invalid-folder-import')
    await expect(replaceFolderContents('Build', [{ ...item, url: '' }])).rejects.toThrow('invalid-folder-import')
    expect(await readState()).toEqual(before)
  })
})
