<script setup lang="ts">
// Không khai báo defineEmits ở đây: "select" là event Vue custom, khai báo nó sẽ bị Vue loại khỏi
// $attrs (coi như component đã tự xử lý), nên v-on="$attrs" bên dưới sẽ KHÔNG forward @select xuống
// reka-ui được nữa — @select từ nơi gọi component này im lặng không bao giờ chạy. Để attrs fallthrough
// tự nhiên xử lý việc forward listener.
import { DropdownMenuItem, type DropdownMenuItemProps } from 'reka-ui'

defineProps<DropdownMenuItemProps>()
</script>

<template>
  <DropdownMenuItem
    v-bind="$props"
    class="flex cursor-pointer items-center gap-2 px-2.5 py-2 font-display text-[14px] text-cream outline-none select-none transition-colors hover:bg-hover focus-visible:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
    v-on="$attrs"
  >
    <slot />
  </DropdownMenuItem>
</template>
