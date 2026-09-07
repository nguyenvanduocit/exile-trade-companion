import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { insertRelative, normalizeSearchOrder, orderedFolders, orderedSearches, type Placement } from '@/lib/bookmark-order'
import type {
  HistoryEntry,
  SavedSearch,
  SaveSearchInput,
  SearchFolder,
  TradePage,
  TradeSettings,
  TradeState,
} from '@/types/trading'
import type { ExchangeRateCache, PriceSnapshot } from '@/types/pricing'
import type { SharedFolderMeta } from '@/lib/folder-sync'

export const STORAGE_KEY = 'exile-trade-companion-state'
export const DEFAULT_FOLDER_ID = 'watchlist'

function defaultFolders(): SearchFolder[] {
  return [
    { id: DEFAULT_FOLDER_ID, name: i18n.t('folder.defaultWatchlist'), color: '#d4a64a', order: 0 },
    { id: 'gear', name: i18n.t('folder.defaultGear'), color: '#70a5dc', order: 1 },
    { id: 'bulk', name: i18n.t('folder.defaultBulk'), color: '#8ccf7e', order: 2 },
  ]
}

export function createDefaultState(): TradeState {
  return {
    version: 1,
    folders: defaultFolders(),
    searches: [],
    history: [],
    settings: {
      maxHistory: 50,
      collapsedFolderIds: [],
      hasOpenedPanel: false,
      statFilterButtonsEnabled: true,
      propertyFilterButtonsEnabled: true,
      priceLabelsEnabled: true,
      highlightSearchedModsEnabled: true,
      tierPickerEnabled: true,
      bulkSellerHighlightEnabled: true,
      telemetryEnabled: true,
    },
    snapshots: [],
    exchangeRate: null,
    hiddenSearchIds: [],
  }
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

function sanitizeState(value: unknown): TradeState {
  const fallback = createDefaultState()
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<TradeState>

  return {
    version: 1,
    folders: Array.isArray(candidate.folders) && candidate.folders.length
      ? candidate.folders
      : fallback.folders,
    searches: Array.isArray(candidate.searches)
      ? normalizeSearchOrder(candidate.searches.map((search) => {
        // Strip legacy per-search `watching` field left over from the removed watchlist feature.
        const { watching: _watching, ...rest } = search as SavedSearch & { watching?: boolean }
        return rest
      }))
      : [],
    history: Array.isArray(candidate.history) ? candidate.history : [],
    settings: {
      ...fallback.settings,
      ...(candidate.settings ?? {}),
    },
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : [],
    exchangeRate: candidate.exchangeRate ?? null,
    hiddenSearchIds: Array.isArray(candidate.hiddenSearchIds) ? candidate.hiddenSearchIds : [],
  }
}

export async function readState() {
  const stored = await browser.storage.local.get(STORAGE_KEY)
  return sanitizeState(stored[STORAGE_KEY])
}

export async function writeState(state: TradeState) {
  // `state` (và mọi field lồng bên trong, vd SavedSearch.query.stats) thường đi qua Vue 3 `ref`/
  // `reactive` trước khi tới đây, nên là Proxy chứ không phải object/array thuần. chrome.storage.local
  // serialize giá trị qua V8ValueConverter của Chromium — converter này không nhận diện Proxy bọc
  // quanh array (bug đã biết của Chromium, không phải JSON.stringify), nên ghi array thành object
  // key số (`{"0": ...}`) rồi không đọc lại được như array nữa. JSON round-trip ở đây tạo ra một bản
  // plain object/array thật trước khi đưa vào storage, né hẳn converter đó.
  await browser.storage.local.set({ [STORAGE_KEY]: JSON.parse(JSON.stringify(state)) })
  return state
}

export async function saveSearch(input: SaveSearchInput) {
  const state = await readState()
  const now = Date.now()
  const existing = state.searches.find((search) => search.url === input.url)

  if (existing) {
    Object.assign(existing, input, {
      folderId: input.folderId ?? existing.folderId,
      note: input.note ?? existing.note,
      updatedAt: now,
    })
    // Lưu lại đúng URL vừa "xoá" (ẩn) trước đó — coi như người dùng chủ động mang nó trở lại.
    state.hiddenSearchIds = state.hiddenSearchIds.filter((id) => id !== existing.id)
  } else {
    state.searches.unshift({
      ...input,
      id: uid('search'),
      folderId: input.folderId ?? DEFAULT_FOLDER_ID,
      note: input.note ?? '',
      order: -1,
      createdAt: now,
      updatedAt: now,
    })
  }

  return writeState(state)
}

export async function removeSearch(id: string) {
  const state = await readState()
  const search = state.searches.find((entry) => entry.id === id)
  const folder = search ? state.folders.find((entry) => entry.id === search.folderId) : undefined

  if (folder?.shareKey) {
    // Folder đang share-live: xoá thật khỏi `searches` sẽ bị diff đẩy lên room và xoá luôn ở máy
    // người khác. Chỉ ẩn cục bộ — search vẫn còn trong storage, chỉ không hiển thị nữa.
    if (!state.hiddenSearchIds.includes(id)) state.hiddenSearchIds = [...state.hiddenSearchIds, id]
    return writeState(state)
  }

  state.searches = state.searches.filter((entry) => entry.id !== id)
  return writeState(state)
}

export function isSearchVisible(state: TradeState, search: SavedSearch): boolean {
  return !state.hiddenSearchIds.includes(search.id)
}

export async function updateSearch(id: string, patch: Partial<SaveSearchInput>) {
  const state = await readState()
  const search = state.searches.find((entry) => entry.id === id)
  if (search) Object.assign(search, patch, { updatedAt: Date.now() })
  return writeState(state)
}

export async function moveFolder(id: string, targetId: string, placement: Placement = 'before') {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === id)
  if (!folder || id === targetId || !state.folders.some((entry) => entry.id === targetId)) return state
  state.folders = insertRelative(orderedFolders(state.folders), folder, targetId, placement)
    .map((entry, order) => ({ ...entry, order }))
  return writeState(state)
}

