import type { Json } from '@liveblocks/client'
import type { SharedResolvedSearch, SharedTradeQuery } from './types'

export type SharedSearchFields = Omit<SharedResolvedSearch, 'id' | 'folderId' | 'query'> & { query?: Json }

export type ShareMode = 'live' | 'once'

export interface SharedFolderMeta {
  name: string
  color: string
  note?: string
  mode: ShareMode
}

export function resolveShareMode(meta: { mode?: ShareMode }): ShareMode {
  return meta.mode === 'once' ? 'once' : 'live'
}

export function isBlankFolderMeta(meta: { name: string }): boolean {
  return meta.name.trim() === ''
}

export function toSharedTradeQuery(query: Json | undefined): SharedTradeQuery | undefined {
  return query as unknown as SharedTradeQuery | undefined
}
