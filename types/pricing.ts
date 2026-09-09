import type { Game } from './trading'

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
  // Legacy imports omit these fields and must be refreshed before use.
  game?: Game
  source?: 'poe.ninja'
  league: string
  fetchedAt: number
  rates: Record<CurrencyId, number>
}
