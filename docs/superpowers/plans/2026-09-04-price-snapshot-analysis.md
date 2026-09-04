# Price Snapshot & Price Analysis Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extension tự động chụp snapshot giá (median, bỏ 5 listing rẻ nhất) mỗi khi user mở trang kết quả của một search đã track, lưu lịch sử theo thời gian, hiện median mới nhất dưới tên search trong sidebar, và có tab "Price Analysis" xem trend.

**Architecture:** Toàn bộ đọc dữ liệu (giá listing từ DOM `[data-field="price"]`, tỷ giá từ GGG `/api/trade(2)/exchange/<league>`) chạy same-origin ngay trong content script isolated-world đã có (`entrypoints/trade.content/App.vue`) — không content script mới, không permission mới. Tách rõ functional core (tính toán thuần, test được) khỏi imperative shell (đọc DOM, gọi fetch, ghi storage).

**Tech Stack:** Vue 3 + TypeScript (WXT), `browser.storage.local` qua `lib/storage.ts`, Vitest (`bun run test`), `vue-tsc` (`bun run typecheck`).

**Spec:** `docs/superpowers/specs/2026-09-04-price-snapshot-analysis-design.md`

## Global Constraints

- Không thêm permission `tabs` hay `alarms` — mọi fetch chạy same-origin trong content script đã match `pathofexile.com/trade*`.
- Không inject UI vào DOM của pathofexile.com — mọi hiển thị nằm trong sidebar/popup của extension.
- Throttle snapshot giá: tối thiểu **1 giờ** giữa hai lần capture cho cùng `queryId`.
- Throttle tỷ giá: cache tỷ giá coi là "fresh" trong **6 giờ**, cùng league.
- Median tính trên listing đã chuẩn hoá chaos-equivalent, **bỏ 5 listing rẻ nhất**, cần **tối thiểu 6 listing hợp lệ** (currency đã biết tỷ giá) mới lưu snapshot.
- Retention: tối đa **90 snapshot/`queryId`**, FIFO cắt bản cũ nhất.
- File mới bám đúng convention hiện có: hàm thuần đi kèm `.test.ts` colocate (xem `lib/property-filter.ts` + `.test.ts`), Vue component không có test tự động trong repo này — verify bằng `bun run typecheck` + kiểm tra thủ công trên trình duyệt.

---

### Task 1: Data model + storage layer cho snapshot/exchange-rate

**Files:**
- Create: `types/pricing.ts`
- Modify: `types/trading.ts`
- Modify: `lib/storage.ts`
- Modify: `lib/storage.test.ts`

**Interfaces:**
- Produces: `CurrencyId = string`; `PriceSnapshot { id, queryId, capturedAt, sampleSize, medianChaos, averageChaos }`; `ExchangeRateCache { league, fetchedAt, rates: Record<CurrencyId, number> }`; `TradeState.snapshots: PriceSnapshot[]`; `TradeState.exchangeRate: ExchangeRateCache | null`; `recordSnapshot(input: Omit<PriceSnapshot, 'id'>): Promise<TradeState>`; `setExchangeRateCache(cache: ExchangeRateCache): Promise<TradeState>`; `MAX_SNAPSHOTS_PER_QUERY = 90`.

- [ ] **Step 1: Tạo `types/pricing.ts`**

```ts
export type CurrencyId = string

export interface PriceSnapshot {
  id: string
  queryId: string
  capturedAt: number
  sampleSize: number
  medianChaos: number
  averageChaos: number
}

export interface ExchangeRateCache {
  league: string
  fetchedAt: number
  rates: Record<CurrencyId, number>
}
```

- [ ] **Step 2: Mở rộng `types/trading.ts`**

Thêm import ở đầu file và hai field vào `TradeState`:

```ts
import type { ExchangeRateCache, PriceSnapshot } from './pricing'
```

```ts
export interface TradeState {
  version: 1
  folders: SearchFolder[]
  searches: SavedSearch[]
  history: HistoryEntry[]
  settings: TradeSettings
  snapshots: PriceSnapshot[]
  exchangeRate: ExchangeRateCache | null
}
```

- [ ] **Step 3: Viết test thất bại cho `recordSnapshot`/`setExchangeRateCache` trong `lib/storage.test.ts`**

Sửa dòng import cuối cùng ở đầu file (thêm hai hàm mới) và cập nhật `makeState()` để có hai field mới:

```ts
import { DEFAULT_FOLDER_ID, STORAGE_KEY, recordSnapshot, removeFolder, renameFolder, setExchangeRateCache } from './storage'
```

Trong `makeState()`, thêm sau `history: [],`:

```ts
    snapshots: [],
    exchangeRate: null,
```

Thêm hai `describe` mới vào cuối file:

