import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveMap, LiveObject } from '@liveblocks/client'
import type { useFolderSync } from './useFolderSync'
import type { useTradeStore } from './useTradeStore'
import { createDefaultState } from '@/lib/storage'
import { enterFolderRoom, type FolderRoomStorage } from '@/lib/liveblocks-room'
import type { SharedFolderMeta } from '@/lib/folder-sync'

vi.mock('@/lib/liveblocks-room', () => ({ enterFolderRoom: vi.fn() }))

let store: ReturnType<typeof useTradeStore>
let sync: ReturnType<typeof useFolderSync>
let root: LiveObject<FolderRoomStorage>
let notifyRemoteChange: () => void
let notifyStorageStatus: ((status: 'synchronizing' | 'synchronized') => void) | undefined
let storageStatus: 'synchronizing' | 'synchronized'
const leave = vi.fn()
const unsubscribeStorageStatus = vi.fn()

beforeAll(async () => {
  store = (await import('./useTradeStore')).useTradeStore()
  sync = (await import('./useFolderSync')).useFolderSync()
  await sync.init()
})

beforeEach(async () => {
  await store.importState(createDefaultState())
  root = new LiveObject<FolderRoomStorage>({
    folder: new LiveObject({ name: 'Shared gear', color: '#aaa', mode: 'live', note: 'Remote build\nBudget: 20 div' }),
    searches: new LiveMap(),
  })
  leave.mockClear()
  unsubscribeStorageStatus.mockClear()
  notifyStorageStatus = undefined
  storageStatus = 'synchronized'
  vi.mocked(enterFolderRoom).mockImplementation((_key, seed) => {
    if (seed) root.get('folder').update(seed.folder)
    return {
      room: {
        getStorage: async () => ({ root }),
        getStorageStatus: () => storageStatus,
        subscribe: (target: unknown, callback: ((status: 'synchronizing' | 'synchronized') => void) | (() => void)) => {
          if (target === 'storage-status') {
            notifyStorageStatus = callback as (status: 'synchronizing' | 'synchronized') => void
            return unsubscribeStorageStatus
          }
          notifyRemoteChange = callback as () => void
          return vi.fn()
        },
      },
      leave,
    } as unknown as ReturnType<typeof enterFolderRoom>
  })
})

afterEach(async () => {
  for (const folder of store.state.value.folders) {
    if (folder.shareKey) await sync.stopSharing(folder.id)
  }
})

