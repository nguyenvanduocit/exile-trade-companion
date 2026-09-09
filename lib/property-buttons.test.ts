import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TradeSettings } from '@/types/trading'
import type { PropertyFilterValue } from '@/lib/property-filter'

const bridge = vi.hoisted(() => ({
  listener: undefined as ((message: { data: TradeSettings }) => void) | undefined,
}))
vi.mock('@/lib/window-messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve()),
  onMessage: (_name: string, listener: typeof bridge.listener) => {
    bridge.listener = listener
    return vi.fn()
  },
}))

import propertiesScript from '@/entrypoints/trade-properties.content'

function setup(pathname = '/trade2/search/poe2/Forbidden%20Rites', missingDps = false) {
  function createElement() {
    let onClick: ((event: { preventDefault: () => void; stopPropagation: () => void }) => void) | undefined
    return {
      nodeName: 'BUTTON', dataset: {} as Record<string, string>,
      className: '', textContent: '', title: '', type: '',
      setAttribute: vi.fn(),
      addEventListener: (_name: string, listener: typeof onClick) => { onClick = listener },
      click: () => {
        const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
        onClick!(event)
        expect(event.preventDefault).toHaveBeenCalledOnce()
        expect(event.stopPropagation).toHaveBeenCalledOnce()
      },
    }
  }

  function item(physicalDps: string, elementalDps: string) {
    function line(field: string, text: string) {
      const buttons: ReturnType<typeof createElement>[] = []
      const host = { classList: { add: vi.fn() } }
      return {
        dataset: { field } as Record<string, string>,
        get textContent() { return text + buttons.map(button => button.textContent).join('') },
        get childNodes() { return [{ nodeName: '#text', textContent: text }, ...buttons] },
        closest: (selector: string): object | null => selector === '.item-property' ? host : selector === '.row' ? row : null,
        append: (...inserted: typeof buttons) => buttons.push(...inserted),
        buttons,
      }
    }
    const lines = [
      line('pdamage', 'Physical Damage: 165-248'),
      line('edamage', 'Lightning Damage: 1-266'),
      line('aps', 'Attacks per Second: 1.40'),
      ...missingDps ? [] : [line('pdps', `Physical DPS${physicalDps}`), line('edps', `Elemental DPS${elementalDps}`)],
    ]
    const row = {
      querySelector: (selector: string) => lines.find(value => selector === `[data-field="${value.dataset.field}"]`) ?? null,
    }
    return lines
  }

  const first = item('329', '208.6')
  const second = item('346.5', '186.9')
  const filters: Record<string, { filters: Record<string, PropertyFilterValue> }> = {}
  const commit = vi.fn((name: string, payload: unknown) => {
    if (name !== 'setPropertyFilter') return
    const { group, index, value } = payload as { group: string; index: string; value: PropertyFilterValue }
    const target = filters[group] ??= { filters: {} }
    if (Object.keys(value).length === 0) delete target.filters[index]
    else target.filters[index] = value
  })
  const save = vi.fn()
  vi.stubGlobal('location', { pathname })
  vi.stubGlobal('window', { app: {
    $store: { state: { persistent: { filters } }, commit },
    $refs: { toastr: { Add: vi.fn() } }, save,
  } })
  vi.stubGlobal('document', {
    head: { append: vi.fn() }, body: {}, createElement,
    // DPS may already have buttons when a damage row is decorated.
    querySelectorAll: (selector: string) => selector === 'span.s[data-field]' ? [...first, ...second].reverse() : [],
  })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
  Reflect.apply(propertiesScript.main, undefined, [])
  bridge.listener!({ data: { propertyFilterButtonsEnabled: true } as TradeSettings })
  return { first, second, filters, commit, save }
}

afterEach(() => vi.unstubAllGlobals())

describe('damage property buttons', () => {
  it.each([0, 1])('switches property bounds in both directions starting with button %s', (first) => {
    const ui = setup()
    const buttons = ui.second[0]!.buttons

    for (const index of [first, 1 - first, first]) {
      buttons[index]!.click()
      expect(ui.filters).toEqual({ equipment_filters: { filters: {
        pdps: { [index === 0 ? 'min' : 'max']: 346.5 },
      } } })
    }
    expect(ui.save).toHaveBeenCalledTimes(3)
  })

  it.each([0, 1])('does not keep property button %s permanently visible after a click', (index) => {
    const ui = setup()
    const button = ui.second[0]!.buttons[index]!
    button.click()
    expect(button.dataset.added).toBeUndefined()
  })

  it.each([
    ['/trade2/search/poe2/Forbidden%20Rites', 'equipment_filters'],
    ['/trade/search/Standard', 'weapon_filters'],
  ])('uses the same listing’s supported DPS filters on %s', (pathname, group) => {
    const ui = setup(pathname)
    for (const [index, field, value, label] of [
      [0, 'pdps', 346.5, 'Physical DPS346.5'],
      [1, 'edps', 186.9, 'Elemental DPS186.9'],
    ] as const) {
      const buttons = ui.second[index]!.buttons
      expect(buttons).toHaveLength(2)
      expect(buttons[0]!.title).toBe(`Set min "${label}" = ${value}`)
      buttons[0]!.click()
      expect(ui.commit).toHaveBeenLastCalledWith('setPropertyFilter', { group, index: field, value: { min: value } })
      buttons[1]!.click()
      expect(ui.commit).toHaveBeenLastCalledWith('setPropertyFilter', { group, index: field, value: { max: value } })
    }
    expect(ui.save).toHaveBeenCalledTimes(4)
    expect(ui.save).toHaveBeenLastCalledWith(true)
  })

  it('keeps ordinary scalar properties working', () => {
    const ui = setup()
    ui.second[2]!.buttons[0]!.click()
    expect(ui.commit).toHaveBeenLastCalledWith('setPropertyFilter', {
      group: 'equipment_filters', index: 'aps', value: { min: 1.4 },
    })
  })

  it('does not invent raw damage filters when DPS is unavailable', () => {
    const ui = setup(undefined, true)
    expect(ui.second[0]!.buttons).toHaveLength(0)
    expect(ui.second[1]!.buttons).toHaveLength(0)
    expect(ui.commit).not.toHaveBeenCalled()
  })
})
