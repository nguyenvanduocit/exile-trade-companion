<script setup lang="ts">
import { i18n } from '#i18n'
import { Info } from 'lucide-vue-next'

const model = defineModel<number>({ required: true })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <label class="flex min-w-0 items-center gap-3 text-[12px] text-tan">
    <span class="flex shrink-0 items-center gap-1 tabular-nums">
      {{ i18n.t('folder.importNinjaRollsMin', { percent: model }) }}
      <span :title="i18n.t('folder.importNinjaRollsHint')"><Info class="size-3" /></span>
    </span>
    <input v-model.number="model" type="range" min="0" max="100" step="1" :disabled="disabled"
      :aria-label="i18n.t('folder.importNinjaRolls')" :aria-valuetext="`${model}%`"
      :title="i18n.t('folder.importNinjaRollsHint')" :style="{ '--roll-fill': `${model}%` }"
      class="import-roll-slider min-w-0 flex-1">
  </label>
</template>
