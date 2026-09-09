<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { i18n } from '#i18n'
import { Bookmark, Download, ExternalLink, RefreshCw, X } from 'lucide-vue-next'
import ImportRollSlider from '@/components/ImportRollSlider.vue'
import { useTradeStore } from '@/composables/useTradeStore'
import { useFolderSync } from '@/composables/useFolderSync'
import { onMessage, sendMessage } from '@/lib/extension-messaging'
import { attachStatMatches, collectImportItems, DEFAULT_IMPORT_ROLL_PERCENT, matchedCount, matchStatLines, parseNinjaUrl, type NinjaCharacter, type ResolvedImportItem } from '@/lib/ninja-import'
import { prepareNinjaSearches } from '@/lib/ninja-build'

const props = defineProps<{ ctx: ContentScriptContext }>()
const store = useTradeStore()
const sync = useFolderSync()
const route = ref(location.pathname + location.search)
const link = computed(() => parseNinjaUrl(`https://poe.ninja${route.value}`))
const open = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const savedCount = ref<number | null>(null)
const character = ref<NinjaCharacter | null>(null)
const items = ref<ResolvedImportItem[]>([])
const rolls = ref(DEFAULT_IMPORT_ROLL_PERCENT)
const panel = ref<HTMLElement | null>(null)
const expanded = ref(new Set<string>())
const existingFolder = computed(() => store.state.value.folders.find(folder => folder.name === character.value?.name))
const tradeUrl = computed(() => link.value && character.value
  ? `https://www.pathofexile.com/${link.value.game === 'poe2' ? 'trade2' : 'trade'}/search/${encodeURIComponent(character.value.league)}` : '')
let generation = 0
let syncReady: Promise<void>
let resizeObserver: ResizeObserver | undefined
let restoreMargin: (() => void) | undefined
const cleanups: (() => void)[] = []

async function load() {
  const current = ++generation
  character.value = null
  items.value = []
  expanded.value = new Set()
  savedCount.value = null
  error.value = ''
  loading.value = Boolean(link.value)
  if (!link.value) return
  const game = link.value.game
  try {
    const [result, catalog] = await Promise.all([
      sendMessage('fetchNinjaCharacter', location.href),
      sendMessage('fetchTradeStatCatalog', game),
    ])
    if (current !== generation) return
    if (!result.ok) { error.value = i18n.t('ninja.loadFailed'); return }
    if (!catalog.ok) { error.value = i18n.t('ninja.catalogFailed'); return }
    const raw = collectImportItems(result.character)
    character.value = result.character
    items.value = attachStatMatches(raw, matchStatLines(catalog.entries, raw.flatMap(item => item.lines)))
  } catch {
    if (current === generation) error.value = i18n.t('ninja.loadFailed')
  } finally {
    if (current === generation) loading.value = false
  }
}

async function save() {
  if (saving.value || !character.value || !link.value || !items.value.length) return
  const current = generation
  const name = character.value.name
  saving.value = true
  error.value = ''
  savedCount.value = null
  try {
    const searches = await prepareNinjaSearches(items.value, link.value.game, character.value.league, rolls.value)
    await syncReady
    if (current !== generation) return
    const folder = existingFolder.value
    if (folder?.shareKey && sync.syncStatus[folder.id] !== 'idle') {
      error.value = i18n.t('ninja.syncFailed')
      return
    }
    await store.replaceFolderContents(name, searches)
    if (current === generation) savedCount.value = searches.length
  } catch {
    if (current === generation) error.value = i18n.t('ninja.saveFailed')
  } finally {
    saving.value = false
  }
}

