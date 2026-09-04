# Folder Share Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép một `SearchFolder` được share qua một key (= Liveblocks room ID); ai có key join được, mọi thay đổi (search + tên/màu folder) đồng bộ hai chiều realtime khi UI đang mở, không cần backend riêng.

**Architecture:** Liveblocks client-side-only mode (public API key, room tự tạo khi connect, không auth endpoint). Room ID = share key = mật khẩu. Sync engine chỉ sống trong UI context đang mở (popup/content-script), tái dùng cơ chế `browser.storage.onChanged` sẵn có để lan toả sang các context khác. Local mutation diff-based push lên room; remote change merge thẳng vào `TradeState` qua `writeState()`.

**Tech Stack:** Vue 3 + WXT (Vite), `@liveblocks/client` (mới), Vitest, `wxt/testing/fake-browser`.

**Spec:** `docs/superpowers/specs/2026-09-04-folder-share-sync-design.md`

## Global Constraints

- KHÔNG backend riêng — chỉ Liveblocks client-side-only mode với public API key.
- Room ID = share key, KHÔNG có owner/viewer, KHÔNG auth endpoint.
- Sync CHỈ hoạt động khi UI đang mở — không kết nối nền trong background service worker.
- KHÔNG import `@liveblocks/client` từ CDN (esm.sh) trong code thật — chỉ dùng pattern đó cho spike/verify. Code thật luôn `bun add @liveblocks/client` rồi import module bundler chuẩn.
- Mọi string UI mới phải có key ở CẢ `locales/vi.json` và `locales/en.json` (default locale là `vi`), theo đúng cấu trúc nested (`folder.xxx`) đã có.
- File mới theo pattern hiện có của repo: pure logic gộp nhiều hàm liên quan trong một file `lib/*.ts` (như `lib/property-filter.ts`), test cùng tên `*.test.ts` cạnh file, `describe`/`it` viết tiếng Việt.
- Sau khi sửa `locales/*.json`, phải chạy `bunx wxt prepare` để regenerate `.wxt/types/i18n.d.ts` trước khi `bun run typecheck`.

---

## Task 1: `lib/folder-sync.ts` — pure data transforms + diff logic

**Files:**
- Modify: `types/trading.ts` (thêm field `shareKey` vào `SearchFolder`)
- Create: `lib/folder-sync.ts`
- Test: `lib/folder-sync.test.ts`

**Interfaces:**
- Consumes: `SavedSearch`, `SearchFolder` từ `@/types/trading`
- Produces (dùng bởi Task 4, 5):
  - `type SharedSearchFields = Omit<SavedSearch, 'id' | 'folderId'>` (type alias, không phải interface — Liveblocks `LsonObject` yêu cầu index signature mà interface không tự thoả)
  - `type SharedFolderMeta = { name: string; color: string }`
  - `interface SearchDiff { added: SavedSearch[]; updated: SavedSearch[]; removedIds: string[] }`
  - `generateShareKey(): string`
  - `toSharedSearchFields(search: SavedSearch): SharedSearchFields`
  - `buildSavedSearch(id: string, folderId: string, fields: SharedSearchFields): SavedSearch`
  - `toSharedFolderMeta(folder: SearchFolder): SharedFolderMeta`
  - `diffSearchesForFolder(folderId: string, prev: SavedSearch[], next: SavedSearch[]): SearchDiff`
  - `diffFolderMeta(prev: SearchFolder, next: SearchFolder): SharedFolderMeta | null`
  - `planRoomChanges(activeShareKeys: string[], folders: SearchFolder[]): { toConnect: { folderId: string; shareKey: string }[]; toDisconnect: string[] }`

- [x] **Step 1: Thêm field `shareKey` vào `SearchFolder`**

Modify `types/trading.ts:14-19`:

```ts
export interface SearchFolder {
  id: string
  name: string
  color: string
  order: number
  shareKey?: string
}
```

- [x] **Step 2: Viết test cho `generateShareKey`, `toSharedSearchFields`, `buildSavedSearch`, `toSharedFolderMeta` (test trước, sẽ fail vì file chưa tồn tại)**

Create `lib/folder-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildSavedSearch,
  diffFolderMeta,
  diffSearchesForFolder,
  generateShareKey,
  planRoomChanges,
  toSharedFolderMeta,
  toSharedSearchFields,
} from './folder-sync'
import type { SavedSearch, SearchFolder } from '@/types/trading'

function makeSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    folderId: 'folder-1',
    url: 'https://www.pathofexile.com/trade/search/Standard/abc',
    title: 'Boots',
    game: 'poe1',
    league: 'Standard',
    mode: 'search',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function makeFolder(overrides: Partial<SearchFolder> = {}): SearchFolder {
  return { id: 'folder-1', name: 'Watchlist', color: '#aaa', order: 0, ...overrides }
}

describe('generateShareKey', () => {
  it('sinh key có prefix share_ và khác nhau mỗi lần gọi', () => {
    const a = generateShareKey()
    const b = generateShareKey()
    expect(a.startsWith('share_')).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('toSharedSearchFields / buildSavedSearch', () => {
  it('roundtrip giữ nguyên mọi field trừ id và folderId', () => {
    const search = makeSearch()
    const fields = toSharedSearchFields(search)
    expect(fields).not.toHaveProperty('id')
    expect(fields).not.toHaveProperty('folderId')
    expect(buildSavedSearch('search-1', 'folder-1', fields)).toEqual(search)
  })
})

describe('toSharedFolderMeta', () => {
  it('chỉ lấy name và color', () => {
    expect(toSharedFolderMeta(makeFolder({ name: 'Gear', color: '#fff' }))).toEqual({ name: 'Gear', color: '#fff' })
  })
})

describe('diffSearchesForFolder', () => {
  it('phát hiện search mới thêm', () => {
    const prev: SavedSearch[] = []
    const next = [makeSearch()]
    const diff = diffSearchesForFolder('folder-1', prev, next)
    expect(diff.added).toEqual(next)
    expect(diff.updated).toEqual([])
    expect(diff.removedIds).toEqual([])
  })

  it('phát hiện search bị xoá', () => {
    const prev = [makeSearch()]
    const next: SavedSearch[] = []
    const diff = diffSearchesForFolder('folder-1', prev, next)
    expect(diff.removedIds).toEqual(['search-1'])
  })

  it('phát hiện search đổi updatedAt là updated, giữ nguyên updatedAt thì bỏ qua', () => {
    const prev = [makeSearch({ updatedAt: 1 })]
    const changed = [makeSearch({ updatedAt: 2, note: 'x' })]
    expect(diffSearchesForFolder('folder-1', prev, changed).updated).toEqual(changed)
    expect(diffSearchesForFolder('folder-1', prev, prev).updated).toEqual([])
  })

  it('bỏ qua search thuộc folder khác', () => {
    const prev: SavedSearch[] = []
    const next = [makeSearch({ folderId: 'folder-2' })]
    expect(diffSearchesForFolder('folder-1', prev, next).added).toEqual([])
  })
})

describe('diffFolderMeta', () => {
  it('trả null khi name và color không đổi', () => {
    expect(diffFolderMeta(makeFolder(), makeFolder())).toBeNull()
  })

  it('trả meta mới khi name hoặc color đổi', () => {
    const next = makeFolder({ name: 'Renamed' })
    expect(diffFolderMeta(makeFolder(), next)).toEqual({ name: 'Renamed', color: '#aaa' })
  })
})

describe('planRoomChanges', () => {
  it('kết nối room mới cho folder có shareKey chưa active', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' }), makeFolder({ id: 'f2' })]
    const plan = planRoomChanges([], folders)
    expect(plan.toConnect).toEqual([{ folderId: 'f1', shareKey: 'share_a' }])
    expect(plan.toDisconnect).toEqual([])
  })

  it('ngắt room không còn folder nào tham chiếu (đã xoá folder hoặc unshare)', () => {
    const folders = [makeFolder({ id: 'f2' })]
    const plan = planRoomChanges(['share_a'], folders)
    expect(plan.toConnect).toEqual([])
    expect(plan.toDisconnect).toEqual(['share_a'])
  })

  it('không đổi gì khi room đang active vẫn khớp folder hiện tại', () => {
    const folders = [makeFolder({ id: 'f1', shareKey: 'share_a' })]
    const plan = planRoomChanges(['share_a'], folders)
    expect(plan.toConnect).toEqual([])
    expect(plan.toDisconnect).toEqual([])
  })
})
```

