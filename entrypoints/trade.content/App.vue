<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { i18n } from '#i18n'
import { Bookmark, Download, Plus, Settings, Upload, Users } from 'lucide-vue-next'
import DiscordIcon from '@/components/DiscordIcon.vue'
import FolderSection from '@/components/FolderSection.vue'
import JoinFolderModal from '@/components/JoinFolderModal.vue'
import { useFolderSync } from '@/composables/useFolderSync'
import { useTradeStore } from '@/composables/useTradeStore'
import { usePriceSnapshot } from '@/composables/usePriceSnapshot'
import { usePriceLabels } from '@/composables/usePriceLabels'
import { pageLabel, relativeTime } from '@/lib/relative-time'
import { recordHistory } from '@/lib/storage'
import { buildDurableUrl, parseTradeUrl } from '@/lib/trade-url'
import { QUERY_STATE_EVENT, type QueryStateDetail } from '@/lib/query-label'
import { SAVE_TOAST_EVENT } from '@/lib/save-toast'
import type { ExtensionMessage, TradePage, TradeQuery } from '@/types/trading'

const UI_STATE_KEY = 'trade-companion-ui-state'

function loadUiState(): { open: boolean; tab: 'saved' | 'history' | 'settings' } {
  try {
    const raw = window.sessionStorage.getItem(UI_STATE_KEY)
    if (!raw) return { open: false, tab: 'saved' }
    const parsed = JSON.parse(raw) as Partial<{ open: boolean; tab: 'saved' | 'history' | 'settings' }>
    const tab = parsed.tab === 'history' || parsed.tab === 'settings' ? parsed.tab : 'saved'
    return { open: parsed.open ?? false, tab }
  } catch {
    return { open: false, tab: 'saved' }
  }
}

const props = defineProps<{ ctx: ContentScriptContext }>()

const uiState = loadUiState()
const store = useTradeStore()
const folderSync = useFolderSync()
const priceSnapshot = usePriceSnapshot(props.ctx)
const priceLabels = usePriceLabels(props.ctx)
const open = ref(uiState.open)
const tab = ref<'saved' | 'history' | 'settings'>(uiState.tab)
const previousTab = ref<'saved' | 'history'>(uiState.tab === 'settings' ? 'saved' : uiState.tab)
const importing = ref(false)
const rawPage = ref<TradePage | null>(null)
const detectedLabel = ref<string | null>(null)
const detectedQuery = ref<TradeQuery | null>(null)
const showFolderCreator = ref(false)
const newFolderName = ref('')
const showJoinModal = ref(false)
const panelRef = ref<HTMLElement | null>(null)
let lastRecordedUrl = ''
let locationTimer: number | undefined
let stopWatchingResults: (() => void) | undefined
let stopWatchingLabels: (() => void) | undefined
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
  return {
    ...rawPage.value,
    title: detectedLabel.value || rawPage.value.title,
    query: detectedQuery.value ?? undefined,
  }
})

function onQueryState(event: Event) {
  // CustomEvent#detail dạng object bị null hoá khi băng qua ranh giới MAIN/ISOLATED world thật —
  // trade-query.content.ts (MAIN world) bắn JSON string, tự parse lại ở đây.
  const detail = JSON.parse((event as CustomEvent<string>).detail) as QueryStateDetail
  detectedLabel.value = detail.label
  detectedQuery.value = detail.query

  // Label detection chạy async (chờ window.app + DOM filter) nên có thể tới sau khi history đã
  // ghi title thô. Nếu label mới tới vẫn khớp URL vừa ghi, vá lại entry đó bằng title đẹp hơn —
  // recordHistory tự dedupe theo url nên gọi lại không tạo entry trùng.
  if (currentPage.value && currentPage.value.url === lastRecordedUrl && store.state.value.settings.captureHistory) {
    void recordHistory(currentPage.value)
  }
}

const history = computed(() => store.state.value.history.slice(0, 15))
const savedCount = computed(() => store.visibleSearches.value.length)
const currentSavedFolderId = computed(() => currentPage.value
  ? store.visibleSearches.value.find((item) => item.url === currentPage.value?.url)?.folderId
  : undefined)

function searchesForFolder(folderId: string) {
  return store.visibleSearches.value
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
  if (message.type === 'TOGGLE_PANEL') {
    open.value = !open.value
    return
  }
  if (message.type === 'OPEN_PANEL') {
    open.value = true
    return
  }
  if (message.type === 'GET_CURRENT_PAGE') return Promise.resolve(currentPage.value)
}

