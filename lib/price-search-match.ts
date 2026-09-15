import { buildQueryPayload } from 'shared/trade-url'
import { parseTradeLocation } from './trade-location'
import type { SavedSearch, TradePage } from '@/types/trading'
import type { TradePriceSearch } from '@/types/pricing'

export function snapshotQueryId(search: SavedSearch): string {
  return search.queryId ?? `bookmark:${search.id}`
}

// Site thêm group rỗng và disabled:false khi dựng form từ URL import. Bỏ các giá trị
// mặc định này và sắp xếp key để so sánh query đã gửi, giữ nguyên thứ tự và giá trị filter.
function normalizeQuery(value: unknown): unknown {
  if (value == null || value === '') return undefined
  if (Array.isArray(value)) {
    const items = value.map(normalizeQuery).filter((item) => item !== undefined)
    return items.length ? items : undefined
  }
  if (typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (record.type === 'and' && Array.isArray(record.filters) && !record.filters.length) return undefined
  const entries = Object.entries(record)
    .filter(([key, item]) => key !== 'disabled' || item !== false)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, normalizeQuery(item)] as const)
    .filter(([, item]) => item !== undefined)
  return entries.length ? Object.fromEntries(entries) : undefined
}

export function matchesPriceSearch(search: SavedSearch, result: TradePriceSearch): boolean {
  if (search.mode !== 'search' || search.game !== result.game || search.league !== result.league) return false
  if (!search.query) return (search.queryId ?? parseTradeLocation(search.url)?.queryId) === result.queryId

  const expected = buildQueryPayload('search', search.query)
  return JSON.stringify(normalizeQuery(expected)) === JSON.stringify(normalizeQuery(result.query))
}

export function matchesTradePage(left: TradePage, right: TradePage): boolean {
  if (left.game !== right.game || left.league !== right.league || left.mode !== right.mode) return false
  if (left.mode === 'search' && left.query && right.query) {
    return JSON.stringify(normalizeQuery(buildQueryPayload(left.mode, left.query)))
      === JSON.stringify(normalizeQuery(buildQueryPayload(right.mode, right.query)))
  }
  if (left.url === right.url) return true
  const leftId = left.queryId ?? parseTradeLocation(left.url)?.queryId
  const rightId = right.queryId ?? parseTradeLocation(right.url)?.queryId
  return !!leftId && leftId === rightId
}
