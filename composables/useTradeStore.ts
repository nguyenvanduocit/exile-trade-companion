import { computed, ref } from 'vue'
import { browser } from 'wxt/browser'
import {
  STORAGE_KEY,
  addSharedFolder as addStoredSharedFolder,
  applyRemoteFolderState as applyStoredRemoteFolderState,
  clearHistory as clearStoredHistory,
  createDefaultState,
  createFolder as createStoredFolder,
  importState as importStoredState,
  isSearchVisible,
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

const state = ref<TradeState>(createDefaultState())
const ready = ref(false)
let initPromise: Promise<void> | undefined
let listening = false

function init() {
  if (!initPromise) {
    initPromise = readState().then((stored) => {
      state.value = stored
      ready.value = true
    })
  }

  if (!listening) {
    listening = true
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
        state.value = changes[STORAGE_KEY].newValue as TradeState
      }
    })
  }

  return initPromise
}

async function run(operation: Promise<TradeState>) {
  state.value = await operation
}

export function useTradeStore() {
  return {
    state,
    // Dùng cái này ở mọi nơi hiển thị (đếm, danh sách, trạng thái "đã lưu"). `state.searches` giữ
    // nguyên bản thô (kể cả search đã ẩn) vì useFolderSync cần nó để diff đúng khi đẩy lên room.
    visibleSearches: computed(() => state.value.searches.filter((search) => isSearchVisible(state.value, search))),
    ready,
    init,
    saveSearch: (input: SaveSearchInput) => run(saveStoredSearch(input)),
    removeSearch: (id: string) => run(removeStoredSearch(id)),
    updateSearch: (id: string, patch: Partial<SaveSearchInput>) => run(updateStoredSearch(id, patch)),
    clearHistory: () => run(clearStoredHistory()),
    createFolder: (name: string) => run(createStoredFolder(name)),
    renameFolder: (id: string, name: string) => run(renameStoredFolder(id, name)),
    removeFolder: (id: string) => run(removeStoredFolder(id)),
    updateSettings: (patch: Partial<TradeState['settings']>) => run(updateStoredSettings(patch)),
    importState: (value: unknown) => run(importStoredState(value)),
    recordSnapshot: (input: Omit<PriceSnapshot, 'id'>) => run(recordStoredSnapshot(input)),
    setExchangeRateCache: (cache: ExchangeRateCache) => run(setStoredExchangeRateCache(cache)),
    setFolderShareKey: (id: string, shareKey: string | undefined) => run(setStoredFolderShareKey(id, shareKey)),
    addSharedFolder: (folder: SearchFolder, searches: SavedSearch[]) => run(addStoredSharedFolder(folder, searches)),
    applyRemoteFolderState: (folderId: string, meta: SharedFolderMeta, searches: SavedSearch[]) =>
      run(applyStoredRemoteFolderState(folderId, meta, searches)),
  }
}
