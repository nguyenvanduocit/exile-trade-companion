import { describe, expect, it } from 'vitest'
import { activeStatIds, parseStatField, parseStatValue, planAddStat, planAddStatNot } from './stat-filter'

describe('modifier values', () => {
  it.each([
    ['+21 to Strength', 21],
    ['+40 to maximum Life', 40],
    ['26% increased Damage', 26],
    ['-12% to Fire Resistance', -12],
    ['−1.5% to Critical Hit Chance', -1.5],
    ['Adds 12 to 24 Physical Damage', 18],
    ['When you kill a Rare monster, gain its Modifiers', null],
    ['10% chance to gain a charge for 4 seconds', null],
  ])('reads %s', (label, value) => {
    expect(parseStatValue(label)).toBe(value)
  })

  it('uses catalog placeholders without treating fixed durations as rolls', () => {
    expect(parseStatValue('10% chance to gain a charge for 4 seconds', {
      text: '#% chance to gain a charge for 4 seconds',
    })).toBe(10)
    expect(parseStatValue('+21 to Strength', { text: '+# to Strength' })).toBe(21)
    expect(parseStatValue('Adds 12 to 24 Physical Damage', { text: 'Adds # to # Physical Damage' })).toBe(18)
  })

  it('does not put fixed or option values into numeric filters', () => {
    expect(parseStatValue('Grants Level 20 Skill', { text: 'Grants Level 20 Skill' })).toBeNull()
    expect(parseStatValue('Allocates Skill 12', { text: 'Allocates #', option: { options: [] } })).toBeNull()
    expect(parseStatValue('+21 to Strength', { text: '+# to Dexterity' })).toBeNull()
  })

  it('converts reduced rolls to negative values for increased catalog stats', () => {
    expect(parseStatValue('30% reduced Charges per use', { text: '#% increased Charges per use' })).toBe(-30)
    expect(parseStatValue('12% less Damage', { text: '#% more Damage' })).toBe(-12)
  })

  it('preserves a weighted filter while replacing its bounds', () => {
    const groups = [{ type: 'weight', filters: [{ id: 'explicit.stat_1', value: { min: 10, max: 50, weight: 2 } }] }]
    expect(planAddStat(groups, 'explicit.stat_1', { min: 21 })).toEqual({
      action: 'update', group: 0, index: 0,
      value: { id: 'explicit.stat_1', value: { min: 21, weight: 2 }, disabled: false },
    })
  })

  it('keeps zero as an explicit bound when adding to an existing group', () => {
    expect(planAddStat([{ type: 'and', filters: [] }], 'explicit.stat_1', { max: 0 })).toEqual({
      action: 'add', group: 0, value: { id: 'explicit.stat_1', value: { max: 0 }, disabled: false },
    })
  })

  it.each(['min', 'max'] as const)('adds the clicked value as %s', (bound) => {
    expect(planAddStat([], 'explicit.stat_1', { [bound]: 21 })).toEqual({
      action: 'add-group', value: { id: 'explicit.stat_1', value: { [bound]: 21 }, disabled: false },
    })
  })

  it.each(['min', 'max'] as const)('updates an existing filter and clears the opposite of %s', (bound) => {
    const groups = [{ type: 'and', filters: [{ id: 'explicit.stat_1', value: { min: 10, max: 50 }, disabled: true }] }]
    expect(planAddStat(groups, 'explicit.stat_1', { [bound]: 21 })).toEqual({
      action: 'update', group: 0, index: 0,
      value: { id: 'explicit.stat_1', value: { [bound]: 21 }, disabled: false },
    })
    expect(groups[0]!.filters[0]!.value).toEqual({ min: 10, max: 50 })
  })
})

describe('parseStatField', () => {
  it('bỏ tiền tố stat. và giữ nguyên id của trade API', () => {
    expect(parseStatField('stat.explicit.stat_3299347043')).toBe('explicit.stat_3299347043')
    expect(parseStatField('stat.implicit.stat_2901986750')).toBe('implicit.stat_2901986750')
  })

  it('giữ statgroup id vì site cũng chấp nhận nó làm filter', () => {
    expect(parseStatField('statgroup.explicit.stat_1')).toBe('statgroup.explicit.stat_1')
  })

  it('bỏ qua field không phải stat như ilvl, quality', () => {
    expect(parseStatField('ilvl')).toBeNull()
    expect(parseStatField('')).toBeNull()
    expect(parseStatField(null)).toBeNull()
  })
})