- [x] **Step 3: Chạy test để xác nhận fail**

Run: `bun run test lib/folder-sync.test.ts`
Expected: FAIL với lỗi `Cannot find module './folder-sync'` (file chưa tồn tại)

- [x] **Step 4: Viết `lib/folder-sync.ts`**

```ts
import type { SavedSearch, SearchFolder } from '@/types/trading'

export type SharedSearchFields = Omit<SavedSearch, 'id' | 'folderId'>

export type SharedFolderMeta = {
  name: string
  color: string
}

export interface SearchDiff {
  added: SavedSearch[]
  updated: SavedSearch[]
  removedIds: string[]
}

export function generateShareKey(): string {
  return `share_${crypto.randomUUID()}`
}

export function toSharedSearchFields(search: SavedSearch): SharedSearchFields {
  const { id: _id, folderId: _folderId, ...fields } = search
  return fields
}

export function buildSavedSearch(id: string, folderId: string, fields: SharedSearchFields): SavedSearch {
  return { ...fields, id, folderId }
}

export function toSharedFolderMeta(folder: SearchFolder): SharedFolderMeta {
  return { name: folder.name, color: folder.color }
}

export function diffSearchesForFolder(folderId: string, prev: SavedSearch[], next: SavedSearch[]): SearchDiff {
  const prevById = new Map(prev.filter((search) => search.folderId === folderId).map((search) => [search.id, search]))
  const nextById = new Map(next.filter((search) => search.folderId === folderId).map((search) => [search.id, search]))

  const added: SavedSearch[] = []
  const updated: SavedSearch[] = []
  for (const [id, search] of nextById) {
    const prevSearch = prevById.get(id)
    if (!prevSearch) added.push(search)
    else if (prevSearch.updatedAt !== search.updatedAt) updated.push(search)
  }

  const removedIds: string[] = []
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) removedIds.push(id)
  }

  return { added, updated, removedIds }
}

export function diffFolderMeta(prev: SearchFolder, next: SearchFolder): SharedFolderMeta | null {
  if (prev.name === next.name && prev.color === next.color) return null
  return { name: next.name, color: next.color }
}

export function planRoomChanges(activeShareKeys: string[], folders: SearchFolder[]) {
  const desired = new Map(
    folders.filter((folder): folder is SearchFolder & { shareKey: string } => Boolean(folder.shareKey))
      .map((folder) => [folder.shareKey, folder.id]),
  )

  const toConnect = [...desired.entries()]
    .filter(([shareKey]) => !activeShareKeys.includes(shareKey))
    .map(([shareKey, folderId]) => ({ folderId, shareKey }))

  const toDisconnect = activeShareKeys.filter((shareKey) => !desired.has(shareKey))

  return { toConnect, toDisconnect }
}
```

- [x] **Step 5: Chạy test để xác nhận pass**

Run: `bun run test lib/folder-sync.test.ts`
Expected: PASS (tất cả test trong Step 2)

- [x] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors

- [x] **Step 7: Commit**

```bash
git add types/trading.ts lib/folder-sync.ts lib/folder-sync.test.ts
git commit -m "feat: add pure data transforms for folder share sync"
```

(Bỏ qua bước này nếu repo chưa init git — xem Global Constraints / spec.)

---

## Task 2: `lib/storage.ts` — thêm ba hàm ghi state cho shared folder

**Files:**
- Modify: `lib/storage.ts`
- Test: `lib/storage.test.ts` (thêm describe block mới vào file đã có)

**Interfaces:**
- Consumes: `SharedFolderMeta` từ `@/lib/folder-sync` (Task 1), `readState`/`writeState` nội bộ đã có
- Produces (dùng bởi Task 5):
  - `setFolderShareKey(id: string, shareKey: string | undefined): Promise<TradeState>`
  - `addSharedFolder(folder: SearchFolder, searches: SavedSearch[]): Promise<TradeState>`
  - `applyRemoteFolderState(folderId: string, meta: SharedFolderMeta, searches: SavedSearch[]): Promise<TradeState>`

- [x] **Step 1: Viết test cho ba hàm mới (fail vì hàm chưa tồn tại)**

Add to `lib/storage.test.ts` (sau describe `setExchangeRateCache`, dòng 119, và cập nhật import ở dòng 19):

Đổi dòng 19 từ:
```ts
import { DEFAULT_FOLDER_ID, STORAGE_KEY, recordSnapshot, removeFolder, renameFolder, setExchangeRateCache } from './storage'
```
thành:
```ts
import {
  DEFAULT_FOLDER_ID,
  STORAGE_KEY,
  addSharedFolder,
  applyRemoteFolderState,
  recordSnapshot,
  removeFolder,
  renameFolder,
  setExchangeRateCache,
  setFolderShareKey,
} from './storage'
```

Append vào cuối file:

