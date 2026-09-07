import { conflictsWithTier, getContextTierFamilies, tierFamilyLabel, tierBound, type TierBound, type TierContext } from '@/lib/tier-filter'
import { onSettingsUpdated, sendMessage } from '@/lib/window-messaging'
import type { TradeApp } from '@/lib/trade-app'

interface StatRow extends HTMLElement {
  __vue__?: { $props?: { filter?: { id?: string; group?: string } } }
}

const CLASS = 'etc-tier-picker'
const ROW_SELECTOR = '.filter.full-span:not(.filter-property)'
const TEXT = {
  en: {
    choose: '≈ Tier…',
    label: 'Choose a stat tier',
    hint: 'T1 is best. Fills a numeric threshold for this tier or better; overlapping rolls and combined mods can include lower tiers. Choose the matching item family. A conflicting opposite bound is cleared. Community data: TierFill.',
    uniqueHint: 'These are affix thresholds for this item category. Unique item rolls can differ.',
  },
  vi: {
    choose: '≈ Tier…',
    label: 'Chọn tier cho stat',
    hint: 'T1 cao nhất. Điền ngưỡng cho tier này trở lên; roll chồng nhau và mod cộng gộp có thể lọt tier thấp hơn. Chọn đúng nhóm item. Ngưỡng min/max đối diện sẽ được xoá nếu mâu thuẫn. Dữ liệu cộng đồng: TierFill.',
    uniqueHint: 'Đây là ngưỡng affix của nhóm item này. Khoảng roll riêng của unique có thể khác.',
  },
}

const STYLE = `
.filter-title:has(> .${CLASS}-slot) { position: relative; padding-right: 118px; box-sizing: border-box; }
.filter-title > .${CLASS}-slot {
  position: absolute; right: 0; top: 50%; transform: translateY(-50%);
  display: block; width: 118px;
}
.${CLASS} {
  width: 110px; height: 26px; margin: 0 4px; padding: 2px 4px;
  border: 1px solid #634928; border-radius: 2px;
  background: #1c2026; color: #fff8e1; font: 12px FontinSmallCaps, sans-serif;
  cursor: pointer;
}
.${CLASS}:focus-visible { outline: 2px solid #a38d6d; outline-offset: 1px; }
`

interface RowControl {
  signature: string
  slot: HTMLSpanElement
  select: HTMLSelectElement
  bound: TierBound | null
}

function fillNativeInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export default defineContentScript({
  matches: ['https://www.pathofexile.com/trade2/*', 'https://pathofexile.com/trade2/*'],
  world: 'MAIN',
  runAt: 'document_idle',

  main() {
    const t = TEXT[navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en']
    const controls = new Map<StatRow, RowControl>()
    let observer: MutationObserver | undefined
    let unwatch: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let style: HTMLStyleElement | undefined

    function removeControl(row: StatRow) {
      controls.get(row)?.slot.remove()
      controls.delete(row)
    }

    function scanRow(row: StatRow, app: TradeApp, context: TierContext) {
      // Vue props supply the exact ID, including explicit/pseudo namespace. Text matching
      // would conflate different mod sources that happen to have the same visible label.
      const filter = row.__vue__?.$props?.filter
      const id = filter?.id
      if (!id || filter?.group?.startsWith('weight')) {
        removeControl(row)
        return
      }
      const families = getContextTierFamilies(id, context, app.static_?.knownItems)
      const signature = JSON.stringify([id, filter?.group, context, families.map((family) => family.types)])
      const boxes = row.querySelectorAll<HTMLInputElement>('input.minmax')
      const minInput = boxes[0]
      const maxInput = boxes[1]
      const title = row.querySelector('.filter-title')
      if (!minInput || !maxInput || !title) {
        removeControl(row)
        return
      }
      const old = controls.get(row)
      if (old?.signature === signature && old.select.isConnected) {
        if (old.bound && (old.bound.field === 'min' ? minInput : maxInput).value !== String(old.bound.value)) {
          old.select.value = ''
          old.bound = null
        }
        return
      }
      removeControl(row)
      if (!families.length) return

      const select = document.createElement('select')
      select.className = CLASS
      select.setAttribute('aria-label', `${t.label}: ${families[0]!.display}`)
      const hint = context.name ? `${t.uniqueHint} ${t.hint}` : t.hint
      select.title = hint
      const placeholder = new Option(t.choose, '')
      placeholder.disabled = true
      select.append(placeholder)
      const choices = new Map<string, { bound: TierBound; description: string }>()
      // Một family duy nhất thì không cần optgroup: header trùng với aria-label và chỉ tốn chỗ.
      for (const [familyIndex, family] of families.entries()) {
        const familyLabel = tierFamilyLabel(family)
        const container = families.length > 1 ? document.createElement('optgroup') : select
        if (container instanceof HTMLOptGroupElement) container.label = familyLabel
        for (const tier of family.tiers) {
          const bound = tierBound(family, tier.tier)
          if (!bound) continue
          const key = `${familyIndex}:${tier.tier}`
          const label = `T${tier.tier} · ${bound.field} ${bound.value}`
          const option = new Option(label, key)
          option.title = `${familyLabel} · ilvl ${tier.ilvl ?? '?'} · ${tier.ranges.map((r) => r.join('–')).join(' / ')}`
          container.append(option)
          choices.set(key, { bound, description: `${familyLabel} · ${label}` })
        }
        if (container !== select && container.childElementCount) select.append(container)
      }
      if (!choices.size) return
      select.value = ''
      const slot = document.createElement('span')
      slot.className = `${CLASS}-slot`
      slot.append(select)
      const control: RowControl = { signature, slot, select, bound: null }
      controls.set(row, control)
      select.addEventListener('click', (event) => event.stopPropagation())
      select.addEventListener('change', (event) => {
        void sendMessage('featureUsed', 'tier-picker').catch(() => undefined)
        event.stopPropagation()
        const choice = choices.get(select.value)
        if (!choice) return
        const { bound } = choice
        const target = bound.field === 'min' ? minInput : maxInput
        const opposite = bound.field === 'min' ? maxInput : minInput
        if (conflictsWithTier(bound, opposite.value)) fillNativeInput(opposite, '')
        fillNativeInput(target, String(bound.value))
        control.bound = bound
        select.title = `${choice.description}. ${hint}`
      })
      title.append(slot)
    }

    function scan() {
      const app = window.app
      if (!observer) return
      if (!app?.$store) {
        scheduleScan()
        return
      }
      if (!unwatch) {
        unwatch = app.$store.watch((state) => [state.persistent, app.static_?.knownItems], scheduleScan, { deep: true })
      }
      for (const row of controls.keys()) {
        if (!row.isConnected) removeControl(row)
      }
      const query = app.$store.state.persistent
      const typeFilters = query.filters.type_filters
      const categoryFilter = typeFilters && !('disabled' in typeFilters && typeFilters.disabled)
        ? typeFilters.filters.category : undefined
      const context: TierContext = {
        category: categoryFilter && 'option' in categoryFilter && typeof categoryFilter.option === 'string'
          ? categoryFilter.option : null,
        type: query.type,
        name: query.name,
      }
      document.querySelectorAll<StatRow>(ROW_SELECTOR).forEach((row) => scanRow(row, app, context))
    }

    function scheduleScan() {
      clearTimeout(timer)
      timer = setTimeout(scan, 80)
    }

    function stop() {
      observer?.disconnect()
      observer = undefined
      unwatch?.()
      unwatch = undefined
      clearTimeout(timer)
      for (const row of controls.keys()) removeControl(row)
      style?.remove()
      style = undefined
    }

    const unsubscribe = onSettingsUpdated((settings) => {
      if (!settings.tierPickerEnabled) return stop()
      if (observer) return
      style = document.createElement('style')
      style.dataset.exileTradeCompanion = 'tier-picker'
      style.textContent = STYLE
      document.head.append(style)
      observer = new MutationObserver(scheduleScan)
      observer.observe(document.body, { childList: true, subtree: true })
      scan()
    })
    window.addEventListener('pagehide', (event) => {
      if (event.persisted) return
      unsubscribe()
      stop()
    })
  },
})