async function openHistory(entry: TradePage) {
  const url = await buildDurableUrl(entry) ?? entry.url
  await browser.runtime.sendMessage({ type: 'OPEN_URL', url } satisfies ExtensionMessage)
}

async function openDiscord() {
  await browser.runtime.sendMessage({ type: 'OPEN_DISCORD' } satisfies ExtensionMessage)
}

async function openOnboarding() {
  await browser.runtime.sendMessage({ type: 'OPEN_ONBOARDING' } satisfies ExtensionMessage)
}

function toggleSettings() {
  if (tab.value === 'settings') {
    tab.value = previousTab.value
  } else {
    previousTab.value = tab.value
    tab.value = 'settings'
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(store.state.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `exile-trade-companion-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  try {
    await store.importState(JSON.parse(await file.text()))
  } finally {
    importing.value = false
    input.value = ''
  }
}

watch([open, tab], ([openValue, tabValue]) => {
  window.sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({ open: openValue, tab: tabValue }))
})

watch(() => store.state.value.settings.priceLabelsEnabled, (enabled) => {
  if (enabled) void priceLabels.applyLabels(currentPage.value)
  else priceLabels.removeLabels()
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
  await folderSync.init()

  // Lần đầu tiên cài extension (chưa từng mở panel) — tự mở panel ngay để user thấy được
  // tính năng thay vì phải tự bấm tab dọc, bất kể họ vào trade site qua nút CTA của onboarding
  // hay tự điều hướng sau khi bấm Skip.
  if (!store.state.value.settings.hasOpenedPanel) {
    open.value = true
    void store.updateSettings({ hasOpenedPanel: true })
  }

  if (open.value) {
    await nextTick()
    if (panelRef.value) startPagePush(panelRef.value)
  }
  await syncCurrentPage()
  locationTimer = props.ctx.setInterval(() => void syncCurrentPage(), 1200)
  browser.runtime.onMessage.addListener(onMessage)
  props.ctx.addEventListener(window, QUERY_STATE_EVENT, onQueryState)
  stopWatchingResults = priceSnapshot.watchResultsForSnapshot(() => currentPage.value)
  stopWatchingLabels = priceLabels.watchResultsForLabels(() => currentPage.value)
  void priceLabels.applyLabels(currentPage.value)
})

onBeforeUnmount(() => {
  if (locationTimer) window.clearInterval(locationTimer)
  browser.runtime.onMessage.removeListener(onMessage)
  stopWatchingResults?.()
  stopWatchingLabels?.()
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
      <header class="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-bronze pr-2 pl-1">
        <button
          class="discord-badge"
          type="button"
          :aria-label="i18n.t('panel.discordLabel')"
          :title="i18n.t('panel.discordLabel')"
          @click="openDiscord"
        >
          <DiscordIcon />
          {{ i18n.t('panel.discordBadge') }}
        </button>
        <div class="flex items-center gap-1.5">
          <template v-if="tab === 'saved'">
            <button class="poe-btn poe-btn-primary poe-btn-sm" type="button" @click="showFolderCreator = true">
              <Plus /> {{ i18n.t('folder.newFolder') }}
            </button>
            <button class="poe-btn poe-btn-sm" type="button" @click="showJoinModal = true">
              <Users /> {{ i18n.t('folder.joinByKey') }}
            </button>
          </template>
          <button
            class="icon-btn"
            type="button"
            :aria-label="i18n.t('panel.tabSettings')"
            :title="i18n.t('panel.tabSettings')"
            @click="toggleSettings"
          >
            <Settings />
          </button>
        </div>
      </header>

      <nav v-if="tab !== 'settings'" class="flex shrink-0 border-b border-bronze" :aria-label="i18n.t('panel.viewNavLabel')">
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
          <form v-if="showFolderCreator" class="flex gap-2 border-b border-dashed border-bronze bg-row px-3 py-2" @submit.prevent="createNewFolder">
            <input v-model="newFolderName" class="poe-input flex-1" maxlength="32" autofocus :placeholder="i18n.t('folder.namePlaceholder')" :aria-label="i18n.t('folder.newNameLabel')">
            <button class="poe-btn poe-btn-primary" type="submit" :disabled="!newFolderName.trim()">{{ i18n.t('folder.create') }}</button>
            <button class="poe-btn" type="button" @click="showFolderCreator = false">{{ i18n.t('folder.cancel') }}</button>
          </form>

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

          <JoinFolderModal v-model:open="showJoinModal" />
        </template>

        <template v-else-if="tab === 'history'">
          <button
            v-for="entry in history"
            :key="entry.id"
            class="group flex w-full items-start gap-3 border-b border-rule px-4 py-2.5 text-left last:border-b-0 hover:bg-hover"
            type="button"
            :title="entry.url"
            @click="openHistory(entry)"
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

        <template v-else-if="tab === 'settings'">
          <div class="flex flex-col gap-6 px-4 py-4">
            <label class="flex items-start justify-between gap-4">
              <span>
                <span class="block font-display text-[16px] text-cream">{{ i18n.t('settings.autoRecordTitle') }}</span>
                <span class="mt-0.5 block leading-5 text-dim">{{ i18n.t('settings.autoRecordDesc') }}</span>
              </span>
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[var(--bronze-strong)]"
                :checked="store.state.value.settings.captureHistory"
                @change="store.updateSettings({ captureHistory: ($event.target as HTMLInputElement).checked })"
              >
            </label>

            <label class="flex items-start justify-between gap-4">
              <span>
                <span class="block font-display text-[16px] text-cream">{{ i18n.t('settings.statFilterButtonsTitle') }}</span>
                <span class="mt-0.5 block leading-5 text-dim">{{ i18n.t('settings.statFilterButtonsDesc') }}</span>
              </span>
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[var(--bronze-strong)]"
                :checked="store.state.value.settings.statFilterButtonsEnabled"
                @change="store.updateSettings({ statFilterButtonsEnabled: ($event.target as HTMLInputElement).checked })"
              >
            </label>

            <label class="flex items-start justify-between gap-4">
              <span>
                <span class="block font-display text-[16px] text-cream">{{ i18n.t('settings.propertyFilterButtonsTitle') }}</span>
                <span class="mt-0.5 block leading-5 text-dim">{{ i18n.t('settings.propertyFilterButtonsDesc') }}</span>
              </span>
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[var(--bronze-strong)]"
                :checked="store.state.value.settings.propertyFilterButtonsEnabled"
                @change="store.updateSettings({ propertyFilterButtonsEnabled: ($event.target as HTMLInputElement).checked })"
              >
            </label>

            <label class="flex items-start justify-between gap-4">
              <span>
                <span class="block font-display text-[16px] text-cream">{{ i18n.t('settings.priceSnapshotTitle') }}</span>
                <span class="mt-0.5 block leading-5 text-dim">{{ i18n.t('settings.priceSnapshotDesc') }}</span>
              </span>
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[var(--bronze-strong)]"
                :checked="store.state.value.settings.priceSnapshotEnabled"
                @change="store.updateSettings({ priceSnapshotEnabled: ($event.target as HTMLInputElement).checked })"
              >
            </label>

            <label class="flex items-start justify-between gap-4">
              <span>
                <span class="block font-display text-[16px] text-cream">{{ i18n.t('settings.priceLabelsTitle') }}</span>
                <span class="mt-0.5 block leading-5 text-dim">{{ i18n.t('settings.priceLabelsDesc') }}</span>
              </span>
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[var(--bronze-strong)]"
                :checked="store.state.value.settings.priceLabelsEnabled"
                @change="store.updateSettings({ priceLabelsEnabled: ($event.target as HTMLInputElement).checked })"
              >
            </label>

            <div>
              <p class="font-display text-[16px] text-cream">{{ i18n.t('settings.backupTitle') }}</p>
              <p class="mt-0.5 leading-5 text-dim">{{ i18n.t('settings.backupDesc') }}</p>
              <div class="mt-3 flex gap-2">
                <button class="poe-btn" type="button" @click="exportData">
                  <Download /> {{ i18n.t('settings.exportJson') }}
                </button>
                <label class="poe-btn">
                  <Upload /> {{ importing ? i18n.t('settings.importing') : i18n.t('settings.importJson') }}
                  <input class="hidden" type="file" accept="application/json" :disabled="importing" @change="importData">
                </label>
              </div>
            </div>

            <p class="leading-5 text-dim">
              {{ i18n.t('settings.shortcutHintBefore') }}
              <kbd class="border border-rule bg-row px-1.5 py-0.5 font-display text-[13px] text-cream">Alt Shift B</kbd>
              {{ i18n.t('settings.shortcutHintAfter') }}
            </p>

            <button class="poe-btn self-start" type="button" @click="openOnboarding">
              {{ i18n.t('settings.viewOnboarding') }}
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
