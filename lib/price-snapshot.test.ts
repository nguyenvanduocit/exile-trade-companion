import { describe, expect, it } from 'vitest'
import { computeSnapshot } from './price-snapshot'

describe('computeSnapshot', () => {
  it('returns null when fewer than 3 valid listings', () => {
    const listings = [
      { amount: 1, currency: 'chaos' },
      { amount: 2, currency: 'chaos' },
    ]
    expect(computeSnapshot(listings, {})).toBeNull()
  })

  it('uses every valid listing — no cheapest listings are dropped', () => {
    const listings = Array.from({ length: 10 }, (_, i) => ({ amount: i + 1, currency: 'chaos' }))
    const result = computeSnapshot(listings, {})
    expect(result).toEqual({ sampleSize: 10, medianChaos: 5.5, averageChaos: 5.5 })
  })

  it('normalizes non-chaos currency using the provided rate', () => {
    const listings = [
      { amount: 1, currency: 'chaos' },
      { amount: 2, currency: 'chaos' },
      { amount: 1, currency: 'divine' },
    ]
    const result = computeSnapshot(listings, { divine: 180 })
    expect(result).toEqual({ sampleSize: 3, medianChaos: 2, averageChaos: 61 })
  })

  it('excludes listings whose currency has no known rate', () => {
    const listings = [
      { amount: 1, currency: 'chaos' },
      { amount: 2, currency: 'chaos' },
      { amount: 3, currency: 'chaos' },
      { amount: 1, currency: 'mystery-currency' },
    ]
    const result = computeSnapshot(listings, {})
    expect(result).toEqual({ sampleSize: 3, medianChaos: 2, averageChaos: 2 })
  })

  it('computes median as the average of the two middle values for an even sample size', () => {
    const listings = Array.from({ length: 4 }, (_, i) => ({ amount: i + 1, currency: 'chaos' }))
    const result = computeSnapshot(listings, {})
    expect(result?.medianChaos).toBe(2.5)
    expect(result?.averageChaos).toBe(2.5)
  })
})