```ts
describe('recordSnapshot', () => {
  it('adds a snapshot for a query with no prior snapshots', async () => {
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 100, sampleSize: 10, medianChaos: 5, averageChaos: 6 })
    expect(state.snapshots).toHaveLength(1)
    expect(state.snapshots[0]).toMatchObject({ queryId: 'q1', capturedAt: 100, sampleSize: 10, medianChaos: 5, averageChaos: 6 })
    expect(state.snapshots[0]!.id).toBeTruthy()
  })

  it('keeps only the newest 90 snapshots per query (FIFO)', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      snapshots: Array.from({ length: 90 }, (_, i) => ({
        id: `old-${i}`, queryId: 'q1', capturedAt: i, sampleSize: 10, medianChaos: 1, averageChaos: 1,
      })),
    }
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 999, sampleSize: 10, medianChaos: 9, averageChaos: 9 })
    const forQuery = state.snapshots.filter((s) => s.queryId === 'q1')
    expect(forQuery).toHaveLength(90)
    expect(forQuery[0]!.capturedAt).toBe(999)
    expect(forQuery.some((s) => s.id === 'old-0')).toBe(false)
  })

  it('does not affect snapshots of other queries', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      snapshots: [{ id: 'other', queryId: 'q2', capturedAt: 1, sampleSize: 10, medianChaos: 1, averageChaos: 1 }],
    }
    const state = await recordSnapshot({ queryId: 'q1', capturedAt: 2, sampleSize: 10, medianChaos: 2, averageChaos: 2 })
    expect(state.snapshots.find((s) => s.queryId === 'q2')).toBeTruthy()
    expect(state.snapshots).toHaveLength(2)
  })
})

describe('setExchangeRateCache', () => {
  it('stores the exchange rate cache', async () => {
    const state = await setExchangeRateCache({ league: 'Standard', fetchedAt: 123, rates: { divine: 180 } })
    expect(state.exchangeRate).toEqual({ league: 'Standard', fetchedAt: 123, rates: { divine: 180 } })
  })
})
```

- [ ] **Step 4: Chạy test, xác nhận fail vì thiếu export**

Run: `bun run test lib/storage.test.ts`
Expected: FAIL — `recordSnapshot`/`setExchangeRateCache` is not exported from `./storage`.

- [ ] **Step 5: Implement trong `lib/storage.ts`**

Thêm import ở đầu file:

```ts
import type { ExchangeRateCache, PriceSnapshot } from '@/types/pricing'
```

Sửa `createDefaultState()` — thêm hai field vào object trả về (sau `history: [],`):

```ts
    snapshots: [],
    exchangeRate: null,
```

Sửa `sanitizeState()` — thêm hai field vào object trả về (sau `history: Array.isArray(candidate.history) ? candidate.history : [],`):

```ts
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : [],
    exchangeRate: candidate.exchangeRate ?? null,
```

Thêm hằng số + hai hàm mới vào cuối file:

```ts
export const MAX_SNAPSHOTS_PER_QUERY = 90

export async function recordSnapshot(input: Omit<PriceSnapshot, 'id'>) {
  const state = await readState()
  const entry: PriceSnapshot = { ...input, id: uid('snapshot') }
  const forQuery = state.snapshots.filter((snapshot) => snapshot.queryId === input.queryId)
  const others = state.snapshots.filter((snapshot) => snapshot.queryId !== input.queryId)
  const nextForQuery = [entry, ...forQuery].slice(0, MAX_SNAPSHOTS_PER_QUERY)
  state.snapshots = [...others, ...nextForQuery]
  return writeState(state)
}

export async function setExchangeRateCache(cache: ExchangeRateCache) {
  const state = await readState()
  state.exchangeRate = cache
  return writeState(state)
}
```

- [ ] **Step 6: Chạy lại toàn bộ test storage, xác nhận pass**

Run: `bun run test lib/storage.test.ts`
Expected: PASS, tất cả test (cũ + mới) đều xanh.

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: không lỗi mới (mọi chỗ dùng `TradeState` khác trong repo — `useTradeStore.ts`, `App.vue`×2 — vẫn build được vì hai field mới không bắt buộc phải set thủ công ở nơi khác, chỉ `createDefaultState`/`sanitizeState` cần set).

- [ ] **Step 8: Commit**

```bash
git add types/pricing.ts types/trading.ts lib/storage.ts lib/storage.test.ts
git commit -m "feat: add price snapshot and exchange rate cache to trade state"
```

---

### Task 2: `useTradeStore` wrapper cho snapshot/exchange-rate

**Files:**
- Modify: `composables/useTradeStore.ts`

**Interfaces:**
- Consumes: `recordSnapshot`, `setExchangeRateCache` từ `lib/storage.ts` (Task 1).
- Produces: `useTradeStore().recordSnapshot(input: Omit<PriceSnapshot, 'id'>): Promise<void>`; `useTradeStore().setExchangeRateCache(cache: ExchangeRateCache): Promise<void>`.

Không có test tự động cho file này (không có `useTradeStore.test.ts` sẵn có trong repo — theo đúng convention hiện tại, composable này chỉ là wrapper mỏng gọi `run()`).

- [ ] **Step 1: Sửa import trong `composables/useTradeStore.ts`**

Thêm vào khối import từ `@/lib/storage`:

```ts
  recordSnapshot as recordStoredSnapshot,
  setExchangeRateCache as setStoredExchangeRateCache,
```

Thêm vào khối `import type ... from '@/types/trading'`:

```ts
import type { ExchangeRateCache, PriceSnapshot } from '@/types/pricing'
```

- [ ] **Step 2: Thêm hai method vào object trả về của `useTradeStore()`**

Thêm sau dòng `importState: (value: unknown) => run(importStoredState(value)),`:

```ts
    recordSnapshot: (input: Omit<PriceSnapshot, 'id'>) => run(recordStoredSnapshot(input)),
    setExchangeRateCache: (cache: ExchangeRateCache) => run(setStoredExchangeRateCache(cache)),
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add composables/useTradeStore.ts
git commit -m "feat: expose recordSnapshot and setExchangeRateCache on useTradeStore"
```

---

### Task 3: Tính toán thuần cho snapshot giá — `lib/price-snapshot.ts`

**Files:**
- Create: `lib/price-snapshot.ts`
- Create: `lib/price-snapshot.test.ts`