describe('folder note sync', () => {
  it('publishes replaced character gear to the same live room while preserving folder metadata', async () => {
    const item = {
      url: 'https://www.pathofexile.com/trade2/search/Standard/test', title: 'Old ring', game: 'poe2' as const, league: 'Standard', mode: 'search' as const,
      query: { status: 'available', name: null, type: 'Ruby Ring', term: null, disc: null, stats: [], filters: {}, exchange: { want: {}, have: {} } },
    }
    await store.replaceFolderContents('ResurrectForbidden', [item])
    const id = store.state.value.folders.find(folder => folder.name === 'ResurrectForbidden')!.id
    await store.updateFolder(id, { note: 'Keep this note', color: '#abcdef' })
    const shareKey = await sync.shareFolderLive(id)
    const before = { ...store.state.value.folders.find(folder => folder.id === id)! }
    const oldIds = [...root.get('searches').keys()]
    await store.removeSearch(oldIds[0]!)
    await store.replaceFolderContents('ResurrectForbidden', [{ ...item, title: 'New boots' }, { ...item, title: 'New ring' }])
    expect(store.state.value.folders.find(folder => folder.id === id)).toEqual(before)
    expect(before.shareKey).toBe(shareKey)
    expect([...root.get('searches').values()].map(value => value.get('title'))).toEqual(['New boots', 'New ring'])
    expect(oldIds.every(id => !root.get('searches').has(id))).toBe(true)
    expect(root.get('folder').toJSON()).toMatchObject({ name: 'ResurrectForbidden', note: 'Keep this note', color: '#abcdef' })
    notifyRemoteChange()
    await vi.waitFor(() => expect(store.state.value.searches.filter(search => search.folderId === id).map(search => search.title)).toEqual(['New boots', 'New ring']))
  })

  it('seeds live sharing, pushes local edits and clearing, and receives remote edits and clearing', async () => {
    await store.updateFolder('gear', { note: 'Local build\nBudget: 10 div' })
    expect(await sync.shareFolderLive('gear')).toMatch(/^share_/)
    expect(root.get('folder').get('note')).toBe('Local build\nBudget: 10 div')

    await store.updateFolder('gear', { note: 'Updated locally' })
    expect(root.get('folder').get('note')).toBe('Updated locally')
    await store.updateFolder('gear', { note: '' })
    expect(root.get('folder').get('note')).toBe('')

    for (const note of ['Updated remotely\nSecond line', '']) {
      root.get('folder').update({ note })
      notifyRemoteChange()
      await vi.waitFor(() => {
        expect(store.state.value.folders.find((folder) => folder.id === 'gear')?.note).toBe(note)
      })
    }
  })

  it('includes notes in one-time snapshots without enabling live sync', async () => {
    await store.updateFolder('gear', { note: 'Snapshot note' })
    expect(await sync.shareFolderOnce('gear')).toMatch(/^share_/)
    expect(root.get('folder').toJSON()).toMatchObject({ note: 'Snapshot note', mode: 'once' })
    expect(store.state.value.folders.find((folder) => folder.id === 'gear')?.shareKey).toBeUndefined()
    expect(leave).toHaveBeenCalledOnce()
  })

  it('waits for a one-time seed to synchronize before leaving or exposing its key', async () => {
    storageStatus = 'synchronizing'
    let settled = false
    const resultPromise = sync.shareFolderOnce('gear').finally(() => { settled = true })

    await vi.waitFor(() => expect(notifyStorageStatus).toBeTypeOf('function'))
    notifyStorageStatus?.('synchronizing')
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(leave).not.toHaveBeenCalled()
    expect(unsubscribeStorageStatus).not.toHaveBeenCalled()

    storageStatus = 'synchronized'
    notifyStorageStatus?.('synchronized')

    await expect(resultPromise).resolves.toMatch(/^share_/)
    expect(unsubscribeStorageStatus).toHaveBeenCalledOnce()
    expect(leave).toHaveBeenCalledOnce()
  })

  it('does not expose a live share key until its seed is synchronized', async () => {
    storageStatus = 'synchronizing'
    let settled = false
    const resultPromise = sync.shareFolderLive('gear').finally(() => { settled = true })

    await vi.waitFor(() => expect(notifyStorageStatus).toBeTypeOf('function'))
    notifyStorageStatus?.('synchronizing')
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(store.state.value.folders.find((folder) => folder.id === 'gear')?.shareKey).toBeUndefined()
    expect(unsubscribeStorageStatus).not.toHaveBeenCalled()

    storageStatus = 'synchronized'
    notifyStorageStatus?.('synchronized')

    const shareKey = await resultPromise
    expect(shareKey).toMatch(/^share_/)
    expect(store.state.value.folders.find((folder) => folder.id === 'gear')?.shareKey).toBe(shareKey)
    expect(unsubscribeStorageStatus).toHaveBeenCalledOnce()
  })

  it.each(['join', 'fork'] as const)('preserves the remote note when choosing %s', async (action) => {
    const result = await sync.inspectShareKey('share_remote')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Inspection failed')
    expect(await (action === 'join' ? sync.confirmJoin(result.inspection) : sync.confirmFork(result.inspection))).toEqual({ ok: true })
    expect(store.state.value.folders.at(-1)).toMatchObject({
      name: 'Shared gear',
      note: 'Remote build\nBudget: 20 div',
    })
    expect(store.state.value.folders.at(-1)?.shareKey).toBe(action === 'join' ? 'share_remote' : undefined)
  })

  it('imports a legacy snapshot without a note', async () => {
    root.set('folder', new LiveObject<SharedFolderMeta>({ name: 'Legacy folder', color: '#bbb', mode: 'once' }))
    const result = await sync.inspectShareKey('share_legacy')
    if (!result.ok) throw new Error('Inspection failed')
    expect(await sync.confirmFork(result.inspection)).toEqual({ ok: true })
    expect(store.state.value.folders.at(-1)?.note).toBe('')
  })
})
