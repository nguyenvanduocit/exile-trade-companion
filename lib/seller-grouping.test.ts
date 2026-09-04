import { describe, expect, it } from 'vitest'
import { groupBySeller } from './seller-grouping'

function fakeRow(seller: string) {
  return { el: {} as Element, seller }
}

describe('groupBySeller', () => {
  it('counts a single item per seller as 1', () => {
    const counts = groupBySeller([fakeRow('Alice#1111'), fakeRow('Bob#2222')])
    expect(counts.get('Alice#1111')).toBe(1)
    expect(counts.get('Bob#2222')).toBe(1)
  })

  it('counts repeated listings from the same seller', () => {
    const counts = groupBySeller([
      fakeRow('Trivene#2406'),
      fakeRow('KosmosUnlimited#6108'),
      fakeRow('Trivene#2406'),
      fakeRow('KosmosUnlimited#6108'),
      fakeRow('KosmosUnlimited#6108'),
    ])
    expect(counts.get('Trivene#2406')).toBe(2)
    expect(counts.get('KosmosUnlimited#6108')).toBe(3)
  })

  it('returns an empty map for no rows', () => {
    expect(groupBySeller([]).size).toBe(0)
  })
})
