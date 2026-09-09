<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { i18n } from '#i18n'
import { X } from 'lucide-vue-next'
import ImportRollSlider from '@/components/ImportRollSlider.vue'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useTradeStore } from '@/composables/useTradeStore'
import { sendMessage } from '@/lib/extension-messaging'
import { sendNinjaMessage } from '@/lib/window-messaging'
import {
  attachStatMatches,
  buildImportQuery,
  collectImportItems,
  DEFAULT_IMPORT_ROLL_PERCENT,
  importItemLabel,
  matchedCount,
  parseNinjaUrl,
  type ImportItem,
  type NinjaCharacter,
  type NinjaFetchError,
  type ResolvedImportItem,
} from '@/lib/ninja-import'
import { decodePobCode, looksLikePobCode, parsePobLink, parsePobXml, type PobBuild } from '@/lib/pob-import'
import { parseCopiedItem, type CopiedItem } from '@/lib/item-text-import'
import { buildDurableUrl, parseTradeUrl } from '@/lib/trade-url'
import { track } from '@/lib/track'
import type { Game, SearchFolder } from '@/types/trading'

const props = defineProps<{
  open: boolean
  folder: SearchFolder
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

type ErrorKey = NinjaFetchError | 'game-mismatch' | 'catalog-unavailable' | 'invalid-code' | 'pob-not-found'

type Source =
  | { kind: 'ninja'; character: NinjaCharacter }
  | { kind: 'pob'; build: PobBuild }
  | { kind: 'item'; item: CopiedItem }

const store = useTradeStore()
const input = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref<ErrorKey | null>(null)
const source = shallowRef<Source | null>(null)
const items = shallowRef<ResolvedImportItem[]>([])
const selected = ref(new Set<string>())
const rolls = ref(DEFAULT_IMPORT_ROLL_PERCENT)
const savedCount = ref<number | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// Catalog stat của tab là của game đang mở (/trade = POE1, /trade2 = POE2); build khác game thì
// không map được mod, chặn sớm thay vì ra một loạt search rỗng.
const tabGame: Game = window.location.pathname.startsWith('/trade2/') ? 'poe2' : 'poe1'
const tabLeague = parseTradeUrl(window.location.href)?.league ?? 'Standard'

const errorText = computed(() => {
  switch (error.value) {
    case 'invalid-url': return i18n.t('folder.importNinjaErrorInvalidUrl')
    case 'invalid-code': return i18n.t('folder.importNinjaErrorInvalidCode')
    case 'pob-not-found': return i18n.t('folder.importNinjaErrorPobNotFound')
    case 'game-mismatch': return i18n.t('folder.importNinjaErrorGameMismatch', { game: tabGame === 'poe1' ? 'POE2' : 'POE1' })
    case 'league-not-found': return i18n.t('folder.importNinjaErrorLeague')
    case 'character-not-found': return i18n.t('folder.importNinjaErrorCharacter')
    case 'catalog-unavailable': return i18n.t('folder.importNinjaErrorCatalog')
    case 'network': return i18n.t('folder.importNinjaErrorNetwork')
    default: return null
  }
})

const sourceLine = computed(() => {
  if (!source.value) return ''
  if (source.value.kind === 'item') return `${importItemLabel(source.value.item)} · ${tabLeague}`
  if (source.value.kind === 'ninja') {
    const character = source.value.character
    return i18n.t('folder.importNinjaCharacter', {
      name: character.name,
      className: character.class ?? '',
      level: String(character.level ?? ''),
      league: character.league,
    })
  }
  const build = source.value.build
  return i18n.t('folder.importNinjaPobLine', { className: build.className, ascendancy: build.ascendClassName, level: String(build.level ?? '') })
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  input.value = ''
  error.value = null
  source.value = null
  items.value = []
  selected.value = new Set()
  savedCount.value = null
  nextTick(() => inputRef.value?.focus())
})

async function loadNinja(url: string): Promise<{ source: Source; items: ImportItem[] } | ErrorKey> {
  const result = await sendMessage('fetchNinjaCharacter', url)
  if (!result.ok) return result.reason
  return { source: { kind: 'ninja', character: result.character }, items: collectImportItems(result.character) }
}

async function loadPob(code: string): Promise<{ source: Source; items: ImportItem[] } | ErrorKey> {
  let build: PobBuild | null
  try {
    build = parsePobXml(await decodePobCode(code))
  } catch {
    return 'invalid-code'
  }
  if (!build) return 'invalid-code'
  if (build.game !== tabGame) return 'game-mismatch'
  // MAGIC/NORMAL không có dòng base trong PoB: tra catalog item của site; không ra thì giữ nguyên
  // typeLine để user thấy và tự sửa trên form.
  const unresolved = build.items.filter((item) => !item.baseType)
  if (unresolved.length) {
    const bases = await sendNinjaMessage('resolveItemBases', unresolved.map((item) => item.typeLine))
    unresolved.forEach((item, index) => { item.baseType = bases[index] ?? item.typeLine })
  }
  return { source: { kind: 'pob', build }, items: build.items }
}

async function load() {
  const raw = input.value.trim()
  const ninja = parseNinjaUrl(raw)
  const pobLink = parsePobLink(raw)
  const copiedItem = parseCopiedItem(raw)
  if (!ninja && !pobLink && !copiedItem && !looksLikePobCode(raw)) {
    error.value = 'invalid-url'
    return
  }
  if (ninja && ninja.game !== tabGame) {
    error.value = 'game-mismatch'
    return
  }
  loading.value = true
  error.value = null
  const sourceKind = ninja ? 'ninja' : pobLink ? 'pobbin' : copiedItem ? 'item' : 'code'
  try {
    let loaded: { source: Source; items: ImportItem[] } | ErrorKey
    if (ninja) {
      loaded = await loadNinja(raw)
    } else if (copiedItem) {
      if (!copiedItem.baseType) {
        const bases = await sendNinjaMessage('resolveItemBases', [copiedItem.typeLine])
        copiedItem.baseType = bases[0] ?? copiedItem.typeLine
      }
      loaded = { source: { kind: 'item', item: copiedItem }, items: [copiedItem] }
    } else if (pobLink) {
      const fetched = await sendMessage('fetchPobCode', pobLink.url)
      loaded = fetched.ok ? await loadPob(fetched.code) : fetched.reason === 'not-found' ? 'pob-not-found' : 'network'
    } else {
      loaded = await loadPob(raw)
    }
    if (typeof loaded === 'string') {
      error.value = loaded
      track('import.error', { source: sourceKind, game: tabGame, reason: loaded })
      return
    }
    const matches = await sendNinjaMessage('matchNinjaStats', loaded.items.flatMap((item) => item.lines))
    source.value = loaded.source
    items.value = attachStatMatches(loaded.items, matches)
    trackLoaded(sourceKind, items.value, loaded.items)
    // Flask ít khi cần mua lại theo mod của người khác, đồ không đeo (item set phụ của PoB) cũng
    // vậy — để user tự tick.
    selected.value = new Set(items.value.filter((item) => sourceKind === 'item' || (item.kind !== 'flask' && item.slot !== 'Unequipped')).map((item) => item.key))
  } catch (cause) {
    error.value = cause instanceof Error && cause.message.includes('catalog-unavailable') ? 'catalog-unavailable' : 'network'
    track('import.error', { source: sourceKind, game: tabGame, reason: error.value })
  } finally {
    loading.value = false
  }
}

// Telemetry của import (xem PRIVACY.md): số đếm và text mod không map được — không tên character,
// không link. Text mod thiếu là dữ liệu game công khai và là thứ duy nhất giúp sửa matcher.
function trackLoaded(sourceKind: string, resolved: ResolvedImportItem[], raw: ImportItem[]) {
  const total = resolved.reduce((sum, item) => sum + item.lines.length, 0)
  const matched = resolved.reduce((sum, item) => sum + matchedCount(item), 0)
  const unresolvedBases = raw.filter((item) => 'typeLine' in item && item.baseType === (item as { typeLine?: string }).typeLine && item.rarity !== 'unique' && item.rarity !== 'rare').length
  track('import.load', { source: sourceKind, game: tabGame, items: resolved.length, mods: total, matched, unresolvedBases })
  let sent = 0
  for (const item of resolved) {
    item.lines.forEach((line, index) => {
      if (item.matches[index] || sent >= 30) return
      sent++
      track('import.miss', { source: sourceKind, game: tabGame, rarity: item.rarity, section: line.section, text: line.text })
    })
  }
}

function slotLabel(item: ImportItem) {
  return item.slot === 'Unequipped' ? i18n.t('folder.importNinjaUnequipped') : item.slot
}

function toggle(key: string) {
  const next = new Set(selected.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selected.value = next
}

function selectAll(all: boolean) {
  selected.value = new Set(all ? items.value.map((item) => item.key) : [])
}

function backToInput() {
  source.value = null
  items.value = []
  error.value = null
}

async function save() {
  if (!source.value || saving.value) return
  const chosen = items.value.filter((item) => selected.value.has(item.key))
  if (!chosen.length) return
  saving.value = true
  try {
    const note = source.value.kind === 'ninja'
      ? i18n.t('folder.importNinjaNote', {
        name: source.value.character.name,
        className: source.value.character.class ?? '',
        level: String(source.value.character.level ?? ''),
      })
      : source.value.kind === 'pob' ? i18n.t('folder.importNinjaPobNote', {
        className: source.value.build.className,
        ascendancy: source.value.build.ascendClassName,
        level: String(source.value.build.level ?? ''),
      }) : null
    const league = source.value.kind === 'ninja' ? source.value.character.league : tabLeague
    // Source note thuộc về cả folder (một character/build sinh ra nhiều search), không phải từng item.
    if (note !== null) await store.updateFolder(props.folder.id, { note })
    // Lưu tuần tự: store.saveSearch đọc-ghi cả state, chạy song song sẽ ghi đè nhau.
    for (const item of chosen) {
      const query = buildImportQuery(item, rolls.value)
      const page = { url: '', title: importItemLabel(item), game: tabGame, league, mode: 'search' as const, query }
      const durable = await buildDurableUrl(page)
      if (!durable) continue
      await store.saveSearch({ ...page, url: durable, folderId: props.folder.id })
    }
    savedCount.value = chosen.length
    track('import.save', { source: source.value.kind, game: tabGame, count: chosen.length, rolls: rolls.value })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <div class="flex items-center justify-between">
        <DialogTitle class="font-display text-[17px] text-cream">{{ i18n.t('folder.importNinjaTitle') }}</DialogTitle>
        <DialogClose class="icon-btn" :aria-label="i18n.t('panel.closeLabel')">
          <X />
        </DialogClose>
      </div>

      <p v-if="loading" class="mt-3 px-1 py-6 text-center leading-5 text-dim">{{ i18n.t('folder.importNinjaLoading') }}</p>

      <template v-else-if="savedCount !== null">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.importNinjaSaved', { count: savedCount, folder: folder.name }) }}</p>
        <div class="mt-3 flex justify-end">
          <DialogClose class="poe-btn poe-btn-primary" type="button">{{ i18n.t('folder.done') }}</DialogClose>
        </div>
      </template>

      <template v-else-if="!source">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.importNinjaDesc', { folder: folder.name }) }}</p>
        <form class="mt-2 flex flex-col gap-2" @submit.prevent="load">
          <textarea
            ref="inputRef"
            v-model="input"
            class="poe-input min-h-[72px] resize-y font-mono text-[12px]"
            rows="3"
            :placeholder="i18n.t('folder.importNinjaPlaceholder')"
            :aria-label="i18n.t('folder.importNinjaInputLabel')"
            @input="error = null"
            @keydown.enter.exact.prevent="load"
          />
          <p v-if="errorText" class="text-[12px] leading-4 text-danger">{{ errorText }}</p>
          <div class="flex justify-end gap-2">
            <DialogClose class="poe-btn" type="button">{{ i18n.t('folder.cancel') }}</DialogClose>
            <button class="poe-btn poe-btn-primary" type="submit" :disabled="!input.trim()">{{ i18n.t('folder.importNinjaContinue') }}</button>
          </div>
        </form>
      </template>

      <template v-else>
        <p class="mt-3 truncate text-[13px] leading-5 text-cream">{{ sourceLine }}</p>
        <div class="mt-2 flex items-center justify-between gap-2 text-[12px] leading-4 text-tan">
          <ImportRollSlider v-model="rolls" :disabled="saving" class="flex-1" />
          <div class="flex shrink-0 gap-2">
            <button class="hover:text-cream" type="button" @click="selectAll(true)">{{ i18n.t('folder.importNinjaSelectAll') }}</button>
            <button class="hover:text-cream" type="button" @click="selectAll(false)">{{ i18n.t('folder.importNinjaSelectNone') }}</button>
          </div>
        </div>

        <ul class="mt-2 max-h-[50vh] overflow-y-auto border border-rule">
          <li v-for="item in items" :key="item.key" class="border-b border-rule last:border-b-0">
            <label class="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-hover">
              <input type="checkbox" :checked="selected.has(item.key)" @change="toggle(item.key)">
              <img v-if="item.icon" :src="item.icon" alt="" class="size-6 shrink-0 object-contain">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] leading-4 text-cream">{{ item.name || item.baseType }}</span>
                <span class="block truncate text-[11px] leading-4 text-grey">{{ slotLabel(item) }}<template v-if="item.name"> · {{ item.baseType }}</template></span>
              </span>
              <span class="shrink-0 text-[11px] leading-4" :class="matchedCount(item) === item.lines.length ? 'text-tan' : 'text-danger'">
                {{ i18n.t('folder.importNinjaMods', { matched: matchedCount(item), total: item.lines.length }) }}
              </span>
            </label>
          </li>
        </ul>

        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="backToInput">{{ i18n.t('folder.importNinjaBack') }}</button>
          <button class="poe-btn poe-btn-primary" type="button" :disabled="!selected.size || saving" @click="save">
            {{ i18n.t('folder.importNinjaSave', { count: selected.size }) }}
          </button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
