<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { i18n } from '#i18n'
import { Check, ChartLine, Copy, MoreHorizontal, Pencil, Replace, StickyNote, Trash2, X } from 'lucide-vue-next'
import BookmarkDragHandle from '@/components/BookmarkDragHandle.vue'
import { useBookmarkDrop } from '@/composables/useBookmarkDrag'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import PriceHistoryModal from '@/components/PriceHistoryModal.vue'
import { useTradeStore } from '@/composables/useTradeStore'
import { isExchangeRateCacheFresh } from '@/composables/useExchangeRates'
import { resolveEditedTitle } from '@/lib/edit-title'
import { formatChaosWithDivine, formatDelta } from '@/lib/format-price'
import { buildDurableUrl } from '@/lib/trade-url'
import { sendMessage } from '@/lib/extension-messaging'
import type { SavedSearch, TradePage } from '@/types/trading'

const props = defineProps<{
  search: SavedSearch
  currentPage?: TradePage | null
}>()

const copied = ref(false)
const overwritten = ref(false)
const isEditingTitle = ref(false)
const isEditingNote = ref(false)
const noteValue = ref('')
const noteInputRef = ref<HTMLTextAreaElement | null>(null)
const noteSaving = ref(false)
const noteSaveError = ref(false)
const editValue = ref(props.search.title)
const editInputRef = ref<HTMLInputElement | null>(null)
const showHistoryModal = ref(false)
const store = useTradeStore()
const dropTarget = useBookmarkDrop('search', () => props.search.id)

const querySnapshots = computed(() => props.search.queryId
  ? store.state.value.snapshots
    .filter((snapshot) => snapshot.queryId === props.search.queryId)
    .sort((a, b) => b.capturedAt - a.capturedAt)
  : [])

const priceLine = computed(() => {
  const latest = querySnapshots.value[0]
  if (!latest) return null

  const cache = store.state.value.exchangeRate
  const divineRate = isExchangeRateCacheFresh(cache, props.search) ? cache!.rates.divine : undefined
  const previous = querySnapshots.value[1]

  return {
    median: formatChaosWithDivine(latest.medianChaos, divineRate),
    delta: previous ? formatDelta(latest.medianChaos, previous.medianChaos) : null,
  }
})

watch(() => props.search.title, (title) => {
  editValue.value = title
})

function startEditTitle() {
  editValue.value = props.search.title
  isEditingTitle.value = true
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function submitEditTitle() {
  const title = resolveEditedTitle(props.search.title, editValue.value)
  if (title !== props.search.title) {
    store.updateSearch(props.search.id, { title })
  }
  isEditingTitle.value = false
}

function cancelEditTitle() {
  isEditingTitle.value = false
}

function startEditNote() {
  noteValue.value = props.search.note ?? ''
  noteSaveError.value = false
  isEditingNote.value = true
  nextTick(() => noteInputRef.value?.focus())
}

async function submitNote() {
  if (noteSaving.value) return
  noteSaving.value = true
  noteSaveError.value = false
  try {
    await store.updateSearch(props.search.id, { note: noteValue.value.trim() })
    isEditingNote.value = false
  } catch {
    noteSaveError.value = true
  } finally {
    noteSaving.value = false
  }
}

async function openSearch() {
  const url = await buildDurableUrl(props.search) ?? props.search.url
  await sendMessage('openUrl', url)
}

async function copyUrl() {
  await navigator.clipboard.writeText(props.search.url)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1200)
}

async function overwriteWithCurrent() {
  if (!props.currentPage) return
  const { url, title, game, league, mode, queryId, query } = props.currentPage
  await store.updateSearch(props.search.id, { url, title, game, league, mode, queryId, query })
  overwritten.value = true
  window.setTimeout(() => (overwritten.value = false), 1200)
}

</script>

