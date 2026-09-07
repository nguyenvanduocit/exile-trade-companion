<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { i18n } from '#i18n'
import { Check, X } from 'lucide-vue-next'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useTradeStore } from '@/composables/useTradeStore'
import { FOLDER_COLORS } from '@/lib/storage'
import type { SearchFolder } from '@/types/trading'

const props = defineProps<{
  open: boolean
  /** Có folder là chế độ sửa; không có là chế độ tạo. */
  folder?: SearchFolder
  /** Màu mặc định khi tạo mới (cha tính theo palette). */
  defaultColor?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useTradeStore()
const name = ref('')
const color = ref<string>(FOLDER_COLORS[0])
const note = ref('')
const saving = ref(false)
const saveError = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => Boolean(props.folder))
const isCustomColor = computed(() => !FOLDER_COLORS.includes(color.value as (typeof FOLDER_COLORS)[number]))

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  name.value = props.folder?.name ?? ''
  color.value = props.folder?.color ?? props.defaultColor ?? FOLDER_COLORS[0]
  note.value = props.folder?.note ?? ''
  saveError.value = false
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
})

async function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || saving.value) return
  saving.value = true
  saveError.value = false
  try {
    const input = { name: trimmed, color: color.value, note: note.value }
    if (props.folder) await store.updateFolder(props.folder.id, input)
    else await store.createFolder(input)
    emit('update:open', false)
  } catch {
    saveError.value = true
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <div class="flex items-center justify-between">
        <DialogTitle class="font-display text-[17px] text-cream">
          {{ isEdit ? i18n.t('folder.editModalTitle') : i18n.t('folder.createModalTitle') }}
        </DialogTitle>
        <DialogClose class="icon-btn" :aria-label="i18n.t('panel.closeLabel')">
          <X />
        </DialogClose>
      </div>

      <form class="mt-3 flex flex-col gap-3" @submit.prevent="submit">
        <label class="flex flex-col gap-1">
          <span class="text-[12px] leading-4 text-tan">{{ i18n.t('folder.nameLabel') }}</span>
          <input
            ref="nameInputRef"
            v-model="name"
            class="poe-input"
            maxlength="32"
            :placeholder="i18n.t('folder.namePlaceholder')"
          >
        </label>

        <div class="flex flex-col gap-1">
          <span class="text-[12px] leading-4 text-tan">{{ i18n.t('folder.colorLabel') }}</span>
          <div class="flex flex-wrap items-center gap-2" role="radiogroup" :aria-label="i18n.t('folder.colorLabel')">
            <button
              v-for="swatch in FOLDER_COLORS"
              :key="swatch"
              class="size-6 border-2 transition-colors"
              :class="color === swatch ? 'border-cream' : 'border-transparent hover:border-tan'"
              :style="{ backgroundColor: swatch }"
              type="button"
              role="radio"
              :aria-checked="color === swatch"
              :aria-label="swatch"
              @click="color = swatch"
            />
            <label
              class="relative size-6 cursor-pointer border-2"
              :class="isCustomColor ? 'border-cream' : 'border-transparent hover:border-tan'"
              :style="{ backgroundColor: isCustomColor ? color : undefined }"
              :title="i18n.t('folder.customColor')"
            >
              <span v-if="!isCustomColor" class="absolute inset-0 bg-[conic-gradient(#e67e80,#d4a64a,#8ccf7e,#70a5dc,#d290e4,#e67e80)]" />
              <input
                v-model="color"
                class="absolute inset-0 size-full cursor-pointer opacity-0"
                type="color"
                :aria-label="i18n.t('folder.customColor')"
              >
            </label>
          </div>
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-[12px] leading-4 text-tan">{{ i18n.t('folder.noteLabel') }}</span>
          <textarea
            v-model="note"
            class="poe-input h-auto min-h-16 resize-y px-2 py-1 leading-4"
            rows="3"
            :placeholder="i18n.t('folder.notePlaceholder')"
          />
        </label>

        <p v-if="saveError" role="alert" class="text-[12px] leading-4 text-danger">{{ i18n.t('folder.saveFailed') }}</p>

        <div class="flex justify-end gap-2">
          <DialogClose class="poe-btn" type="button">{{ i18n.t('folder.cancel') }}</DialogClose>
          <button class="poe-btn poe-btn-primary" type="submit" :disabled="!name.trim() || saving">
            <Check /> {{ isEdit ? i18n.t('folder.save') : i18n.t('folder.create') }}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