export async function moveSearch(id: string, folderId: string, targetId?: string, placement: Placement = 'before') {
  const state = await readState()
  let search = state.searches.find((entry) => entry.id === id && isSearchVisible(state, entry))
  if (!search || id === targetId || !state.folders.some((folder) => folder.id === folderId)) return state
  const destination = orderedSearches(state.searches.filter((entry) => isSearchVisible(state, entry)), folderId)
  if (targetId && !destination.some((entry) => entry.id === targetId)) return state

  const source = state.folders.find((folder) => folder.id === search!.folderId)
  if (source?.shareKey && source.id !== folderId) {
    // Moving out of a shared folder keeps the original for other participants, like local deletion.
    state.hiddenSearchIds.push(search.id)
    search = { ...search, id: uid('search') }
    state.searches.push(search)
  }
  search.folderId = folderId
  insertRelative(destination, search, targetId, placement).forEach((entry, order) => { entry.order = order })
  state.settings.collapsedFolderIds = state.settings.collapsedFolderIds.filter((id) => id !== folderId)
  return writeState(state)
}

export async function setSearchPurchased(id: string, purchased: boolean) {
  const state = await readState()
  const search = state.searches.find((entry) => entry.id === id)
  if (!search) return state
  search.purchased = purchased
  return writeState(state)
}

export async function recordHistory(page: TradePage) {
  const state = await readState()

  const entry: HistoryEntry = {
    ...page,
    id: uid('history'),
    visitedAt: Date.now(),
  }
  state.history = [entry, ...state.history.filter((item) => item.url !== page.url)]
    .slice(0, state.settings.maxHistory)
  return writeState(state)
}

export async function clearHistory() {
  const state = await readState()
  state.history = []
  return writeState(state)
}

export const FOLDER_COLORS = ['#d4a64a', '#70a5dc', '#8ccf7e', '#d290e4', '#e67e80', '#e0a458', '#5fbfb0', '#a8a29e'] as const

export function nextFolderColor(folderCount: number): string {
  return FOLDER_COLORS[folderCount % FOLDER_COLORS.length]!
}

export interface FolderInput {
  name: string
  color: string
  note?: string
}

export async function createFolder(input: FolderInput) {
  const state = await readState()
  const note = input.note?.trim()
  state.folders.push({
    id: uid('folder'),
    name: input.name.trim(),
    color: input.color,
    order: state.folders.length,
    ...(note ? { note } : {}),
  })
  return writeState(state)
}

export async function updateFolder(id: string, patch: Partial<FolderInput>) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === id)
  if (!folder) return state

  const nextName = patch.name?.trim()
  if (nextName) folder.name = nextName
  if (patch.color) folder.color = patch.color
  if (patch.note !== undefined) folder.note = patch.note.trim()
  return writeState(state)
}

export async function removeFolder(id: string) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === id)
  const fallbackFolder = state.folders.find((entry) => entry.id === DEFAULT_FOLDER_ID && entry.id !== id)
    ?? state.folders.find((entry) => entry.id !== id)

  if (!folder || !fallbackFolder) return state

  for (const search of state.searches) {
    if (search.folderId === id) search.folderId = fallbackFolder.id
  }

  state.folders = state.folders
    .filter((entry) => entry.id !== id)
    .map((entry, order) => ({ ...entry, order }))
  state.settings.collapsedFolderIds = state.settings.collapsedFolderIds.filter((folderId) => folderId !== id)
  return writeState(state)
}

export async function updateSettings(patch: Partial<TradeSettings>) {
  const state = await readState()
  state.settings = { ...state.settings, ...patch }
  return writeState(state)
}

export async function importState(value: unknown) {
  return writeState(sanitizeState(value))
}

export const MAX_SNAPSHOTS_PER_QUERY = 90

export async function recordSnapshot(input: Omit<PriceSnapshot, 'id'>) {
  const state = await readState()
  const entry: PriceSnapshot = { ...input, id: uid('snapshot') }
  const others = state.snapshots.filter((snapshot) => snapshot.queryId !== input.queryId)
  const nextForQuery = [...state.snapshots.filter((snapshot) => snapshot.queryId === input.queryId), entry]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, MAX_SNAPSHOTS_PER_QUERY)
  state.snapshots = [...others, ...nextForQuery]
  return writeState(state)
}

export async function setExchangeRateCache(cache: ExchangeRateCache) {
  const state = await readState()
  state.exchangeRate = cache
  return writeState(state)
}

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

export async function applyRemoteFolderState(folderId: string, meta: Pick<SharedFolderMeta, 'name' | 'color' | 'note'>, searches: SavedSearch[]) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === folderId)
  if (!folder) return state

  folder.name = meta.name
  folder.color = meta.color
  folder.note = meta.note ?? ''
  state.searches = [
    ...state.searches.filter((search) => search.folderId !== folderId),
    ...searches.map((search, index) => {
      const local = state.searches.find((entry) => entry.id === search.id && entry.folderId === folderId)
      return {
        ...search,
        order: local?.order ?? state.searches.length + index,
        purchased: local?.purchased ?? false,
      }
    }),
  ]

  return writeState(state)
}
