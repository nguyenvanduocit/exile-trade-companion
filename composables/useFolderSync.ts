import { reactive, watch } from 'vue'
import { LiveObject } from '@liveblocks/client'
import { useTradeStore } from '@/composables/useTradeStore'
import { enterFolderRoom, type FolderRoomStorage, type Room } from '@/lib/liveblocks-room'
import {
  buildSavedSearch,
  diffFolderMeta,
  diffSearchesForFolder,
  generateShareKey,
  isShareKeyInUse,
  planRoomChanges,
  resolveShareMode,
  toSharedFolderMeta,
  toSharedSearchFields,
  type ShareMode,
  type SharedFolderMeta,
  type SharedSearchFields,
} from '@/lib/folder-sync'
import type { SavedSearch, SearchFolder, TradeState } from '@/types/trading'

export type FolderSyncStatus = 'connecting' | 'idle' | 'syncing' | 'error'
export type JoinFolderResult = { ok: true } | { ok: false; reason: 'already-joined' | 'error' }

export interface ShareKeyInspection {
  shareKey: string
  mode: ShareMode
  meta: SharedFolderMeta
  searchFields: [string, SharedSearchFields][]
  room: Room
  root: LiveObject<FolderRoomStorage>
  leave: () => void
}

export type InspectShareKeyResult = { ok: true; inspection: ShareKeyInspection } | { ok: false; reason: 'error' }

interface RoomHandle {
  folderId: string
  leave: () => void
  root: LiveObject<FolderRoomStorage>
}

const activeRooms = new Map<string, RoomHandle>()
const syncStatus = reactive<Record<string, FolderSyncStatus>>({})
let watching = false

function readRemoteSearches(root: LiveObject<FolderRoomStorage>, folderId: string) {
  return [...root.get('searches').entries()].map(([id, fields]) => buildSavedSearch(id, folderId, fields.toJSON()))
}

async function connectRoom(folderId: string, shareKey: string, store: ReturnType<typeof useTradeStore>) {
  if (activeRooms.has(shareKey)) return
  syncStatus[folderId] = 'connecting'
  try {
    const { room, leave } = enterFolderRoom(shareKey)
    const { root } = await room.getStorage()
    activeRooms.set(shareKey, { folderId, leave, root })

    syncStatus[folderId] = 'syncing'
    await store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))
    syncStatus[folderId] = 'idle'

    room.subscribe(
      root,
      async () => {
        syncStatus[folderId] = 'syncing'
        try {
          await store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))
          syncStatus[folderId] = 'idle'
        } catch {
          syncStatus[folderId] = 'error'
        }
      },
      { isDeep: true },
    )
  } catch {
    syncStatus[folderId] = 'error'
  }
}

function disconnectRoom(shareKey: string) {
  const handle = activeRooms.get(shareKey)
  if (!handle) return
  handle.leave()
  activeRooms.delete(shareKey)
  delete syncStatus[handle.folderId]
}

function pushLocalChangesToRoom(folder: SearchFolder, prevState: TradeState, nextState: TradeState) {
  if (!folder.shareKey) return
  const handle = activeRooms.get(folder.shareKey)
  if (!handle) return

  const prevFolder = prevState.folders.find((entry) => entry.id === folder.id)
  const metaDiff = prevFolder ? diffFolderMeta(prevFolder, folder) : null
  const diff = diffSearchesForFolder(folder.id, prevState.searches, nextState.searches)
  if (!metaDiff && diff.added.length === 0 && diff.updated.length === 0 && diff.removedIds.length === 0) return

  try {
    if (metaDiff) handle.root.get('folder').update(metaDiff)
    const searchesMap = handle.root.get('searches')
    for (const search of diff.added) searchesMap.set(search.id, new LiveObject(toSharedSearchFields(search)))
    for (const search of diff.updated) searchesMap.get(search.id)?.update(toSharedSearchFields(search))
    for (const id of diff.removedIds) searchesMap.delete(id)
    syncStatus[folder.id] = 'idle'
  } catch {
    syncStatus[folder.id] = 'error'
  }
}