```ts
describe('setFolderShareKey', () => {
  it('gán shareKey cho folder', async () => {
    const state = await setFolderShareKey('gear', 'share_abc')
    expect(state.folders.find((folder) => folder.id === 'gear')?.shareKey).toBe('share_abc')
  })

  it('xoá shareKey khi truyền undefined', async () => {
    storage.value[STORAGE_KEY] = {
      ...makeState(),
      folders: [
        { ...makeState().folders[0]!, shareKey: 'share_abc' },
        makeState().folders[1]!,
      ],
    }
    const state = await setFolderShareKey(DEFAULT_FOLDER_ID, undefined)
    expect(state.folders.find((folder) => folder.id === DEFAULT_FOLDER_ID)?.shareKey).toBeUndefined()
  })
})

describe('addSharedFolder', () => {
  it('thêm folder mới kèm search của nó vào state', async () => {
    const newFolder = { id: 'joined-1', name: 'Từ bạn bè', color: '#e67e80', order: 2, shareKey: 'share_xyz' }
    const newSearch: TradeState['searches'][number] = {
      id: 'remote-search-1',
      folderId: 'joined-1',
      url: 'https://www.pathofexile.com/trade/search/Standard/xyz',
      title: 'Chest',
      game: 'poe1',
      league: 'Standard',
      mode: 'search',
      note: '',
      createdAt: 5,
      updatedAt: 5,
    }
    const state = await addSharedFolder(newFolder, [newSearch])
    expect(state.folders.find((folder) => folder.id === 'joined-1')).toEqual(newFolder)
    expect(state.searches.find((search) => search.id === 'remote-search-1')).toEqual(newSearch)
  })
})

describe('applyRemoteFolderState', () => {
  it('ghi đè meta folder và thay toàn bộ search của folder đó bằng dữ liệu remote', async () => {
    const state = await applyRemoteFolderState(
      'gear',
      { name: 'Đổi tên từ xa', color: '#123456' },
      [{
        id: 'search-1',
        folderId: 'gear',
        url: 'https://www.pathofexile.com/trade/search/Standard/abc',
        title: 'Boots (updated)',
        game: 'poe1',
        league: 'Standard',
        mode: 'search',
        note: 'ghi chú mới',
        createdAt: 1,
        updatedAt: 9,
      }],
    )
    const folder = state.folders.find((entry) => entry.id === 'gear')
    expect(folder?.name).toBe('Đổi tên từ xa')
    expect(folder?.color).toBe('#123456')
    expect(state.searches.filter((search) => search.folderId === 'gear')).toHaveLength(1)
    expect(state.searches.find((search) => search.id === 'search-1')?.title).toBe('Boots (updated)')
  })

  it('bỏ qua nếu folder không còn tồn tại local', async () => {
    const before = storage.value[STORAGE_KEY]
    const state = await applyRemoteFolderState('khong-ton-tai', { name: 'x', color: '#000' }, [])
    expect(state).toEqual(before)
  })
})
```

- [x] **Step 2: Chạy test để xác nhận fail**

Run: `bun run test lib/storage.test.ts`
Expected: FAIL — `setFolderShareKey`/`addSharedFolder`/`applyRemoteFolderState` is not exported

- [x] **Step 3: Viết implementation trong `lib/storage.ts`**

Append vào cuối `lib/storage.ts` (sau dòng 201), và thêm import `SharedFolderMeta` ở đầu file (dòng 11, cạnh import `pricing`):

```ts
import type { ExchangeRateCache, PriceSnapshot } from '@/types/pricing'
import type { SharedFolderMeta } from '@/lib/folder-sync'
```

```ts
export async function setFolderShareKey(id: string, shareKey: string | undefined) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === id)
  if (!folder) return state

  if (shareKey) folder.shareKey = shareKey
  else delete folder.shareKey

  return writeState(state)
}

export async function addSharedFolder(folder: SearchFolder, searches: SavedSearch[]) {
  const state = await readState()
  state.folders.push(folder)
  state.searches.push(...searches)
  return writeState(state)
}

export async function applyRemoteFolderState(folderId: string, meta: SharedFolderMeta, searches: SavedSearch[]) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === folderId)
  if (!folder) return state

  folder.name = meta.name
  folder.color = meta.color
  state.searches = [
    ...state.searches.filter((search) => search.folderId !== folderId),
    ...searches,
  ]

  return writeState(state)
}
```

Cần thêm `SavedSearch` vào import type ở dòng 3-10 nếu chưa có (đã có sẵn — kiểm tra `lib/storage.ts:3-10`, `SavedSearch` chưa được import trực tiếp vì trước đó chỉ dùng qua `SaveSearchInput`). Thêm `SavedSearch` vào danh sách import:

```ts
import type {
  HistoryEntry,
  SavedSearch,
  SaveSearchInput,
  SearchFolder,
  TradePage,
  TradeSettings,
  TradeState,
} from '@/types/trading'
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `bun run test lib/storage.test.ts`
Expected: PASS

- [x] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors

- [x] **Step 6: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: add storage functions for shared folder state"
```

---

## Task 3: Cài đặt Liveblocks + cấu hình env + manifest permissions

**Files:**
- Modify: `package.json` (thêm dependency)
- Create: `.env.example`
- Create: `.env` (local, KHÔNG commit nếu sau này có git — xem lưu ý bên dưới)
- Modify: `.gitignore`
- Modify: `wxt.config.ts:16`

**Interfaces:**
- Produces: biến môi trường `import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY` khả dụng cho Task 4.

- [x] **Step 1: Cài package**

Run: `bun add @liveblocks/client`

- [x] **Step 2: Thêm `.env` vào `.gitignore`**

Modify `.gitignore` (append):

```
.env
```

- [x] **Step 3: Tạo `.env.example`**

```
# Liveblocks public API key (an toàn để commit dạng ví dụ — public key được thiết kế để lộ trong client bundle).
# Lấy tại: https://liveblocks.io/dashboard -> project -> API keys -> Public key
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [x] **Step 4: Tạo `.env` (local dev, dùng key project Development đã tạo lúc spike)**

```
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_MHSDmlRbYjHk9IeMMDHtBz6ZVNpspSw-WsmYodsYZlql76SNpR1i1aF218PnMPbs
```

Trước khi ship production: tạo project Liveblocks RIÊNG cho extension này (dashboard hiện có project `Production` đang dùng cho app khác, KHÔNG dùng chung — xem `## Failure modes` trong spec), lấy public key của project mới thay vào `.env` production build.

- [x] **Step 5: Thêm `host_permissions` vào manifest**

Modify `wxt.config.ts:11-26`:

```ts
manifest: {
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  version: '0.1.0',
  default_locale: 'vi',
  permissions: ['storage', 'activeTab', 'contextMenus'],
  host_permissions: ['https://api.liveblocks.io/*', 'wss://api.liveblocks.io/*'],
  commands: {
    'toggle-trade-companion': {
      suggested_key: {
        default: 'Alt+Shift+B',
        mac: 'Alt+Shift+B',
      },
      description: '__MSG_commandToggleDescription__',
    },
  },
},
```

