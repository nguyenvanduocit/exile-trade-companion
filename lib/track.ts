// Gửi event telemetry từ isolated world (panel, modal, store) về background. Không await, không
// throw: telemetry lỗi thì tính năng vẫn chạy. Background mới là nơi quyết định gửi hay không
// (settings.telemetryEnabled) và gửi đi đâu.
import { sendMessage } from '@/lib/extension-messaging'
import type { TelemetryValue } from '@/lib/telemetry'

export function track(name: string, props?: Record<string, TelemetryValue>) {
  void sendMessage('track', { name, props }).catch(() => undefined)
}
