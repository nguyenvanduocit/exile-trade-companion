import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StatFilterEntry, StatGroup } from '@/lib/stat-filter'
import type { TradeSettings } from '@/types/trading'

const bridge = vi.hoisted(() => ({
  listener: undefined as ((message: { data: TradeSettings }) => void) | undefined,
}))
vi.mock('@/lib/window-messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve()),
  onMessage: (name: string, listener: typeof bridge.listener) => {
    if (name === 'settingsUpdated') bridge.listener = listener
    return vi.fn()
  },
}))

import statsScript from '@/entrypoints/trade-stats.content'

function setup(text: string, groups: StatGroup[], field = 'stat.explicit.strength') {
  const buttons: ReturnType<typeof createElement>[] = []
  function createElement() {
    let onClick: ((event: { preventDefault: () => void; stopPropagation: () => void }) => void) | undefined
    return {
      dataset: {} as Record<string, string>,
      className: '', textContent: '', title: '', type: '',
      setAttribute: vi.fn(),
      addEventListener: (name: string, listener: typeof onClick) => {
        if (name === 'click') onClick = listener
      },
      click: () => {
        const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
        onClick!(event)
        expect(event.preventDefault).toHaveBeenCalledOnce()
        expect(event.stopPropagation).toHaveBeenCalledOnce()
      },
    }
  }
  const line = {
    dataset: { field }, textContent: text,
    parentElement: {
      classList: { add: vi.fn() },
      querySelector: (selector: string) => buttons.find((button) => `.${button.className}` === selector),
    },
    after: (...inserted: typeof buttons) => buttons.push(...inserted),
  }
  const commit = vi.fn((name: string, payload: unknown) => {
    if (name === 'pushStatGroup') groups.push(payload as StatGroup)
    if (name === 'setStatFilter') {
      const { group, index, value } = payload as { group: number; index?: number; value: StatFilterEntry }
      // Match the trade site's Vuex mutation: index replaces, omission appends.
      if (index === undefined) groups[group]!.filters.push(value)
      else groups[group]!.filters.splice(index, 1, value)
    }
  })
  const save = vi.fn()
  vi.stubGlobal('window', { app: {
    $store: { state: { persistent: { stats: groups } }, commit },
    $refs: { toastr: { Add: vi.fn() } }, save,
  } })
  vi.stubGlobal('document', {
    head: { append: vi.fn() }, body: {}, createElement,
    querySelectorAll: (selector: string) => selector.startsWith('.lc.s') ? [line] : [],
  })
  vi.stubGlobal('MutationObserver', class {
    observe() {}
    disconnect() {}
  })
  Reflect.apply(statsScript.main, undefined, [])
  bridge.listener!({ data: {
    maxHistory: 50, collapsedFolderIds: [], hasOpenedPanel: false,
    statFilterButtonsEnabled: true, propertyFilterButtonsEnabled: true,
    priceLabelsEnabled: true, highlightSearchedModsEnabled: false,
    bulkSellerHighlightEnabled: true, tierPickerEnabled: true, telemetryEnabled: true,
  } })
  return { line, groups, commit, save, plus: buttons[0]!, minus: buttons[1]! }
}

afterEach(() => vi.unstubAllGlobals())

describe('modifier filter button clicks', () => {
  it('replaces an existing maximum with the current roll, then switches to a maximum without duplication', () => {
    const id = 'explicit.strength'
    const ui = setup('+21 to Strength', [{ type: 'and', filters: [
      { id: 'explicit.life', value: { min: 40 }, disabled: false },
      { id, value: { max: 50 }, disabled: true },
    ] }])

    ui.plus.click()

    expect(ui.groups[0]!.filters).toEqual([
      { id: 'explicit.life', value: { min: 40 }, disabled: false },
      { id, value: { min: 21 }, disabled: false },
    ])
    expect(ui.commit).toHaveBeenCalledWith('setStatFilter', {
      group: 0, index: 1, value: { id, value: { min: 21 }, disabled: false },
    })

    ui.line.textContent = '+26 to Strength'
    ui.minus.click()

    expect(ui.groups).toEqual([{ type: 'and', filters: [
      { id: 'explicit.life', value: { min: 40 }, disabled: false },
      { id, value: { max: 26 }, disabled: false },
    ] }])
    expect(ui.commit).toHaveBeenCalledWith('setStatFilter', {
      group: 0, index: 1, value: { id, value: { max: 26 }, disabled: false },
    })
    expect(ui.commit).toHaveBeenCalledWith('showAdvancedSearch', true)
    expect(ui.save).toHaveBeenCalledTimes(2)
    expect(ui.save).toHaveBeenLastCalledWith(true)
  })

  it('adds a numeric minus as a maximum in the first group', () => {
    const ui = setup('+21 to Strength', [{ type: 'and', filters: [] }])
    ui.minus.click()
    expect(ui.groups).toEqual([{ type: 'and', filters: [
      { id: 'explicit.strength', value: { max: 21 }, disabled: false },
    ] }])
    expect(ui.save).toHaveBeenCalledOnce()
  })

  it('keeps a modifier without a numeric value in the Not group when minus is clicked', () => {
    const ui = setup('Cannot be Frozen', [{ type: 'and', filters: [] }], 'stat.explicit.frozen')
    ui.minus.click()
    expect(ui.groups).toEqual([
      { type: 'and', filters: [] },
      { type: 'not', filters: [{ id: 'explicit.frozen', value: {}, disabled: false }] },
    ])
    expect(ui.save).toHaveBeenCalledOnce()
  })
})
