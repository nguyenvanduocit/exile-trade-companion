const JOIN_HASH_PREFIX = 'etc-join='

export function buildJoinHash(shareKey: string): string {
  return `#${JOIN_HASH_PREFIX}${encodeURIComponent(shareKey)}`
}

export function parseJoinHash(hash: string): string | null {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  if (!value.startsWith(JOIN_HASH_PREFIX)) return null
  const key = decodeURIComponent(value.slice(JOIN_HASH_PREFIX.length)).trim()
  return key ? key : null
}
