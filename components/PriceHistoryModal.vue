<script setup lang="ts">
import { computed } from 'vue'
import { i18n } from '#i18n'
import { X } from 'lucide-vue-next'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import PriceHistoryChart from '@/components/PriceHistoryChart.vue'
import { useTradeStore } from '@/composables/useTradeStore'

const props = defineProps<{
  open: boolean
  queryId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useTradeStore()

const snapshots = computed(() => store.state.value.snapshots
  .filter((snapshot) => snapshot.queryId === props.queryId)
  .sort((a, b) => a.capturedAt - b.capturedAt))
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <div class="flex items-center justify-between">
        <DialogTitle class="font-display text-[17px] text-cream">{{ i18n.t('priceHistory.title') }}</DialogTitle>
        <DialogClose class="icon-btn" :aria-label="i18n.t('panel.closeLabel')">
          <X />
        </DialogClose>
      </div>
      <PriceHistoryChart :snapshots="snapshots" class="mt-3" />
    </DialogContent>
  </Dialog>
</template>
