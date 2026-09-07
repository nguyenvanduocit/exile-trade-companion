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
const leave = vi.fn()

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
  vi.mocked(enterFolderRoom).mockImplementation((_key, seed) => {
    if (seed) root.get('folder').update(seed.folder)
    return {
      room: {
        getStorage: async () => ({ root }),
        subscribe: (_target: unknown, callback: () => void) => { notifyRemoteChange = callback },
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
