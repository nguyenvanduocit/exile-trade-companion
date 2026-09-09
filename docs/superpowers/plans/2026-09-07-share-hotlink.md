# Share Hotlink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable hotlink alongside every share key so a shared folder can be opened by anyone — a static landing page lists the items and links to `pathofexile.com/trade` for people without the extension, and offers a one-click join for people who have it.

**Architecture:** Bun workspace with two new packages (`packages/shared`, `packages/web`) alongside the untouched extension at repo root. `packages/shared` holds the pure logic already proven in the extension (durable URL builder, Liveblocks room reader, share-mode helpers) so both the extension and the new landing page read the exact same Liveblocks room the exact same way. The extension gains a tiny content-script that marks its own presence on the landing page's domain, and a URL-hash handler on the trade site that auto-opens the existing `JoinFolderModal`.

**Tech Stack:** Bun workspaces, Vue 3, Vite (plain, no WXT) for `packages/web`, `@liveblocks/client` (already a dependency), Vitest, Cloudflare Pages + GitHub Actions for deploy.

**Spec:** `docs/superpowers/specs/2026-09-07-share-hotlink-design.md`

## Global Constraints

- Package manager is `bun` everywhere (root and both new packages).
- Extension code at repo root (`entrypoints/`, `components/`, `lib/`, `composables/`, `types/`) is not moved — only edited in place.
- No custom backend — `packages/web` reads Liveblocks rooms client-side with the same public key the extension already uses (`VITE_LIVEBLOCKS_PUBLIC_KEY`).
- The existing raw share-key UI (input + copy button in `ShareFolderModal.vue`) is not removed or replaced — the hotlink is an addition next to it.
- Detecting the extension on the landing page never auto-redirects; it only reveals a button the user clicks.
- `packages/shared` has no build step — both consumers (`packages/web` via Vite, the extension via WXT/Vite) import its `.ts`/`.vue` source directly through the `workspace:*` protocol.
- All new user-facing text is Vietnamese, matching the rest of the codebase.
- Landing page domain: `poe-trade.aiocean.io` (Cloudflare Pages, custom domain).
- Join hash format: `#etc-join=<shareKey>` on `pathofexile.com/trade` or `/trade2`.

---

### Task 1: Bun workspace scaffold + `packages/shared` core types

