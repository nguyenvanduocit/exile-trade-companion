// Logic thuần cho telemetry: event schema, gom batch, dựng request tới Datadog Logs intake.
// I/O (fetch, timer thật, storage) nằm ở entrypoints/background.ts — mọi content script chỉ gửi
// message `track` về background, nên trang pathofexile.com không bao giờ thấy request ra Datadog.
//
// Không gửi dữ liệu cá nhân: không tên character/account, không link, không nội dung bookmark hay
// query. Chỉ tên event, số đếm, mã lỗi, và text mod game (dữ liệu công khai) khi matcher bỏ sót.

export type TelemetryValue = string | number | boolean | null

export interface TelemetryEvent {
  name: string
  props?: Record<string, TelemetryValue>
}

export interface TelemetryContext {
  service: string
  version: string
  env: string
  installId: string
}

export const TELEMETRY_SERVICE = 'exile-trade-companion'

// Client token của Datadog được thiết kế để lộ trong bundle client (khác API key). Site quyết định
// host intake: datadoghq.com → browser-intake-datadoghq.com, us5.datadoghq.com →
// browser-intake-us5-datadoghq.com, datadoghq.eu → browser-intake-datadoghq.eu.
export function intakeHost(site: string): string {
  const parts = site.trim().split('.')
  if (parts.length >= 3) return `browser-intake-${parts.slice(0, -2).join('-')}-${parts.slice(-2).join('.')}`
  return `browser-intake-${site.trim()}`
}

export function intakeUrl(site: string, clientToken: string): string {
  const params = new URLSearchParams({ 'ddsource': 'browser', 'dd-api-key': clientToken, 'dd-evp-origin': 'browser' })
  return `https://${intakeHost(site)}/api/v2/logs?${params}`
}

const MAX_STRING = 500

// Chỉ giữ giá trị nguyên thuỷ, cắt chuỗi dài; object/array/undefined bị bỏ để payload luôn phẳng.
export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, TelemetryValue> {
  const out: Record<string, TelemetryValue> = {}
  if (!props) return out
  for (const [key, value] of Object.entries(props)) {
    if (value === null || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'string') out[key] = value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value
  }
  return out
}

// Một dòng log cho mỗi event, NDJSON (body text/plain) đúng như Datadog Browser Logs SDK gửi.
export function buildIntakeBody(events: TelemetryEvent[], context: TelemetryContext, now = Date.now()): string {
  const ddtags = `version:${context.version},env:${context.env}`
  return events
    .map((event) => JSON.stringify({
      ddsource: 'browser',
      ddtags,
      service: context.service,
      status: event.name.endsWith('.error') || event.name === 'error' ? 'error' : 'info',
      message: event.name,
      event: event.name,
      install_id: context.installId,
      date: now,
      ...sanitizeProps(event.props),
    }))
    .join('\n')
}

export interface BatcherOptions {
  flush: (events: TelemetryEvent[]) => Promise<void> | void
  maxBatch?: number
  delayMs?: number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface Batcher {
  push: (event: TelemetryEvent) => void
  flushNow: () => Promise<void>
  size: () => number
}

// Gom event rồi gửi một lần: khi đủ maxBatch, hoặc delayMs sau event đầu tiên của batch.
// flush thất bại thì bỏ batch đó — telemetry không được giữ event lại vô hạn hay làm hỏng tính năng.
export function createBatcher(options: BatcherOptions): Batcher {
  const maxBatch = options.maxBatch ?? 20
  const delayMs = options.delayMs ?? 5000
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  let queue: TelemetryEvent[] = []
  let timer: unknown = null

  async function flushNow() {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
    if (!queue.length) return
    const batch = queue
    queue = []
    try {
      await options.flush(batch)
    } catch {
      // bỏ batch
    }
  }

  return {
    push(event) {
      queue.push({ name: event.name, props: sanitizeProps(event.props) })
      if (queue.length >= maxBatch) {
        void flushNow()
        return
      }
      if (timer === null) timer = setTimer(() => void flushNow(), delayMs)
    },
    flushNow,
    size: () => queue.length,
  }
}
