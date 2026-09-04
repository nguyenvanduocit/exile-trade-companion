<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { Bookmark, Plus, Users } from 'lucide-vue-next'
import FolderSection from '@/components/FolderSection.vue'
import JoinFolderModal from '@/components/JoinFolderModal.vue'
import { useFolderSync } from '@/composables/useFolderSync'
import { useTradeStore } from '@/composables/useTradeStore'
import { usePriceSnapshot } from '@/composables/usePriceSnapshot'
import { pageLabel, relativeTime } from '@/lib/relative-time'
import { recordHistory } from '@/lib/storage'
import { parseTradeUrl } from '@/lib/trade-url'
import { QUERY_LABEL_EVENT } from '@/lib/query-label'
import { SAVE_TOAST_EVENT } from '@/lib/save-toast'
import type { ExtensionMessage, TradePage } from '@/types/trading'

const UI_STATE_KEY = 'trade-companion-ui-state'

function loadUiState(): { open: boolean; tab: 'saved' | 'history' } {
  try {
    const raw = window.sessionStorage.getItem(UI_STATE_KEY)
    if (!raw) return { open: false, tab: 'saved' }
    const parsed = JSON.parse(raw) as Partial<{ open: boolean; tab: 'saved' | 'history' }>
    const tab = parsed.tab === 'history' ? parsed.tab : 'saved'
    return { open: parsed.open ?? false, tab }
  } catch {
    return { open: false, tab: 'saved' }
  }
}

const uiState = loadUiState()
const store = useTradeStore()
const folderSync = useFolderSync()
const priceSnapshot = usePriceSnapshot()
const open = ref(uiState.open)
const tab = ref<'saved' | 'history'>(uiState.tab)
const rawPage = ref<TradePage | null>(null)
const detectedLabel = ref<string | null>(null)
const showFolderCreator = ref(false)
const newFolderName = ref('')
const showJoinModal = ref(false)
const panelRef = ref<HTMLElement | null>(null)
let lastRecordedUrl = ''
let locationTimer: number | undefined
let stopWatchingResults: (() => void) | undefined
let pushObserver: ResizeObserver | undefined

// Panel là position:fixed (viewport, không nằm trong luồng trang) nên tự nó không đẩy được
// nội dung trang. Push thật bằng margin-right trên <html> — !important để thắng reset CSS
// của trang; ResizeObserver bám đúng width thực tế của panel (kể cả min(420px, 100vw)).
function applyPagePush(widthPx: number) {
  document.documentElement.style.setProperty('margin-right', `${widthPx}px`, 'important')
}

function clearPagePush() {
  document.documentElement.style.removeProperty('margin-right')
}

function startPagePush(el: HTMLElement) {
  applyPagePush(el.getBoundingClientRect().width)
  pushObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width
    if (width) applyPagePush(width)
  })
  pushObserver.observe(el)
}

function stopPagePush() {
  pushObserver?.disconnect()
  pushObserver = undefined
  clearPagePush()
}

const currentPage = computed<TradePage | null>(() => {
  if (!rawPage.value) return null
  return detectedLabel.value ? { ...rawPage.value, title: detectedLabel.value } : rawPage.value
})

function onQueryLabel(event: Event) {
  detectedLabel.value = (event as CustomEvent<string | null>).detail ?? null

  // Label detection chạy async (chờ window.app + DOM filter) nên có thể tới sau khi history đã
  // ghi title thô. Nếu label mới tới vẫn khớp URL vừa ghi, vá lại entry đó bằng title đẹp hơn —
  // recordHistory tự dedupe theo url nên gọi lại không tạo entry trùng.
  if (currentPage.value && currentPage.value.url === lastRecordedUrl && store.state.value.settings.captureHistory) {
    void recordHistory(currentPage.value)
  }
}

const history = computed(() => store.state.value.history.slice(0, 15))
const savedCount = computed(() => store.state.value.searches.length)
const currentSavedFolderId = computed(() => currentPage.value
  ? store.state.value.searches.find((item) => item.url === currentPage.value?.url)?.folderId
  : undefined)

function searchesForFolder(folderId: string) {
  return store.state.value.searches
    .filter((item) => item.folderId === folderId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

function deleteTargetName(folderId: string) {
  return store.state.value.folders.find((folder) => folder.id === 'watchlist' && folder.id !== folderId)?.name
    ?? store.state.value.folders.find((folder) => folder.id !== folderId)?.name
}

function isFolderOpen(folderId: string) {
  return !store.state.value.settings.collapsedFolderIds.includes(folderId)
}

async function setFolderOpen(folderId: string, isOpen: boolean) {
  const collapsed = new Set(store.state.value.settings.collapsedFolderIds)
  if (isOpen) collapsed.delete(folderId)
  else collapsed.add(folderId)
  await store.updateSettings({ collapsedFolderIds: [...collapsed] })
}

async function syncCurrentPage() {
  const parsed = parseTradeUrl(window.location.href, document.title)
  rawPage.value = parsed
  if (!parsed || parsed.url === lastRecordedUrl) return

  lastRecordedUrl = parsed.url
  if (store.state.value.settings.captureHistory) await recordHistory(currentPage.value ?? parsed)
}

async function saveCurrent(folderId: string) {
  if (!currentPage.value) return
  await store.saveSearch({ ...currentPage.value, folderId })
  tab.value = 'saved'

  const folderName = store.state.value.folders.find((folder) => folder.id === folderId)?.name ?? ''
  window.dispatchEvent(new CustomEvent(SAVE_TOAST_EVENT, { detail: i18n.t('folder.savedIn', { folder: folderName }) }))
}

async function createNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) return

  await store.createFolder(name)
  newFolderName.value = ''
  showFolderCreator.value = false
}