**Files:**
- Modify: `package.json` (root — add `workspaces` field)
- Modify: `tsconfig.json` (root — exclude `packages`)
- Modify: `vitest.config.ts` (root — exclude `packages`)
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/types.ts`
- Create: `packages/shared/folder-sync-types.ts`
- Create: `packages/shared/folder-sync-types.test.ts`

**Interfaces:**
- Produces: `SharedTradeQuery`, `SharedTradePage`, `SharedResolvedSearch` (from `types.ts`); `ShareMode`, `SharedFolderMeta`, `SharedSearchFields`, `resolveShareMode(meta: {mode?: ShareMode}): ShareMode`, `isBlankFolderMeta(meta: {name: string}): boolean`, `toSharedTradeQuery(query: Json | undefined): SharedTradeQuery | undefined` (from `folder-sync-types.ts`) — all consumed by later tasks.

- [ ] **Step 1: Add the workspace field to root `package.json`**

Edit `package.json` (`"private": true` is already present on line 4), add `"workspaces": ["packages/*"]` right after it:

```json
{
  "name": "exile-trade-companion",
  "version": "0.3.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "license": "Apache-2.0",
```

- [ ] **Step 2: Exclude `packages` from the root TypeScript project**

Edit `tsconfig.json`, change the `exclude` array:

```json
  "exclude": ["tmp", "scripts", "node_modules", ".output", "packages"]
```

- [ ] **Step 3: Exclude `packages` from the root Vitest run**

Edit `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', 'packages/**'],
  },
})
```

- [ ] **Step 4: Create `packages/shared/package.json`**

```json
{
  "name": "shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@liveblocks/client": "^3.24.1",
    "vue": "^3.5.42"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^5.0.0",
    "vue-tsc": "^3.3.11"
  }
}
```

- [ ] **Step 5: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "preserve",
    "types": ["vitest/globals"]
  },
  "include": ["**/*.ts", "**/*.vue"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {},
})
```

- [ ] **Step 7: Run `bun install` at the repo root**

Run: `bun install`
Expected: lockfile updates, `node_modules/shared` symlinked to `packages/shared` (bun workspace linking). No errors.

- [ ] **Step 8: Write `packages/shared/types.ts`**

These are intentionally *narrower* than the extension's `TradeQuery`/`TradePage` (`types/trading.ts`) — they only describe the fields `buildDurableUrl` actually reads. The extension's concrete types satisfy them structurally, so no changes are needed at extension call sites.

```ts
export type Game = 'poe1' | 'poe2'
export type TradeMode = 'search' | 'exchange'

export interface SharedStatGroupLike {
  filters: unknown[]
}

export interface SharedTradeQuery {
  status: string
  name: string | null
  type: string | null
  term: string | null
  disc: string | null
  stats: SharedStatGroupLike[]
  filters: Record<string, unknown>
  exchange: {
    want: Record<string, unknown>
    have: Record<string, unknown>
  }
}

export interface SharedTradePage {
  url: string
  title: string
  game: Game
  league: string
  mode: TradeMode
  queryId?: string
  query?: SharedTradeQuery
}

export interface SharedResolvedSearch extends SharedTradePage {
  id: string
  folderId: string
  note: string
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 9: Write the failing test for `folder-sync-types.ts`**

Create `packages/shared/folder-sync-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isBlankFolderMeta, resolveShareMode } from './folder-sync-types'

describe('resolveShareMode', () => {
  it('trả "once" khi meta ghi rõ mode once', () => {
    expect(resolveShareMode({ mode: 'once' })).toBe('once')
  })

  it('trả "live" khi meta ghi rõ mode live', () => {
    expect(resolveShareMode({ mode: 'live' })).toBe('live')
  })

  it('mặc định "live" khi meta không có field mode (room share từ trước khi có tính năng này)', () => {
    expect(resolveShareMode({})).toBe('live')
  })
})

describe('isBlankFolderMeta', () => {
  it('true khi tên rỗng hoặc toàn khoảng trắng (room vừa được Liveblocks tự tạo lại, chưa có seed)', () => {
    expect(isBlankFolderMeta({ name: '' })).toBe(true)
    expect(isBlankFolderMeta({ name: '   ' })).toBe(true)
  })

  it('false khi có tên thật', () => {
    expect(isBlankFolderMeta({ name: 'Watchlist' })).toBe(false)
  })
})
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd packages/shared && bun run test`
Expected: FAIL — `folder-sync-types.ts` does not exist yet.

- [ ] **Step 11: Write `packages/shared/folder-sync-types.ts`**

```ts
import type { Json } from '@liveblocks/client'
import type { SharedResolvedSearch, SharedTradeQuery } from './types'

export type SharedSearchFields = Omit<SharedResolvedSearch, 'id' | 'folderId' | 'query'> & { query?: Json }

export type ShareMode = 'live' | 'once'

export interface SharedFolderMeta {
  name: string
  color: string
  note?: string
  mode: ShareMode
}

export function resolveShareMode(meta: { mode?: ShareMode }): ShareMode {
  return meta.mode === 'once' ? 'once' : 'live'
}

export function isBlankFolderMeta(meta: { name: string }): boolean {
  return meta.name.trim() === ''
}

export function toSharedTradeQuery(query: Json | undefined): SharedTradeQuery | undefined {
  return query as unknown as SharedTradeQuery | undefined
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `cd packages/shared && bun run test`
Expected: PASS (4 tests).

- [ ] **Step 13: Typecheck the new package**

Run: `cd packages/shared && bun run typecheck`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts packages/shared
git commit -m "feat: scaffold bun workspace and shared package types"
```

---

### Task 2: `shared/join-hash.ts` — the URL-hash protocol between web and extension

**Files:**
- Create: `packages/shared/join-hash.ts`
- Create: `packages/shared/join-hash.test.ts`

**Interfaces:**
- Consumes: nothing (pure strings).
- Produces: `buildJoinHash(shareKey: string): string`, `parseJoinHash(hash: string): string | null` — `buildJoinHash` used by `packages/web` (Task 8), `parseJoinHash` used by the extension's `App.vue` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/join-hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildJoinHash, parseJoinHash } from './join-hash'

describe('buildJoinHash / parseJoinHash', () => {
  it('round-trips a share key through the hash fragment', () => {
    const hash = buildJoinHash('share_abc-123')
    expect(hash).toBe('#etc-join=share_abc-123')
    expect(parseJoinHash(hash)).toBe('share_abc-123')
  })

  it('encodes and decodes special characters in the key', () => {
    const hash = buildJoinHash('share_a b/c')
    expect(parseJoinHash(hash)).toBe('share_a b/c')
  })

  it('returns null for a hash with the wrong prefix', () => {
    expect(parseJoinHash('#something-else=foo')).toBeNull()
  })

  it('returns null for an empty or missing hash', () => {
    expect(parseJoinHash('')).toBeNull()
    expect(parseJoinHash('#etc-join=')).toBeNull()
    expect(parseJoinHash('#etc-join=   ')).toBeNull()
  })

  it('accepts the hash with or without the leading #', () => {
    expect(parseJoinHash('etc-join=share_x')).toBe('share_x')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test join-hash`
Expected: FAIL — `join-hash.ts` does not exist.

- [ ] **Step 3: Write `packages/shared/join-hash.ts`**

```ts
const JOIN_HASH_PREFIX = 'etc-join='

export function buildJoinHash(shareKey: string): string {
  return `#${JOIN_HASH_PREFIX}${encodeURIComponent(shareKey)}`
}

export function parseJoinHash(hash: string): string | null {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  if (!value.startsWith(JOIN_HASH_PREFIX)) return null
  const key = decodeURIComponent(value.slice(JOIN_HASH_PREFIX.length)).trim()
  return key ? key : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test join-hash`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/join-hash.ts packages/shared/join-hash.test.ts
git commit -m "feat: add shared join-hash URL protocol helpers"
```

---

### Task 3: Move `buildDurableUrl` into `packages/shared`

**Files:**
- Create: `packages/shared/trade-url.ts`
- Create: `packages/shared/trade-url.test.ts`
- Modify: `lib/trade-url.ts:1,60-105` (extension — drop `buildQueryPayload`/`gzipBase64Url`, re-export `buildDurableUrl`)
- Modify: `lib/trade-url.test.ts` (extension — drop the moved `buildDurableUrl` describe block)
- Modify: `packages/shared/package.json` (add `"vue": ...` already present; no change needed here — verify only)

**Interfaces:**
- Consumes: `SharedTradePage`, `SharedTradeQuery` (Task 1).
- Produces: `buildDurableUrl(page: SharedTradePage): Promise<string | null>` — consumed by `packages/web` (Task 10) and the extension's `lib/trade-url.ts` wrapper.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/trade-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SharedTradePage, SharedTradeQuery } from './types'
import { buildDurableUrl } from './trade-url'

async function decodeDurableSegment(url: string): Promise<unknown> {
  const segment = url.split('/').pop()!
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text())
}

function makeQuery(overrides: Partial<SharedTradeQuery> = {}): SharedTradeQuery {
  return {
    status: 'any',
    name: null,
    type: null,
    term: null,
    disc: null,
    stats: [{ filters: [] }],
    filters: {},
    exchange: { want: {}, have: {} },
    ...overrides,
  }
}

describe('buildDurableUrl', () => {
  const basePage: Omit<SharedTradePage, 'query'> = {
    url: 'https://www.pathofexile.com/trade/search/Standard/expired-id',
    title: 'Stat search',
    game: 'poe1',
    league: 'Standard',
    mode: 'search',
  }

  it('returns null when there is no query to encode', async () => {
    await expect(buildDurableUrl(basePage)).resolves.toBeNull()
  })

  it('round-trips a search query into a self-contained URL, matching the shape GGG accepts', async () => {
    const page: SharedTradePage = {
      ...basePage,
      query: makeQuery({
        name: 'Tabula Rasa',
        stats: [{ filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
      }),
    }

    const url = await buildDurableUrl(page)
    expect(url).toMatch(/^https:\/\/www\.pathofexile\.com\/trade\/search\/Standard\/[\w-]+$/)

    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({
      status: { option: 'any' },
      name: 'Tabula Rasa',
      stats: [{ filters: [{ id: 'explicit.stat_3299347043', value: { min: 80 }, disabled: false }] }],
    })
  })

  it('encodes poe2 exchange mode as currency id arrays, dropping amounts', async () => {
    const page: SharedTradePage = {
      ...basePage,
      game: 'poe2',
      mode: 'exchange',
      query: makeQuery({
        exchange: { have: { chaos: { amount: null } }, want: { divine: { amount: null } } },
      }),
    }

    const url = await buildDurableUrl(page)
    expect(url).toMatch(/^https:\/\/www\.pathofexile\.com\/trade2\/exchange\/Standard\/[\w-]+$/)

    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' }, have: ['chaos'], want: ['divine'] })
  })

  it('omits empty/default fields entirely — the site rejects payloads that include them explicitly', async () => {
    const url = await buildDurableUrl({ ...basePage, query: makeQuery() })
    const decoded = await decodeDurableSegment(url!)
    expect(decoded).toEqual({ status: { option: 'any' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test trade-url`
Expected: FAIL — `trade-url.ts` does not exist.

- [ ] **Step 3: Write `packages/shared/trade-url.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test trade-url`
Expected: PASS (4 tests).

- [ ] **Step 5: Point the extension's `lib/trade-url.ts` at the shared implementation**

Replace lines 1 and 60-105 of `lib/trade-url.ts` — remove the `TradeQuery` import (no longer used here), remove `buildQueryPayload`/`gzipBase64Url`, and replace `buildDurableUrl` with a thin wrapper:

```ts
import { i18n } from '#i18n'
import type { Game, TradeMode, TradePage } from '@/types/trading'
import { buildDurableUrl as sharedBuildDurableUrl } from 'shared/trade-url'

const TRADE_HOSTS = new Set(['pathofexile.com', 'www.pathofexile.com'])
```

(keep `cleanPageTitle`, `normalizeTradeUrl`, `parseTradeUrl`, `isTradeUrl` exactly as they are — only the top import line and everything from the `buildQueryPayload` comment onward changes)

Replace everything from the `// Trade site tự đọc queryId...` comment (originally starting at line 60) through the end of the file with:

```ts
// Dựng lại URL search từ raw query đã lưu kèm bookmark — cài đặt thật nằm ở packages/shared/trade-url.ts
// (dùng chung với packages/web); TradePage của extension thoả cấu trúc SharedTradePage nên không cần map tay.
export async function buildDurableUrl(page: TradePage): Promise<string | null> {
  return sharedBuildDurableUrl(page)
}
```

- [ ] **Step 6: Update the extension's `package.json` to depend on `shared`**

Edit `package.json`, add to `"dependencies"`:

```json
    "shared": "workspace:*",
```

Run: `bun install`

- [ ] **Step 7: Remove the moved test block from `lib/trade-url.test.ts`**

Edit `lib/trade-url.test.ts` — delete the entire `describe('buildDurableUrl', ...)` block (it now lives in `packages/shared/trade-url.test.ts`) and the now-unused `decodeDurableSegment`/`makeQuery` helpers and the `buildDurableUrl` import, keeping only the `parseTradeUrl` describe block and its imports:

```ts
import { describe, expect, it } from 'vitest'
import { parseTradeUrl } from './trade-url'

describe('parseTradeUrl', () => {
  it('parses a Path of Exile 1 search', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade/search/Allflame/abc123', 'Convoking Wand - Path of Exile Trade')).toMatchObject({
      game: 'poe1',
      league: 'Allflame',
      mode: 'search',
      queryId: 'abc123',
      title: 'Convoking Wand',
    })
  })

  it('parses a Path of Exile 2 exchange', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade2/exchange/poe2/Standard/xyz')).toMatchObject({
      game: 'poe2',
      league: 'Standard',
      mode: 'exchange',
      queryId: 'xyz',
    })
  })

  it('rejects lookalike and non-trade URLs', () => {
    expect(parseTradeUrl('https://pathofexile.example/trade/search/Standard/abc')).toBeNull()
    expect(parseTradeUrl('https://www.pathofexile.com/account/view-profile/foo')).toBeNull()
  })
})
```

- [ ] **Step 8: Run the full extension test suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS, no errors. (`SearchCard.vue` and other callers of `buildDurableUrl(page: TradePage)` are unaffected — the wrapper keeps the exact same signature.)

- [ ] **Step 9: Commit**

```bash
git add packages/shared/trade-url.ts packages/shared/trade-url.test.ts lib/trade-url.ts lib/trade-url.test.ts package.json bun.lock
git commit -m "refactor: move buildDurableUrl into shared package"
```

---

### Task 4: Move `enterFolderRoom` into `packages/shared`, wire extension imports

**Files:**
- Create: `packages/shared/liveblocks-room.ts`
- Modify: `lib/liveblocks-room.ts` (extension — becomes a re-export shim)
- Modify: `lib/folder-sync.ts:1-17` (extension — import moved types from `shared`)

**Interfaces:**
- Consumes: `SharedFolderMeta`, `SharedSearchFields` (Task 1).
- Produces: `enterFolderRoom(shareKey: string, seed?: {folder: SharedFolderMeta; searches: Record<string, SharedSearchFields>}): {room: Room; leave: () => void}`, `FolderRoomStorage` type — consumed by `packages/web` (Task 10) and the extension's `lib/liveblocks-room.ts` re-export (already consumed by `composables/useFolderSync.ts`, signature unchanged).

- [ ] **Step 1: Write `packages/shared/liveblocks-room.ts`**

This is a direct move of the existing extension file, only the type import path changes:

```ts
import { LiveMap, LiveObject, createClient } from '@liveblocks/client'
import type { Room } from '@liveblocks/client'
import type { SharedFolderMeta, SharedSearchFields } from './folder-sync-types'

export type FolderRoomStorage = {
  folder: LiveObject<SharedFolderMeta>
  searches: LiveMap<string, LiveObject<SharedSearchFields>>
}

let client: ReturnType<typeof createClient> | undefined

function getClient() {
  if (!client) {
    const publicApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY
    if (!publicApiKey) throw new Error('VITE_LIVEBLOCKS_PUBLIC_KEY chưa được cấu hình trong .env')
    client = createClient({ publicApiKey })
  }
  return client
}

export function enterFolderRoom(
  shareKey: string,
  seed?: { folder: SharedFolderMeta; searches: Record<string, SharedSearchFields> },
) {
  return getClient().enterRoom<Record<string, never>, FolderRoomStorage>(shareKey, {
    initialPresence: {},
    initialStorage: seed
      ? {
          folder: new LiveObject(seed.folder),
          searches: new LiveMap(Object.entries(seed.searches).map(([id, fields]) => [id, new LiveObject(fields)])),
        }
      : {
          folder: new LiveObject({ name: '', color: '', mode: 'live' }),
          searches: new LiveMap(),
        },
  })
}

export type { Room }
```

- [ ] **Step 2: Replace `lib/liveblocks-room.ts` with a re-export shim**

```ts
export { enterFolderRoom } from 'shared/liveblocks-room'
export type { FolderRoomStorage, Room } from 'shared/liveblocks-room'
```

- [ ] **Step 3: Point `lib/folder-sync.ts` at the shared types**

Replace lines 1-17 of `lib/folder-sync.ts`:

```ts
import type { Json } from '@liveblocks/client'
import type { SavedSearch, SearchFolder } from '@/types/trading'
import type { SharedFolderMeta, SharedSearchFields, ShareMode } from 'shared/folder-sync-types'

export type { SharedFolderMeta, SharedSearchFields, ShareMode }

// Liveblocks yêu cầu mọi field lưu trong LiveObject là Json (có index signature) — TradeQuery là
// interface có shape cụ thể nên không tự thoả structural constraint đó dù giá trị runtime của nó
// luôn là JSON hợp lệ (chính là payload JSON.stringify được trong lib/trade-url.ts). Ép kiểu ở đúng
// ranh giới serialize này (toSharedSearchFields/buildSavedSearch) thay vì nới lỏng type toàn app.
export { resolveShareMode, isBlankFolderMeta } from 'shared/folder-sync-types'
```

(keep everything from `export interface SearchDiff` onward — line 19 in the original file — exactly as it is: `generateShareKey`, `toSharedSearchFields`, `buildSavedSearch`, `toSharedFolderMeta`, `diffSearchesForFolder`, `diffFolderMeta`, `isShareKeyInUse`, `planRoomChanges` all stay in the extension unchanged, they still need the extension's concrete `SavedSearch`/`SearchFolder` types)

- [ ] **Step 4: Run the full extension test suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS. `composables/useFolderSync.ts`, `lib/folder-sync.test.ts`, `lib/storage.test.ts` all import from `@/lib/folder-sync` and `@/lib/liveblocks-room` exactly as before — only what those files internally source from changes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/liveblocks-room.ts lib/liveblocks-room.ts lib/folder-sync.ts
git commit -m "refactor: move enterFolderRoom into shared package"
```

---

### Task 5: Hash-triggered join on the trade site

**Files:**
- Create: `lib/join-hash.ts` (extension — thin re-export, matches the pattern of `lib/trade-url.ts`/`lib/liveblocks-room.ts`)
- Modify: `components/JoinFolderModal.vue` (add `initialKey` prop, auto-inspect on open)
- Modify: `entrypoints/trade.content/App.vue:239-249` (read the hash on mount, open the modal)

**Interfaces:**
- Consumes: `parseJoinHash(hash: string): string | null` (Task 2).
- Produces: `JoinFolderModal`'s new `initialKey?: string` prop — no other task depends on this.

- [ ] **Step 1: Create the extension-side re-export**

```ts
export { parseJoinHash, buildJoinHash } from 'shared/join-hash'
```

- [ ] **Step 2: Add `initialKey` prop to `JoinFolderModal.vue`**

Edit `components/JoinFolderModal.vue`. Change the props block (lines 8-10):

```ts
const props = defineProps<{
  open: boolean
  initialKey?: string
}>()
```

Change the `watch(() => props.open, ...)` block (lines 22-28) to auto-fill and auto-inspect when opened with an initial key:

```ts
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    inspection.value?.leave()
    inspection.value = null
    joinKey.value = ''
    error.value = null
    return
  }
  if (props.initialKey) {
    joinKey.value = props.initialKey
    void inspectKey()
  }
})
```

- [ ] **Step 3: Write the failing test for the hash parser wiring**

Create `lib/join-hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseJoinHash } from './join-hash'

describe('parseJoinHash (extension re-export)', () => {
  it('parses a join hash', () => {
    expect(parseJoinHash('#etc-join=share_abc')).toBe('share_abc')
  })

  it('returns null for an unrelated hash', () => {
    expect(parseJoinHash('#foo')).toBeNull()
  })
})
```

- [ ] **Step 4: Run test to verify it passes** (it should pass immediately since it re-exports already-tested logic)

Run: `bun run test join-hash`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire hash detection into `App.vue`'s `onMounted`**

Edit `entrypoints/trade.content/App.vue`. Add the import (near the existing `buildDurableUrl, parseTradeUrl` import on line 19):

```ts
import { buildDurableUrl, parseTradeUrl } from '@/lib/trade-url'
import { parseJoinHash } from '@/lib/join-hash'
```

Add a new ref next to `showJoinModal` (line 56):

```ts
const showJoinModal = ref(false)
const joinModalInitialKey = ref<string | undefined>(undefined)
```

Insert hash handling at the top of `onMounted`, right after `await folderSync.init()` (line 241), before the `hasOpenedPanel` block:

```ts
onMounted(async () => {
  document.documentElement.style.setProperty('transition', 'margin-right 200ms ease')
  await folderSync.init()

  const joinKeyFromHash = parseJoinHash(window.location.hash)
  if (joinKeyFromHash) {
    open.value = true
    tab.value = 'saved'
    joinModalInitialKey.value = joinKeyFromHash
    showJoinModal.value = true
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  // Lần đầu tiên cài extension (chưa từng mở panel) — tự mở panel ngay để user thấy được
  // tính năng thay vì phải tự bấm tab dọc, bất kể họ vào trade site qua nút CTA của onboarding
  // hay tự điều hướng sau khi bấm Skip.
  if (!store.state.value.settings.hasOpenedPanel) {
    open.value = true
    void store.updateSettings({ hasOpenedPanel: true })
  }
```

- [ ] **Step 6: Pass the prop through in the template**

Edit the `JoinFolderModal` usage (line 373):

```html
<JoinFolderModal v-model:open="showJoinModal" :initial-key="joinModalInitialKey" />
```

- [ ] **Step 7: Run the full extension test suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/join-hash.ts lib/join-hash.test.ts components/JoinFolderModal.vue entrypoints/trade.content/App.vue
git commit -m "feat: auto-open join modal from a #etc-join= URL hash"
```

---

### Task 6: Content-script marker for extension detection

**Files:**
- Create: `entrypoints/share-marker.content.ts`

**Interfaces:**
- Produces: sets `document.documentElement.dataset.exileTradeCompanion = 'installed'` on `poe-trade.aiocean.io` — read by `packages/web` (Task 9).

- [ ] **Step 1: Create the content script**

```ts
export default defineContentScript({
  matches: [
    'https://poe-trade.aiocean.io/*',
  ],
  runAt: 'document_start',

  main() {
    document.documentElement.dataset.exileTradeCompanion = 'installed'
  },
})
```

- [ ] **Step 2: Build the extension and confirm the new entrypoint is picked up**

Run: `bun run build`
Expected: build succeeds; check `.output/chrome-mv3/manifest.json` contains a `content_scripts` entry matching `https://poe-trade.aiocean.io/*`.

Run: `cat .output/chrome-mv3/manifest.json | grep -A3 "poe-trade.aiocean.io"`
Expected: the match pattern is present.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/share-marker.content.ts
git commit -m "feat: mark extension presence on the share landing page domain"
```

---

### Task 7: Hotlink URL in `ShareFolderModal.vue`

**Files:**
- Create: `lib/share-hotlink.ts`
- Create: `lib/share-hotlink.test.ts`
- Modify: `components/ShareFolderModal.vue`
- Modify: `locales/vi.json` (add 2 keys under `"folder"`)
- Modify: `locales/en.json` (add 2 keys under `"folder"`)

**Interfaces:**
- Produces: `buildShareHotlinkUrl(shareKey: string): string` — used only within this task.

- [ ] **Step 1: Write the failing test**

Create `lib/share-hotlink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildShareHotlinkUrl } from './share-hotlink'

describe('buildShareHotlinkUrl', () => {
  it('builds a landing-page URL carrying the share key', () => {
    expect(buildShareHotlinkUrl('share_abc-123')).toBe('https://poe-trade.aiocean.io/?key=share_abc-123')
  })

  it('encodes special characters in the key', () => {
    expect(buildShareHotlinkUrl('share_a b')).toBe('https://poe-trade.aiocean.io/?key=share_a%20b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test share-hotlink`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `lib/share-hotlink.ts`**

```ts
const SHARE_HOTLINK_BASE_URL = 'https://poe-trade.aiocean.io'

export function buildShareHotlinkUrl(shareKey: string): string {
  return `${SHARE_HOTLINK_BASE_URL}/?key=${encodeURIComponent(shareKey)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test share-hotlink`
Expected: PASS (2 tests).

- [ ] **Step 5: Add i18n keys**

Edit `locales/vi.json`, insert after the `"copyShareKey": "Sao chép share key",` line (inside `"folder"`):

```json
    "copyShareKey": "Sao chép share key",
    "shareHotlinkLabel": "Link chia sẻ",
    "copyShareHotlink": "Sao chép link chia sẻ",
```

Edit `locales/en.json`, insert after the matching `"copyShareKey": "Copy share key",` line:

```json
    "copyShareKey": "Copy share key",
    "shareHotlinkLabel": "Share link",
    "copyShareHotlink": "Copy share link",
```

- [ ] **Step 6: Add the hotlink row to `ShareFolderModal.vue`**

Edit `components/ShareFolderModal.vue`. Add the import and a computed:

```ts
import { buildShareHotlinkUrl } from '@/lib/share-hotlink'
```

Add after `const onceKey = ref<string | null>(null)` (line 20):

```ts
const onceKey = ref<string | null>(null)

function hotlinkFor(key: string) {
  return buildShareHotlinkUrl(key)
}
```

Add a second input+copy row in the `folder.shareKey` branch, right after the existing share-key row (after line 94's closing `</div>`, before the `<div class="mt-3 flex justify-end gap-2">` actions row):

```html
        <div class="mt-2 flex items-center gap-2">
          <input class="poe-input flex-1" readonly :value="hotlinkFor(folder.shareKey!)" :aria-label="i18n.t('folder.shareHotlinkLabel')">
          <button class="icon-btn" type="button" :aria-label="i18n.t('folder.copyShareHotlink')" @click="copyKey(hotlinkFor(folder.shareKey!))">
            <Copy />
          </button>
        </div>
```

Add the same row in the `onceKey` branch, right after its existing share-key row (after line 112's closing `</div>`, before the `<div class="mt-3 flex justify-end">` Done button):

```html
        <div class="mt-2 flex items-center gap-2">
          <input class="poe-input flex-1" readonly :value="hotlinkFor(onceKey)" :aria-label="i18n.t('folder.shareHotlinkLabel')">
          <button class="icon-btn" type="button" :aria-label="i18n.t('folder.copyShareHotlink')" @click="copyKey(hotlinkFor(onceKey))">
            <Copy />
          </button>
        </div>
```

- [ ] **Step 7: Run the full extension test suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/share-hotlink.ts lib/share-hotlink.test.ts components/ShareFolderModal.vue locales/vi.json locales/en.json
git commit -m "feat: show a hotlink URL alongside every share key"
```

---

### Task 8: `ShareItemRow.vue` presentational component

**Files:**
- Create: `packages/shared/ShareItemRow.vue`

**Interfaces:**
- Produces: `<ShareItemRow :title :note :href />` Vue component — consumed by `packages/web`'s `App.vue` (Task 10).

There is no dedicated test for this file — the codebase's existing convention (verified: no `.vue` file anywhere has a matching `.test.ts`) is to unit-test extracted logic, not mount components. This component is verified live in Task 11.

- [ ] **Step 1: Write `packages/shared/ShareItemRow.vue`**

```vue
<script setup lang="ts">
defineProps<{
  title: string
  note?: string
  href: string | null
}>()
</script>

<template>
  <div class="share-item-row">
    <div class="share-item-row__title">{{ title }}</div>
    <p v-if="note" class="share-item-row__note">{{ note }}</p>
    <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" class="share-item-row__link">
      Mở trên pathofexile.com/trade
    </a>
    <span v-else class="share-item-row__link share-item-row__link--disabled">
      Không dựng lại được URL (thiếu dữ liệu query)
    </span>
  </div>
</template>

<style scoped>
.share-item-row {
  padding: 12px 0;
  border-bottom: 1px solid #3a2a12;
}
.share-item-row__title {
  font-weight: 600;
  color: #e9cf9f;
}
.share-item-row__note {
  margin-top: 4px;
  font-size: 13px;
  color: #9c8f7a;
  white-space: pre-wrap;
}
.share-item-row__link {
  display: inline-block;
  margin-top: 6px;
  font-size: 13px;
  color: #c9a227;
  text-decoration: underline;
}
.share-item-row__link--disabled {
  color: #6b6153;
  text-decoration: none;
  cursor: default;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/ShareItemRow.vue
git commit -m "feat: add ShareItemRow presentational component"
```

---

### Task 9: `packages/web` scaffold + pure share-page logic

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/tsconfig.node.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.ts`
- Create: `packages/web/src/share-page.ts`
- Create: `packages/web/src/share-page.test.ts`
- Create: `packages/web/vitest.config.ts`

**Interfaces:**
- Produces: `parseShareKeyFromLocation(search: string): string | null`, `resolveJoinGame(entries: Array<{game: 'poe1' | 'poe2'}>): 'poe1' | 'poe2'`, `watchExtensionInstalled(root: HTMLElement, onChange: (installed: boolean) => void, timeoutMs?: number): () => void` — consumed by `App.vue` (Task 10).

- [ ] **Step 1: Write `packages/web/package.json`**

```json
{
  "name": "web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@liveblocks/client": "^3.24.1",
    "shared": "workspace:*",
    "vue": "^3.5.42"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "jsdom": "^25.0.1",
    "typescript": "~5.9.3",
    "vite": "^6.0.0",
    "vitest": "^5.0.0",
    "vue-tsc": "^3.3.11"
  }
}
```

- [ ] **Step 2: Write `packages/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write `packages/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Write `packages/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
```

- [ ] **Step 5: Write `packages/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 6: Write `packages/web/index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exile Trade Companion — Folder chia sẻ</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `packages/web/src/main.ts`**

`App.vue` itself is written in Task 10 — this task only runs `bun run test` (Step 12 below), which doesn't touch `main.ts`/`App.vue`, so the dangling import is never exercised before Task 10 fills it in.

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 8: Run `bun install` at the repo root**

Run: `bun install`
Expected: `node_modules/web` and `node_modules/shared` symlinks present, no errors.

- [ ] **Step 9: Write the failing test for `share-page.ts`**

Create `packages/web/src/share-page.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { parseShareKeyFromLocation, resolveJoinGame, watchExtensionInstalled } from './share-page'

describe('parseShareKeyFromLocation', () => {
  it('reads the key query param', () => {
    expect(parseShareKeyFromLocation('?key=share_abc')).toBe('share_abc')
  })

  it('returns null when the param is missing or blank', () => {
    expect(parseShareKeyFromLocation('')).toBeNull()
    expect(parseShareKeyFromLocation('?key=')).toBeNull()
    expect(parseShareKeyFromLocation('?key=%20%20')).toBeNull()
  })
})

describe('resolveJoinGame', () => {
  it('uses the first entry\'s game', () => {
    expect(resolveJoinGame([{ game: 'poe2' }, { game: 'poe1' }])).toBe('poe2')
  })

  it('defaults to poe1 when there are no entries', () => {
    expect(resolveJoinGame([])).toBe('poe1')
  })
})

describe('watchExtensionInstalled', () => {
  it('calls back immediately with true when the marker is already present', () => {
    const root = document.createElement('html')
    root.dataset.exileTradeCompanion = 'installed'
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 50)
    expect(onChange).toHaveBeenCalledWith(true)
    stop()
  })

  it('calls back with true once the marker appears within the timeout', async () => {
    const root = document.createElement('html')
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 200)
    expect(onChange).not.toHaveBeenCalled()

    root.dataset.exileTradeCompanion = 'installed'
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(onChange).toHaveBeenCalledWith(true)
    stop()
  })

  it('never calls back when the marker never appears', async () => {
    const root = document.createElement('html')
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 50)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(onChange).not.toHaveBeenCalled()
    stop()
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/web && bun run test`
Expected: FAIL — `share-page.ts` does not exist.

- [ ] **Step 11: Write `packages/web/src/share-page.ts`**

```ts
import type { Game } from 'shared/types'

export function parseShareKeyFromLocation(search: string): string | null {
  const params = new URLSearchParams(search)
  const key = params.get('key')?.trim()
  return key ? key : null
}

export function resolveJoinGame(entries: Array<{ game: Game }>): Game {
  return entries[0]?.game ?? 'poe1'
}

// Content-script marker (entrypoints/share-marker.content.ts) chạy runAt:'document_start' nhưng
// thứ tự chạy so với module này không đảm bảo tuyệt đối giữa các trình duyệt — check ngay lập tức
// rồi quan sát thêm một khoảng ngắn qua MutationObserver trước khi kết luận "không có extension".
export function watchExtensionInstalled(root: HTMLElement, onChange: (installed: boolean) => void, timeoutMs = 1500): () => void {
  if (root.dataset.exileTradeCompanion === 'installed') {
    onChange(true)
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (root.dataset.exileTradeCompanion === 'installed') {
      onChange(true)
      cleanup()
    }
  })
  observer.observe(root, { attributes: true, attributeFilter: ['data-exile-trade-companion'] })

  const timer = setTimeout(cleanup, timeoutMs)

  function cleanup() {
    observer.disconnect()
    clearTimeout(timer)
  }

  return cleanup
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/web && bun run test`
Expected: PASS (7 tests).

- [ ] **Step 13: Commit**

```bash
git add packages/web
git commit -m "feat: scaffold packages/web with share-page pure logic"
```

---

### Task 10: `packages/web` landing page UI

**Files:**
- Create: `packages/web/src/App.vue`

**Interfaces:**
- Consumes: `enterFolderRoom` (Task 4), `resolveShareMode`/`isBlankFolderMeta`/`SharedFolderMeta`/`SharedSearchFields` (Task 1), `buildDurableUrl` (Task 3), `buildJoinHash` (Task 2), `ShareItemRow.vue` (Task 8), `parseShareKeyFromLocation`/`resolveJoinGame`/`watchExtensionInstalled` (Task 9).
- Produces: nothing further consumed — this is the leaf UI.

No dedicated test — same rationale as Task 8 (no `.vue` file in this codebase has a direct test; all logic it depends on is already unit-tested in Task 9 / Task 1-4). Verified live in Task 11.

- [ ] **Step 1: Write `packages/web/src/App.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { enterFolderRoom } from 'shared/liveblocks-room'
import { isBlankFolderMeta, resolveShareMode, toSharedTradeQuery, type SharedFolderMeta, type SharedSearchFields } from 'shared/folder-sync-types'
import { buildDurableUrl } from 'shared/trade-url'
import { buildJoinHash } from 'shared/join-hash'
import ShareItemRow from 'shared/ShareItemRow.vue'
import { parseShareKeyFromLocation, resolveJoinGame, watchExtensionInstalled } from './share-page'

type DisplayItem = { id: string; title: string; note?: string; href: string | null }
type LoadState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'not-found' }
  | { status: 'error' }
  | { status: 'ready'; meta: SharedFolderMeta; items: DisplayItem[] }

const shareKey = parseShareKeyFromLocation(window.location.search)
const state = ref<LoadState>({ status: 'loading' })
const extensionInstalled = ref(false)
const joinUrl = ref<string | null>(null)
let stopWatchingExtension: (() => void) | undefined

async function load() {
  if (!shareKey) {
    state.value = { status: 'invalid' }
    return
  }

  try {
    const { room, leave } = enterFolderRoom(shareKey)
    const { root } = await room.getStorage()
    const meta = root.get('folder').toJSON() as SharedFolderMeta

    if (isBlankFolderMeta(meta)) {
      leave()
      state.value = { status: 'not-found' }
      return
    }

    const entries = [...root.get('searches').entries()] as [string, SharedSearchFields][]
    const items = await Promise.all(entries.map(async ([id, fields]) => ({
      id,
      title: fields.title,
      note: fields.note || undefined,
      href: await buildDurableUrl({
        url: fields.url,
        title: fields.title,
        game: fields.game,
        league: fields.league,
        mode: fields.mode,
        queryId: fields.queryId,
        query: toSharedTradeQuery(fields.query),
      }),
    })))

    const game = resolveJoinGame(entries.map(([, fields]) => fields))
    joinUrl.value = `https://www.pathofexile.com/${game === 'poe2' ? 'trade2' : 'trade'}/${buildJoinHash(shareKey)}`

    leave()
    state.value = { status: 'ready', meta: { ...meta, mode: resolveShareMode(meta) }, items }
  } catch {
    state.value = { status: 'error' }
  }
}

onMounted(() => {
  stopWatchingExtension = watchExtensionInstalled(document.documentElement, (installed) => {
    extensionInstalled.value = installed
  })
  void load()
})

onUnmounted(() => stopWatchingExtension?.())
</script>

<template>
  <main class="page">
    <h1 class="page__title">Exile Trade Companion</h1>

    <p v-if="state.status === 'loading'" class="page__message">Đang tải folder…</p>
    <p v-else-if="state.status === 'invalid'" class="page__message page__message--error">
      Link không hợp lệ — thiếu thông tin key trong URL.
    </p>
    <p v-else-if="state.status === 'not-found'" class="page__message page__message--error">
      Link đã hết hạn hoặc đã bị thu hồi. Hỏi người gửi share lại cho bạn.
    </p>
    <p v-else-if="state.status === 'error'" class="page__message page__message--error">
      Không tải được dữ liệu chia sẻ. Kiểm tra kết nối mạng rồi thử lại.
    </p>

    <template v-else-if="state.status === 'ready'">
      <div class="page__folder-header">
        <h2 class="page__folder-name">{{ state.meta.name }}</h2>
        <p v-if="state.meta.note" class="page__folder-note">{{ state.meta.note }}</p>
        <p class="page__folder-mode">
          {{ state.meta.mode === 'once' ? 'Bản chụp một lần' : 'Đang chia sẻ trực tiếp' }}
        </p>
      </div>

      <a v-if="extensionInstalled && joinUrl" :href="joinUrl" class="page__join-button">
        Mở trong extension
      </a>
      <a v-else href="https://chromewebstore.google.com/" target="_blank" rel="noopener noreferrer" class="page__install-banner">
        Cài Exile Trade Companion để đồng bộ trực tiếp folder này
      </a>

      <ShareItemRow v-for="item in state.items" :key="item.id" :title="item.title" :note="item.note" :href="item.href" />
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: Verdana, Geneva, "DejaVu Sans", sans-serif;
  color: #e9cf9f;
  background: #1a1108;
  min-height: 100vh;
}
.page__title {
  font-size: 20px;
  margin-bottom: 16px;
}
.page__message {
  color: #9c8f7a;
}
.page__message--error {
  color: #d9534f;
}
.page__folder-header {
  margin-bottom: 12px;
}
.page__folder-name {
  font-size: 17px;
  font-weight: 600;
}
.page__folder-note {
  margin-top: 4px;
  font-size: 13px;
  color: #9c8f7a;
  white-space: pre-wrap;
}
.page__folder-mode {
  margin-top: 4px;
  font-size: 12px;
  color: #6b6153;
}
.page__join-button,
.page__install-banner {
  display: block;
  margin: 12px 0;
  padding: 10px 14px;
  text-align: center;
  border-radius: 4px;
  text-decoration: none;
  font-size: 14px;
}
.page__join-button {
  background: #c9a227;
  color: #1a1108;
  font-weight: 600;
}
.page__install-banner {
  border: 1px solid #3a2a12;
  color: #c9a227;
}
</style>
```

- [ ] **Step 2: Run the build**

Run: `cd packages/web && bun run build`
Expected: succeeds, `packages/web/dist/` produced. If Vite fails to process the `.vue` import from the `shared` workspace package, add `optimizeDeps: { exclude: ['shared'] }` to `packages/web/vite.config.ts` and rerun.

- [ ] **Step 3: Run typecheck**

Run: `cd packages/web && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/App.vue packages/web/vite.config.ts
git commit -m "feat: implement the share landing page UI"
```

---

### Task 11: Root script wiring + CI workflow

**Files:**
- Modify: `package.json` (root — add `web:*` scripts, extend `check`)
- Create: `.github/workflows/deploy-web.yml`

**Interfaces:** none — this task wires existing pieces together for CI/local use.

- [ ] **Step 1: Add workspace scripts to root `package.json`**

Add to `"scripts"`:

```json
    "shared:test": "bun --filter=shared test",
    "shared:typecheck": "bun --filter=shared typecheck",
    "web:dev": "bun --filter=web dev",
    "web:build": "bun --filter=web build",
    "web:test": "bun --filter=web test",
    "web:typecheck": "bun --filter=web typecheck",
```

Change `"check"` to also gate on the new packages:

```json
    "check": "bun run test && bun run typecheck && bun run build && bun run shared:test && bun run shared:typecheck && bun run web:test && bun run web:typecheck && bun run web:build",
```

- [ ] **Step 2: Run the full check**

Run: `bun run check`
Expected: PASS end-to-end (extension test/typecheck/build, then shared test/typecheck, then web test/typecheck/build).

- [ ] **Step 3: Write `.github/workflows/deploy-web.yml`**

```yaml
name: Deploy web

on:
  push:
    branches:
      - main
    paths:
      - 'packages/web/**'
      - 'packages/shared/**'
      - '.github/workflows/deploy-web.yml'

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build packages/web
        env:
          VITE_LIVEBLOCKS_PUBLIC_KEY: ${{ secrets.VITE_LIVEBLOCKS_PUBLIC_KEY }}
        run: bun run web:build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy packages/web/dist --project-name=poe-trade-share
```

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/deploy-web.yml
git commit -m "ci: wire up packages/web test/build and Cloudflare Pages deploy"
```

---

### Task 12: Cloudflare Pages project + custom domain (operational — confirm before running)

This task creates real cloud infrastructure and modifies DNS for a domain the user owns. **Stop and confirm with the user before running any command in this task**, per the design doc's stated caution.

**Files:** none (infrastructure only).

- [ ] **Step 1: Confirm with the user**

Ask: "Sẵn sàng tạo Cloudflare Pages project `poe-trade-share` cho `packages/web` và gắn domain `poe-trade.aiocean.io`? Việc này tạo resource thật trên Cloudflare và có thể sửa DNS của `aiocean.io`."

- [ ] **Step 2: Create the Pages project and attach the domain**

Use the `deploy-cloudflare-page` skill, pointing it at `packages/web` (built via `bun run web:build`, output directory `packages/web/dist`), project name `poe-trade-share`, custom domain `poe-trade.aiocean.io`.

- [ ] **Step 3: Add the two GitHub secrets used by Task 11's workflow**

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, scoped to the `poe-trade-share` Pages project. Add via `gh secret set CLOUDFLARE_API_TOKEN` / `gh secret set CLOUDFLARE_ACCOUNT_ID` (values from the Cloudflare dashboard step above) — confirm with the user before running, since this writes to the repository's GitHub settings.

- [ ] **Step 4: Verify the deploy workflow runs end to end**

Push a trivial change under `packages/web/` (or manually trigger via `gh workflow run deploy-web.yml`) and confirm the Action succeeds and `https://poe-trade.aiocean.io/` serves the built page.

---

### Task 13: Live verification + docs

**Files:**
- Create: `docs/features/share-hotlink.md`
- Modify: `docs/features/folder-share.md` (cross-reference)
- Modify: `docs/features/README.md` (index entry)
- Modify: `README.md` (feature bullet)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Live-verify with ego-browser**

Build the extension (`bun run build`), load it unpacked in a Chrome profile via ego-browser. Share a folder (Live and Once), copy the hotlink, open it in:
1. A tab in the same profile (extension present) — confirm the "Mở trong extension" button appears and clicking it opens the trade site with the join modal pre-filled and inspecting the right key.
2. A profile/incognito context without the extension loaded — confirm the item list renders with working "Mở trên pathofexile.com/trade" links, and the install banner shows instead of the join button.

Fix anything that doesn't match before proceeding — this is the actual feature working, not just green tests.

- [ ] **Step 2: Write `docs/features/share-hotlink.md`**

```markdown
# Hotlink kèm share key

`packages/shared`, `packages/web`, `lib/share-hotlink.ts`, `lib/join-hash.ts`, `entrypoints/share-marker.content.ts`. Mỗi share key (xem [folder-share.md](folder-share.md)) giờ có thêm một link mở được bằng trình duyệt thường, không cần dán key thủ công vào extension.

## Hành vi

- **Tạo hotlink**: `ShareFolderModal.vue` hiện thêm một ô `https://poe-trade.aiocean.io/?key=<key>` kèm nút copy riêng, bên cạnh raw key hiện có — cả hai chế độ Live và Once đều có.
- **Mở link, không có extension**: `packages/web` đọc `?key=`, kết nối đúng room Liveblocks mà extension dùng, liệt kê từng search kèm nút mở thẳng `pathofexile.com/trade` (dùng lại `buildDurableUrl`), rồi rời room ngay (không giữ kết nối live).
- **Mở link, có extension**: content-script `entrypoints/share-marker.content.ts` đánh dấu `document.documentElement.dataset.exileTradeCompanion = 'installed'` trên domain landing page. Landing page thấy marker thì hiện nút "Mở trong extension", trỏ tới `pathofexile.com/trade[2]/#etc-join=<key>`.
- **Trade site nhận hash**: `entrypoints/trade.content/App.vue` đọc `#etc-join=<key>` lúc mount, tự mở `JoinFolderModal` với key đó (Fork/Join UI không đổi), rồi xoá hash.

## Cách hoạt động

- `packages/shared` là nơi cả extension lẫn `packages/web` cùng đọc một implementation: `trade-url.ts` (buildDurableUrl), `liveblocks-room.ts` (enterFolderRoom), `folder-sync-types.ts` (SharedFolderMeta/SharedSearchFields/resolveShareMode/isBlankFolderMeta), `join-hash.ts` (buildJoinHash/parseJoinHash). Không có build step riêng — cả hai consumer import thẳng `.ts`/`.vue` qua `workspace:*`.
- Không tự động redirect khi phát hiện extension — luôn cần bấm nút, tránh bất ngờ nếu detect sai.
- Landing page không giữ kết nối Liveblocks sống — đọc một lần rồi rời room, kể cả với folder đang share-live (đồng bộ tiếp diễn vẫn chỉ chạy trong extension như trước).

## Giới hạn

- Landing page host trên Cloudflare Pages, domain `poe-trade.aiocean.io` — vẫn phụ thuộc Liveblocks free tier như `folder-share.md` đã ghi.
- Game (poe1/poe2) hiển thị trên nút join suy từ search đầu tiên trong room; folder rỗng mặc định poe1.

## Test

`packages/shared/*.test.ts`, `packages/web/src/share-page.test.ts`, `lib/share-hotlink.test.ts`, `lib/join-hash.test.ts`.
```

- [ ] **Step 3: Cross-reference from `folder-share.md`**

Edit `docs/features/folder-share.md`, add at the end of the `## Hành vi` section:

```markdown
- Mỗi share key đi kèm một hotlink mở được bằng trình duyệt thường — xem [share-hotlink.md](share-hotlink.md).
```

- [ ] **Step 4: Add the index entry**

Edit `docs/features/README.md`, add a line for `share-hotlink.md` next to the existing `folder-share.md` entry (match the existing list format in that file).

- [ ] **Step 5: Update the README feature bullet**

Edit `README.md`, change the `- **Chia sẻ folder**: ...` bullet to mention the hotlink:

```markdown
- **Chia sẻ folder**: chia sẻ trực tiếp đồng bộ hai chiều hoặc gửi bản chụp một lần, chỉ cần một share key, không tài khoản. Mỗi key kèm một hotlink mở được bằng trình duyệt thường, không cần cài extension để xem.
```

- [ ] **Step 6: Commit**

```bash
git add docs/features/share-hotlink.md docs/features/folder-share.md docs/features/README.md README.md
git commit -m "docs: document the share hotlink feature"
```
