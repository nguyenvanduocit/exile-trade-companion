import { computed, ref } from 'vue'
import { useTradeStore } from '@/composables/useTradeStore'
import type { Placement } from '@/lib/bookmark-order'

type DragItem = { kind: 'folder' | 'search'; id: string }
const dragged = ref<DragItem | null>(null)
const target = ref<(DragItem & { placement: Placement | 'inside' }) | null>(null)

export function endBookmarkDrag() {
  dragged.value = null
  target.value = null
}

export function startBookmarkDrag(event: DragEvent, item: DragItem) {
  if (!event.dataTransfer) return
  dragged.value = item
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-exile-bookmark', JSON.stringify(item))
}

export function useBookmarkDrop(kind: DragItem['kind'], getId: () => string) {
  const store = useTradeStore()
  const placement = computed(() => target.value?.kind === kind && target.value.id === getId()
    ? target.value.placement : null)

  function accepts() {
    return dragged.value && !(dragged.value.kind === kind && dragged.value.id === getId())
      && (kind === 'folder' || dragged.value.kind === 'search')
  }

  function dragOver(event: DragEvent) {
    if (!accepts()) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    const element = event.currentTarget as HTMLElement
    const rect = element.getBoundingClientRect()
    target.value = {
      kind, id: getId(),
      placement: kind === 'folder' && dragged.value?.kind === 'search'
        ? 'inside' : event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
    }
    const scroll = element.closest('.trade-companion-scroll')
    if (scroll) {
      const bounds = scroll.getBoundingClientRect()
      if (event.clientY < bounds.top + 32) scroll.scrollTop -= 16
      else if (event.clientY > bounds.bottom - 32) scroll.scrollTop += 16
    }
  }

  function dragLeave(event: DragEvent) {
    const element = event.currentTarget as HTMLElement
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return
    if (placement.value) target.value = null
  }

  async function drop(event: DragEvent) {
    if (!accepts()) return
    dragOver(event)
    const source = dragged.value!
    const position = placement.value!
    endBookmarkDrag()
    if (source.kind === 'folder') {
      await store.moveFolder(source.id, getId(), position as Placement)
    } else if (kind === 'folder') {
      await store.moveSearch(source.id, getId())
    } else {
      const search = store.state.value.searches.find((entry) => entry.id === getId())
      if (search) await store.moveSearch(source.id, search.folderId, search.id, position as Placement)
    }
  }

  return { placement, dragOver, dragLeave, drop }
}
