export type Game = 'poe1' | 'poe2'
export type TradeMode = 'search' | 'exchange'

export interface SharedStatGroupLike {
  filters: unknown[]
}

export interface SharedTradeQuery {
  status: string
  name: string | null
  type: string | null
  term: string | null
  disc: string | null
  stats: SharedStatGroupLike[]
  filters: Record<string, unknown>
  exchange: {
    want: Record<string, unknown>
    have: Record<string, unknown>
  }
}

export interface SharedTradePage {
  url: string
  title: string
  game: Game
  league: string
  mode: TradeMode
  queryId?: string
  query?: SharedTradeQuery
}

export interface SharedResolvedSearch extends SharedTradePage {
  id: string
  folderId: string
  note: string
  createdAt: number
  updatedAt: number
}
