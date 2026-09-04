import type { Json } from '@liveblocks/client'
import type { SavedSearch, SearchFolder } from '@/types/trading'

// Liveblocks yêu cầu mọi field lưu trong LiveObject là Json (có index signature) — TradeQuery là
// interface có shape cụ thể nên không tự thoả structural constraint đó dù giá trị runtime của nó
// luôn là JSON hợp lệ (chính là payload JSON.stringify được trong lib/trade-url.ts). Ép kiểu ở đúng
// ranh giới serialize này (toSharedSearchFields/buildSavedSearch) thay vì nới lỏng type toàn app.
export type SharedSearchFields = Omit<SavedSearch, 'id' | 'folderId' | 'query'> & { query?: Json }

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
  const { id: _id, folderId: _folderId, query, ...fields } = search
  return { ...fields, query: query as Json | undefined }
}

export function buildSavedSearch(id: string, folderId: string, fields: SharedSearchFields): SavedSearch {
  const { query, ...rest } = fields
  return { ...rest, id, folderId, query: query as SavedSearch['query'] }
}

export function toSharedFolderMeta(folder: SearchFolder, mode: ShareMode): SharedFolderMeta {
  return { name: folder.name, color: folder.color, mode }
}

export function resolveShareMode(meta: { mode?: ShareMode }): ShareMode {
  return meta.mode === 'once' ? 'once' : 'live'
}

// createFolder/renameFolder đều trim-guard tên rỗng nên folder local không bao giờ mang tên rỗng —
// tên rỗng đến từ room nghĩa là Liveblocks vừa tự tạo lại room trống (room bị xoá hoặc chưa từng
// tồn tại), không phải một lần đồng bộ hợp lệ.
export function isBlankFolderMeta(meta: { name: string }): boolean {
  return meta.name.trim() === ''
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
