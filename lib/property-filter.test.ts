import { describe, expect, it } from 'vitest'
import { parsePropertyField, parsePropertyValue, planSetPropertyMax, planSetPropertyMin, resolvePropertyGroup } from './property-filter'

describe('parsePropertyField', () => {
  it('nhận field property đã biết (không prefix stat.)', () => {
    expect(parsePropertyField('ar')).toBe('ar')
    expect(parsePropertyField('quality')).toBe('quality')
    expect(parsePropertyField('str')).toBe('str')
  })

  it('bỏ qua field không nằm trong map (kể cả dòng stat/statgroup của mod)', () => {
    expect(parsePropertyField('stat.explicit.stat_1')).toBeNull()
    expect(parsePropertyField('statgroup.explicit.stat_1')).toBeNull()
    expect(parsePropertyField('unknown_field')).toBeNull()
    expect(parsePropertyField(null)).toBeNull()
    expect(parsePropertyField('')).toBeNull()
  })
})

describe('resolvePropertyGroup', () => {
  it('poe2 gộp weapon + armour field vào equipment_filters', () => {
    expect(resolvePropertyGroup('damage', true)).toBe('equipment_filters')
    expect(resolvePropertyGroup('ar', true)).toBe('equipment_filters')
    expect(resolvePropertyGroup('spirit', true)).toBe('equipment_filters')
    expect(resolvePropertyGroup('rune_sockets', true)).toBe('equipment_filters')
  })

  it('poe1 tách weapon_filters và armour_filters, không dùng equipment_filters', () => {
    expect(resolvePropertyGroup('damage', false)).toBe('weapon_filters')
    expect(resolvePropertyGroup('aps', false)).toBe('weapon_filters')
    expect(resolvePropertyGroup('ar', false)).toBe('armour_filters')
    expect(resolvePropertyGroup('block', false)).toBe('armour_filters')
  })

  it('field tĩnh (type/req/misc) giống nhau ở cả hai game', () => {
    expect(resolvePropertyGroup('ilvl', false)).toBe('type_filters')
    expect(resolvePropertyGroup('ilvl', true)).toBe('type_filters')
    expect(resolvePropertyGroup('str', false)).toBe('req_filters')
    expect(resolvePropertyGroup('gem_level', true)).toBe('misc_filters')
  })

  it('field không xác định trả về null', () => {
    expect(resolvePropertyGroup('unknown_field', false)).toBeNull()
    expect(resolvePropertyGroup('unknown_field', true)).toBeNull()
  })
})

describe('parsePropertyValue', () => {
  it('lấy số khi giá trị đứng sau nhãn', () => {
    expect(parsePropertyValue('Armour: 331')).toBe(331)
    expect(parsePropertyValue('Energy Shield: 347')).toBe(347)
  })

  it('lấy số khi giá trị đứng trước nhãn', () => {
    expect(parsePropertyValue('54 Str')).toBe(54)
  })

  it('lấy số khi label không có dấu hai chấm', () => {
    expect(parsePropertyValue('Level 33')).toBe(33)
  })

  it('bỏ dấu % và + khi lấy số', () => {
    expect(parsePropertyValue('Quality: +20%')).toBe(20)
    expect(parsePropertyValue('Block chance: 25%')).toBe(25)
  })

  it('trả về null khi không có số', () => {
    expect(parsePropertyValue('Identified')).toBeNull()
  })
})

describe('planSetPropertyMin', () => {
  it('set min và xóa max đã có', () => {
    expect(planSetPropertyMin({ max: 500 }, 331)).toEqual({ min: 331 })
  })

  it('set min khi chưa có filter nào', () => {
    expect(planSetPropertyMin(undefined, 331)).toEqual({ min: 331 })
  })
})

describe('planSetPropertyMax', () => {
  it('set max bằng giá trị trên dòng và xóa min đã có', () => {
    expect(planSetPropertyMax({ min: 10 }, 331)).toEqual({ max: 331 })
  })

  it('set max khi chưa có filter nào', () => {
    expect(planSetPropertyMax(undefined, 0)).toEqual({ max: 0 })
  })
})
