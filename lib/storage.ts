import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
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
      captureHistory: true,
      maxHistory: 50,
      collapsedFolderIds: [],
      hasOpenedPanel: false,
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
    searches: Array.isArray(candidate.searches) ? candidate.searches : [],
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
  await browser.storage.local.set({ [STORAGE_KEY]: state })
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

export async function recordHistory(page: TradePage) {
  const state = await readState()
  if (!state.settings.captureHistory) return state

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

export async function createFolder(name: string) {
  const state = await readState()
  const palette = ['#d4a64a', '#70a5dc', '#8ccf7e', '#d290e4', '#e67e80']
  state.folders.push({
    id: uid('folder'),
    name: name.trim(),
    color: palette[state.folders.length % palette.length]!,
    order: state.folders.length,
  })
  return writeState(state)
}

export async function renameFolder(id: string, name: string) {
  const state = await readState()
  const folder = state.folders.find((entry) => entry.id === id)
  const nextName = name.trim()
  if (!folder || !nextName) return state

  folder.name = nextName
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

export async function applyRemoteFolderState(folderId: string, meta: Pick<SharedFolderMeta, 'name' | 'color'>, searches: SavedSearch[]) {
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
