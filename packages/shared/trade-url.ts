import type { SharedTradeQuery, SharedTradePage, TradeMode } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function compactValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return undefined
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined)
    return items.length ? items : undefined
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).flatMap(([key, entry]) => {
      if (key === 'disabled' && entry === false) return []
      const compacted = compactValue(entry)
      return compacted === undefined ? [] : [[key, compacted]]
    })
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value
}

function serializeStatGroup(group: unknown): unknown {
  if (!isRecord(group) || !Array.isArray(group.filters)) return undefined
  const filters = group.filters.filter(isRecord).map((filter) => compactValue({
    id: filter.id,
    value: filter.value,
    disabled: filter.disabled,
  })).filter((filter) => filter !== undefined)
  if (!filters.length) return undefined
  return compactValue({
    type: group.type,
    filters,
    value: group.value,
    disabled: group.disabled,
  })
}

// Trade site tự đọc queryId dạng path segment như một blob gzip+base64url của chính query JSON —
// xác nhận bằng cách round-trip thủ công qua devtools (2026-09-05): tự nén một payload tối giản
// rồi mở lại, site load đúng state, không cần server lưu trước id này. Site KHÔNG đọc `?q=` (đã thử
// cả JSON thô lẫn bọc {query:...}, cả hai đều bị bỏ qua và fallback về search trống).
// Site cũng từ chối payload có field thừa (id/tab/realm/league/exchange khi search, hoặc bất kỳ
// field null/rỗng nào) — phải lược bỏ đúng những field có nội dung thật, giống cách encoder gốc
// của site tự làm, nếu không toàn bộ payload bị bỏ qua (fallback về search trống, không lỗi).
export function buildQueryPayload(mode: TradeMode, query: SharedTradeQuery): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (query.status) payload.status = { option: query.status }

  if (mode === 'exchange') {
    const have = Object.keys(query.exchange.have)
    const want = Object.keys(query.exchange.want)
    if (have.length) payload.have = have
    if (want.length) payload.want = want
    return payload
  }

  if (query.term) {
    payload.term = query.term
  } else {
    if (query.name) payload.name = query.disc ? { option: query.name, discriminator: query.disc } : query.name
    if (query.type) payload.type = query.disc ? { option: query.type, discriminator: query.disc } : query.type
  }
  if (Array.isArray(query.stats)) {
    const stats = query.stats.map(serializeStatGroup).filter((group) => group !== undefined)
    if (stats.length) payload.stats = stats
  }
  const filters: Record<string, unknown> = {}
  for (const [key, group] of Object.entries(query.filters)) {
    if (!isRecord(group)) continue
    const groupFilters = compactValue(group.filters)
    if (groupFilters !== undefined) filters[key] = compactValue({ filters: groupFilters, disabled: group.disabled })
  }
  if (Object.keys(filters).length) payload.filters = filters
  return payload
}

async function gzipBase64Url(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Dựng lại URL search từ raw query đã lưu kèm bookmark, không phụ thuộc queryId gốc (có thể đã hết
// hạn phía server GGG). Trả null nếu bookmark cũ chưa từng capture query — nơi gọi tự fallback về
// page.url gốc.
export async function buildDurableUrl(page: SharedTradePage): Promise<string | null> {
  if (!page.query) return null

  const payload = buildQueryPayload(page.mode, page.query)
  const encoded = await gzipBase64Url(JSON.stringify(payload))
  const tradeRoot = page.game === 'poe2' ? 'trade2' : 'trade'
  const realm = page.game === 'poe2' ? '/poe2' : ''
  return `https://www.pathofexile.com/${tradeRoot}/${page.mode}${realm}/${encodeURIComponent(page.league)}/${encoded}`
}
