<script setup lang="ts">
import { computed, ref } from 'vue'
import { i18n } from '#i18n'
import { BookmarkCheck, BookmarkPlus, Download, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-vue-next'
import FolderFormModal from '@/components/FolderFormModal.vue'
import ImportNinjaModal from '@/components/ImportNinjaModal.vue'
import { endBookmarkDrag, startBookmarkDrag, useBookmarkDrop } from '@/composables/useBookmarkDrag'
import SearchCard from '@/components/SearchCard.vue'
import ShareFolderModal from '@/components/ShareFolderModal.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useFolderSync } from '@/composables/useFolderSync'
import type { SavedSearch, SearchFolder, TradePage } from '@/types/trading'

const props = defineProps<{
  folder: SearchFolder
  searches: SavedSearch[]
  open: boolean
  canDelete: boolean
  deleteTargetName?: string
  currentPage?: TradePage | null
  isCurrentPageSaved?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'delete': [folderId: string]
  'save': [folderId: string]
}>()

const confirmingDelete = ref(false)
const showEditModal = ref(false)
const showShareModal = ref(false)
const showImportModal = ref(false)
const folderSync = useFolderSync()
const dropTarget = useBookmarkDrop('folder', () => props.folder.id)

const shareStatus = computed(() => (props.folder.shareKey ? folderSync.syncStatus[props.folder.id] ?? 'idle' : undefined))

const shareStatusLabel = computed(() => {
  switch (shareStatus.value) {
    case 'connecting': return i18n.t('folder.shareStatusConnecting')
    case 'syncing': return i18n.t('folder.shareStatusSyncing')
    case 'error': return i18n.t('folder.shareStatusError')
    case 'idle': return i18n.t('folder.shareStatusIdle')
    default: return i18n.t('folder.share')
  }
})

function confirmDelete() {
  if (!props.canDelete) return
  emit('delete', props.folder.id)
  confirmingDelete.value = false
}
</script>

<template>
  <Collapsible :open="open" class="border-b border-rule" @update:open="emit('update:open', $event)">
    <div
      class="bookmark-drop-row flex cursor-pointer items-center bg-row pr-2 pl-1 select-none"
      draggable="true"
      :data-drop="dropTarget.placement.value"
      @dragstart.stop="startBookmarkDrag($event, { kind: 'folder', id: folder.id })"
      @dragend.stop="endBookmarkDrag"
      @dragover="dropTarget.dragOver"
      @dragleave="dropTarget.dragLeave"
      @drop="dropTarget.drop"
    >
      <CollapsibleTrigger as-child>
        <button class="flex h-8 min-w-0 flex-1 items-center gap-2 pl-1 text-left hover:bg-hover" type="button">
          <span class="size-2 shrink-0" :style="{ backgroundColor: folder.color }" />
          <span class="min-w-0 flex-1 truncate font-display text-[14px] text-cream">{{ folder.name }}</span>
        </button>
      </CollapsibleTrigger>
      <button
        v-if="folder.shareKey"
        class="icon-btn"
        type="button"
        :class="shareStatus === 'error' ? 'text-danger' : ''"
        :aria-label="shareStatusLabel"
        :title="shareStatusLabel"
        @click="showShareModal = true"
      >
        <Share2 />
      </button>
      <button
        v-if="currentPage"
        class="icon-btn"
        type="button"
        :aria-label="isCurrentPageSaved ? i18n.t('folder.savedIn', { folder: folder.name }) : i18n.t('folder.saveIntoFolder', { folder: folder.name })"
        :title="isCurrentPageSaved ? i18n.t('folder.savedIn', { folder: folder.name }) : i18n.t('folder.saveIntoFolder', { folder: folder.name })"
        @click="emit('save', folder.id)"
      >
        <BookmarkCheck v-if="isCurrentPageSaved" class="text-cream" />
        <BookmarkPlus v-else />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            class="icon-btn"
            type="button"
            :aria-label="i18n.t('folder.actionsLabel', { folder: folder.name })"
          >
            <MoreHorizontal />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @select="showEditModal = true">
            <Pencil class="size-4 text-tan" /> {{ i18n.t('folder.edit') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="!canDelete"
            :title="canDelete ? undefined : i18n.t('folder.deleteDisabledTitle')"
            @select="confirmingDelete = true"
          >
            <Trash2 class="size-4 text-tan" /> {{ i18n.t('folder.delete') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="showShareModal = true">
            <Share2 class="size-4 text-tan" /> {{ folder.shareKey ? i18n.t('folder.shareSettings') : i18n.t('folder.share') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="showImportModal = true">
            <Download class="size-4 text-tan" /> {{ i18n.t('folder.importNinja') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div v-if="confirmingDelete" class="border-t border-rule bg-raised px-3 py-3">
      <p class="text-[13px] leading-5 text-grey">
        {{ i18n.t('folder.confirmDeleteText', { folder: folder.name }) }}
        <template v-if="searches.length">
          {{ i18n.t('folder.moveBookmarksText', { count: searches.length, target: deleteTargetName ?? '' }) }}
        </template>
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <button class="poe-btn" type="button" @click="confirmingDelete = false">{{ i18n.t('folder.keep') }}</button>
        <button class="poe-btn text-danger" type="button" @click="confirmDelete">
          <Trash2 /> {{ i18n.t('folder.deleteFolder') }}
        </button>
      </div>
    </div>

    <CollapsibleContent>
      <p v-if="folder.note" class="whitespace-pre-wrap break-words border-b border-rule bg-raised px-3 py-2 text-[11px] leading-4 text-grey">{{ folder.note }}</p>
      <div v-if="searches.length">
        <SearchCard v-for="searchItem in searches" :key="searchItem.id" :search="searchItem" :current-page="currentPage" />
      </div>
      <p v-else class="px-4 py-4 text-[13px] leading-5 text-dim">
        {{ i18n.t('folder.empty') }}
      </p>
    </CollapsibleContent>

    <FolderFormModal v-model:open="showEditModal" :folder="folder" />
    <ShareFolderModal v-model:open="showShareModal" :folder="folder" />
    <ImportNinjaModal v-model:open="showImportModal" :folder="folder" />
  </Collapsible>
</template>
