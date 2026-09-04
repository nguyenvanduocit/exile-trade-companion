<script setup lang="ts">
import { DropdownMenuContent, type DropdownMenuContentEmits, type DropdownMenuContentProps } from 'reka-ui'

const props = withDefaults(defineProps<DropdownMenuContentProps>(), {
  align: 'end',
  sideOffset: 4,
})
defineEmits<DropdownMenuContentEmits>()
</script>

<template>
  <DropdownMenuContent
    v-bind="props"
    class="z-50 min-w-[160px] overflow-hidden border border-rule bg-raised p-1 shadow-lg shadow-black/50"
    v-on="$attrs"
  >
    <slot />
  </DropdownMenuContent>
</template>
