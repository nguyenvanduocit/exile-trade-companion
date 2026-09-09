import { buildDurableUrl } from 'shared/trade-url'
import type { TradePage } from '@/types/trading'

export const DONATION_ACCOUNT = 'hopthuxacnhan#3062'

export function buildDonationTradeUrl(page: TradePage) {
  return buildDurableUrl({
    ...page,
    mode: 'search',
    query: {
      status: 'any',
      name: null,
      type: null,
      term: null,
      disc: null,
      stats: [],
      filters: {
        trade_filters: { filters: { account: { input: DONATION_ACCOUNT } } },
      },
      exchange: { want: {}, have: {} },
    },
  })
}
