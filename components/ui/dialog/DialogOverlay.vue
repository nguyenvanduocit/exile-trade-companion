<script setup lang="ts">
import { DialogOverlay, type DialogOverlayProps } from 'reka-ui'

defineProps<DialogOverlayProps>()
</script>

<template>
  <DialogOverlay v-bind="$props" class="fixed inset-0 z-50 bg-black/70" />
</template>
