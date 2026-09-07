import { describe, expect, it } from 'vitest'
import { buildShareHotlinkUrl } from './share-hotlink'

describe('buildShareHotlinkUrl', () => {
  it('builds a landing-page URL carrying the share key', () => {
    expect(buildShareHotlinkUrl('share_abc-123')).toBe('https://poe-trade.aiocean.io/?key=share_abc-123')
  })

  it('encodes special characters in the key', () => {
    expect(buildShareHotlinkUrl('share_a b')).toBe('https://poe-trade.aiocean.io/?key=share_a%20b')
  })
})
