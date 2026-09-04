import type { PropertyFilterValue } from '@/lib/property-filter'
import type { StatGroup } from '@/lib/stat-filter'
import type { ExchangeRateCache, PriceSnapshot } from './pricing'

export type Game = 'poe1' | 'poe2'
export type TradeMode = 'search' | 'exchange'

export interface TradeExchangeState {
  want: Record<string, { amount: number | null } | undefined>
  have: Record<string, { amount: number | null } | undefined>
}

// Bản sao state.persistent của Vuex store trên trade site (window.app), trừ các field route-derived
// (id/tab/realm/league) — đây là phần thật sự mô tả nội dung search, dùng để dựng lại durable URL
// (xem lib/trade-url.ts buildDurableUrl) khi queryId gốc do GGG cấp đã hết hạn.
export interface TradeQuery {
  status: string
  name: string | null
  type: string | null
  term: string | null
  disc: string | null
  stats: StatGroup[]
  filters: Record<string, { filters: Record<string, PropertyFilterValue> } | undefined>
  exchange: TradeExchangeState
}

export interface TradePage {
  url: string
  title: string
  game: Game
  league: string
  mode: TradeMode
  queryId?: string
  query?: TradeQuery
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
  | { type: 'GET_CURRENT_PAGE' }
