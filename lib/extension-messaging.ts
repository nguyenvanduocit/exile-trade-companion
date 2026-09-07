// Kênh background <-> isolated-world content script (trade.content/App.vue, SearchCard.vue).
// defineExtensionMessaging bọc browser.runtime.sendMessage/onMessage, buộc request/response khớp
// type qua ProtocolMap thay vì cast tay như ExtensionMessage union cũ.
import { defineExtensionMessaging } from '@webext-core/messaging'
import type { TradePage } from '@/types/trading'
import type { NinjaFetchResult } from '@/lib/ninja-import'
import type { PobFetchResult } from '@/lib/pob-import'
import type { TelemetryEvent } from '@/lib/telemetry'

interface ExtensionProtocolMap {
  // Content script (isolated) -> background, không cần tabId (mặc định gửi tới background).
  openUrl(url: string): void
  openDiscord(): void
  openOnboarding(): void
  saveActiveSearch(page: TradePage): void
  // poe.ninja không trả CORS header nên content script không fetch được; background có host permission.
  fetchNinjaCharacter(url: string): NinjaFetchResult
  // pobb.in/<id>/raw trả PoB code dạng text, cũng không có CORS header.
  fetchPobCode(url: string): PobFetchResult
  // Telemetry ẩn danh: background gom batch và gửi tới Datadog (proxy — trang GGG không thấy request).
  track(event: TelemetryEvent): void
  // Background -> content script, gọi kèm tabId qua sendMessage(type, data, tabId).
  togglePanel(): void
  openPanel(): void
  getCurrentPage(): TradePage | null
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ExtensionProtocolMap>()