export function useFolderSync() {
  const store = useTradeStore()

  function startWatching() {
    if (watching) return
    watching = true
    watch(
      () => store.state.value,
      (next, prev) => {
        const { toConnect, toDisconnect } = planRoomChanges([...activeRooms.keys()], next.folders)
        for (const shareKey of toDisconnect) disconnectRoom(shareKey)
        for (const { folderId, shareKey } of toConnect) void connectRoom(folderId, shareKey, store)
        for (const folder of next.folders) {
          if (folder.shareKey) pushLocalChangesToRoom(folder, prev, next)
        }
      },
      { deep: true, flush: 'sync' },
    )
  }

  async function init() {
    await store.init()
    const { toConnect } = planRoomChanges([], store.state.value.folders)
    for (const { folderId, shareKey } of toConnect) await connectRoom(folderId, shareKey, store)
    startWatching()
  }

  async function shareFolderLive(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder) return

    const shareKey = generateShareKey()
    const seedSearches = Object.fromEntries(
      store.state.value.searches
        .filter((search) => search.folderId === folderId)
        .map((search) => [search.id, toSharedSearchFields(search)]),
    )

    syncStatus[folderId] = 'connecting'
    try {
      const { room, leave } = enterFolderRoom(shareKey, { folder: toSharedFolderMeta(folder, 'live'), searches: seedSearches })
      const { root } = await room.getStorage()
      activeRooms.set(shareKey, { folderId, leave, root })
      room.subscribe(
        root,
        async () => {
          syncStatus[folderId] = 'syncing'
          try {
            await store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))
            syncStatus[folderId] = 'idle'
          } catch {
            syncStatus[folderId] = 'error'
          }
        },
        { isDeep: true },
      )

      await store.setFolderShareKey(folderId, shareKey)
      syncStatus[folderId] = 'idle'
      return shareKey
    } catch {
      syncStatus[folderId] = 'error'
    }
  }

  async function shareFolderOnce(folderId: string): Promise<string | undefined> {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder) return

    const shareKey = generateShareKey()
    const seedSearches = Object.fromEntries(
      store.state.value.searches
        .filter((search) => search.folderId === folderId)
        .map((search) => [search.id, toSharedSearchFields(search)]),
    )

    try {
      const { room, leave } = enterFolderRoom(shareKey, { folder: toSharedFolderMeta(folder, 'once'), searches: seedSearches })
      await room.getStorage()
      leave()
      return shareKey
    } catch {
      return undefined
    }
  }

  async function inspectShareKey(shareKey: string): Promise<InspectShareKeyResult> {
    try {
      const { room, leave } = enterFolderRoom(shareKey)
      const { root } = await room.getStorage()
      const meta = root.get('folder').toJSON()
      const searchFields: [string, SharedSearchFields][] = [...root.get('searches').entries()].map(([id, fields]) => [id, fields.toJSON()])

      return { ok: true, inspection: { shareKey, mode: resolveShareMode(meta), meta, searchFields, room, root, leave } }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }

  function buildFolderFromInspection(inspection: ShareKeyInspection, shareKey?: string): { folder: SearchFolder; searches: SavedSearch[] } {
    const folderId = `folder-${crypto.randomUUID()}`
    const folder: SearchFolder = {
      id: folderId,
      name: inspection.meta.name,
      color: inspection.meta.color,
      order: store.state.value.folders.length,
      ...(shareKey ? { shareKey } : {}),
    }
    const searches = inspection.searchFields.map(([id, fields]) => buildSavedSearch(id, folderId, fields))
    return { folder, searches }
  }

  async function confirmJoin(inspection: ShareKeyInspection): Promise<JoinFolderResult> {
    if (isShareKeyInUse(store.state.value.folders, inspection.shareKey)) {
      inspection.leave()
      return { ok: false, reason: 'already-joined' }
    }

    try {
      const { folder, searches } = buildFolderFromInspection(inspection, inspection.shareKey)
      syncStatus[folder.id] = 'connecting'
      activeRooms.set(inspection.shareKey, { folderId: folder.id, leave: inspection.leave, root: inspection.root })
      inspection.room.subscribe(
        inspection.root,
        async () => {
          syncStatus[folder.id] = 'syncing'
          try {
            await store.applyRemoteFolderState(folder.id, inspection.root.get('folder').toJSON(), readRemoteSearches(inspection.root, folder.id))
            syncStatus[folder.id] = 'idle'
          } catch {
            syncStatus[folder.id] = 'error'
          }
        },
        { isDeep: true },
      )

      await store.addSharedFolder(folder, searches)
      syncStatus[folder.id] = 'idle'
      return { ok: true }
    } catch {
      inspection.leave()
      return { ok: false, reason: 'error' }
    }
  }

  async function confirmFork(inspection: ShareKeyInspection): Promise<JoinFolderResult> {
    try {
      const { folder, searches } = buildFolderFromInspection(inspection)
      await store.addSharedFolder(folder, searches)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'error' }
    } finally {
      inspection.leave()
    }
  }

  async function rotateShareKey(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder?.shareKey) return
    disconnectRoom(folder.shareKey)
    await shareFolderLive(folderId)
  }

  async function stopSharing(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder?.shareKey) return
    disconnectRoom(folder.shareKey)
    await store.setFolderShareKey(folderId, undefined)
  }

  return { init, shareFolderLive, shareFolderOnce, inspectShareKey, confirmJoin, confirmFork, rotateShareKey, stopSharing, syncStatus }
}
