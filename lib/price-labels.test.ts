import { describe, expect, it } from 'vitest'
import { buildPriceLabelParts, currencyIconUrls } from './price-labels'

describe('buildPriceLabelParts', () => {
  it('shows only the divine equivalent for a chaos-priced listing', () => {
    expect(buildPriceLabelParts(10, 'chaos', { divine: 300 })).toEqual([
      { currency: 'divine', text: '0.033' },
    ])
  })

  it('shows only the chaos equivalent for a divine-priced listing', () => {
    expect(buildPriceLabelParts(2, 'divine', { divine: 200 })).toEqual([
      { currency: 'chaos', text: '400' },
    ])
  })

  it('shows chaos and divine equivalents for any other currency', () => {
    expect(buildPriceLabelParts(2, 'exalted', { exalted: 90, divine: 180 })).toEqual([
      { currency: 'chaos', text: '180' },
      { currency: 'divine', text: '1.00' },
    ])
  })

  it('returns null when the listing currency has no known rate', () => {
    expect(buildPriceLabelParts(3, 'mystery-currency', { divine: 180 })).toBeNull()
  })

  it('returns null for a chaos-priced listing when no divine rate is available', () => {
    expect(buildPriceLabelParts(50, 'chaos', {})).toBeNull()
  })

  it('omits the divine part for another currency when no divine rate is available', () => {
    expect(buildPriceLabelParts(2, 'exalted', { exalted: 90 })).toEqual([
      { currency: 'chaos', text: '180' },
    ])
  })
})

describe('currencyIconUrls', () => {
  it('prefixes catalog image paths with the CDN origin and skips unknown currencies', () => {
    const catalog = {
      chaos: { id: 'chaos', text: 'Chaos Orb', image: '/gen/image/abc/CurrencyRerollRare.png' },
    }
    expect(currencyIconUrls(catalog, ['chaos', 'divine'])).toEqual({
      chaos: 'https://web.poecdn.com/gen/image/abc/CurrencyRerollRare.png',
    })
  })
})
