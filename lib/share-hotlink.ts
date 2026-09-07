const SHARE_HOTLINK_BASE_URL = 'https://poe-trade.aiocean.io'

export function buildShareHotlinkUrl(shareKey: string): string {
  return `${SHARE_HOTLINK_BASE_URL}/?key=${encodeURIComponent(shareKey)}`
}
