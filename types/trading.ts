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
}

export interface TradeState {
  version: 1
  folders: SearchFolder[]
  searches: SavedSearch[]
  history: HistoryEntry[]
  settings: TradeSettings
  snapshots: PriceSnapshot[]
  exchangeRate: ExchangeRateCache | null
}

export interface SaveSearchInput extends TradePage {
  folderId?: string
  note?: string
}

export type ExtensionMessage =
  | { type: 'OPEN_URL'; url: string }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SAVE_ACTIVE_SEARCH'; page: TradePage }
