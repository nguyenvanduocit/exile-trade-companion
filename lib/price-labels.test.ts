import { describe, expect, it } from 'vitest'
import { buildPriceLabelParts } from './price-labels'

describe('buildPriceLabelParts', () => {
  it('formats a chaos-priced listing with its divine equivalent', () => {
    expect(buildPriceLabelParts(180, 'chaos', { divine: 180 })).toEqual([
      { currency: 'chaos', text: '180' },
      { currency: 'divine', text: '1.00' },
    ])
  })

  it('converts a divine-priced listing to chaos without a redundant divine part', () => {
    expect(buildPriceLabelParts(2, 'divine', { divine: 200 })).toEqual([
      { currency: 'chaos', text: '400' },
    ])
  })

  it('returns null when the listing currency has no known rate', () => {
    expect(buildPriceLabelParts(3, 'mystery-currency', { divine: 180 })).toBeNull()
  })

  it('omits the divine part when no divine rate is available', () => {
    expect(buildPriceLabelParts(50, 'chaos', {})).toEqual([{ currency: 'chaos', text: '50' }])
  })
})
