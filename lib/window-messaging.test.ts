import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineWindowMessaging } from '@webext-core/messaging/page'
import type { TradeSettings } from '@/types/trading'

const settings: TradeSettings = {
  maxHistory: 100,
  collapsedFolderIds: [],
  hasOpenedPanel: false,
  statFilterButtonsEnabled: true,
  propertyFilterButtonsEnabled: true,
  priceLabelsEnabled: true,
  highlightSearchedModsEnabled: true,
  bulkSellerHighlightEnabled: true, telemetryEnabled: true,
}

const cleanup: (() => void)[] = []
let listeners: Set<EventListenerOrEventListenerObject>

beforeEach(() => {
  vi.resetModules()
  const target = new EventTarget()
  listeners = new Set()
  vi.stubGlobal('location', { origin: 'https://www.pathofexile.com' })
  vi.stubGlobal('window', {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.add(listener)
      target.addEventListener(type, listener)
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.delete(listener)
      target.removeEventListener(type, listener)
    },
    postMessage(data: unknown) {
      queueMicrotask(() => target.dispatchEvent(new MessageEvent('message', { data })))
    },
  })
})

afterEach(() => {
  for (const stop of cleanup.splice(0)) stop()
  vi.unstubAllGlobals()
})

function publisher() {
  const peer = defineWindowMessaging<{
    settingsUpdated(settings: TradeSettings): void
    settingsRequested(): void
  }>({ namespace: 'exile-trade-companion' })
  cleanup.push(() => peer.removeAllListeners())
  return peer
}

const settleMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('settings startup handshake', () => {
  it('recovers settings published before the subscriber started', async () => {
    const peer = publisher()
    peer.onMessage('settingsRequested', () => {
      void peer.sendMessage('settingsUpdated', settings).catch(() => undefined)
    })
    void peer.sendMessage('settingsUpdated', settings).catch(() => undefined)
    await settleMessages()

    const { onSettingsUpdated } = await import('./window-messaging')
    const receive = vi.fn()
    cleanup.push(onSettingsUpdated(receive))
    await settleMessages()
    expect(receive).toHaveBeenCalledExactlyOnceWith(settings)
  })

  it('receives initial settings when the publisher starts later', async () => {
    const { onSettingsUpdated } = await import('./window-messaging')
    const receive = vi.fn()
    cleanup.push(onSettingsUpdated(receive))
    await settleMessages()
    expect(receive).not.toHaveBeenCalled()

    const peer = publisher()
    await peer.sendMessage('settingsUpdated', settings)
    expect(receive).toHaveBeenCalledExactlyOnceWith(settings)
  })

  it('preserves a disabled setting and receives subsequent changes', async () => {
    const peer = publisher()
    peer.onMessage('settingsRequested', () => {
      void peer.sendMessage('settingsUpdated', { ...settings, statFilterButtonsEnabled: false }).catch(() => undefined)
    })
    const { onSettingsUpdated } = await import('./window-messaging')
    const receive = vi.fn()
    cleanup.push(onSettingsUpdated(receive))
    await settleMessages()
    expect(receive).toHaveBeenCalledExactlyOnceWith({ ...settings, statFilterButtonsEnabled: false })

    await peer.sendMessage('settingsUpdated', settings)
    expect(receive).toHaveBeenLastCalledWith(settings)
    expect(receive).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes even before any publisher exists without leaving listeners', async () => {
    const { onSettingsUpdated } = await import('./window-messaging')
    const receive = vi.fn()
    const stop = onSettingsUpdated(receive)
    await settleMessages()
    stop()
    expect(listeners.size).toBe(0)

    const peer = publisher()
    void peer.sendMessage('settingsUpdated', settings).catch(() => undefined)
    await settleMessages()
    expect(receive).not.toHaveBeenCalled()
    peer.removeAllListeners()
    expect(listeners.size).toBe(0)
  })

  it('cancels immediately before the startup request launches', async () => {
    const { onSettingsUpdated } = await import('./window-messaging')
    const stop = onSettingsUpdated(vi.fn())
    stop()
    await settleMessages()
    expect(listeners.size).toBe(0)
  })

  it('cleans up cancellation while the messaging library prepares the request', async () => {
    const { onSettingsUpdated } = await import('./window-messaging')
    const stop = onSettingsUpdated(vi.fn())
    await Promise.resolve()
    stop()
    await settleMessages()
    expect(listeners.size).toBe(0)
  })
})
