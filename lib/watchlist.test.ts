import { describe, expect, it } from 'vitest'
import { MAX_WATCHED_SEARCHES, canEnableWatching, diffWatchlistTabs, hasNewListings, searchIdForTab } from './watchlist'

describe('canEnableWatching', () => {
  it('allows enabling when below the cap', () => {
    expect(canEnableWatching(0)).toBe(true)
    expect(canEnableWatching(MAX_WATCHED_SEARCHES - 1)).toBe(true)
  })

  it('blocks enabling once at or above the cap', () => {
    expect(canEnableWatching(MAX_WATCHED_SEARCHES)).toBe(false)
    expect(canEnableWatching(MAX_WATCHED_SEARCHES + 1)).toBe(false)
  })
})

describe('hasNewListings', () => {
  it('does not flag a first-ever report as new (no baseline yet)', () => {
    expect(hasNewListings(undefined, 0)).toBe(false)
    expect(hasNewListings(undefined, 12)).toBe(false)
  })

  it('flags an increase over the previous count as new', () => {
    expect(hasNewListings(5, 6)).toBe(true)
    expect(hasNewListings(0, 1)).toBe(true)
  })

  it('does not flag an unchanged count as new', () => {
    expect(hasNewListings(5, 5)).toBe(false)
  })

  it('does not flag a decrease (listings sold/expired) as new', () => {
    expect(hasNewListings(5, 3)).toBe(false)
  })
})

describe('diffWatchlistTabs', () => {
  it('opens tabs for watched searches with no tab yet', () => {
    const diff = diffWatchlistTabs(['s1'], {}, new Set())
    expect(diff).toEqual({ toOpen: ['s1'], toClose: [] })
  })

  it('reopens a tab that no longer exists (restart recovery)', () => {
    const diff = diffWatchlistTabs(['s1'], { s1: 100 }, new Set())
    expect(diff).toEqual({ toOpen: ['s1'], toClose: [] })
  })

  it('leaves an already-live watched tab alone', () => {
    const diff = diffWatchlistTabs(['s1'], { s1: 100 }, new Set([100]))
    expect(diff).toEqual({ toOpen: [], toClose: [] })
  })

  it('closes a live tab whose search is no longer watched', () => {
    const diff = diffWatchlistTabs([], { s1: 100 }, new Set([100]))
    expect(diff).toEqual({ toOpen: [], toClose: [100] })
  })

  it('does not try to close a tab that is already dead', () => {
    const diff = diffWatchlistTabs([], { s1: 100 }, new Set())
    expect(diff).toEqual({ toOpen: [], toClose: [] })
  })

  it('handles a mix of open/close/leave-alone across several searches', () => {
    const diff = diffWatchlistTabs(
      ['keep', 'reopen', 'fresh'],
      { keep: 1, reopen: 2, stale: 3 },
      new Set([1, 3]),
    )
    expect(diff.toOpen.sort()).toEqual(['fresh', 'reopen'])
    expect(diff.toClose).toEqual([3])
  })
})

describe('searchIdForTab', () => {
  it('finds the searchId mapped to a tabId', () => {
    expect(searchIdForTab({ s1: 100, s2: 200 }, 200)).toBe('s2')
  })

  it('returns null when the tab is not a watchlist tab', () => {
    expect(searchIdForTab({ s1: 100 }, 999)).toBeNull()
  })
})
