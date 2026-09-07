// Kênh MAIN world <-> isolated world (trade-query.content.ts, trade-stats.content.ts,
// trade-properties.content.ts chạy MAIN world để với window.app; trade.content chạy isolated
// world, có browser.storage). MAIN world không có browser.runtime nên không thể dùng
// extension-messaging — defineWindowMessaging bọc window.postMessage, structuredClone payload qua
// verifyMessageData nên không dính bug CustomEvent#detail bị null hoá qua ranh giới world (đã verify
// bằng CDP 2026-09-05, xem git history lib/settings-bridge.ts/lib/save-toast.ts bản cũ).
import { defineWindowMessaging } from '@webext-core/messaging/page'
import type { TradeQuery, TradeSettings } from '@/types/trading'
import type { CurrencyId } from '@/types/pricing'
import type { StatLine, StatMatch } from '@/lib/ninja-import'

export interface QueryStateDetail {
  label: string | null
  query: TradeQuery
}

interface WindowProtocolMap {
  settingsRequested(): void
  // Isolated -> MAIN, broadcast tới cả trade-stats.content.ts lẫn trade-properties.content.ts.
  settingsUpdated(settings: TradeSettings): void
  // MAIN -> isolated (trade.content/App.vue).
  queryStateChanged(detail: QueryStateDetail): void
  // Isolated -> MAIN (trade-query.content.ts hiện qua toastr có sẵn của site).
  saveToast(message: string): void
  // MAIN -> isolated (App.vue chuyển tiếp thành telemetry `feature.use`); MAIN world không có
  // browser.runtime nên không tự gửi được.
  featureUsed(feature: string): void
}

export const { sendMessage, onMessage } = defineWindowMessaging<WindowProtocolMap>({
  namespace: 'exile-trade-companion',
})

// Kênh request/response riêng cho Import from poe.ninja. Namespace tách khỏi kênh broadcast ở trên
// vì mọi bundle có listener trong một namespace đều trả lời mọi request của namespace đó (kể cả
// type nó không xử lý — trả undefined), và sendMessage lấy response ĐẦU TIÊN tới. Cùng namespace
// với settingsUpdated thì trade-stats/trade-properties có thể trả undefined trước trade-ninja.
interface NinjaProtocolMap {
  // Isolated (ImportNinjaModal) -> MAIN (trade-ninja.content.ts): map mod text của item poe.ninja
  // sang trade stat id bằng catalog window.app.static_.knownStatsFlat của site. Throw
  // 'catalog-unavailable' khi site chưa load catalog.
  matchNinjaStats(lines: StatLine[]): (StatMatch | null)[]
  // Item MAGIC/NORMAL trong PoB code không có dòng base; tra base trong catalog item của site
  // (window.app.static_.knownItems). Throw 'catalog-unavailable' khi site chưa load.
  resolveItemBases(typeLines: string[]): (string | null)[]
}

export const { sendMessage: sendNinjaMessage, onMessage: onNinjaMessage } = defineWindowMessaging<NinjaProtocolMap>({
  namespace: 'exile-trade-companion/ninja',
})

// Kênh request/response riêng cho icon currency của nhãn quy đổi giá (cùng lý do tách namespace
// như kênh ninja ở trên).
interface CurrencyIconProtocolMap {
  // Isolated (usePriceLabels) -> MAIN (trade-currency-icons.content.ts): URL ảnh currency từ
  // catalog bulk exchange của site (window.app.static_.exchangeDataFlat). Currency không có trong
  // catalog thì vắng mặt trong kết quả. Throw 'catalog-unavailable' khi site chưa load.
  resolveCurrencyIcons(ids: CurrencyId[]): Record<CurrencyId, string>
}

export const { sendMessage: sendCurrencyIconMessage, onMessage: onCurrencyIconMessage } = defineWindowMessaging<CurrencyIconProtocolMap>({
  namespace: 'exile-trade-companion/currency-icons',
})

export function onSettingsUpdated(callback: (settings: TradeSettings) => void): () => void {
  let active = true
  const request = defineWindowMessaging<WindowProtocolMap>({ namespace: 'exile-trade-companion' })
  const unsubscribe = onMessage('settingsUpdated', ({ data }) => {
    request.removeAllListeners()
    callback(data)
  })
  // A late content script can miss the initial broadcast. Request a fresh broadcast
  // after subscribing; another bundle's empty response is not the settings payload.
  queueMicrotask(() => {
    if (!active) return
    void request.sendMessage('settingsRequested').catch(() => undefined).finally(() => request.removeAllListeners())
  })
  return () => {
    active = false
    unsubscribe()
    request.removeAllListeners()
    // sendMessage awaits data cloning before installing its response listener.
    queueMicrotask(() => request.removeAllListeners())
  }
}
