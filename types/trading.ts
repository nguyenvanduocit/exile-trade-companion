import type { ExchangeRateCache, PriceSnapshot } from './pricing'

export type Game = 'poe1' | 'poe2'
export type TradeMode = 'search' | 'exchange'

export interface TradePage {
  url: string
  title: string
  game: Game
  league: string
  mode: TradeMode
  queryId?: string
}

export interface SearchFolder {
  id: string
  name: string
  color: string
  order: number
  shareKey?: string
}

export interface SavedSearch extends TradePage {
  id: string
  folderId: string
  note: string
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry extends TradePage {
  id: string
  visitedAt: number
}

export interface TradeSettings {
  captureHistory: boolean
  maxHistory: number
  collapsedFolderIds: string[]
  hasOpenedPanel: boolean
  statFilterButtonsEnabled: boolean
  propertyFilterButtonsEnabled: boolean
  priceSnapshotEnabled: boolean
  priceLabelsEnabled: boolean
}

export interface TradeState {
  version: 1
  folders: SearchFolder[]
  searches: SavedSearch[]
  history: HistoryEntry[]
  settings: TradeSettings
  snapshots: PriceSnapshot[]
  exchangeRate: ExchangeRateCache | null
  // Search bị "xoá" trong lúc folder đang share-live: xoá thật sẽ propagate lên room và mất luôn
  // ở máy người khác, nên chỉ ẩn cục bộ — search vẫn còn trong `searches` để không phá diff đẩy
  // lên room, chỉ lọc khỏi mọi nơi hiển thị.
  hiddenSearchIds: string[]
}

export interface SaveSearchInput extends TradePage {
  folderId?: string
  note?: string
}

export type ExtensionMessage =
  | { type: 'OPEN_URL'; url: string }
  | { type: 'OPEN_DISCORD' }
  | { type: 'OPEN_ONBOARDING' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SAVE_ACTIVE_SEARCH'; page: TradePage }