**Interfaces:**
- Consumes: `CurrencyId` từ `@/types/pricing` (Task 1).
- Produces: `RawListing { amount: number; currency: CurrencyId }`; `ComputedSnapshot { sampleSize: number; medianChaos: number; averageChaos: number }`; `computeSnapshot(listings: RawListing[], rates: Record<CurrencyId, number>): ComputedSnapshot | null`; `readListingPrices(root?: ParentNode): RawListing[]`.

- [ ] **Step 1: Viết test thất bại cho `computeSnapshot`**

```ts
import { describe, expect, it } from 'vitest'
import { computeSnapshot } from './price-snapshot'

describe('computeSnapshot', () => {
  it('returns null when fewer than 6 valid listings', () => {
    const listings = [
      { amount: 1, currency: 'chaos' },
      { amount: 2, currency: 'chaos' },
      { amount: 3, currency: 'chaos' },
      { amount: 4, currency: 'chaos' },
      { amount: 5, currency: 'chaos' },
    ]
    expect(computeSnapshot(listings, {})).toBeNull()
  })

  it('drops the 5 cheapest listings before computing median/average', () => {
    const listings = Array.from({ length: 10 }, (_, i) => ({ amount: i + 1, currency: 'chaos' }))
    const result = computeSnapshot(listings, {})
    expect(result).toEqual({ sampleSize: 5, medianChaos: 8, averageChaos: 8 })
  })

  it('normalizes non-chaos currency using the provided rate', () => {
    const listings = [
      { amount: 1, currency: 'chaos' },
      { amount: 2, currency: 'chaos' },
      { amount: 3, currency: 'chaos' },
      { amount: 4, currency: 'chaos' },
      { amount: 5, currency: 'chaos' },
      { amount: 1, currency: 'divine' },
    ]
    const result = computeSnapshot(listings, { divine: 180 })
    expect(result).toEqual({ sampleSize: 1, medianChaos: 180, averageChaos: 180 })
  })

  it('excludes listings whose currency has no known rate', () => {
    const listings = [
      ...Array.from({ length: 6 }, (_, i) => ({ amount: i + 1, currency: 'chaos' })),
      { amount: 1, currency: 'mystery-currency' },
    ]
    const result = computeSnapshot(listings, {})
    expect(result).toEqual({ sampleSize: 1, medianChaos: 6, averageChaos: 6 })
  })

  it('computes median as the average of the two middle values for an even kept count', () => {
    const listings = Array.from({ length: 9 }, (_, i) => ({ amount: i + 1, currency: 'chaos' }))
    const result = computeSnapshot(listings, {})
    expect(result?.medianChaos).toBe(7.5)
    expect(result?.averageChaos).toBe(7.5)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `bun run test lib/price-snapshot.test.ts`
Expected: FAIL — không tìm thấy module `./price-snapshot`.

- [ ] **Step 3: Implement `lib/price-snapshot.ts`**

```ts
import type { CurrencyId } from '@/types/pricing'

export interface RawListing {
  amount: number
  currency: CurrencyId
}

export interface ComputedSnapshot {
  sampleSize: number
  medianChaos: number
  averageChaos: number
}

const MIN_SAMPLE_SIZE = 6
const DROP_CHEAPEST = 5

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function computeSnapshot(
  listings: RawListing[],
  rates: Record<CurrencyId, number>,
): ComputedSnapshot | null {
  const chaosValues = listings
    .map((listing) => {
      if (listing.currency === 'chaos') return listing.amount
      const rate = rates[listing.currency]
      return rate != null ? listing.amount * rate : null
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)

  if (chaosValues.length < MIN_SAMPLE_SIZE) return null

  const kept = chaosValues.slice(DROP_CHEAPEST)
  const sum = kept.reduce((total, value) => total + value, 0)

  return {
    sampleSize: kept.length,
    medianChaos: median(kept),
    averageChaos: sum / kept.length,
  }
}

// Đọc trực tiếp từ DOM trang kết quả trade — chạy được từ isolated-world content script
// (DOM dùng chung giữa MAIN world và isolated world dù JS context tách biệt).
// Cấu trúc đã verify trên pathofexile.com/trade2 (2026-09-04):
//   <span data-field="price">
//     <span class="price-label buyout-price">Asking Price:</span>
//     <span>1</span><span>×</span>
//     <span class="currency-text currency-image"><img alt="regal">...</span>
//   </span>
// [data-field="fee"] (Gold sink riêng của POE2) bị loại vì nó không mang [data-field="price"].
export function readListingPrices(root: ParentNode = document): RawListing[] {
  const listings: RawListing[] = []
  root.querySelectorAll('[data-field="price"]').forEach((el) => {
    const img = el.querySelector('img')
    const amountEl = [...el.querySelectorAll(':scope > span')]
      .find((span) => !span.classList.contains('price-label'))
    const amount = amountEl ? Number(amountEl.textContent) : Number.NaN
    if (img?.alt && !Number.isNaN(amount)) listings.push({ amount, currency: img.alt })
  })
  return listings
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run: `bun run test lib/price-snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/price-snapshot.ts lib/price-snapshot.test.ts
git commit -m "feat: add pure price snapshot median/average calculation"
```

---

### Task 4: Tỷ giá exchange — `lib/exchange-rate.ts`

**Files:**
- Create: `lib/exchange-rate.ts`
- Create: `lib/exchange-rate.test.ts`

**Interfaces:**
- Consumes: `CurrencyId` từ `@/types/pricing`; `Game` từ `@/types/trading`.
- Produces: `buildExchangeUrl(game: Game, league: string): string`; `buildExchangeBody(currencies: CurrencyId[]): object`; `parseExchangeRatios(response: { result?: Record<string, { listing?: { offers?: Array<{ exchange: { currency: CurrencyId; amount: number }; item: { currency: CurrencyId; amount: number } }> } }> }): Record<CurrencyId, number>`; `fetchExchangeRates(game: Game, league: string, currencies: CurrencyId[]): Promise<Record<CurrencyId, number>>`.

- [ ] **Step 1: Viết test thất bại**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildExchangeBody, buildExchangeUrl, fetchExchangeRates, parseExchangeRatios } from './exchange-rate'

describe('buildExchangeUrl', () => {
  it('uses /api/trade2/exchange for poe2', () => {
    expect(buildExchangeUrl('poe2', 'Standard')).toBe('https://www.pathofexile.com/api/trade2/exchange/Standard')
  })

  it('uses /api/trade/exchange for poe1', () => {
    expect(buildExchangeUrl('poe1', 'Standard')).toBe('https://www.pathofexile.com/api/trade/exchange/Standard')
  })
})

describe('buildExchangeBody', () => {
  it('wants chaos and lists the given have currencies', () => {
    expect(buildExchangeBody(['divine', 'exalted'])).toEqual({
      query: { status: { option: 'online' }, have: ['divine', 'exalted'], want: ['chaos'] },
      sort: { have: 'asc' },
    })
  })
})

describe('parseExchangeRatios', () => {
  it('computes the median chaos-per-unit ratio for each have currency', () => {
    const response = {
      result: {
        a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 150 } }] } },
        b: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 200 } }] } },
        c: { listing: { offers: [{ exchange: { currency: 'divine', amount: 2 }, item: { currency: 'chaos', amount: 500 } }] } },
      },
    }
    expect(parseExchangeRatios(response)).toEqual({ divine: 200 })
  })

  it('ignores offers that do not resolve to chaos', () => {
    const response = {
      result: {
        a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'exalted', amount: 12 } }] } },
      },
    }
    expect(parseExchangeRatios(response)).toEqual({})
  })

  it('returns an empty map when result is missing', () => {
    expect(parseExchangeRatios({ result: {} })).toEqual({})
  })
})