- [x] **Step 6: Verify build**

Run: `bun run build`
Expected: build thành công, không lỗi resolve `@liveblocks/client`

Nếu request tới `wss://api.liveblocks.io` bị chặn lúc chạy thật (Task 8), quay lại bước này kiểm tra domain chính xác qua network tab thay vì đoán.

- [x] **Step 7: Commit**

```bash
git add package.json bun.lock .env.example .gitignore wxt.config.ts
git commit -m "chore: add liveblocks dependency and manifest permissions"
```

---

## Task 4: `lib/liveblocks-room.ts` — wrapper quanh Liveblocks SDK

**Files:**
- Create: `lib/liveblocks-room.ts`

**Interfaces:**
- Consumes: `SharedFolderMeta`, `SharedSearchFields` từ `@/lib/folder-sync` (Task 1); `VITE_LIVEBLOCKS_PUBLIC_KEY` từ Task 3
- Produces (dùng bởi Task 5):
  - `interface FolderRoomStorage { folder: LiveObject<SharedFolderMeta>; searches: LiveMap<string, LiveObject<SharedSearchFields>> }`
  - `enterFolderRoom(shareKey: string, seed?: { folder: SharedFolderMeta; searches: Record<string, SharedSearchFields> }): { room: Room<Record<string, never>, FolderRoomStorage, never, never>; leave: () => void }`

Không có unit test riêng cho file này — nó chỉ là plumbing mỏng quanh API đã verify trực tiếp bằng spike thật (xem `## Spike verification` trong spec: `createClient`, `client.enterRoom`, `LiveObject`, `LiveMap`, `room.getStorage()`, `room.subscribe(root, cb, {isDeep:true})`, `LiveMap.set/delete`, `LiveObject.update` đều đã chạy thành công qua 2 tab thật). Verify bằng typecheck.

- [x] **Step 1: Viết `lib/liveblocks-room.ts`**

```ts
import { LiveMap, LiveObject, createClient } from '@liveblocks/client'
import type { Room } from '@liveblocks/client'
import type { SharedFolderMeta, SharedSearchFields } from '@/lib/folder-sync'

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
          folder: new LiveObject({ name: '', color: '' }),
          searches: new LiveMap(),
        },
  })
}

export type { Room }
```

- [x] **Step 2: Typecheck — sửa signature nếu type thật của `@liveblocks/client` khác**

Run: `bun run typecheck`
Expected: no errors. Nếu generic parameter của `enterRoom`/`createClient` không khớp (SDK có thể đổi tên type param giữa version), mở `node_modules/@liveblocks/client/dist/*.d.ts` xem signature thật và chỉnh lại cho khớp — đây là library thật cài ở Task 3, không phải giả định.

- [x] **Step 3: Commit**

```bash
git add lib/liveblocks-room.ts
git commit -m "feat: add liveblocks client wrapper for folder rooms"
```

---

## Task 5: `composables/useFolderSync.ts` — orchestration

**Files:**
- Create: `composables/useFolderSync.ts`

**Interfaces:**
- Consumes:
  - `useTradeStore()` từ `@/composables/useTradeStore` (Task đã có sẵn — KHÔNG sửa file này)
  - `enterFolderRoom`, `FolderRoomStorage` từ `@/lib/liveblocks-room` (Task 4)
  - `generateShareKey`, `toSharedFolderMeta`, `toSharedSearchFields`, `buildSavedSearch`, `diffFolderMeta`, `diffSearchesForFolder`, `planRoomChanges` từ `@/lib/folder-sync` (Task 1)
  - `store.setFolderShareKey`, `store.addSharedFolder`, `store.applyRemoteFolderState` — CẦN expose qua `useTradeStore()` (xem Step 0 bên dưới)
- Produces (dùng bởi Task 6, 7):
  - `useFolderSync(): { init(): Promise<void>; shareFolder(folderId: string): Promise<string | undefined>; joinFolder(shareKey: string): Promise<void>; rotateShareKey(folderId: string): Promise<void>; stopSharing(folderId: string): Promise<void> }`

- [x] **Step 0: Expose 3 hàm mới của Task 2 qua `useTradeStore()`**

Modify `composables/useTradeStore.ts`. Đổi import ở dòng 3-18, thêm:

```ts
import {
  STORAGE_KEY,
  addSharedFolder as addStoredSharedFolder,
  applyRemoteFolderState as applyStoredRemoteFolderState,
  clearHistory as clearStoredHistory,
  createDefaultState,
  createFolder as createStoredFolder,
  importState as importStoredState,
  readState,
  recordSnapshot as recordStoredSnapshot,
  removeFolder as removeStoredFolder,
  removeSearch as removeStoredSearch,
  renameFolder as renameStoredFolder,
  saveSearch as saveStoredSearch,
  setExchangeRateCache as setStoredExchangeRateCache,
  setFolderShareKey as setStoredFolderShareKey,
  updateSearch as updateStoredSearch,
  updateSettings as updateStoredSettings,
} from '@/lib/storage'
import type { SharedFolderMeta } from '@/lib/folder-sync'
import type { ExchangeRateCache, PriceSnapshot } from '@/types/pricing'
import type { SavedSearch, SaveSearchInput, SearchFolder, TradeState } from '@/types/trading'
```

Thêm 3 hàm vào object trả về của `useTradeStore()` (`composables/useTradeStore.ts:51-68`), ngay trước dòng đóng `}`:

```ts
    setFolderShareKey: (id: string, shareKey: string | undefined) => run(setStoredFolderShareKey(id, shareKey)),
    addSharedFolder: (folder: SearchFolder, searches: SavedSearch[]) => run(addStoredSharedFolder(folder, searches)),
    applyRemoteFolderState: (folderId: string, meta: SharedFolderMeta, searches: SavedSearch[]) =>
      run(applyStoredRemoteFolderState(folderId, meta, searches)),
```

- [x] **Step 1: Typecheck sau Step 0**

Run: `bun run typecheck`
Expected: no errors

- [x] **Step 2: Viết `composables/useFolderSync.ts`**

