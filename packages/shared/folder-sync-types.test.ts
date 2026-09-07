import { describe, expect, it } from 'vitest'
import { isBlankFolderMeta, resolveShareMode } from './folder-sync-types'

describe('resolveShareMode', () => {
  it('trả "once" khi meta ghi rõ mode once', () => {
    expect(resolveShareMode({ mode: 'once' })).toBe('once')
  })

  it('trả "live" khi meta ghi rõ mode live', () => {
    expect(resolveShareMode({ mode: 'live' })).toBe('live')
  })

  it('mặc định "live" khi meta không có field mode (room share từ trước khi có tính năng này)', () => {
    expect(resolveShareMode({})).toBe('live')
  })
})

describe('isBlankFolderMeta', () => {
  it('true khi tên rỗng hoặc toàn khoảng trắng (room vừa được Liveblocks tự tạo lại, chưa có seed)', () => {
    expect(isBlankFolderMeta({ name: '' })).toBe(true)
    expect(isBlankFolderMeta({ name: '   ' })).toBe(true)
  })

  it('false khi có tên thật', () => {
    expect(isBlankFolderMeta({ name: 'Watchlist' })).toBe(false)
  })
})
