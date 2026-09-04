export type CurrencyId = string

export interface PriceSnapshot {
  id: string
  queryId: string
  capturedAt: number
  sampleSize: number
  medianChaos: number
  averageChaos: number
}

export interface ExchangeRateCache {
  league: string
  fetchedAt: number
  rates: Record<CurrencyId, number>
}
