import { describe, expect, it } from 'vitest'
import { parseTradeUrl } from './trade-url'

describe('parseTradeUrl', () => {
  it('parses a Path of Exile 1 search', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade/search/Allflame/abc123', 'Convoking Wand - Path of Exile Trade')).toMatchObject({
      game: 'poe1',
      league: 'Allflame',
      mode: 'search',
      queryId: 'abc123',
      title: 'Convoking Wand',
    })
  })

  it('parses a Path of Exile 2 exchange', () => {
    expect(parseTradeUrl('https://www.pathofexile.com/trade2/exchange/poe2/Standard/xyz')).toMatchObject({
      game: 'poe2',
      league: 'Standard',
      mode: 'exchange',
      queryId: 'xyz',
    })
  })

  it('rejects lookalike and non-trade URLs', () => {
    expect(parseTradeUrl('https://pathofexile.example/trade/search/Standard/abc')).toBeNull()
    expect(parseTradeUrl('https://www.pathofexile.com/account/view-profile/foo')).toBeNull()
  })
})
