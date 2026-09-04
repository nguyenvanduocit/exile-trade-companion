import { describe, expect, it } from 'vitest'
import { formatChaos, formatChaosWithDivine, formatDelta } from './format-price'

describe('formatChaos', () => {
  it('formats amounts under 10 with up to 2 decimals, trimming trailing zeros', () => {
    expect(formatChaos(1)).toBe('1')
    expect(formatChaos(0.5)).toBe('0.5')
    expect(formatChaos(1.25)).toBe('1.25')
  })

  it('formats amounts 10-99 with at most 1 decimal', () => {
    expect(formatChaos(12.34)).toBe('12.3')
    expect(formatChaos(50)).toBe('50')
  })

  it('rounds amounts 100-999 to whole numbers', () => {
    expect(formatChaos(456.7)).toBe('457')
  })

  it('formats amounts 1000+ as compact k-notation', () => {
    expect(formatChaos(1234)).toBe('1.2k')
    expect(formatChaos(2000)).toBe('2k')
  })
})

describe('formatChaosWithDivine', () => {
  it('appends the divine-equivalent when a rate is given', () => {
    expect(formatChaosWithDivine(180, 180)).toBe('180c (≈1.00 div)')
  })

  it('omits the divine suffix when no rate is available', () => {
    expect(formatChaosWithDivine(50)).toBe('50c')
  })

  it('keeps the divine-equivalent visible even when it is a tiny fraction', () => {
    expect(formatChaosWithDivine(1, 1000)).toBe('1c (≈0.0010 div)')
  })
})

describe('formatDelta', () => {
  it('formats a positive change with a leading +', () => {
    expect(formatDelta(120, 100)).toBe('+20%')
  })

  it('formats a negative change', () => {
    expect(formatDelta(80, 100)).toBe('-20%')
  })

  it('returns "0%" for no change', () => {
    expect(formatDelta(100, 100)).toBe('0%')
  })

  it('returns null when there is no previous value to compare against', () => {
    expect(formatDelta(100, 0)).toBeNull()
  })
})
