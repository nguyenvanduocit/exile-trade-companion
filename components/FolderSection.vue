<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { i18n } from '#i18n'
import { BookmarkCheck, BookmarkPlus, Check, ChevronRight, MoreHorizontal, Pencil, Share2, Trash2, X } from 'lucide-vue-next'
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
  'rename': [folderId: string, name: string]
  'delete': [folderId: string]
  'save': [folderId: string]
}>()

const action = ref<'closed' | 'rename' | 'delete'>('closed')
const renameValue = ref(props.folder.name)
const showShareModal = ref(false)
const folderSync = useFolderSync()

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

watch(() => props.folder.name, (name) => {
  renameValue.value = name
})

function startRename() {
  renameValue.value = props.folder.name
  action.value = 'rename'
}

function submitRename() {
  const name = renameValue.value.trim()
  if (!name) return
  emit('rename', props.folder.id, name)
  action.value = 'closed'
}

function confirmDelete() {
  if (!props.canDelete) return
  emit('delete', props.folder.id)
  action.value = 'closed'
}
</script>

<template>
  <Collapsible :open="open" class="border-b border-rule" @update:open="emit('update:open', $event)">
    <div class="flex items-center bg-row pr-2">
      <CollapsibleTrigger as-child>
        <button class="flex h-8 min-w-0 flex-1 items-center gap-2 pl-3 text-left hover:bg-hover" type="button">
          <ChevronRight class="size-3.5 shrink-0 text-tan transition-transform duration-150" :class="open ? 'rotate-90' : ''" />
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
          <DropdownMenuItem @select="startRename">
            <Pencil class="size-4 text-tan" /> {{ i18n.t('folder.rename') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="!canDelete"
            :title="canDelete ? undefined : i18n.t('folder.deleteDisabledTitle')"
            @select="action = 'delete'"
          >
            <Trash2 class="size-4 text-tan" /> {{ i18n.t('folder.delete') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="showShareModal = true">
            <Share2 class="size-4 text-tan" /> {{ folder.shareKey ? i18n.t('folder.shareSettings') : i18n.t('folder.share') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <form v-if="action === 'rename'" class="flex items-center gap-2 border-t border-rule bg-raised px-3 py-2" @submit.prevent="submitRename">
      <input
        v-model="renameValue"
        class="poe-input flex-1"
        maxlength="32"
        autofocus
        :aria-label="i18n.t('folder.renameInputLabel')"
        @keydown.escape="action = 'closed'"
      >
      <button class="icon-btn" type="submit" :disabled="!renameValue.trim()" :aria-label="i18n.t('folder.saveRenameLabel')">
        <Check />
      </button>
      <button class="icon-btn" type="button" :aria-label="i18n.t('folder.cancelRenameLabel')" @click="action = 'closed'">
        <X />
      </button>
    </form>

    <div v-else-if="action === 'delete'" class="border-t border-rule bg-raised px-3 py-3">
      <p class="text-[13px] leading-5 text-grey">
        {{ i18n.t('folder.confirmDeleteText', { folder: folder.name }) }}
        <template v-if="searches.length">
          {{ i18n.t('folder.moveBookmarksText', { count: searches.length, target: deleteTargetName ?? '' }) }}
        </template>
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <button class="poe-btn" type="button" @click="action = 'closed'">{{ i18n.t('folder.keep') }}</button>
        <button class="poe-btn text-danger" type="button" @click="confirmDelete">
          <Trash2 /> {{ i18n.t('folder.deleteFolder') }}
        </button>
      </div>
    </div>

    <CollapsibleContent>
      <div v-if="searches.length">
        <SearchCard v-for="searchItem in searches" :key="searchItem.id" :search="searchItem" :current-page="currentPage" />
      </div>
      <p v-else class="px-4 py-4 text-[13px] leading-5 text-dim">
        {{ i18n.t('folder.empty') }}
      </p>
    </CollapsibleContent>

    <ShareFolderModal v-model:open="showShareModal" :folder="folder" />
  </Collapsible>
</template>
