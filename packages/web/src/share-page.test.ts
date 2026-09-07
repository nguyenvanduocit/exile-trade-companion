import { describe, expect, it, vi } from 'vitest'
import { parseShareKeyFromLocation, resolveJoinGame, watchExtensionInstalled } from './share-page'

describe('parseShareKeyFromLocation', () => {
  it('reads the key query param', () => {
    expect(parseShareKeyFromLocation('?key=share_abc')).toBe('share_abc')
  })

  it('returns null when the param is missing or blank', () => {
    expect(parseShareKeyFromLocation('')).toBeNull()
    expect(parseShareKeyFromLocation('?key=')).toBeNull()
    expect(parseShareKeyFromLocation('?key=%20%20')).toBeNull()
  })

  it('returns null when the key does not use the share-key format', () => {
    expect(parseShareKeyFromLocation('?key=folder_abc')).toBeNull()
    expect(parseShareKeyFromLocation('?key=share_')).toBeNull()
  })
})

describe('resolveJoinGame', () => {
  it('uses the first entry\'s game', () => {
    expect(resolveJoinGame([{ game: 'poe2' }, { game: 'poe1' }])).toBe('poe2')
  })

  it('defaults to poe1 when there are no entries', () => {
    expect(resolveJoinGame([])).toBe('poe1')
  })
})

describe('watchExtensionInstalled', () => {
  it('calls back immediately with true when the marker is already present', () => {
    const root = document.createElement('html')
    root.dataset.exileTradeCompanion = 'installed'
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 50)
    expect(onChange).toHaveBeenCalledWith(true)
    stop()
  })

  it('calls back with true once the marker appears within the timeout', async () => {
    const root = document.createElement('html')
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 200)
    expect(onChange).not.toHaveBeenCalled()

    root.dataset.exileTradeCompanion = 'installed'
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(onChange).toHaveBeenCalledWith(true)
    stop()
  })

  it('never calls back when the marker never appears', async () => {
    const root = document.createElement('html')
    const onChange = vi.fn()
    const stop = watchExtensionInstalled(root, onChange, 50)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(onChange).not.toHaveBeenCalled()
    stop()
  })
})