```ts
import { watch } from 'vue'
import { LiveObject } from '@liveblocks/client'
import { useTradeStore } from '@/composables/useTradeStore'
import { enterFolderRoom, type FolderRoomStorage } from '@/lib/liveblocks-room'
import {
  buildSavedSearch,
  diffFolderMeta,
  diffSearchesForFolder,
  generateShareKey,
  planRoomChanges,
  toSharedFolderMeta,
  toSharedSearchFields,
} from '@/lib/folder-sync'
import type { SearchFolder, TradeState } from '@/types/trading'

interface RoomHandle {
  leave: () => void
  root: LiveObject<FolderRoomStorage>
}

const activeRooms = new Map<string, RoomHandle>()
let watching = false

function readRemoteSearches(root: LiveObject<FolderRoomStorage>, folderId: string) {
  return [...root.get('searches').entries()].map(([id, fields]) => buildSavedSearch(id, folderId, fields.toJSON()))
}

async function connectRoom(folderId: string, shareKey: string, store: ReturnType<typeof useTradeStore>) {
  if (activeRooms.has(shareKey)) return

  const { room, leave } = enterFolderRoom(shareKey)
  const { root } = await room.getStorage()
  activeRooms.set(shareKey, { leave, root })

  await store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))

  room.subscribe(
    root,
    () => {
      void store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))
    },
    { isDeep: true },
  )
}

function disconnectRoom(shareKey: string) {
  const handle = activeRooms.get(shareKey)
  if (!handle) return
  handle.leave()
  activeRooms.delete(shareKey)
}

function pushLocalChangesToRoom(folder: SearchFolder, prevState: TradeState, nextState: TradeState) {
  if (!folder.shareKey) return
  const handle = activeRooms.get(folder.shareKey)
  if (!handle) return

  const prevFolder = prevState.folders.find((entry) => entry.id === folder.id)
  if (prevFolder) {
    const metaDiff = diffFolderMeta(prevFolder, folder)
    if (metaDiff) handle.root.get('folder').update(metaDiff)
  }

  const diff = diffSearchesForFolder(folder.id, prevState.searches, nextState.searches)
  const searchesMap = handle.root.get('searches')
  for (const search of diff.added) searchesMap.set(search.id, new LiveObject(toSharedSearchFields(search)))
  for (const search of diff.updated) searchesMap.get(search.id)?.update(toSharedSearchFields(search))
  for (const id of diff.removedIds) searchesMap.delete(id)
}

export function useFolderSync() {
  const store = useTradeStore()

  function startWatching() {
    if (watching) return
    watching = true
    watch(
      () => store.state.value,
      (next, prev) => {
        const { toConnect, toDisconnect } = planRoomChanges([...activeRooms.keys()], next.folders)
        for (const shareKey of toDisconnect) disconnectRoom(shareKey)
        for (const { folderId, shareKey } of toConnect) void connectRoom(folderId, shareKey, store)
        for (const folder of next.folders) {
          if (folder.shareKey) pushLocalChangesToRoom(folder, prev, next)
        }
      },
      { deep: true, flush: 'sync' },
    )
  }

  async function init() {
    await store.init()
    const { toConnect } = planRoomChanges([], store.state.value.folders)
    for (const { folderId, shareKey } of toConnect) await connectRoom(folderId, shareKey, store)
    startWatching()
  }

  async function shareFolder(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder) return

    const shareKey = generateShareKey()
    const seedSearches = Object.fromEntries(
      store.state.value.searches
        .filter((search) => search.folderId === folderId)
        .map((search) => [search.id, toSharedSearchFields(search)]),
    )

    const { room, leave } = enterFolderRoom(shareKey, { folder: toSharedFolderMeta(folder), searches: seedSearches })
    const { root } = await room.getStorage()
    activeRooms.set(shareKey, { leave, root })
    room.subscribe(
      root,
      () => {
        void store.applyRemoteFolderState(folderId, root.get('folder').toJSON(), readRemoteSearches(root, folderId))
      },
      { isDeep: true },
    )

    await store.setFolderShareKey(folderId, shareKey)
    return shareKey
  }

  async function joinFolder(shareKey: string) {
    const { room, leave } = enterFolderRoom(shareKey)
    const { root } = await room.getStorage()
    const meta = root.get('folder').toJSON()

    const folder: SearchFolder = {
      id: `folder-${crypto.randomUUID()}`,
      name: meta.name,
      color: meta.color,
      order: store.state.value.folders.length,
      shareKey,
    }
    const searches = readRemoteSearches(root, folder.id)

    activeRooms.set(shareKey, { leave, root })
    room.subscribe(
      root,
      () => {
        void store.applyRemoteFolderState(folder.id, root.get('folder').toJSON(), readRemoteSearches(root, folder.id))
      },
      { isDeep: true },
    )

    await store.addSharedFolder(folder, searches)
  }

  async function rotateShareKey(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder?.shareKey) return
    disconnectRoom(folder.shareKey)
    await shareFolder(folderId)
  }

  async function stopSharing(folderId: string) {
    const folder = store.state.value.folders.find((entry) => entry.id === folderId)
    if (!folder?.shareKey) return
    disconnectRoom(folder.shareKey)
    await store.setFolderShareKey(folderId, undefined)
  }

  return { init, shareFolder, joinFolder, rotateShareKey, stopSharing }
}
```

API `LiveMap.set/get/delete` và `LiveObject.update` dùng trong `pushLocalChangesToRoom` đã verify hoạt động đúng trực tiếp trong spike (xem phần thứ hai của `## Spike verification` trong spec) — không phải suy đoán từ docs.

- [x] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors. Sửa mọi mismatch giữa code trên và type thật của `@liveblocks/client` (vd tên tham số `enterRoom`, kiểu trả về `room.getStorage()`) dựa trên `node_modules/@liveblocks/client/dist/*.d.ts` — không đoán, đọc type thật.

- [x] **Step 4: Commit**

```bash
git add composables/useTradeStore.ts composables/useFolderSync.ts
git commit -m "feat: add folder sync orchestration composable"
```

---

## Task 6: UI share/rotate/stop-sharing trên `FolderSection.vue`

**Files:**
- Modify: `components/FolderSection.vue`
- Modify: `locales/vi.json`, `locales/en.json`

**Interfaces:**
- Produces (dùng bởi Task 7): emit mới `share: [folderId: string]`, `rotateShare: [folderId: string]`, `stopShare: [folderId: string]`

- [x] **Step 1: Thêm i18n keys**

Modify `locales/vi.json`, trong object `folder` (sau dòng `"delete": "Xóa",` ở dòng 25), thêm:

```json
    "share": "Chia sẻ",
    "shareSettings": "Cài đặt chia sẻ",
    "shareIntroText": "Sinh một key để chia sẻ folder này. Ai có key sẽ thấy và sửa được mọi bookmark trong folder, thay đổi đồng bộ hai chiều theo thời gian thực.",
    "startSharing": "Bắt đầu chia sẻ",
    "shareActiveText": "Folder này đang được chia sẻ. Ai có key dưới đây có toàn quyền đọc/ghi.",
    "shareKeyLabel": "Share key",
    "copyShareKey": "Sao chép share key",
    "rotateShareKey": "Đổi key mới",
    "stopSharing": "Ngừng chia sẻ",
    "joinByKey": "Tham gia bằng key",
    "joinKeyPlaceholder": "Dán share key vào đây",
    "joinKeyInputLabel": "Share key",
    "join": "Tham gia",
```

