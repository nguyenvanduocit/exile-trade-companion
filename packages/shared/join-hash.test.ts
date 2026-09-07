import { describe, expect, it } from 'vitest'
import { buildJoinHash, parseJoinHash } from './join-hash'

describe('buildJoinHash / parseJoinHash', () => {
  it('round-trips a share key through the hash fragment', () => {
    const hash = buildJoinHash('share_abc-123')
    expect(hash).toBe('#etc-join=share_abc-123')
    expect(parseJoinHash(hash)).toBe('share_abc-123')
  })

  it('encodes and decodes special characters in the key', () => {
    const hash = buildJoinHash('share_a b/c')
    expect(parseJoinHash(hash)).toBe('share_a b/c')
  })

  it('returns null for a hash with the wrong prefix', () => {
    expect(parseJoinHash('#something-else=foo')).toBeNull()
  })

  it('returns null for an empty or missing hash', () => {
    expect(parseJoinHash('')).toBeNull()
    expect(parseJoinHash('#etc-join=')).toBeNull()
    expect(parseJoinHash('#etc-join=   ')).toBeNull()
  })

  it('accepts the hash with or without the leading #', () => {
    expect(parseJoinHash('etc-join=share_x')).toBe('share_x')
  })
})
