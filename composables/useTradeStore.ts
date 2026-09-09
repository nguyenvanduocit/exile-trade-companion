import { computed, ref } from 'vue'
import { browser } from 'wxt/browser'
import {
  STORAGE_KEY,
  addSharedFolder as addStoredSharedFolder,
  applyRemoteFolderState as applyStoredRemoteFolderState,
  clearHistory as clearStoredHistory,
  createDefaultState,
  createFolder as createStoredFolder,
  type FolderInput,
  importState as importStoredState,
  isSearchVisible,
  moveFolder as moveStoredFolder,
  moveSearch as moveStoredSearch,
  setSearchPurchased as setStoredSearchPurchased,
  readState,
  replaceFolderContents as replaceStoredFolderContents,
  recordSnapshot as recordStoredSnapshot,
  removeFolder as removeStoredFolder,
  removeSearch as removeStoredSearch,
  saveSearch as saveStoredSearch,
  setExchangeRateCache as setStoredExchangeRateCache,
  setFolderShareKey as setStoredFolderShareKey,
  updateSearch as updateStoredSearch,
  updateFolder as updateStoredFolder,
  updateSettings as updateStoredSettings,
} from '@/lib/storage'
import { track } from '@/lib/track'
import type { Placement } from '@/lib/bookmark-order'
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
    saveSearch: (input: SaveSearchInput) => { track('feature.use', { feature: 'bookmark.save', mode: input.mode, game: input.game }); return run(saveStoredSearch(input)) },
    replaceFolderContents: (name: string, searches: SaveSearchInput[]) => run(replaceStoredFolderContents(name, searches)),
    removeSearch: (id: string) => run(removeStoredSearch(id)),
    updateSearch: (id: string, patch: Partial<SaveSearchInput>) => run(updateStoredSearch(id, patch)),
    moveFolder: (id: string, targetId: string, placement?: Placement) => run(moveStoredFolder(id, targetId, placement)),
    moveSearch: (id: string, folderId: string, targetId?: string, placement?: Placement) => { track('feature.use', { feature: 'bookmark.move' }); return run(moveStoredSearch(id, folderId, targetId, placement)) },
    setSearchPurchased: (id: string, purchased: boolean) => { track('feature.use', { feature: 'bookmark.purchased', purchased }); return run(setStoredSearchPurchased(id, purchased)) },
    clearHistory: () => run(clearStoredHistory()),
    createFolder: (input: FolderInput) => { track('feature.use', { feature: 'folder.create' }); return run(createStoredFolder(input)) },
    updateFolder: (id: string, patch: Partial<FolderInput>) => run(updateStoredFolder(id, patch)),
    removeFolder: (id: string) => run(removeStoredFolder(id)),
    updateSettings: (patch: Partial<TradeState['settings']>) => {
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === 'boolean' && key !== 'hasOpenedPanel') track('settings.change', { setting: key, value })
      }
      return run(updateStoredSettings(patch))
    },
    importState: (value: unknown) => { track('feature.use', { feature: 'backup.import' }); return run(importStoredState(value)) },
    recordSnapshot: (input: Omit<PriceSnapshot, 'id'>) => run(recordStoredSnapshot(input)),
    setExchangeRateCache: (cache: ExchangeRateCache) => run(setStoredExchangeRateCache(cache)),
    setFolderShareKey: (id: string, shareKey: string | undefined) => { track('feature.use', { feature: shareKey ? 'folder.share' : 'folder.unshare' }); return run(setStoredFolderShareKey(id, shareKey)) },
    addSharedFolder: (folder: SearchFolder, searches: SavedSearch[]) => { track('feature.use', { feature: 'folder.join', searches: searches.length }); return run(addStoredSharedFolder(folder, searches)) },
    applyRemoteFolderState: (folderId: string, meta: SharedFolderMeta, searches: SavedSearch[]) =>
      run(applyStoredRemoteFolderState(folderId, meta, searches)),
  }
}
