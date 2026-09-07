import type { SharedTradeQuery, SharedTradePage, TradeMode } from './types'

// Trade site tự đọc queryId dạng path segment như một blob gzip+base64url của chính query JSON —
// xác nhận bằng cách round-trip thủ công qua devtools (2026-09-05): tự nén một payload tối giản
// rồi mở lại, site load đúng state, không cần server lưu trước id này. Site KHÔNG đọc `?q=` (đã thử
// cả JSON thô lẫn bọc {query:...}, cả hai đều bị bỏ qua và fallback về search trống).
// Site cũng từ chối payload có field thừa (id/tab/realm/league/exchange khi search, hoặc bất kỳ
// field null/rỗng nào) — phải lược bỏ đúng những field có nội dung thật, giống cách encoder gốc
// của site tự làm, nếu không toàn bộ payload bị bỏ qua (fallback về search trống, không lỗi).
function buildQueryPayload(mode: TradeMode, query: SharedTradeQuery): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: { option: query.status } }

  if (mode === 'exchange') {
    const have = Object.keys(query.exchange.have)
    const want = Object.keys(query.exchange.want)
    if (have.length) payload.have = have
    if (want.length) payload.want = want
    return payload
  }

  if (query.name) payload.name = query.name
  if (query.type) payload.type = query.type
  if (query.term) payload.term = query.term
  if (query.disc) payload.disc = query.disc
  if (Array.isArray(query.stats) && query.stats.some((group) => group.filters.length)) payload.stats = query.stats
  if (Object.keys(query.filters).length) payload.filters = query.filters
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
  return `https://www.pathofexile.com/${tradeRoot}/${page.mode}/${encodeURIComponent(page.league)}/${encoded}`
}
