import { describe, expect, it } from 'vitest'
import { resolveEditedTitle } from './edit-title'

describe('resolveEditedTitle', () => {
  it('trả về giá trị mới đã trim khi user nhập title hợp lệ', () => {
    expect(resolveEditedTitle('Old Title', '  New Title  ')).toBe('New Title')
  })

  it('giữ nguyên title cũ khi user xoá trắng rồi submit', () => {
    expect(resolveEditedTitle('Old Title', '   ')).toBe('Old Title')
  })

  it('giữ nguyên title cũ khi giá trị mới rỗng hoàn toàn', () => {
    expect(resolveEditedTitle('Old Title', '')).toBe('Old Title')
  })
})
