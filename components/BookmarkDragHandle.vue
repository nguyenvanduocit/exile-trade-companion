<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next'
import { endBookmarkDrag, startBookmarkDrag } from '@/composables/useBookmarkDrag'

defineProps<{ kind: 'folder' | 'search'; id: string; label: string }>()
</script>

<template>
  <span
    class="inline-grid w-4 shrink-0 cursor-grab place-items-center self-stretch text-dim hover:text-cream active:cursor-grabbing"
    draggable="true"
    :title="label"
    :aria-label="label"
    @dragstart.stop="startBookmarkDrag($event, { kind, id })"
    @dragend.stop="endBookmarkDrag"
  ><GripVertical class="size-3.5" /></span>
</template>
