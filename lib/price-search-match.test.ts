import { describe, expect, it } from 'vitest'
import { matchesPriceSearch, matchesTradePage, snapshotQueryId } from './price-search-match'
import type { SavedSearch } from '@/types/trading'
import type { TradePriceSearch } from '@/types/pricing'
import urls from './__fixtures__/price-capture-urls.json'

async function decodeQuery(url: string) {
  const token = url.split('/').at(-1)!
  const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text())
}

const search: SavedSearch = {
  id: 'bookmark-1', folderId: 'watchlist', title: 'Boots', note: '', createdAt: 1, updatedAt: 1,
  game: 'poe1', mode: 'search', league: 'Standard', url: 'https://www.pathofexile.com/trade/search/Standard/import-blob',
  query: {
    status: 'any', name: null, type: 'Sorcerer Boots', term: null, disc: null,
    stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 80 } }] }],
    filters: { type_filters: { filters: { rarity: { option: 'nonunique' } } } },
    exchange: { want: {}, have: {} },
  },
}
const result: TradePriceSearch = {
  url: 'https://www.pathofexile.com/trade/search/Standard/new-server-id',
  queryId: 'new-server-id', game: 'poe1', league: 'Standard',
  query: {
    type: 'Sorcerer Boots', status: { option: 'any' },
    stats: [{ type: 'and', filters: [{ disabled: false, value: { max: null, min: 80 }, id: 'explicit.life' }], disabled: false }],
    filters: { misc_filters: { filters: {}, disabled: false }, type_filters: { disabled: false, filters: { rarity: { option: 'nonunique' } } } },
  },
}

describe('nhận diện kết quả giá của bookmark', () => {
  it('nhận đúng cặp URL Emerald do người dùng cung cấp trước và sau GGG chuẩn hóa', async () => {
    const imported = await decodeQuery(urls.imported)
    const opened = await decodeQuery(urls.opened)
    const bookmark: SavedSearch = {
      ...search, game: 'poe2', league: 'Forbidden Rites', url: urls.imported,
      query: {
        status: imported.status.option, type: imported.type, name: null, disc: null, term: null,
        stats: imported.stats, filters: imported.filters, exchange: { want: {}, have: {} },
      },
    }
    expect(urls.imported).not.toBe(urls.opened)
    expect(matchesPriceSearch(bookmark, { ...result, url: urls.opened, game: 'poe2', league: 'Forbidden Rites', query: opened })).toBe(true)
    const current = { ...bookmark, url: urls.opened, queryId: 'rewritten-id', query: { ...bookmark.query!, stats: opened.stats, filters: opened.filters } }
    expect(matchesTradePage(bookmark, current)).toBe(true)
    expect(matchesTradePage(bookmark, { ...current, league: 'Standard' })).toBe(false)
    expect(matchesTradePage(bookmark, { ...current, query: { ...current.query, type: 'Ruby' } })).toBe(false)
    expect(snapshotQueryId(bookmark)).toBe(`bookmark:${bookmark.id}`)
  })

  it('khớp query import dù site cấp ID mới và bổ sung field mặc định', () => {
    expect(matchesPriceSearch(search, result)).toBe(true)
  })

  it.each([
    { type: 'Titan Greaves' },
    { status: { option: 'online' } },
    { stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 100 } }] }] },
    { stats: [{ type: 'and', filters: [{ id: 'explicit.life', value: { min: 80 }, disabled: true }] }] },
    { filters: { type_filters: { filters: { rarity: { option: 'unique' } } } } },
  ])('từ chối khi bộ lọc của kết quả khác bookmark: %j', (patch) => {
    expect(matchesPriceSearch(search, { ...result, query: { ...result.query, ...patch } })).toBe(false)
  })

  it('từ chối cùng query ở game hoặc league khác', () => {
    expect(matchesPriceSearch(search, { ...result, game: 'poe2' })).toBe(false)
    expect(matchesPriceSearch(search, { ...result, league: 'Other' })).toBe(false)
  })

  it('bỏ qua group and rỗng mà site thêm mặc định', () => {
    const saved = { ...search, query: { ...search.query!, stats: [] } }
    expect(matchesPriceSearch(saved, { ...result, query: { ...result.query, stats: [{ type: 'and', filters: [] }] } })).toBe(true)
  })

  it('khớp discriminator theo định dạng query của API', () => {
    const saved = { ...search, query: { ...search.query!, disc: 'variant' } }
    expect(matchesPriceSearch(saved, { ...result, query: { ...result.query, type: { option: 'Sorcerer Boots', discriminator: 'variant' } } })).toBe(true)
  })

  it('bookmark cũ không có query vẫn phải khớp ID kết quả', () => {
    const saved = { ...search, query: undefined, queryId: 'old-id' }
    expect(matchesPriceSearch(saved, result)).toBe(false)
    expect(matchesPriceSearch(saved, { ...result, queryId: 'old-id' })).toBe(true)
  })

  it('khóa lịch sử lấy từ bookmark, không đổi theo ID kết quả mới', () => {
    expect(snapshotQueryId(search)).toBe('bookmark:bookmark-1')
    expect(snapshotQueryId({ ...search, queryId: 'old-id' })).toBe('old-id')
  })

  it('bookmark import ở league khác không dùng chung lịch sử dù blob query giống nhau', () => {
    const otherLeague = { ...search, id: 'bookmark-2', league: 'Forbidden Rites', url: search.url.replace('/Standard/', '/Forbidden%20Rites/') }
    expect(snapshotQueryId(search)).not.toBe(snapshotQueryId(otherLeague))
  })
})
