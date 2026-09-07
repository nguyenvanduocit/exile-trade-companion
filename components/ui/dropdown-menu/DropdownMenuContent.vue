<script setup lang="ts">
import { DropdownMenuContent, useForwardPropsEmits, type DropdownMenuContentEmits, type DropdownMenuContentProps } from 'reka-ui'

const props = withDefaults(defineProps<DropdownMenuContentProps>(), {
  align: 'end',
  sideOffset: 4,
})
const emit = defineEmits<DropdownMenuContentEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DropdownMenuContent
    v-bind="forwarded"
    class="z-50 min-w-[160px] overflow-hidden border border-rule bg-raised p-1 shadow-lg shadow-black/50"
  >
    <slot />
  </DropdownMenuContent>
</template>
