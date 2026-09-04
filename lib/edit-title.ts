export function resolveEditedTitle(current: string, next: string): string {
  const trimmed = next.trim()
  return trimmed || current
}