Modify `locales/en.json`, cùng vị trí tương ứng trong object `folder`:

```json
    "share": "Share",
    "shareSettings": "Share settings",
    "shareIntroText": "Generate a key to share this folder. Anyone with the key can see and edit every bookmark in it, changes sync both ways in real time.",
    "startSharing": "Start sharing",
    "shareActiveText": "This folder is being shared. Anyone with the key below has full read/write access.",
    "shareKeyLabel": "Share key",
    "copyShareKey": "Copy share key",
    "rotateShareKey": "Rotate key",
    "stopSharing": "Stop sharing",
    "joinByKey": "Join by key",
    "joinKeyPlaceholder": "Paste a share key",
    "joinKeyInputLabel": "Share key",
    "join": "Join",
```

- [x] **Step 2: Regenerate i18n types**

Run: `bunx wxt prepare`
Expected: `.wxt/types/i18n.d.ts` regenerate thành công, không lỗi parse JSON

- [x] **Step 3: Sửa `components/FolderSection.vue`**

Đổi import icon ở dòng 4:

```ts
import { BookmarkCheck, BookmarkPlus, Check, ChevronRight, Copy, MoreHorizontal, Pencil, RefreshCw, Share2, Trash2, X } from 'lucide-vue-next'
```

Đổi kiểu `action` ở dòng 27:

```ts
const action = ref<'closed' | 'rename' | 'delete' | 'share'>('closed')
```

Thêm emit mới vào `defineEmits` (dòng 20-25):

```ts
const emit = defineEmits<{
  'update:open': [value: boolean]
  'rename': [folderId: string, name: string]
  'delete': [folderId: string]
  'save': [folderId: string]
  'share': [folderId: string]
  'rotateShare': [folderId: string]
  'stopShare': [folderId: string]
}>()
```

Thêm hàm copy sau `confirmDelete` (dòng 46-50):

```ts
async function copyShareKey() {
  if (!props.folder.shareKey) return
  await navigator.clipboard.writeText(props.folder.shareKey)
}
```

Thêm `DropdownMenuItem` cho share, ngay sau item "Xóa" (dòng 88-94), trước `</DropdownMenuContent>`:

```vue
          <DropdownMenuItem @select="action = 'share'">
            <Share2 class="size-4 text-tan" /> {{ folder.shareKey ? i18n.t('folder.shareSettings') : i18n.t('folder.share') }}
          </DropdownMenuItem>
```

Thêm panel share, ngay sau khối `v-else-if="action === 'delete'"` (dòng 116-129), trước `<CollapsibleContent>`:

```vue
    <div v-else-if="action === 'share'" class="border-t border-rule bg-raised px-3 py-3">
      <template v-if="folder.shareKey">
        <p class="text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareActiveText') }}</p>
        <div class="mt-2 flex items-center gap-2">
          <input class="poe-input flex-1" readonly :value="folder.shareKey" :aria-label="i18n.t('folder.shareKeyLabel')">
          <button class="icon-btn" type="button" :aria-label="i18n.t('folder.copyShareKey')" @click="copyShareKey">
            <Copy />
          </button>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="emit('rotateShare', folder.id); action = 'closed'">
            <RefreshCw /> {{ i18n.t('folder.rotateShareKey') }}
          </button>
          <button class="poe-btn text-danger" type="button" @click="emit('stopShare', folder.id); action = 'closed'">
            {{ i18n.t('folder.stopSharing') }}
          </button>
        </div>
      </template>
      <template v-else>
        <p class="text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareIntroText') }}</p>
        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="action = 'closed'">{{ i18n.t('folder.cancel') }}</button>
          <button class="poe-btn poe-btn-primary" type="button" @click="emit('share', folder.id)">
            <Share2 /> {{ i18n.t('folder.startSharing') }}
          </button>
        </div>
      </template>
    </div>
```

- [x] **Step 4: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: no errors

- [x] **Step 5: Commit**

```bash
git add components/FolderSection.vue locales/vi.json locales/en.json
git commit -m "feat: add share/rotate/stop-sharing UI to FolderSection"
```

---

## Task 7: Wire `useFolderSync` + "Join by key" vào cả hai App.vue

**Files:**
- Modify: `entrypoints/popup/App.vue`
- Modify: `entrypoints/trade.content/App.vue`

(Hai file duplicate cấu trúc sẵn có — theo đúng convention hiện tại của repo, không refactor gộp chung ở plan này.)

- [x] **Step 1: `entrypoints/popup/App.vue`**

Đổi import ở dòng 5-10, thêm `Users` vào icon và thêm import composable:

```ts
import { Bookmark, Download, Plus, Upload, Users } from 'lucide-vue-next'
import FolderSection from '@/components/FolderSection.vue'
import { useFolderSync } from '@/composables/useFolderSync'
import { useTradeStore } from '@/composables/useTradeStore'
```

Thêm state mới sau dòng 18 (`const showFolderCreator = ref(false)`):

```ts
const folderSync = useFolderSync()
const showJoinForm = ref(false)
const joinKey = ref('')
```

Đổi `onMounted` (dòng 49-53):

```ts
onMounted(async () => {
  await folderSync.init()
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  currentPage.value = tab?.url ? parseTradeUrl(tab.url, tab.title) : null
})
```

Thêm handler sau hàm `addFolder` (dòng 64-70):

```ts
async function shareFolder(folderId: string) {
  await folderSync.shareFolder(folderId)
}

async function rotateShareKey(folderId: string) {
  await folderSync.rotateShareKey(folderId)
}

async function stopSharing(folderId: string) {
  await folderSync.stopSharing(folderId)
}

async function joinFolder() {
  const key = joinKey.value.trim()
  if (!key) return
  await folderSync.joinFolder(key)
  joinKey.value = ''
  showJoinForm.value = false
}
```

Wire event mới vào `<FolderSection>` (dòng 133-147):

```vue
      <FolderSection
        v-for="folder in store.state.value.folders"
        :key="folder.id"
        :folder="folder"
        :searches="searchesForFolder(folder.id)"
        :open="isFolderOpen(folder.id)"
        :can-delete="store.state.value.folders.length > 1"
        :delete-target-name="deleteTargetName(folder.id)"
        :current-page="currentPage"
        :is-current-page-saved="currentSavedFolderId() === folder.id"
        @update:open="setFolderOpen(folder.id, $event)"
        @rename="store.renameFolder"
        @delete="store.removeFolder"
        @save="saveCurrent"
        @share="shareFolder"
        @rotate-share="rotateShareKey"
        @stop-share="stopSharing"
      />
```

