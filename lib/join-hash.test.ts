import { describe, expect, it } from 'vitest'
import { parseJoinHash } from './join-hash'

describe('parseJoinHash (extension re-export)', () => {
  it('parses a join hash', () => {
    expect(parseJoinHash('#etc-join=share_abc')).toBe('share_abc')
  })

  it('returns null for an unrelated hash', () => {
    expect(parseJoinHash('#foo')).toBeNull()
  })

  it('returns null for malformed percent encoding', () => {
    expect(parseJoinHash('#etc-join=%E0%A4%A')).toBeNull()
  })
})
