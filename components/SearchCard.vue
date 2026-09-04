<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { Check, ChartLine, Copy, MoreHorizontal, Pencil, Replace, Trash2, X } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import PriceHistoryModal from '@/components/PriceHistoryModal.vue'
import { useTradeStore } from '@/composables/useTradeStore'
import { resolveEditedTitle } from '@/lib/edit-title'
import { formatChaosWithDivine, formatDelta } from '@/lib/format-price'
import type { ExtensionMessage, SavedSearch, TradePage } from '@/types/trading'

const props = defineProps<{
  search: SavedSearch
  currentPage?: TradePage | null
}>()

const copied = ref(false)
const overwritten = ref(false)
const isEditingTitle = ref(false)
const editValue = ref(props.search.title)
const showHistoryModal = ref(false)
const store = useTradeStore()

const querySnapshots = computed(() => props.search.queryId
  ? store.state.value.snapshots
    .filter((snapshot) => snapshot.queryId === props.search.queryId)
    .sort((a, b) => b.capturedAt - a.capturedAt)
  : [])

const priceLine = computed(() => {
  const latest = querySnapshots.value[0]
  if (!latest) return null

  const divineRate = store.state.value.exchangeRate?.rates.divine
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

async function openSearch() {
  await browser.runtime.sendMessage({ type: 'OPEN_URL', url: props.search.url } satisfies ExtensionMessage)
}

async function copyUrl() {
  await navigator.clipboard.writeText(props.search.url)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1200)
}

async function overwriteWithCurrent() {
  if (!props.currentPage) return
  const { url, title, game, league, mode, queryId } = props.currentPage
  await store.updateSearch(props.search.id, { url, title, game, league, mode, queryId })
  overwritten.value = true
  window.setTimeout(() => (overwritten.value = false), 1200)
}
</script>

<template>
  <article class="group flex items-center gap-1 border-b border-rule py-2.5 pr-2 pl-4 last:border-b-0 hover:bg-hover">
    <form v-if="isEditingTitle" class="flex min-w-0 flex-1 items-center gap-2 py-0.5" @submit.prevent="submitEditTitle">
      <input
        v-model="editValue"
        class="poe-input min-w-0 flex-1"
        maxlength="80"
        autofocus
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
    <button v-else class="min-w-0 flex-1 py-0.5 text-left" type="button" :title="search.url" @click="openSearch">
      <span class="line-clamp-2 font-display text-[14px] leading-5 text-cream">{{ search.title }}</span>
      <span v-if="search.note" class="mt-1 line-clamp-2 block text-[12px] leading-[18px] text-dim">{{ search.note }}</span>
    </button>

    <div v-if="!isEditingTitle" class="relative flex min-h-6 shrink-0 items-center">
      <span v-if="priceLine" class="whitespace-nowrap pr-1 text-[12px] leading-5 text-dim">
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
