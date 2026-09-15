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
    static_: { knownStatsFlat: { 'explicit.strength': { text: '+# to Strength' } } },
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
    bulkSellerHighlightEnabled: true, telemetryEnabled: true,
  } })
  return { line, groups, commit, save, plus: buttons[0]!, minus: buttons[1]! }
}

afterEach(() => vi.unstubAllGlobals())

describe('modifier filter button clicks', () => {
  it.each([
    ['+21.9 to Strength', 'stat.explicit.strength', 21],
    ['−1.5% to Critical Hit Chance', 'stat.explicit.crit', -2],
    ['0.9% increased Damage', 'stat.explicit.damage', 0],
    ['Adds 12 to 25 Physical Damage', 'stat.explicit.damage', 18],
  ])('điền giá trị làm tròn xuống và hiện đúng tooltip cho %s', (label, field, expected) => {
    const ui = setup(label, [{ type: 'and', filters: [] }], field)
    expect(ui.plus.title).toBe(`Set min "${label}" = ${expected}`)
    expect(ui.minus.title).toBe(`Add "${label}" to Not group (min = ${expected})`)
    ui.plus.click()
    ui.minus.click()
    expect(ui.groups).toEqual(['and', 'not'].map(type => ({
      type, filters: [{ id: field.slice('stat.'.length), value: { min: expected }, disabled: false }],
    })))
  })

  it.each(['plus', 'minus'] as const)('updates the matching group without duplicates starting with %s', (first) => {
    const ui = setup('+21 to Strength', [{ type: 'and', filters: [] }])
    const second = first === 'plus' ? 'minus' : 'plus'

    for (const button of [first, second, first] as const) ui[button].click()
    expect(ui.groups).toEqual(['and', 'not'].map(type => ({
      type, filters: [{ id: 'explicit.strength', value: { min: 21 }, disabled: false }],
    })))
    expect(ui.save).toHaveBeenCalledTimes(3)
  })

  it.each(['plus', 'minus'] as const)('does not keep %s permanently visible after a click', (button) => {
    const ui = setup('+21 to Strength', [{ type: 'and', filters: [] }])
    ui[button].click()
    expect(ui[button].dataset.added).toBeUndefined()
  })

  it('updates the positive minimum and adds a separate exclusion with the current roll', () => {
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

    ui.line.textContent = '+26.9 to Strength'
    ui.minus.click()

    expect(ui.groups).toEqual([{ type: 'and', filters: [
      { id: 'explicit.life', value: { min: 40 }, disabled: false },
      { id, value: { min: 21 }, disabled: false },
    ] }, { type: 'not', filters: [{ id, value: { min: 26 }, disabled: false }] }])
    expect(ui.commit).toHaveBeenCalledWith('pushStatGroup', {
      type: 'not', filters: [{ id, value: { min: 26 }, disabled: false }],
    })
    expect(ui.commit).toHaveBeenCalledWith('showAdvancedSearch', true)
    expect(ui.save).toHaveBeenCalledTimes(2)
    expect(ui.save).toHaveBeenLastCalledWith(true)
  })

  it('adds a numeric minus as a minimum in a new Not group', () => {
    const ui = setup('+21 to Strength', [{ type: 'and', filters: [] }])
    ui.minus.click()
    expect(ui.groups).toEqual([{ type: 'and', filters: [] }, { type: 'not', filters: [
      { id: 'explicit.strength', value: { min: 21 }, disabled: false },
    ] }])
    expect(ui.save).toHaveBeenCalledOnce()
  })

  it('replaces bounds in the first Not group and refreshes its minimum on repeated clicks', () => {
    const id = 'explicit.strength'
    const ui = setup('+21 to Strength', [
      { type: 'and', filters: [] },
      { type: 'not', filters: [
        { id: 'explicit.life', value: { min: 40 }, disabled: false },
        { id, value: { min: 10, max: 50 }, disabled: true },
      ] },
      { type: 'not', filters: [{ id, value: { min: 99 }, disabled: false }] },
    ])
    ui.minus.click()
    expect(ui.groups[1]!.filters[1]).toEqual({ id, value: { min: 21 }, disabled: false })
    ui.line.textContent = '+26.9 to Strength'
    ui.minus.click()
    expect(ui.groups).toEqual([
      { type: 'and', filters: [] },
      { type: 'not', filters: [
        { id: 'explicit.life', value: { min: 40 }, disabled: false },
        { id, value: { min: 26 }, disabled: false },
      ] },
      { type: 'not', filters: [{ id, value: { min: 99 }, disabled: false }] },
    ])
    expect(ui.save).toHaveBeenCalledTimes(2)
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
