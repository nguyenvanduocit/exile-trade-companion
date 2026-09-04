<script setup lang="ts">
import { DialogContent, type DialogContentEmits, type DialogContentProps } from 'reka-ui'
import DialogOverlay from './DialogOverlay.vue'

defineProps<DialogContentProps>()
defineEmits<DialogContentEmits>()
</script>

<template>
  <DialogOverlay />
  <DialogContent
    v-bind="$props"
    class="fixed top-1/2 left-1/2 z-50 w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 border border-rule bg-raised p-4 shadow-lg shadow-black/50 outline-none"
    v-on="$attrs"
  >
    <slot />
  </DialogContent>
</template>
