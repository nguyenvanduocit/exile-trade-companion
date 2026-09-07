// Shape tối thiểu của window.app — instance Vue 2 + Vuex root của trade site (MAIN world).
// Một declare global duy nhất cho toàn extension, tránh xung đột type giữa các content script cùng augment Window.
import type { TradeQuery } from '@/types/trading'
import type { KnownItemGroup } from '@/lib/tier-filter'
import type { StatDefinition } from '@/lib/stat-filter'

export interface CurrencyCatalogEntry {
  id: string
  text: string
  image: string
}

export interface TradeApp {
  static_?: {
    knownItems?: KnownItemGroup[]
    knownStatsFlat?: Record<string, StatDefinition>
    // Catalog currency của bulk exchange, key theo currency id (chaos, divine, transmute...).
    // image là path tương đối trên web.poecdn.com — nguồn icon cho nhãn quy đổi giá.
    exchangeDataFlat?: Record<string, CurrencyCatalogEntry>
  }
  $store: {
    state: {
      persistent: TradeQuery
    }
    commit: (type: string, payload?: unknown) => void
    watch: (getter: (state: TradeApp['$store']['state']) => unknown, cb: () => void, opts?: { deep?: boolean }) => () => void
  }
  $refs: { toastr?: { Add: (toast: { msg: string; progressbar: boolean; timeout: number }) => void } }
  save: (dirty?: boolean) => void
}

declare global {
  interface Window {
    app?: TradeApp
  }
}