<template>
  <article
    class="bookmark-drop-row group flex items-center gap-1 border-b border-rule py-1 pr-2 pl-1 last:border-b-0 hover:bg-hover"
    :data-drop="dropTarget.placement.value"
    @dragover="dropTarget.dragOver"
    @dragleave="dropTarget.dragLeave"
    @drop="dropTarget.drop"
  >
    <BookmarkDragHandle v-if="!isEditingTitle && !isEditingNote" kind="search" :id="search.id" :label="i18n.t('search.drag')" />
    <form v-if="isEditingTitle" class="flex min-w-0 flex-1 items-center gap-2 py-0.5" @submit.prevent="submitEditTitle">
      <input
        ref="editInputRef"
        v-model="editValue"
        class="poe-input min-w-0 flex-1"
        maxlength="80"
        :aria-label="i18n.t('search.titleInputLabel')"
        @keydown.escape="cancelEditTitle"
      >
      <button class="icon-btn" type="submit" :aria-label="i18n.t('search.saveTitleLabel')">
        <Check />
      </button>
      <button class="icon-btn" type="button" :aria-label="i18n.t('search.cancelEditTitleLabel')" @click="cancelEditTitle">
        <X />
      </button>
    </form>
    <form v-else-if="isEditingNote" class="min-w-0 flex-1 space-y-1 pl-1" @submit.prevent="submitNote">
      <p class="truncate font-display text-[12px] leading-4 text-cream">{{ search.title }}</p>
      <textarea
        ref="noteInputRef"
        v-model="noteValue"
        class="poe-input block h-auto min-h-16 w-full resize-y px-2 py-1 text-[11px] leading-4"
        rows="3"
        :disabled="noteSaving"
        :aria-label="i18n.t('search.noteLabel', { title: search.title })"
        :placeholder="i18n.t('search.notePlaceholder')"
        @keydown.escape="!noteSaving && (isEditingNote = false)"
      />
      <p v-if="noteSaveError" role="alert" class="text-[11px] leading-4 text-danger">{{ i18n.t('search.noteSaveFailed') }}</p>
      <div class="flex justify-end gap-1">
        <button class="poe-btn poe-btn-sm" type="button" :disabled="noteSaving" @click="isEditingNote = false">{{ i18n.t('search.cancelNote') }}</button>
        <button class="poe-btn poe-btn-sm" type="submit" :disabled="noteSaving"><Check /> {{ i18n.t('search.saveNote') }}</button>
      </div>
    </form>
    <button v-else class="min-w-0 flex-1 py-0.5 text-left" type="button" :title="search.url" :aria-label="search.purchased ? i18n.t('search.markPurchased', { title: search.title }) : undefined" @click="openSearch">
      <span class="line-clamp-2 font-display text-[12px] leading-4 text-cream" :class="search.purchased ? 'line-through decoration-tan' : ''">{{ search.title }}</span>
      <span v-if="search.note" class="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-[11px] leading-[14px] text-dim" :title="search.note">{{ search.note }}</span>
    </button>

    <div v-if="!isEditingTitle && !isEditingNote" class="relative flex min-h-6 shrink-0 items-center">
      <span v-if="priceLine" class="whitespace-nowrap pr-1 text-[11px] leading-4 text-dim">
        {{ priceLine.median }}
        <span
          v-if="priceLine.delta"
          :class="priceLine.delta.startsWith('+') ? 'text-danger' : priceLine.delta === '0%' ? 'text-dim' : 'text-tan'"
        >
          {{ priceLine.delta }}
        </span>
      </span>
      <div class="absolute inset-y-0 right-0 flex items-center bg-row opacity-0 group-hover:bg-hover group-hover:opacity-100 focus-within:bg-hover focus-within:opacity-100">
        <button
          v-if="currentPage && currentPage.url !== search.url"
          class="icon-btn"
          type="button"
          :aria-label="overwritten ? i18n.t('search.overwritten') : i18n.t('search.overwrite')"
          :title="overwritten ? i18n.t('search.overwritten') : i18n.t('search.overwrite')"
          @click="overwriteWithCurrent"
        >
          <Check v-if="overwritten" />
          <Replace v-else />
        </button>
        <button
          class="icon-btn"
          type="button"
          :aria-label="i18n.t('search.editTitle')"
          @click="startEditTitle"
        >
          <Pencil />
        </button>
        <button
          class="icon-btn hover:text-danger"
          type="button"
          :aria-label="i18n.t('search.deleteBookmark')"
          @click="store.removeSearch(search.id)"
        >
          <Trash2 />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              class="icon-btn"
              type="button"
              :aria-label="i18n.t('search.actionsLabel')"
            >
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem @select="startEditNote">
              <StickyNote class="size-4 text-tan" />
              {{ search.note ? i18n.t('search.editNote') : i18n.t('search.addNote') }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="store.setSearchPurchased(search.id, !search.purchased)">
              <Check class="size-4" :class="search.purchased ? 'text-tan' : 'text-dim'" />
              {{ search.purchased ? i18n.t('search.markUnpurchased') : i18n.t('search.purchased') }}
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!querySnapshots.length" @select="showHistoryModal = true">
              <ChartLine class="size-4 text-tan" />
              {{ i18n.t('priceHistory.menuItem') }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="copyUrl">
              <Check v-if="copied" class="size-4 text-tan" />
              <Copy v-else class="size-4 text-tan" />
              {{ copied ? i18n.t('search.copied') : i18n.t('search.copyLink') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </article>

  <PriceHistoryModal
    v-if="search.queryId"
    :open="showHistoryModal"
    :query-id="search.queryId"
    @update:open="showHistoryModal = $event"
  />
</template>
