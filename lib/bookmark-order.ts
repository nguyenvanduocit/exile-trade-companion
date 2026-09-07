import type { SavedSearch, SearchFolder } from '@/types/trading'

export type Placement = 'before' | 'after'

export function orderedFolders(folders: SearchFolder[]): SearchFolder[] {
  return [...folders].sort((a, b) => a.order - b.order)
}

export function orderedSearches(searches: SavedSearch[], folderId: string): SavedSearch[] {
  return searches.filter((search) => search.folderId === folderId)
    .sort((a, b) => (a.order ?? -a.updatedAt) - (b.order ?? -b.updatedAt))
}

export function normalizeSearchOrder(searches: SavedSearch[]): SavedSearch[] {
  const orders = new Map<string, number>()
  for (const folderId of new Set(searches.map((search) => search.folderId))) {
    orderedSearches(searches, folderId).forEach((search, order) => orders.set(search.id, order))
  }
  return searches.map((search) => ({ ...search, order: orders.get(search.id)! }))
}

export function insertRelative<T extends { id: string }>(items: T[], item: T, targetId?: string, placement: Placement = 'before'): T[] {
  const rest = items.filter((entry) => entry.id !== item.id)
  const index = targetId === undefined ? -1 : rest.findIndex((entry) => entry.id === targetId)
  rest.splice(index < 0 ? rest.length : index + (placement === 'after' ? 1 : 0), 0, item)
  return rest
}