function onMessage(message: ExtensionMessage) {
  if (message.type === 'TOGGLE_PANEL') open.value = !open.value
}

async function openHistory(url: string) {
  await browser.runtime.sendMessage({ type: 'OPEN_URL', url } satisfies ExtensionMessage)
}

watch([open, tab], ([openValue, tabValue]) => {
  window.sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({ open: openValue, tab: tabValue }))
})

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    if (panelRef.value) startPagePush(panelRef.value)
  } else {
    stopPagePush()
  }
})

onMounted(async () => {
  document.documentElement.style.setProperty('transition', 'margin-right 200ms ease')
  if (open.value) {
    await nextTick()
    if (panelRef.value) startPagePush(panelRef.value)
  }
  await folderSync.init()
  await syncCurrentPage()
  locationTimer = window.setInterval(() => void syncCurrentPage(), 1200)
  browser.runtime.onMessage.addListener(onMessage)
  window.addEventListener(QUERY_LABEL_EVENT, onQueryLabel)
  stopWatchingResults = priceSnapshot.watchResultsForSnapshot(() => currentPage.value)
})

onBeforeUnmount(() => {
  if (locationTimer) window.clearInterval(locationTimer)
  browser.runtime.onMessage.removeListener(onMessage)
  window.removeEventListener(QUERY_LABEL_EVENT, onQueryLabel)
  stopWatchingResults?.()
  stopPagePush()
  document.documentElement.style.removeProperty('transition')
})
</script>

<template>
  <div class="trade-companion-shell">
    <button
      class="trade-companion-tab"
      :class="{ 'trade-companion-tab--open': open }"
      type="button"
      :aria-label="open ? i18n.t('panel.closeLabel') : i18n.t('panel.openLabel')"
      @click="open = !open"
    >
      <Bookmark />
      <span class="trade-companion-tab-label">{{ i18n.t('panel.title') }}</span>
    </button>

    <section v-if="open" ref="panelRef" class="trade-companion-panel" :aria-label="i18n.t('panel.title')">
      <header class="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-bronze pr-2 pl-1">
        <button
          v-if="tab === 'saved'"
          class="icon-btn"
          type="button"
          :aria-label="i18n.t('folder.newFolder')"
          @click="showFolderCreator = true"
        >
          <Plus />
        </button>
      </header>

      <nav class="flex shrink-0 border-b border-bronze" :aria-label="i18n.t('panel.viewNavLabel')">
        <button
          v-for="item in [
            { id: 'saved', label: savedCount ? i18n.t('panel.tabSavedCount', { count: savedCount }) : i18n.t('panel.tabSaved') },
            { id: 'history', label: i18n.t('panel.tabHistory') },
          ]"
          :key="item.id"
          class="h-8 flex-1 font-display text-[14px] transition-colors"
          :class="tab === item.id
            ? 'bg-[#5a3806] text-[#e9cf9f]'
            : 'text-[#e9cf9f] hover:bg-hover'"
          type="button"
          :aria-pressed="tab === item.id"
          @click="tab = item.id as typeof tab"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="trade-companion-scroll">
        <template v-if="tab === 'saved'">
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
          />

          <form v-if="showFolderCreator" class="flex gap-2 px-3 py-3" @submit.prevent="createNewFolder">
            <input v-model="newFolderName" class="poe-input flex-1" maxlength="32" autofocus :placeholder="i18n.t('folder.namePlaceholder')" :aria-label="i18n.t('folder.newNameLabel')">
            <button class="poe-btn poe-btn-primary" type="submit" :disabled="!newFolderName.trim()">{{ i18n.t('folder.create') }}</button>
            <button class="poe-btn" type="button" @click="showFolderCreator = false">{{ i18n.t('folder.cancel') }}</button>
          </form>
          <button
            v-else
            class="flex h-9 w-full items-center justify-center gap-2 border-t border-dashed border-bronze bg-row font-display text-[14px] text-tan transition-colors hover:border-bronze-strong hover:bg-hover hover:text-cream"
            type="button"
            @click="showFolderCreator = true"
          >
            <Plus class="size-4" /> {{ i18n.t('folder.newFolder') }}
          </button>

          <button
            class="flex h-8 w-full items-center justify-center gap-2 border-t border-dashed border-bronze bg-row text-[12px] text-tan transition-colors hover:border-bronze-strong hover:bg-hover hover:text-cream"
            type="button"
            @click="showJoinModal = true"
          >
            <Users class="size-3.5" /> {{ i18n.t('folder.joinByKey') }}
          </button>
          <JoinFolderModal v-model:open="showJoinModal" />
        </template>

        <template v-else>
          <button
            v-for="entry in history"
            :key="entry.id"
            class="group flex w-full items-start gap-3 border-b border-rule px-4 py-2.5 text-left last:border-b-0 hover:bg-hover"
            type="button"
            :title="entry.url"
            @click="openHistory(entry.url)"
          >
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 text-[13px] leading-5 text-grey group-hover:text-cream">{{ entry.title }}</span>
              <span class="mt-0.5 block font-display text-[14px] leading-5 text-tan">{{ pageLabel(entry) }}</span>
            </span>
            <span class="shrink-0 pt-0.5 text-[12px] leading-5 text-dim">{{ relativeTime(entry.visitedAt) }}</span>
          </button>
          <p v-if="!history.length" class="px-4 py-6 text-[13px] leading-5 text-dim">
            {{ i18n.t('history.empty') }}
          </p>
        </template>
      </div>
    </section>
  </div>
</template>
