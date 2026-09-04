import { i18n } from '#i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(timestamp: number, now = Date.now()) {
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < MINUTE) return i18n.t('time.justNow')
  if (elapsed < HOUR) return i18n.t('time.minutesAgo', [String(Math.floor(elapsed / MINUTE))])
  if (elapsed < DAY) return i18n.t('time.hoursAgo', [String(Math.floor(elapsed / HOUR))])
  if (elapsed < 7 * DAY) return i18n.t('time.daysAgo', [String(Math.floor(elapsed / DAY))])
  return new Date(timestamp).toLocaleDateString()
}

export function pageLabel(page: { game: 'poe1' | 'poe2'; league: string; mode: 'search' | 'exchange' }) {
  const game = page.game === 'poe2' ? 'PoE2' : 'PoE1'
  const mode = page.mode === 'exchange' ? ` (${i18n.t('tradeUrl.exchange')})` : ''
  return `${game} - ${page.league}${mode}`
}