describe('planAddStat', () => {
  const groups = [
    { type: 'and', filters: [{ id: 'explicit.stat_1', value: {}, disabled: false }] },
    { type: 'weight', filters: [{ id: 'explicit.stat_2', value: {}, disabled: false }] },
  ]

  it('thêm vào group 0 khi stat chưa có ở đó', () => {
    expect(planAddStat(groups, 'explicit.stat_9')).toEqual({
      action: 'add',
      group: 0,
      value: { id: 'explicit.stat_9', value: {}, disabled: false },
    })
  })

  it('bỏ qua khi stat đã có trong group 0', () => {
    expect(planAddStat(groups, 'explicit.stat_1')).toEqual({ action: 'exists', group: 0, index: 0 })
  })

  it('vẫn thêm vào group 0 dù stat đang nằm ở group khác', () => {
    expect(planAddStat(groups, 'explicit.stat_2').action).toBe('add')
  })

  it('tạo group and khi search chưa có group nào', () => {
    expect(planAddStat([], 'explicit.stat_9')).toEqual({
      action: 'add-group',
      value: { id: 'explicit.stat_9', value: {}, disabled: false },
    })
  })
})

describe('planAddStatNot', () => {
  const groups = [
    { type: 'and', filters: [{ id: 'explicit.stat_1', value: {}, disabled: false }] },
    { type: 'not', filters: [{ id: 'explicit.stat_2', value: {}, disabled: false }] },
    { type: 'not', filters: [{ id: 'explicit.stat_3', value: {}, disabled: false }] },
  ]

  it('thêm vào group "not" đầu tiên tìm thấy, bỏ qua group and đứng trước nó', () => {
    expect(planAddStatNot(groups, 'explicit.stat_9')).toEqual({
      action: 'add',
      group: 1,
      value: { id: 'explicit.stat_9', value: {}, disabled: false },
    })
  })

  it('bỏ qua khi stat đã có trong group "not" đầu tiên', () => {
    expect(planAddStatNot(groups, 'explicit.stat_2')).toEqual({ action: 'exists', group: 1, index: 0 })
  })

  it('không tính stat trùng ở group "not" thứ hai, vẫn add vào group "not" đầu tiên', () => {
    expect(planAddStatNot(groups, 'explicit.stat_3')).toEqual({
      action: 'add',
      group: 1,
      value: { id: 'explicit.stat_3', value: {}, disabled: false },
    })
  })

  it('tạo group not mới khi search chưa có group "not" nào', () => {
    const noNotGroups = [{ type: 'and', filters: [{ id: 'explicit.stat_1', value: {}, disabled: false }] }]
    expect(planAddStatNot(noNotGroups, 'explicit.stat_9')).toEqual({
      action: 'add-group',
      value: { id: 'explicit.stat_9', value: {}, disabled: false },
    })
  })

  it('tạo group not mới khi search chưa có group nào', () => {
    expect(planAddStatNot([], 'explicit.stat_9')).toEqual({
      action: 'add-group',
      value: { id: 'explicit.stat_9', value: {}, disabled: false },
    })
  })
})

describe('activeStatIds', () => {
  it('gom id từ mọi group lại thành một set', () => {
    const groups = [
      { type: 'and', filters: [{ id: 'explicit.stat_1' }] },
      { type: 'not', filters: [{ id: 'explicit.stat_2' }] },
    ]
    expect(activeStatIds(groups)).toEqual(new Set(['explicit.stat_1', 'explicit.stat_2']))
  })

  it('loại id có disabled true, không tính là đang search', () => {
    const groups = [
      { type: 'and', filters: [{ id: 'explicit.stat_1', disabled: true }, { id: 'explicit.stat_2', disabled: false }] },
    ]
    expect(activeStatIds(groups)).toEqual(new Set(['explicit.stat_2']))
  })

  it('coi disabled undefined là đang active', () => {
    const groups = [{ type: 'and', filters: [{ id: 'explicit.stat_1' }] }]
    expect(activeStatIds(groups)).toEqual(new Set(['explicit.stat_1']))
  })

  it('id trùng ở nhiều group chỉ tính một lần', () => {
    const groups = [
      { type: 'and', filters: [{ id: 'explicit.stat_1' }] },
      { type: 'weight', filters: [{ id: 'explicit.stat_1' }] },
    ]
    expect(activeStatIds(groups)).toEqual(new Set(['explicit.stat_1']))
  })

  it('trả về set rỗng khi không có group nào', () => {
    expect(activeStatIds([])).toEqual(new Set())
  })
})