Thêm form "Join by key" ngay sau khối "New Folder" (dòng 149-161), trước `</section>`:

```vue
      <form v-if="showJoinForm" class="flex gap-2 px-3 py-3" @submit.prevent="joinFolder">
        <input v-model="joinKey" class="poe-input flex-1" :placeholder="i18n.t('folder.joinKeyPlaceholder')" :aria-label="i18n.t('folder.joinKeyInputLabel')">
        <button class="poe-btn poe-btn-primary" type="submit" :disabled="!joinKey.trim()">{{ i18n.t('folder.join') }}</button>
        <button class="poe-btn" type="button" @click="showJoinForm = false">{{ i18n.t('folder.cancel') }}</button>
      </form>
      <button
        v-else
        class="flex h-10 w-full items-center justify-center gap-2 border-t border-dashed border-bronze bg-row text-[13px] text-tan transition-colors hover:border-bronze-strong hover:bg-hover hover:text-cream"
        type="button"
        @click="showJoinForm = true"
      >
        <Users class="size-4" /> {{ i18n.t('folder.joinByKey') }}
      </button>
```

- [x] **Step 2: `entrypoints/trade.content/App.vue`**

Đổi import ở dòng 5-7, thêm `Users` + composable:

```ts
import { Bookmark, Plus, Users, X } from 'lucide-vue-next'
import FolderSection from '@/components/FolderSection.vue'
import { useFolderSync } from '@/composables/useFolderSync'
import { useTradeStore } from '@/composables/useTradeStore'
```

Thêm state sau dòng 38 (`const newFolderName = ref('')`):

```ts
const folderSync = useFolderSync()
const showJoinForm = ref(false)
const joinKey = ref('')
```

Đổi dòng 127 (`await store.init()` trong `onMounted`) thành:

```ts
  await folderSync.init()
```

Thêm handler sau `createNewFolder` (dòng 105-112):

```ts
async function shareFolder(folderId: string) {
  await folderSync.shareFolder(folderId)
}

async function rotateShareKey(folderId: string) {
  await folderSync.rotateShareKey(folderId)
}

async function stopSharing(folderId: string) {
  await folderSync.stopSharing(folderId)
}

async function joinFolder() {
  const key = joinKey.value.trim()
  if (!key) return
  await folderSync.joinFolder(key)
  joinKey.value = ''
  showJoinForm.value = false
}
```

Wire event vào `<FolderSection>` (dòng 195-209):

```vue
          <FolderSection
            v-for="folder in store.state.value.folders"
            :key="folder.id"
            :folder="folder"
            :searches="searchesForFolder(folder.id)"
            :open="isFolderOpen(folder.id)"
            :can-delete="store.state.value.folders.length > 1"
            :delete-target-name="deleteTargetName(folder.id)"
            :current-page="currentPage"
            :is-current-page-saved="currentSavedFolderId === folder.id"
            @update:open="setFolderOpen(folder.id, $event)"
            @rename="store.renameFolder"
            @delete="store.removeFolder"
            @save="saveCurrent"
            @share="shareFolder"
            @rotate-share="rotateShareKey"
            @stop-share="stopSharing"
          />
```

Thêm form "Join by key" sau khối "New Folder" (dòng 211-223), trước `</template>`:

```vue
          <form v-if="showJoinForm" class="flex gap-2 px-3 py-3" @submit.prevent="joinFolder">
            <input v-model="joinKey" class="poe-input flex-1" :placeholder="i18n.t('folder.joinKeyPlaceholder')" :aria-label="i18n.t('folder.joinKeyInputLabel')">
            <button class="poe-btn poe-btn-primary" type="submit" :disabled="!joinKey.trim()">{{ i18n.t('folder.join') }}</button>
            <button class="poe-btn" type="button" @click="showJoinForm = false">{{ i18n.t('folder.cancel') }}</button>
          </form>
          <button
            v-else
            class="flex h-10 w-full items-center justify-center gap-2 border-t border-dashed border-bronze bg-row text-[13px] text-tan transition-colors hover:border-bronze-strong hover:bg-hover hover:text-cream"
            type="button"
            @click="showJoinForm = true"
          >
            <Users class="size-4" /> {{ i18n.t('folder.joinByKey') }}
          </button>
```

- [x] **Step 3: Typecheck + full check**

Run: `bun run check`
Expected: test + typecheck + build đều pass

- [x] **Step 4: Commit**

```bash
git add entrypoints/popup/App.vue entrypoints/trade.content/App.vue
git commit -m "feat: wire folder share/join actions into popup and panel"
```

---

## Task 8: Xác minh end-to-end qua ego-browser (2 profile thật)

Không phải unit test — đây là bước xác minh thủ công bắt buộc trước khi coi feature xong, theo đúng `## Testing strategy` trong spec (Liveblocks realtime khó mock trung thực trong vitest).

- [x] **Step 1: Build extension**

Run: `bun run build`
Expected: output ở `.output/chrome-mv3`

- [x] **Step 2: Load unpacked extension bằng ego-browser, xác nhận panel mở được trên một trang trade thật**

Dùng `ego-browser` mở `chrome://extensions`, bật Developer mode, "Load unpacked" trỏ vào `.output/chrome-mv3`, sau đó mở một trang `pathofexile.com/trade/...` thật, xác nhận panel Trade Companion hiện ra bình thường (không lỗi console liên quan `@liveblocks/client` hay `host_permissions`).

- [x] **Step 3: Test flow Share**

Trên panel, mở dropdown một folder có sẵn search → "Chia sẻ" → "Bắt đầu chia sẻ" → xác nhận panel hiện share key, không lỗi console.

- [x] **Step 4: Test flow Join (tab/profile thứ hai)**

Mở một tab/profile thứ hai (hoặc một trang trade khác trong cùng extension instance để mô phỏng người thứ hai — chấp nhận vì mục tiêu chỉ là xác nhận đường dữ liệu qua Liveblocks, không cần multi-profile thật), dùng nút "Tham gia bằng key" dán key vừa copy → xác nhận folder mới xuất hiện với đúng search đã share.

- [x] **Step 5: Test flow realtime**

Từ context A, thêm/sửa một search trong folder đang share → quan sát context B (đang mở) tự cập nhật không cần reload, trong vài giây.

- [x] **Step 6: Test flow Rotate**

Từ context A, "Đổi key mới" → xác nhận key hiển thị đổi khác, và context B (vẫn giữ key cũ, giờ không active nữa) không còn nhận update mới từ A.

- [x] **Step 7: Ghi lại kết quả**

Nếu có bước fail, quay lại task tương ứng sửa code — KHÔNG coi plan là xong nếu bước nào ở Task 8 fail. Đây là proxy cuối cùng cho goal gốc ("mọi thay đổi đều share với nhau hết"), không phải chỉ `bun run check` xanh.

