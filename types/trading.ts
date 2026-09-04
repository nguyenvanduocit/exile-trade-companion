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
  // undefined/false = không theo dõi. Khi true, background mở một tab nền chạy đúng search này
  // qua UI thật của site (xem entrypoints/background.ts) và báo cáo số lượng listing về watchlistState.
  watching?: boolean
}

export interface HistoryEntry extends TradePage {
  id: string
  visitedAt: number
}

export interface TradeSettings {
  maxHistory: number
  collapsedFolderIds: string[]
  hasOpenedPanel: boolean
  statFilterButtonsEnabled: boolean
  propertyFilterButtonsEnabled: boolean
  priceLabelsEnabled: boolean
  highlightSearchedModsEnabled: boolean
}

export interface WatchlistEntryState {
  // Số listing ở lần content script report gần nhất — baseline để so sánh phát hiện listing mới
  // (xem lib/watchlist.ts hasNewListings).
  lastCount: number
  lastNotifiedAt: number
  // false khi vừa có listing mới chưa được user xem qua sidebar (xem lib/storage.ts markWatchlistSeen).
  seen: boolean
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
  // Baseline + trạng thái "đã xem" của từng search đang theo dõi, keyed theo SavedSearch.id.
  watchlistState: Record<string, WatchlistEntryState>
}

export interface SaveSearchInput extends TradePage {
  folderId?: string
  note?: string
  watching?: boolean
}

export type ExtensionMessage =
  | { type: 'OPEN_URL'; url: string }
  | { type: 'OPEN_DISCORD' }
  | { type: 'OPEN_ONBOARDING' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'OPEN_PANEL' }
  | { type: 'SAVE_ACTIVE_SEARCH'; page: TradePage }
  | { type: 'GET_CURRENT_PAGE' }
  // Content script (bất kỳ tab trade nào, kể cả tab watchlist tự mở) báo số lượng listing hiện tại
  // của một search đang theo dõi mà nó phát hiện khớp trang đang xem.
  | { type: 'WATCHLIST_REPORT'; searchId: string; count: number }
  // Sidebar yêu cầu background focus đúng tab nền đang chạy search này.
  | { type: 'FOCUS_WATCHLIST_TAB'; searchId: string }
  // Content script hỏi background "tab này (theo sender.tab.id) có phải tab nền dành riêng cho một
  // search đang theo dõi không" — trade site tự viết lại URL sau khi tab load nên không thể tự nhận
  // diện chỉ bằng queryId/URL hiện tại của trang (xem lib/watchlist.ts searchIdForTab).
  | { type: 'WATCHLIST_TAB_IDENTIFY' }
