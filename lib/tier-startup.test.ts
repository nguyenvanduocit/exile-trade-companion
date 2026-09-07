import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TradeSettings } from '@/types/trading'

const bridge = vi.hoisted(() => ({ listener: undefined as ((settings: TradeSettings) => void) | undefined }))
vi.mock('@/lib/window-messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve()),
  onSettingsUpdated: (listener: (settings: TradeSettings) => void) => {
    bridge.listener = listener
    return vi.fn()
  },
}))

import tiers from '@/entrypoints/trade-tiers.content'

function setEnabled(enabled: boolean) {
  bridge.listener!({
    maxHistory: 50, collapsedFolderIds: [], hasOpenedPanel: false,
    statFilterButtonsEnabled: true, propertyFilterButtonsEnabled: true,
    priceLabelsEnabled: true, highlightSearchedModsEnabled: true,
    bulkSellerHighlightEnabled: true, tierPickerEnabled: enabled, telemetryEnabled: true,
  })
}

function readyApp() {
  return {
    $store: {
      watch: vi.fn(() => vi.fn()),
      state: { persistent: { filters: {}, stats: [], name: null, type: null } },
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { addEventListener: vi.fn(), app: undefined })
  vi.stubGlobal('document', {
    head: { append: vi.fn() }, body: {}, querySelectorAll: vi.fn(() => []),
    createElement: () => ({ dataset: {}, remove: vi.fn(), textContent: '' }),
  })
  vi.stubGlobal('MutationObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('tier picker startup', () => {
  it('waits for the trade app even when no DOM mutation follows settings', () => {
    Reflect.apply(tiers.main, undefined, [])
    setEnabled(true)
    const app = readyApp()
    Object.assign(window, { app })
    vi.advanceTimersByTime(80)
    expect(app.$store.watch).toHaveBeenCalledOnce()
    expect(document.querySelectorAll).toHaveBeenCalled()
  })

  it('cancels readiness polling when disabled, then can start again', () => {
    Reflect.apply(tiers.main, undefined, [])
    setEnabled(true)
    setEnabled(false)
    const app = readyApp()
    Object.assign(window, { app })
    vi.advanceTimersByTime(200)
    expect(app.$store.watch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    setEnabled(true)
    expect(app.$store.watch).toHaveBeenCalledOnce()
  })
})
