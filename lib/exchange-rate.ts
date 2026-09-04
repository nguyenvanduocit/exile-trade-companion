import type { CurrencyId } from '@/types/pricing'
import type { Game } from '@/types/trading'

interface ExchangeOffer {
  exchange: { currency: CurrencyId; amount: number }
  item: { currency: CurrencyId; amount: number }
}

interface ExchangeApiResponse {
  result?: Record<string, { listing?: { offers?: ExchangeOffer[] } }>
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function buildExchangeUrl(game: Game, league: string): string {
  const root = game === 'poe2' ? 'trade2' : 'trade'
  return `https://www.pathofexile.com/api/${root}/exchange/${encodeURIComponent(league)}`
}

export function buildExchangeBody(currencies: CurrencyId[]) {
  return {
    query: { status: { option: 'online' }, have: currencies, want: ['chaos'] },
    sort: { have: 'asc' },
  }
}

export function parseExchangeRatios(response: ExchangeApiResponse): Record<CurrencyId, number> {
  const byCurrency = new Map<CurrencyId, number[]>()

  for (const entry of Object.values(response.result ?? {})) {
    const offer = entry.listing?.offers?.[0]
    if (!offer || offer.item.currency !== 'chaos' || offer.exchange.amount <= 0) continue

    const ratio = offer.item.amount / offer.exchange.amount
    const list = byCurrency.get(offer.exchange.currency) ?? []
    list.push(ratio)
    byCurrency.set(offer.exchange.currency, list)
  }

  const rates: Record<CurrencyId, number> = {}
  for (const [currency, ratios] of byCurrency) {
    rates[currency] = median([...ratios].sort((a, b) => a - b))
  }
  return rates
}

export async function fetchExchangeRates(
  game: Game,
  league: string,
  currencies: CurrencyId[],
): Promise<Record<CurrencyId, number>> {
  if (!currencies.length) return {}

  const res = await fetch(buildExchangeUrl(game, league), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildExchangeBody(currencies)),
  })
  if (!res.ok) return {}

  const json = await res.json() as ExchangeApiResponse
  return parseExchangeRatios(json)
}
