import type { SavedSearch, SearchFolder } from '@/types/trading'

export type SharedSearchFields = Omit<SavedSearch, 'id' | 'folderId'>

export type ShareMode = 'live' | 'once'

export type SharedFolderMeta = {
  name: string
  color: string
  mode: ShareMode
}

export interface SearchDiff {
  added: SavedSearch[]
  updated: SavedSearch[]
  removedIds: string[]
}

export function generateShareKey(): string {
  return `share_${crypto.randomUUID()}`
}

export function toSharedSearchFields(search: SavedSearch): SharedSearchFields {
  const { id: _id, folderId: _folderId, ...fields } = search
  return fields
}

export function buildSavedSearch(id: string, folderId: string, fields: SharedSearchFields): SavedSearch {
  return { ...fields, id, folderId }
}

export function toSharedFolderMeta(folder: SearchFolder, mode: ShareMode): SharedFolderMeta {
  return { name: folder.name, color: folder.color, mode }
}

export function resolveShareMode(meta: { mode?: ShareMode }): ShareMode {
  return meta.mode === 'once' ? 'once' : 'live'
}

export function diffSearchesForFolder(folderId: string, prev: SavedSearch[], next: SavedSearch[]): SearchDiff {
  const prevById = new Map(prev.filter((search) => search.folderId === folderId).map((search) => [search.id, search]))
  const nextById = new Map(next.filter((search) => search.folderId === folderId).map((search) => [search.id, search]))

  const added: SavedSearch[] = []
  const updated: SavedSearch[] = []
  for (const [id, search] of nextById) {
    const prevSearch = prevById.get(id)
    if (!prevSearch) added.push(search)
    else if (prevSearch.updatedAt !== search.updatedAt) updated.push(search)
  }

  const removedIds: string[] = []
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) removedIds.push(id)
  }

  return { added, updated, removedIds }
}

export function diffFolderMeta(prev: SearchFolder, next: SearchFolder): Pick<SharedFolderMeta, 'name' | 'color'> | null {
  if (prev.name === next.name && prev.color === next.color) return null
  return { name: next.name, color: next.color }
}

export function isShareKeyInUse(folders: SearchFolder[], shareKey: string): boolean {
  return folders.some((folder) => folder.shareKey === shareKey)
}

export function planRoomChanges(activeShareKeys: string[], folders: SearchFolder[]) {
  const desired = new Map(
    folders.filter((folder): folder is SearchFolder & { shareKey: string } => Boolean(folder.shareKey))
      .map((folder) => [folder.shareKey, folder.id]),
  )

  const toConnect = [...desired.entries()]
    .filter(([shareKey]) => !activeShareKeys.includes(shareKey))
    .map(([shareKey, folderId]) => ({ folderId, shareKey }))

  const toDisconnect = activeShareKeys.filter((shareKey) => !desired.has(shareKey))

  return { toConnect, toDisconnect }
}
