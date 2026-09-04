import { describe, expect, it } from 'vitest'
import { buildQueryLabel } from './query-label'

describe('buildQueryLabel', () => {
  it('ưu tiên name khi search một unique/item cụ thể', () => {
    expect(buildQueryLabel({ name: 'Tabula Rasa', type: 'Simple Robe' })).toBe('Tabula Rasa')
  })

  it('fallback về base type khi chỉ chọn type, không có name', () => {
    expect(buildQueryLabel({ name: null, type: 'Astral Plate' })).toBe('Astral Plate')
  })

  it('fallback về category filter khi không có name/type và category khác "Any"', () => {
    expect(buildQueryLabel({ categoryLabel: 'Bow' })).toBe('Bow')
    expect(buildQueryLabel({ categoryLabel: 'Any' })).toBeNull()
  })

  it('fallback về rarity filter khi không có name/type/category', () => {
    expect(buildQueryLabel({ rarityLabel: 'Unique' })).toBe('Unique')
    expect(buildQueryLabel({ rarityLabel: 'Any' })).toBeNull()
  })

  it('gộp rarity + category khi cả hai cùng chọn', () => {
    expect(buildQueryLabel({ rarityLabel: 'Rare', categoryLabel: 'Boots' })).toBe('Rare Boots')
    expect(buildQueryLabel({ rarityLabel: 'Any', categoryLabel: 'Boots' })).toBe('Boots')
    expect(buildQueryLabel({ rarityLabel: 'Unique', categoryLabel: 'Any' })).toBe('Unique')
  })

  it('fallback về stat filter đầu tiên khi search chỉ build từ mod, làm sạch token "#"', () => {
    expect(buildQueryLabel({ statLabels: ['#% increased Rarity of Items found'] })).toBe(
      'increased Rarity of Items found',
    )
    expect(buildQueryLabel({ statLabels: ['+#% total to Cold Resistance'] })).toBe('total to Cold Resistance')
  })

  it('gắn số lượng stat còn lại khi chọn nhiều hơn một stat filter', () => {
    expect(
      buildQueryLabel({
        statLabels: ['#% increased Rarity of Items found', '+# to maximum Life', '+# to Strength'],
      }),
    ).toBe('increased Rarity of Items found +2')
  })

  it('fallback về cặp currency exchange, khử trùng và nối bằng ↔', () => {
    expect(buildQueryLabel({ exchangeAlts: ['Chaos Orb', 'Divine Orb'] })).toBe('Chaos Orb ↔ Divine Orb')
    expect(buildQueryLabel({ exchangeAlts: ['Chaos Orb', 'Chaos Orb'] })).toBe('Chaos Orb')
  })

  it('trả về null khi không có tín hiệu nào', () => {
    expect(buildQueryLabel({})).toBeNull()
    expect(buildQueryLabel({ name: '  ', type: '' })).toBeNull()
  })
})
