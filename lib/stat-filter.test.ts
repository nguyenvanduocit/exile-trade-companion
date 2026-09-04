import { describe, expect, it } from 'vitest'
import { parseStatField, planAddStat, planAddStatNot } from './stat-filter'

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
