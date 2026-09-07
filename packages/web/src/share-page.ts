import type { Game } from 'shared/types'

export function parseShareKeyFromLocation(search: string): string | null {
  const params = new URLSearchParams(search)
  const key = params.get('key')?.trim()
  return key?.startsWith('share_') && key.length > 'share_'.length ? key : null
}

export function resolveJoinGame(entries: Array<{ game: Game }>): Game {
  return entries[0]?.game ?? 'poe1'
}

// Content-script marker (entrypoints/share-marker.content.ts) chạy runAt:'document_start' nhưng
// thứ tự chạy so với module này không đảm bảo tuyệt đối giữa các trình duyệt — check ngay lập tức
// rồi quan sát thêm một khoảng ngắn qua MutationObserver trước khi kết luận "không có extension".
export function watchExtensionInstalled(root: HTMLElement, onChange: (installed: boolean) => void, timeoutMs = 1500): () => void {
  if (root.dataset.exileTradeCompanion === 'installed') {
    onChange(true)
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (root.dataset.exileTradeCompanion === 'installed') {
      onChange(true)
      cleanup()
    }
  })
  observer.observe(root, { attributes: true, attributeFilter: ['data-exile-trade-companion'] })

  const timer = setTimeout(cleanup, timeoutMs)

  function cleanup() {
    observer.disconnect()
    clearTimeout(timer)
  }

  return cleanup
}
