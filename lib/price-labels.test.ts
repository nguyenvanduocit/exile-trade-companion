import { describe, expect, it } from 'vitest'
import { buildPriceLabel } from './price-labels'

describe('buildPriceLabel', () => {
  it('formats a chaos-priced listing with its divine equivalent', () => {
    expect(buildPriceLabel(180, 'chaos', { divine: 180 })).toBe('180c (≈1.00 div)')
  })

  it('converts a divine-priced listing to chaos without a redundant divine suffix', () => {
    expect(buildPriceLabel(2, 'divine', { divine: 200 })).toBe('400c')
  })

  it('returns null when the listing currency has no known rate', () => {
    expect(buildPriceLabel(3, 'mystery-currency', { divine: 180 })).toBeNull()
  })

  it('omits the divine suffix when no divine rate is available', () => {
    expect(buildPriceLabel(50, 'chaos', {})).toBe('50c')
  })
})