function toggleItem(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

watch(route, () => void load())
watch(rolls, () => { savedCount.value = null })
watch(panel, (element) => {
  resizeObserver?.disconnect()
  restoreMargin?.()
  restoreMargin = undefined
  if (!element) return
  const style = document.documentElement.style
  const previous = style.getPropertyValue('margin-right')
  const priority = style.getPropertyPriority('margin-right')
  restoreMargin = () => previous ? style.setProperty('margin-right', previous, priority) : style.removeProperty('margin-right')
  const push = () => style.setProperty('margin-right', `${element.getBoundingClientRect().width}px`, 'important')
  resizeObserver = new ResizeObserver(push)
  resizeObserver.observe(element)
  push()
}, { flush: 'post' })

onMounted(() => {
  syncReady = sync.init()
  void load()
  props.ctx.setInterval(() => { route.value = location.pathname + location.search }, 300)
  cleanups.push(onMessage('togglePanel', () => { open.value = !open.value }))
  cleanups.push(onMessage('openPanel', () => { open.value = true }))
})

onBeforeUnmount(() => {
  generation++
  cleanups.forEach(cleanup => cleanup())
  resizeObserver?.disconnect()
  restoreMargin?.()
})
</script>

<template>
  <div v-if="link" class="trade-companion-shell">
    <button class="trade-companion-tab" :class="{ 'trade-companion-tab--open': open }" type="button"
      :aria-label="open ? i18n.t('panel.closeLabel') : i18n.t('panel.openLabel')" :aria-expanded="open" @click="open = !open">
      <Bookmark />
      <span class="trade-companion-tab-label">{{ i18n.t('panel.title') }}</span>
    </button>
    <section v-if="open" ref="panel" class="trade-companion-panel" :aria-label="i18n.t('ninja.title')">
      <header class="flex h-12 shrink-0 items-center gap-2 border-b border-bronze px-3">
        <Bookmark class="size-4 text-tan" />
        <h2 class="min-w-0 flex-1 font-display text-[17px] text-cream">{{ i18n.t('ninja.title') }}</h2>
        <button class="icon-btn" type="button" :disabled="loading || saving" :aria-label="i18n.t('ninja.refresh')" :title="i18n.t('ninja.refresh')" @click="load"><RefreshCw /></button>
        <button class="icon-btn" type="button" :aria-label="i18n.t('panel.closeLabel')" @click="open = false"><X /></button>
      </header>
      <div class="trade-companion-scroll">
        <p v-if="loading" role="status" class="px-4 py-6 text-center text-dim">{{ i18n.t('folder.importNinjaLoading') }}</p>
        <template v-else-if="character">
          <div class="flex items-center gap-2 border-b border-rule bg-row px-3 py-2">
            <span class="size-2 shrink-0" :style="{ backgroundColor: existingFolder?.color ?? '#d4a64a' }" />
            <h3 class="min-w-0 flex-1 truncate font-display text-[15px] text-cream">{{ character.name }}</h3>
            <span class="text-[11px] text-tan">{{ items.length }}</span>
          </div>
          <p class="border-b border-rule bg-raised px-3 py-2 text-[11px] leading-4 text-grey">
            {{ character.league }} · {{ character.class }} · {{ character.level }}
            <span v-if="link.timeMachine" class="block text-tan">{{ link.timeMachine }}</span>
          </p>
          <p v-if="!items.length" class="px-4 py-6 text-dim">{{ i18n.t('ninja.empty') }}</p>
          <article v-for="item in items" :key="item.key" class="border-b border-rule">
            <button class="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-hover" type="button" :aria-expanded="expanded.has(item.key)" @click="toggleItem(item.key)">
              <img v-if="item.icon" :src="item.icon" alt="" class="size-8 shrink-0 object-contain">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] leading-5" :class="item.rarity === 'unique' ? 'text-[#af6025]' : 'text-cream'">{{ item.name || item.baseType }}</span>
                <span class="block truncate text-[11px] leading-4 text-dim">{{ item.slot }}<template v-if="item.name"> · {{ item.baseType }}</template></span>
              </span>
              <span class="text-[10px]" :class="matchedCount(item) === item.lines.length ? 'text-tan' : 'text-danger'">{{ i18n.t('folder.importNinjaMods', { matched: matchedCount(item), total: item.lines.length }) }}</span>
            </button>
            <ul v-if="expanded.has(item.key)" class="space-y-1 bg-raised px-4 py-2 text-[11px] leading-4">
              <li v-for="(line, index) in item.lines" :key="index" :class="item.matches[index] ? 'text-grey' : 'text-danger'">{{ line.text }}</li>
            </ul>
          </article>
        </template>
      </div>
      <footer class="shrink-0 space-y-3 border-t border-bronze bg-raised px-3 py-3">
        <p v-if="error" role="alert" class="text-[12px] leading-5 text-danger">{{ error }}</p>
        <p v-if="savedCount !== null" role="status" class="text-[12px] leading-5 text-cream">{{ i18n.t('folder.importNinjaSaved', { count: savedCount, folder: character?.name ?? '' }) }}</p>
        <template v-if="character && items.length">
          <ImportRollSlider v-model="rolls" :disabled="saving" />
          <p class="text-[11px] leading-4 text-dim">{{ existingFolder ? i18n.t('ninja.replaceHint', { folder: character.name }) : i18n.t('ninja.createHint', { folder: character.name }) }}</p>
          <button class="poe-btn poe-btn-primary w-full justify-center" type="button" :disabled="saving || loading" @click="save"><Download />{{ saving ? i18n.t('ninja.importing') : i18n.t('ninja.importAll') }}</button>
          <a v-if="savedCount !== null" :href="tradeUrl" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 text-[12px] text-tan hover:text-cream"><ExternalLink class="size-3" />{{ i18n.t('ninja.openTrade') }}</a>
        </template>
      </footer>
    </section>
  </div>
</template>