---

## Self-review

**Spec coverage:** data model (Task 1), sync engine + echo-avoidance (Task 5), UI flow share/join/rotate (Task 6, 7), manifest/host_permissions (Task 3), zero-CDN-import constraint (Global Constraints + Task 4 note), failure modes về Liveblocks project riêng cho production (Task 3 Step 4 note), testing strategy unit + integration (Task 1/2 unit, Task 8 integration) — tất cả có task tương ứng.

**Placeholder scan:** không còn "TBD"/"implement later". Task 5 Step 2 có một đoạn cố ý sai kèm hướng dẫn sửa cụ thể ngay sau đó (không phải placeholder mơ hồ — là toàn bộ code thay thế đã viết sẵn, tránh fabricate signature `LiveObject` chưa chắc đúng import path trong đoạn đó).

**Type consistency:** `SharedFolderMeta`, `SharedSearchFields`, `SearchDiff`, `FolderRoomStorage` dùng nhất quán tên và shape xuyên suốt Task 1/2/4/5. `store.setFolderShareKey`/`addSharedFolder`/`applyRemoteFolderState` khớp signature giữa Task 2 (định nghĩa ở storage.ts) và Task 5 Step 0 (expose qua useTradeStore) và Task 5 Step 2 (sử dụng).

---

## Post-execution note (2026-09-04)

Plan đã thực thi xong Task 1-7 đúng như viết, verify bằng `bun run check` (test/typecheck/build) sau mỗi task. Hai điều chỉnh so với lúc viết plan, phát hiện lúc code thật:

1. **`interface` → `type`** cho `SharedSearchFields`/`SharedFolderMeta`/`FolderRoomStorage` — Liveblocks `LsonObject` yêu cầu index signature, interface không tự thoả được (xem spec, mục "Version drift").
2. **`LiveObject.toObject()` → `.toJSON()`** — spike dùng `@liveblocks/client@2` qua CDN, bản cài thật (`bun add`) là `3.24.1`; method đổi tên giữa hai version. Phát hiện qua typecheck, không phải qua chạy thử.

**Task 6/7 đã bị thay thế sau khi thực thi xong**, theo yêu cầu UX mới của user giữa phiên: UI share đổi từ inline panel (mở rộng ngay dưới header folder) sang **modal riêng** (`components/ShareFolderModal.vue`), theo đúng convention modal đã có sẵn trong app (`PriceHistoryModal.vue` + `components/ui/dialog/`). Thay đổi cụ thể:
- `components/FolderSection.vue` không còn giữ state `action === 'share'` hay emit `share`/`rotateShare`/`stopShare` — chỉ còn `showShareModal` ref mở modal, cộng icon `Share2` nhỏ làm indicator cạnh tên folder khi `folder.shareKey` tồn tại.
- `components/ShareFolderModal.vue` (mới) tự gọi thẳng `useFolderSync()` (share/rotate/stop) — không cần App.vue trung chuyển event nữa, nên `entrypoints/popup/App.vue` và `entrypoints/trade.content/App.vue` bỏ hẳn 3 handler `shareFolder`/`rotateShareKey`/`stopSharing` và 3 event binding tương ứng, chỉ còn giữ `showJoinForm`/`joinFolder` (Join by key vẫn ở cấp App vì không gắn với một folder cụ thể).
- Modal có state `loading` rõ ràng (hiện `i18n.t('folder.shareLoading')`) trong lúc `shareFolder`/`rotateShareKey`/`stopSharing` đang chạy async.

**Verify end-to-end qua ego-browser** (real extension load unpacked, trang trade thật, không phải raw SDK): share tạo room + hiện key + indicator xuất hiện trên folder row; stop sharing tự chuyển modal về trạng thái "chưa share" + indicator biến mất — không cần đóng/mở lại modal. Gặp và giải quyết một false-positive lớn trong lúc test: **"Extension context invalidated"** — content script cũ (từ trước các lần reload extension) vẫn chạy trong tab đã mở từ lâu, không phải bug thật trong code. Bài học: sau khi reload unpacked extension, phải hard-refresh (`gotoAndWait` cùng URL) mọi tab đang mở trước khi test, không chỉ switch qua lại; và UI content-script của app này mount trong **Shadow DOM** (`<exile-trade-companion>`), `document.querySelector` từ page context không xuyên qua được — phải query qua `.shadowRoot`.

Chưa test: rotate key + realtime cross-context (2 profile Chrome thật riêng biệt) — chỉ verify được qua cùng một storage local (đủ để xác nhận đường dữ liệu Liveblocks, theo đúng giới hạn đã ghi ở Task 8 Step 4 gốc). Test đa-profile thật để lại cho user tự trải nghiệm với bạn bè.

### Iteration 2: indicator nổi bật + trạng thái sync (2026-09-04, cùng phiên)

User yêu cầu thêm: indicator phải nổi bật hơn (icon 14px cũ quá nhỏ, không rõ đang share), click thẳng vào indicator phải mở modal (không chỉ qua dropdown), và hiển thị trạng thái sync thật (connecting/syncing/idle/error — kiểu git status).

- `composables/useFolderSync.ts` thêm `syncStatus: Record<folderId, 'connecting'|'idle'|'syncing'|'error'>` (Vue `reactive`), cập nhật ở mọi điểm có I/O thật: `connectRoom` (connecting → syncing khi merge remote lần đầu → idle), callback `room.subscribe` (syncing → idle/error), `pushLocalChangesToRoom` (idle/error, không giả lập 'syncing' cho thao tác đồng bộ vì Liveblocks local mutation chạy đồng bộ, không có gì để chờ — tránh dựng loading giả). `RoomHandle` thêm field `folderId` để `disconnectRoom` dọn đúng status khi rời room.
- `components/FolderSection.vue`: icon share chuyển từ 14px tĩnh nằm trong header-trigger sang **button `icon-btn` 32px riêng** (cùng cỡ với nút bookmark/dropdown cạnh nó), có dot trạng thái (`bg-tan` = idle, `bg-tan animate-pulse` = connecting/syncing, `bg-danger` = error) đè góc trên-phải, `aria-label`/`title` đọc trạng thái. Click thẳng vào button này mở `ShareFolderModal` — không cần qua dropdown "..." nữa (dropdown vẫn giữ item Share/Share settings làm lối vào thứ hai).
- i18n keys mới: `folder.shareStatusConnecting/Syncing/Idle/Error` (vi + en).
- Verify qua ego-browser: label tính đúng ("Synced" ở trạng thái idle), class dot đúng (`bg-tan`, không pulse khi idle), click button mở modal thành công. `bun run check` sạch (96/96 test, typecheck, build).