describe('fetchExchangeRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns {} without calling fetch when currencies is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const rates = await fetchExchangeRates('poe2', 'Standard', [])
    expect(rates).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the built request and parses the response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          a: { listing: { offers: [{ exchange: { currency: 'divine', amount: 1 }, item: { currency: 'chaos', amount: 180 } }] } },
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const rates = await fetchExchangeRates('poe2', 'Standard', ['divine'])

    expect(rates).toEqual({ divine: 180 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.pathofexile.com/api/trade2/exchange/Standard',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('returns {} when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const rates = await fetchExchangeRates('poe2', 'Standard', ['divine'])
    expect(rates).toEqual({})
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `bun run test lib/exchange-rate.test.ts`
Expected: FAIL — module `./exchange-rate` không tồn tại.

- [ ] **Step 3: Implement `lib/exchange-rate.ts`**

```ts
import type { CurrencyId } from '@/types/pricing'
import type { Game } from '@/types/trading'

interface ExchangeOffer {
  exchange: { currency: CurrencyId; amount: number }
  item: { currency: CurrencyId; amount: number }
}

interface ExchangeApiResponse {
  result?: Record<string, { listing?: { offers?: ExchangeOffer[] } }>
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function buildExchangeUrl(game: Game, league: string): string {
  const root = game === 'poe2' ? 'trade2' : 'trade'
  return `https://www.pathofexile.com/api/${root}/exchange/${encodeURIComponent(league)}`
}

export function buildExchangeBody(currencies: CurrencyId[]) {
  return {
    query: { status: { option: 'online' }, have: currencies, want: ['chaos'] },
    sort: { have: 'asc' },
  }
}

export function parseExchangeRatios(response: ExchangeApiResponse): Record<CurrencyId, number> {
  const byCurrency = new Map<CurrencyId, number[]>()

  for (const entry of Object.values(response.result ?? {})) {
    const offer = entry.listing?.offers?.[0]
    if (!offer || offer.item.currency !== 'chaos' || offer.exchange.amount <= 0) continue

    const ratio = offer.item.amount / offer.exchange.amount
    const list = byCurrency.get(offer.exchange.currency) ?? []
    list.push(ratio)
    byCurrency.set(offer.exchange.currency, list)
  }

  const rates: Record<CurrencyId, number> = {}
  for (const [currency, ratios] of byCurrency) {
    rates[currency] = median([...ratios].sort((a, b) => a - b))
  }
  return rates
}

export async function fetchExchangeRates(
  game: Game,
  league: string,
  currencies: CurrencyId[],
): Promise<Record<CurrencyId, number>> {
  if (!currencies.length) return {}

  const res = await fetch(buildExchangeUrl(game, league), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildExchangeBody(currencies)),
  })
  if (!res.ok) return {}

  const json = await res.json() as ExchangeApiResponse
  return parseExchangeRatios(json)
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run: `bun run test lib/exchange-rate.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/exchange-rate.ts lib/exchange-rate.test.ts
git commit -m "feat: fetch and parse GGG bulk exchange rates"
```

---

### Task 5: Format hiển thị giá — `lib/format-price.ts`

**Files:**
- Create: `lib/format-price.ts`
- Create: `lib/format-price.test.ts`

**Interfaces:**
- Produces: `formatChaos(amount: number): string`; `formatChaosWithDivine(chaosAmount: number, divineRate?: number): string`; `formatDelta(current: number, previous: number): string | null`.

- [ ] **Step 1: Viết test thất bại**

```ts
import { describe, expect, it } from 'vitest'
import { formatChaos, formatChaosWithDivine, formatDelta } from './format-price'

describe('formatChaos', () => {
  it('formats amounts under 10 with up to 2 decimals, trimming trailing zeros', () => {
    expect(formatChaos(1)).toBe('1')
    expect(formatChaos(0.5)).toBe('0.5')
    expect(formatChaos(1.25)).toBe('1.25')
  })

  it('formats amounts 10-99 with at most 1 decimal', () => {
    expect(formatChaos(12.34)).toBe('12.3')
    expect(formatChaos(50)).toBe('50')
  })

  it('rounds amounts 100-999 to whole numbers', () => {
    expect(formatChaos(456.7)).toBe('457')
  })

  it('formats amounts 1000+ as compact k-notation', () => {
    expect(formatChaos(1234)).toBe('1.2k')
    expect(formatChaos(2000)).toBe('2k')
  })
})

describe('formatChaosWithDivine', () => {
  it('appends the divine-equivalent when a rate is given', () => {
    expect(formatChaosWithDivine(180, 180)).toBe('180c (≈1.00 div)')
  })

  it('omits the divine suffix when no rate is available', () => {
    expect(formatChaosWithDivine(50)).toBe('50c')
  })

  it('omits the divine suffix when the divine-equivalent rounds to under 0.01', () => {
    expect(formatChaosWithDivine(1, 1000)).toBe('1c')
  })
})

describe('formatDelta', () => {
  it('formats a positive change with a leading +', () => {
    expect(formatDelta(120, 100)).toBe('+20%')
  })

  it('formats a negative change', () => {
    expect(formatDelta(80, 100)).toBe('-20%')
  })

  it('returns "0%" for no change', () => {
    expect(formatDelta(100, 100)).toBe('0%')
  })

  it('returns null when there is no previous value to compare against', () => {
    expect(formatDelta(100, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `bun run test lib/format-price.test.ts`
Expected: FAIL — module `./format-price` không tồn tại.

- [ ] **Step 3: Implement `lib/format-price.ts`**

```ts
export function formatChaos(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (amount >= 100) return Math.round(amount).toString()
  if (amount >= 10) return amount.toFixed(1).replace(/\.0$/, '')
  return amount.toFixed(2).replace(/\.?0+$/, '')
}

export function formatChaosWithDivine(chaosAmount: number, divineRate?: number): string {
  const base = `${formatChaos(chaosAmount)}c`
  if (!divineRate || divineRate <= 0) return base

  const divineAmount = chaosAmount / divineRate
  if (divineAmount < 0.01) return base

  return `${base} (≈${divineAmount.toFixed(2)} div)`
}

export function formatDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null

  const rounded = Math.round(((current - previous) / previous) * 100)
  if (rounded === 0) return '0%'
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run: `bun run test lib/format-price.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/format-price.ts lib/format-price.test.ts
git commit -m "feat: add chaos/divine price formatting helpers"
```

---

### Task 6: Composable orchestration — `composables/usePriceSnapshot.ts`

**Files:**
- Create: `composables/usePriceSnapshot.ts`

**Interfaces:**
- Consumes: `useTradeStore()` (Task 2, cụ thể `state`, `recordSnapshot`, `setExchangeRateCache`); `readListingPrices`, `computeSnapshot` từ `@/lib/price-snapshot` (Task 3); `fetchExchangeRates` từ `@/lib/exchange-rate` (Task 4); `TradePage` từ `@/types/trading`.
- Produces: `usePriceSnapshot(): { maybeCaptureSnapshot(page: TradePage | null): Promise<void>; watchResultsForSnapshot(getPage: () => TradePage | null): () => void }`.

Không có test tự động (đụng `document`/`fetch` qua các lib đã test riêng ở Task 3-4; bản thân composable chỉ orchestrate). Verify bằng typecheck + kiểm tra thủ công ở Task 9.

- [ ] **Step 1: Tạo `composables/usePriceSnapshot.ts`**

```ts
import { fetchExchangeRates } from '@/lib/exchange-rate'
import { computeSnapshot, readListingPrices } from '@/lib/price-snapshot'
import { useTradeStore } from '@/composables/useTradeStore'
import type { CurrencyId } from '@/types/pricing'
import type { TradePage } from '@/types/trading'

const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000
const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const OBSERVER_DEBOUNCE_MS = 800

export function usePriceSnapshot() {
  const store = useTradeStore()

  async function maybeCaptureSnapshot(page: TradePage | null) {
    if (!page || page.mode !== 'search' || !page.queryId) return

    const queryId = page.queryId
    const now = Date.now()
    const lastForQuery = store.state.value.snapshots
      .filter((snapshot) => snapshot.queryId === queryId)
      .reduce<number>((latest, snapshot) => Math.max(latest, snapshot.capturedAt), 0)
    if (now - lastForQuery < SNAPSHOT_THROTTLE_MS) return

    const listings = readListingPrices()
    if (!listings.length) return

    const currencies = [...new Set(listings.map((listing) => listing.currency))]
      .filter((currency) => currency !== 'chaos')

    const cache = store.state.value.exchangeRate
    const cacheFresh = cache != null && cache.league === page.league && now - cache.fetchedAt < RATE_CACHE_TTL_MS
    const missing = currencies.filter((currency) => !cacheFresh || !(currency in cache!.rates))

    let rates: Record<CurrencyId, number> = cacheFresh ? { ...cache!.rates } : {}
    if (missing.length) {
      const fetched = await fetchExchangeRates(page.game, page.league, missing)
      rates = { ...rates, ...fetched }
      await store.setExchangeRateCache({ league: page.league, fetchedAt: now, rates })
    }

    const result = computeSnapshot(listings, rates)
    if (!result) return

    await store.recordSnapshot({ queryId, capturedAt: now, ...result })
  }

  function watchResultsForSnapshot(getPage: () => TradePage | null) {
    let debounceTimer: number | undefined
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => void maybeCaptureSnapshot(getPage()), OBSERVER_DEBOUNCE_MS)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }

  return { maybeCaptureSnapshot, watchResultsForSnapshot }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add composables/usePriceSnapshot.ts
git commit -m "feat: orchestrate price snapshot capture with throttle and rate cache"
```

---

### Task 7: Nối vào `entrypoints/trade.content/App.vue`

**Files:**
- Modify: `entrypoints/trade.content/App.vue`

**Interfaces:**
- Consumes: `usePriceSnapshot()` (Task 6).

- [ ] **Step 1: Thêm import**

Thêm sau `import { useTradeStore } from '@/composables/useTradeStore'` (dòng 7):

```ts
import { usePriceSnapshot } from '@/composables/usePriceSnapshot'
```

- [ ] **Step 2: Khởi tạo composable**

Thêm sau `const store = useTradeStore()` (dòng 29):

```ts
const priceSnapshot = usePriceSnapshot()
```

- [ ] **Step 3: Gắn watcher vào lifecycle**

Thêm biến module-level cạnh `let lastRecordedUrl = ''` (dòng 36):

```ts
let stopWatchingResults: (() => void) | undefined
```

Trong `onMounted` (dòng 122-128), thêm dòng cuối:

```ts
  stopWatchingResults = priceSnapshot.watchResultsForSnapshot(() => currentPage.value)
```

Trong `onBeforeUnmount` (dòng 130-134), thêm:

```ts
  stopWatchingResults?.()
```

- [ ] **Step 4: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: cả hai đều PASS.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/trade.content/App.vue
git commit -m "feat: capture price snapshots when trade results settle"
```

---

### Task 8: Dòng median dưới tên search — `components/SearchCard.vue`

**Files:**
- Modify: `components/SearchCard.vue`
- Modify: `locales/vi.json`
- Modify: `locales/en.json`

**Interfaces:**
- Consumes: `store.state.value.snapshots: PriceSnapshot[]`, `store.state.value.exchangeRate` (Task 1); `formatChaosWithDivine`, `formatDelta` từ `@/lib/format-price` (Task 5).

- [ ] **Step 1: Thêm i18n key**

`locales/vi.json`, trong khối `"search"`, thêm sau `"cancelEditTitleLabel": "Hủy đổi tên"`:

```json
    "cancelEditTitleLabel": "Hủy đổi tên",
    "medianPrice": "Trung vị: {price}"
```

`locales/en.json`, tương tự:

```json
    "cancelEditTitleLabel": "Cancel rename",
    "medianPrice": "Median: {price}"
```

- [ ] **Step 2: Sửa `<script setup>` của `SearchCard.vue`**

Sửa dòng import Vue (dòng 2) từ:

```ts
import { ref, watch } from 'vue'
```

thành:

```ts
import { computed, ref, watch } from 'vue'
```

Thêm import mới sau dòng `import { resolveEditedTitle } from '@/lib/edit-title'` (dòng 8):

```ts
import { formatChaosWithDivine, formatDelta } from '@/lib/format-price'
```

Thêm computed mới sau khối `const store = useTradeStore()` (dòng 20):

```ts
const priceLine = computed(() => {
  if (!props.search.queryId) return null

  const snapshots = store.state.value.snapshots
    .filter((snapshot) => snapshot.queryId === props.search.queryId)
    .sort((a, b) => b.capturedAt - a.capturedAt)
  const latest = snapshots[0]
  if (!latest) return null

  const divineRate = store.state.value.exchangeRate?.rates.divine
  const previous = snapshots[1]

  return {
    median: formatChaosWithDivine(latest.medianChaos, divineRate),
    delta: previous ? formatDelta(latest.medianChaos, previous.medianChaos) : null,
  }
})
```

- [ ] **Step 3: Sửa template**

Thêm dòng mới ngay sau title span, trước dòng `note` (dòng 81-82):

```html
      <span class="line-clamp-2 font-display text-[15px] leading-5 text-cream">{{ search.title }}</span>
      <span v-if="priceLine" class="mt-1 block text-[12px] leading-[18px] text-dim">
        {{ i18n.t('search.medianPrice', { price: priceLine.median }) }}
        <span
          v-if="priceLine.delta"
          :class="priceLine.delta.startsWith('+') ? 'text-danger' : priceLine.delta === '0%' ? 'text-dim' : 'text-tan'"
        >
          {{ priceLine.delta }}
        </span>
      </span>
      <span v-if="search.note" class="mt-1 line-clamp-2 block text-[12px] leading-[18px] text-dim">{{ search.note }}</span>
```

(Dòng `search.title` giữ nguyên, chỉ thêm block `priceLine` giữa nó và dòng `search.note` đã có.)

- [ ] **Step 4: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: cả hai PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SearchCard.vue locales/vi.json locales/en.json
git commit -m "feat: show latest median price under each saved search"
```

---

### Task 9: Tab "Price Analysis" — component + wiring

**Files:**
- Create: `components/PriceAnalysisTab.vue`
- Modify: `entrypoints/trade.content/App.vue`
- Modify: `entrypoints/popup/App.vue`
- Modify: `locales/vi.json`
- Modify: `locales/en.json`

**Interfaces:**
- Consumes: `useTradeStore()`, `relativeTime` từ `@/lib/relative-time`, `formatChaosWithDivine`/`formatDelta` từ `@/lib/format-price`.
- Produces: `PriceAnalysisTab.vue` component không nhận prop, tự đọc store.

- [ ] **Step 1: Thêm i18n key**

`locales/vi.json`, trong khối `"panel"`, thêm sau `"tabHistory": "Gần đây",`:

```json
    "tabHistory": "Gần đây",
    "tabAnalysis": "Phân tích giá",
```

Thêm khối mới `"analysis"` sau khối `"history"` (sau dòng `"clear": "Xóa lịch sử"` đóng ngoặc):

```json
  "analysis": {
    "empty": "Chưa có snapshot giá nào. Mở một search đã lưu để bắt đầu theo dõi.",
    "back": "Quay lại",
    "average": "Trung bình: {price}"
  },
```

`locales/en.json`, tương tự:

```json
    "tabHistory": "Recent",
    "tabAnalysis": "Price Analysis",
```

```json
  "analysis": {
    "empty": "No price snapshots yet. Open a saved search to start tracking.",
    "back": "Back",
    "average": "Average: {price}"
  },
```

- [ ] **Step 2: Tạo `components/PriceAnalysisTab.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { i18n } from '#i18n'
import { useTradeStore } from '@/composables/useTradeStore'
import { formatChaosWithDivine, formatDelta } from '@/lib/format-price'
import { relativeTime } from '@/lib/relative-time'

const store = useTradeStore()
const selectedQueryId = ref<string | null>(null)

interface TrackedQuery {
  queryId: string
  title: string
  latestCapturedAt: number
}

function resolveTitle(queryId: string): string {
  return store.state.value.searches.find((search) => search.queryId === queryId)?.title
    ?? store.state.value.history.find((entry) => entry.queryId === queryId)?.title
    ?? queryId
}

const trackedQueries = computed<TrackedQuery[]>(() => {
  const latestByQuery = new Map<string, number>()
  for (const snapshot of store.state.value.snapshots) {
    latestByQuery.set(snapshot.queryId, Math.max(latestByQuery.get(snapshot.queryId) ?? 0, snapshot.capturedAt))
  }
  return [...latestByQuery.entries()]
    .map(([queryId, latestCapturedAt]) => ({ queryId, latestCapturedAt, title: resolveTitle(queryId) }))
    .sort((a, b) => b.latestCapturedAt - a.latestCapturedAt)
})

const selectedSnapshots = computed(() => {
  if (!selectedQueryId.value) return []
  return store.state.value.snapshots
    .filter((snapshot) => snapshot.queryId === selectedQueryId.value)
    .sort((a, b) => b.capturedAt - a.capturedAt)
})

const divineRate = computed(() => store.state.value.exchangeRate?.rates.divine)

function deltaAt(index: number) {
  const current = selectedSnapshots.value[index]
  const previous = selectedSnapshots.value[index + 1]
  return current && previous ? formatDelta(current.medianChaos, previous.medianChaos) : null
}
</script>

<template>
  <section>
    <template v-if="!selectedQueryId">
      <button
        v-for="query in trackedQueries"
        :key="query.queryId"
        class="flex w-full items-center justify-between border-b border-rule px-4 py-2.5 text-left hover:bg-hover"
        type="button"
        @click="selectedQueryId = query.queryId"
      >
        <span class="line-clamp-2 text-[13px] leading-5 text-grey">{{ query.title }}</span>
        <span class="shrink-0 pl-2 text-[12px] leading-5 text-dim">{{ relativeTime(query.latestCapturedAt) }}</span>
      </button>
      <p v-if="!trackedQueries.length" class="px-4 py-6 leading-5 text-dim">
        {{ i18n.t('analysis.empty') }}
      </p>
    </template>

    <template v-else>
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-tan hover:text-cream"
        type="button"
        @click="selectedQueryId = null"
      >
        &larr; {{ i18n.t('analysis.back') }}
      </button>
      <div v-for="(snapshot, index) in selectedSnapshots" :key="snapshot.id" class="border-b border-rule px-4 py-2.5">
        <div class="flex items-center justify-between">
          <span class="font-display text-[15px] text-cream">{{ formatChaosWithDivine(snapshot.medianChaos, divineRate) }}</span>
          <span class="text-[12px] text-dim">{{ relativeTime(snapshot.capturedAt) }}</span>
        </div>
        <div class="mt-0.5 text-[12px] text-dim">
          {{ i18n.t('analysis.average', { price: formatChaosWithDivine(snapshot.averageChaos, divineRate) }) }}
          <span v-if="deltaAt(index)">· {{ deltaAt(index) }}</span>
        </div>
      </div>
    </template>
  </section>
</template>
```

- [ ] **Step 3: Wiring tab thứ ba vào `entrypoints/trade.content/App.vue`**

Sửa `loadUiState()` (dòng 17-26) — đổi type và fallback:

```ts
function loadUiState(): { open: boolean; tab: 'saved' | 'history' | 'analysis' } {
  try {
    const raw = window.sessionStorage.getItem(UI_STATE_KEY)
    if (!raw) return { open: false, tab: 'saved' }
    const parsed = JSON.parse(raw) as Partial<{ open: boolean; tab: 'saved' | 'history' | 'analysis' }>
    const tab = parsed.tab === 'history' || parsed.tab === 'analysis' ? parsed.tab : 'saved'
    return { open: parsed.open ?? false, tab }
  } catch {
    return { open: false, tab: 'saved' }
  }
}
```

Sửa khai báo `tab` (dòng 31):

```ts
const tab = ref<'saved' | 'history' | 'analysis'>(uiState.tab)
```

Thêm import component sau dòng `import FolderSection from '@/components/FolderSection.vue'` (dòng 6):

```ts
import PriceAnalysisTab from '@/components/PriceAnalysisTab.vue'
```

Sửa mảng tab trong template (dòng 170-173) — thêm phần tử thứ ba:

```html
          v-for="item in [
            { id: 'saved', label: savedCount ? i18n.t('panel.tabSavedCount', { count: savedCount }) : i18n.t('panel.tabSaved') },
            { id: 'history', label: i18n.t('panel.tabHistory') },
            { id: 'analysis', label: i18n.t('panel.tabAnalysis') },
          ]"
```

Sửa khối nội dung tab: KHÔNG chạm nội dung bên trong hai khối `template` hiện có (dòng 188-218 cho `saved`, dòng 220-238 cho `history`) — chỉ đổi đúng một dòng mở đầu khối thứ hai, rồi chèn một khối `template` mới ngay sau nó.

Đổi dòng 220 từ:

```html
        <template v-else>
```

thành:

```html
        <template v-else-if="tab === 'history'">
```

Chèn khối mới ngay sau dòng đóng `</template>` hiện tại của khối history (dòng 238, trước dòng `</div>` đóng `trade-companion-scroll` ở dòng 239):

```html
        <template v-else>
          <PriceAnalysisTab />
        </template>
```

- [ ] **Step 4: Wiring tab thứ ba vào `entrypoints/popup/App.vue`**

Sửa type (dòng 12):

```ts
type View = 'saved' | 'history' | 'settings' | 'analysis'
```

Thêm import sau dòng `import FolderSection from '@/components/FolderSection.vue'` (dòng 6):

```ts
import PriceAnalysisTab from '@/components/PriceAnalysisTab.vue'
```

Sửa mảng tab trong template (dòng 114-118) — thêm phần tử trước `settings`:

```html
          { id: 'saved', label: store.state.value.searches.length ? i18n.t('panel.tabSavedCount', { count: store.state.value.searches.length }) : i18n.t('panel.tabSaved') },
          { id: 'history', label: i18n.t('panel.tabHistory') },
          { id: 'analysis', label: i18n.t('panel.tabAnalysis') },
          { id: 'settings', label: i18n.t('panel.tabSettings') },
```

Thêm section mới trước khối settings (dòng 187, `<section v-else class="flex flex-col gap-6 px-4 py-4">`) — đổi khối settings từ `v-else` thành `v-else-if="view === 'settings'"`, và thêm section analysis ngay trước nó:

```html
    <section v-else-if="view === 'analysis'">
      <PriceAnalysisTab />
    </section>

    <section v-else-if="view === 'settings'" class="flex flex-col gap-6 px-4 py-4">
```

(Đóng thẻ `</section>` cuối cùng của khối settings giữ nguyên; chỉ đổi điều kiện mở đầu của nó và chèn section mới phía trước.)

- [ ] **Step 5: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: cả hai PASS.

- [ ] **Step 6: Commit**

```bash
git add components/PriceAnalysisTab.vue entrypoints/trade.content/App.vue entrypoints/popup/App.vue locales/vi.json locales/en.json
git commit -m "feat: add Price Analysis tab to sidebar and popup"
```

---

### Task 10: Test suite tổng + xác minh thủ công trên trình duyệt thật

**Files:** không tạo/sửa file mới — chỉ verify.

- [ ] **Step 1: Chạy toàn bộ kiểm tra tự động**

Run: `bun run check`
Expected: `vitest run` PASS toàn bộ (test cũ + mới ở Task 1, 3, 4, 5), `vue-tsc --noEmit` PASS, `wxt build` PASS.

- [ ] **Step 2: Load extension thật và xác minh trên trang trade sống**

Run: `bun run dev` (giữ chạy nền), load unpacked từ `.output/chrome-mv3-dev` vào Chrome, mở một trang `pathofexile.com/trade2/search/<league>/<queryId>` đã save trong Trade Companion.

Xác nhận trực tiếp trong DevTools console của trang (không phải giả định):
- Sau khi kết quả load xong (~1-2s), không có lỗi JS mới trong console liên quan tới `usePriceSnapshot`/`price-snapshot`/`exchange-rate`.
- `chrome.storage.local.get('exile-trade-companion-state')` (chạy trong console extension hoặc qua panel) cho thấy `snapshots` có entry mới với `queryId` khớp URL hiện tại, `medianChaos > 0`.
- Nếu search có listing không phải chaos, `exchangeRate.rates` có key tương ứng (vd `divine`) sau lần capture đầu.
- Mở lại sidebar, tab "Đã lưu" → search vừa mở hiện dòng "Trung vị: ..." dưới tên.
- Chuyển sang tab "Phân tích giá" → thấy search đó trong danh sách, bấm vào thấy ít nhất 1 snapshot.
- Mở lại đúng trang đó trong vòng 1 giờ → xác nhận snapshot KHÔNG tăng thêm (throttle hoạt động) bằng cách kiểm tra `snapshots.length` cho `queryId` đó không đổi.

- [ ] **Step 3: Ghi nhận kết quả**

Nếu bước 2 phát hiện lệch so với thiết kế (vd selector `[data-field="price"]` không khớp trên league/trang cụ thể đang test, hoặc response `/api/trade/exchange` cho POE1 khác shape so với POE2 đã verify) — dừng lại, sửa `lib/price-snapshot.ts`/`lib/exchange-rate.ts` tương ứng, chạy lại Step 1-2 trước khi coi task hoàn tất. Đây là bước bắt buộc, không bỏ qua kể cả khi Step 1 xanh toàn bộ — theo đúng spec: giả định về POE1 exchange response chưa được verify trực tiếp, đây là cơ hội xác nhận.
