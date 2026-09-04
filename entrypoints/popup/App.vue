<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { Bookmark, Download, Plus, Upload, Users } from 'lucide-vue-next'
import DiscordIcon from '@/components/DiscordIcon.vue'
import FolderSection from '@/components/FolderSection.vue'
import JoinFolderModal from '@/components/JoinFolderModal.vue'
import { useFolderSync } from '@/composables/useFolderSync'
import { useTradeStore } from '@/composables/useTradeStore'
import { DISCORD_URL } from '@/lib/discord'
import { pageLabel, relativeTime } from '@/lib/relative-time'
import { parseTradeUrl } from '@/lib/trade-url'
import type { ExtensionMessage, TradePage } from '@/types/trading'

type View = 'saved' | 'history' | 'settings'

const store = useTradeStore()
const folderSync = useFolderSync()
const view = ref<View>('saved')
const currentPage = ref<TradePage | null>(null)
const newFolderName = ref('')
const showFolderCreator = ref(false)
const showJoinModal = ref(false)
const importing = ref(false)

function currentSavedFolderId() {
  return currentPage.value
    ? store.visibleSearches.value.find((search) => search.url === currentPage.value?.url)?.folderId
    : undefined
}

function searchesForFolder(folderId: string) {
  return store.visibleSearches.value
    .filter((search) => search.folderId === folderId)
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

onMounted(async () => {
  await folderSync.init()
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  currentPage.value = tab?.url ? parseTradeUrl(tab.url, tab.title) : null
})

async function saveCurrent(folderId: string) {
  if (!currentPage.value) return
  await store.saveSearch({ ...currentPage.value, folderId })
}

async function openUrl(url: string) {
  await browser.runtime.sendMessage({ type: 'OPEN_URL', url } satisfies ExtensionMessage)
}

async function addFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  await store.createFolder(name)
  newFolderName.value = ''
  showFolderCreator.value = false
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

async function openOnboarding() {
  await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
}

async function openDiscord() {
  await browser.tabs.create({ url: DISCORD_URL })
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
</script>

<template>
  <main class="flex min-h-[580px] flex-col bg-bg font-body text-[13px] text-grey">
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-bronze pr-2 pl-3">
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
      <Bookmark class="size-[14px] text-tan" />
      <h1 class="flex-1 truncate font-display text-[16px] leading-none text-cream">{{ i18n.t('panel.title') }}</h1>
      <template v-if="view === 'saved'">
        <button class="poe-btn poe-btn-primary poe-btn-sm" type="button" @click="showFolderCreator = true">
          <Plus /> {{ i18n.t('folder.newFolder') }}
        </button>
        <button class="poe-btn poe-btn-sm" type="button" @click="showJoinModal = true">
          <Users /> {{ i18n.t('folder.joinByKey') }}
        </button>
      </template>
    </header>

    <nav class="flex shrink-0 border-b border-bronze" :aria-label="i18n.t('panel.viewNavLabel')">
      <button
        v-for="item in [
          { id: 'saved', label: store.visibleSearches.value.length ? i18n.t('panel.tabSavedCount', { count: store.visibleSearches.value.length }) : i18n.t('panel.tabSaved') },
          { id: 'history', label: i18n.t('panel.tabHistory') },
          { id: 'settings', label: i18n.t('panel.tabSettings') },
        ]"
        :key="item.id"
        class="h-8 flex-1 font-display text-[14px] transition-colors"
        :class="view === item.id
          ? 'bg-[#5a3806] text-[#e9cf9f]'
          : 'text-[#e9cf9f] hover:bg-hover'"
        type="button"
        :aria-pressed="view === item.id"
        @click="view = item.id as View"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="view === 'saved'">
      <form v-if="showFolderCreator" class="flex gap-2 border-b border-dashed border-bronze bg-row px-3 py-2" @submit.prevent="addFolder">
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
        :is-current-page-saved="currentSavedFolderId() === folder.id"
        @update:open="setFolderOpen(folder.id, $event)"
        @rename="store.renameFolder"
        @delete="store.removeFolder"
        @save="saveCurrent"
      />

      <JoinFolderModal v-model:open="showJoinModal" />
    </section>

    <section v-else-if="view === 'history'">
      <button
        v-for="entry in store.state.value.history"
        :key="entry.id"
        class="group flex w-full items-start gap-3 border-b border-rule px-4 py-2.5 text-left hover:bg-hover"
        type="button"
        :title="entry.url"
        @click="openUrl(entry.url)"
      >
        <span class="min-w-0 flex-1">
          <span class="line-clamp-2 text-[13px] leading-5 text-grey group-hover:text-cream">{{ entry.title }}</span>
          <span class="mt-0.5 block font-display text-[14px] leading-5 text-tan">{{ pageLabel(entry) }}</span>
        </span>
        <span class="shrink-0 pt-0.5 text-[12px] leading-5 text-dim">{{ relativeTime(entry.visitedAt) }}</span>
      </button>
      <p v-if="!store.state.value.history.length" class="px-4 py-6 leading-5 text-dim">
        {{ i18n.t('history.empty') }}
      </p>
      <div v-else class="flex justify-end px-3 py-3">
        <button class="poe-btn" type="button" @click="store.clearHistory">{{ i18n.t('history.clear') }}</button>
      </div>
    </section>

    <section v-else-if="view === 'settings'" class="flex flex-col gap-6 px-4 py-4">
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
    </section>
  </main>
</template>
