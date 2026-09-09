import type { CurrencyId } from '@/types/pricing'
import type { Game } from '@/types/trading'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function buildExchangeUrl(game: Game, league: string): string {
  if (game !== 'poe1' && game !== 'poe2') throw new Error('Unsupported game')
  return `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=Currency`
}

// https://poe.ninja/docs/api: lines quote primary currency per item, while
// core.rates quotes units of each reference currency per primary currency.
export function parseExchangeRates(response: unknown): Record<CurrencyId, number> {
  if (!isRecord(response) || !isRecord(response.core)) return {}
  const core = response.core
  const primary = core.primary
  if (typeof primary !== 'string' || !primary) return {}

  const coreRates = isRecord(core.rates) ? core.rates : {}
  const chaosPerPrimary = primary === 'chaos' ? 1 : coreRates.chaos
  if (!isPositiveNumber(chaosPerPrimary)) return {}

  const rates = new Map<CurrencyId, number>()
  for (const line of Array.isArray(response.lines) ? response.lines : []) {
    if (!isRecord(line) || typeof line.id !== 'string' || !line.id || !isPositiveNumber(line.primaryValue)) continue
    const chaosPerUnit = line.primaryValue * chaosPerPrimary
    if (isPositiveNumber(chaosPerUnit)) rates.set(line.id, chaosPerUnit)
  }

  // Reference rates retain more precision than their rounded overview lines.
  for (const [currency, unitsPerPrimary] of Object.entries(coreRates)) {
    if (!currency || !isPositiveNumber(unitsPerPrimary)) continue
    const chaosPerUnit = chaosPerPrimary / unitsPerPrimary
    if (isPositiveNumber(chaosPerUnit)) rates.set(currency, chaosPerUnit)
  }
  rates.set(primary, chaosPerPrimary)
  rates.set('chaos', 1)
  return Object.fromEntries(rates)
}

export async function fetchExchangeRates(
  game: Game,
  league: string,
): Promise<Record<CurrencyId, number>> {
  try {
    if ((game !== 'poe1' && game !== 'poe2') || !league) return {}
    const options: RequestInit = {
      method: 'GET',
      credentials: 'omit',
      signal: AbortSignal.timeout(15_000),
    }
    const leagueResponse = await fetch(`https://poe.ninja/${game}/api/economy/leagues`, options)
    if (!leagueResponse.ok) return {}
    const leagues: unknown = await leagueResponse.json()
    if (!Array.isArray(leagues)) return {}
    const matchingLeague = leagues.filter(isRecord).find((entry) => typeof entry.id === 'string' && entry.id.length > 0
      && (entry.id === league || entry.name === league))
    if (!matchingLeague || typeof matchingLeague.id !== 'string') return {}

    const res = await fetch(buildExchangeUrl(game, matchingLeague.id), options)
    if (!res.ok) return {}
    return parseExchangeRates(await res.json())
  } catch {
    return {}
  }
}
