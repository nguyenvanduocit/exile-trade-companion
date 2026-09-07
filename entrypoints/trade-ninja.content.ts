// Chạy trong MAIN world để với tới window.app.static_ — catalog stat và item của trade site, luôn
// đúng patch và đúng game của tab (/trade = POE1, /trade2 = POE2). Phục vụ modal import build
// (isolated world): map mod text sang trade stat id, và tra base cho item PoB không có dòng base.
import { flattenStatCatalog, matchStatLines } from '@/lib/ninja-import'
import { resolveBaseType } from '@/lib/pob-import'
import { onNinjaMessage } from '@/lib/window-messaging'
import type { TradeApp } from '@/lib/trade-app'

export default defineContentScript({
  matches: [
    'https://www.pathofexile.com/trade/*',
    'https://www.pathofexile.com/trade2/*',
    'https://pathofexile.com/trade/*',
    'https://pathofexile.com/trade2/*',
  ],
  world: 'MAIN',
  runAt: 'document_idle',

  main() {
    onNinjaMessage('matchNinjaStats', ({ data: lines }) => {
      const flat = (window.app as TradeApp | undefined)?.static_?.knownStatsFlat
      if (!flat) throw new Error('catalog-unavailable')
      return matchStatLines(flattenStatCatalog(flat), lines)
    })
    onNinjaMessage('resolveItemBases', ({ data: typeLines }) => {
      const groups = (window.app as TradeApp | undefined)?.static_?.knownItems
      if (!groups) throw new Error('catalog-unavailable')
      const bases = [...new Set(groups.flatMap((group) => group.entries.map((entry) => entry.type)))]
      return typeLines.map((typeLine) => resolveBaseType(typeLine, bases))
    })
  },
})
