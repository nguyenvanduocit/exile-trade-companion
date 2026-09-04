<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { i18n } from '#i18n'
import { X } from 'lucide-vue-next'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useFolderSync, type ShareKeyInspection } from '@/composables/useFolderSync'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const folderSync = useFolderSync()
const joinKey = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const inspection = shallowRef<ShareKeyInspection | null>(null)

watch(() => props.open, (isOpen) => {
  if (isOpen) return
  inspection.value?.leave()
  inspection.value = null
  joinKey.value = ''
  error.value = null
})

async function inspectKey() {
  const key = joinKey.value.trim()
  if (!key) return
  loading.value = true
  error.value = null
  try {
    const result = await folderSync.inspectShareKey(key)
    if (!result.ok) {
      error.value = i18n.t('folder.joinFailed')
      return
    }
    inspection.value = result.inspection
  } finally {
    loading.value = false
  }
}

function backToInput() {
  inspection.value?.leave()
  inspection.value = null
  error.value = null
}

async function confirmFork() {
  if (!inspection.value) return
  loading.value = true
  try {
    const result = await folderSync.confirmFork(inspection.value)
    inspection.value = null
    if (!result.ok) {
      error.value = i18n.t('folder.joinFailed')
      return
    }
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}

async function confirmJoin() {
  if (!inspection.value) return
  loading.value = true
  try {
    const result = await folderSync.confirmJoin(inspection.value)
    inspection.value = null
    if (!result.ok) {
      error.value = result.reason === 'already-joined' ? i18n.t('folder.joinAlreadyExists') : i18n.t('folder.joinFailed')
      return
    }
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <div class="flex items-center justify-between">
        <DialogTitle class="font-display text-[17px] text-cream">{{ i18n.t('folder.joinModalTitle') }}</DialogTitle>
        <DialogClose class="icon-btn" :aria-label="i18n.t('panel.closeLabel')">
          <X />
        </DialogClose>
      </div>

      <p v-if="loading" class="mt-3 px-1 py-6 text-center leading-5 text-dim">{{ i18n.t('folder.shareLoading') }}</p>

      <template v-else-if="!inspection">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.joinModalDesc') }}</p>
        <form class="mt-2 flex flex-col gap-2" @submit.prevent="inspectKey">
          <input
            v-model="joinKey"
            class="poe-input"
            :placeholder="i18n.t('folder.joinKeyPlaceholder')"
            :aria-label="i18n.t('folder.joinKeyInputLabel')"
            @input="error = null"
          >
          <p v-if="error" class="text-[12px] leading-4 text-danger">{{ error }}</p>
          <div class="flex justify-end gap-2">
            <DialogClose class="poe-btn" type="button">{{ i18n.t('folder.cancel') }}</DialogClose>
            <button class="poe-btn poe-btn-primary" type="submit" :disabled="!joinKey.trim()">{{ i18n.t('folder.joinContinue') }}</button>
          </div>
        </form>
      </template>

      <template v-else-if="inspection.mode === 'once'">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.joinOnceDetectedText') }}</p>
        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="backToInput">{{ i18n.t('folder.cancel') }}</button>
          <button class="poe-btn poe-btn-primary" type="button" @click="confirmFork">{{ i18n.t('folder.joinOnceConfirm') }}</button>
        </div>
      </template>

      <template v-else>
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.joinLiveDetectedText') }}</p>
        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="backToInput">{{ i18n.t('folder.cancel') }}</button>
          <button class="poe-btn" type="button" @click="confirmFork">{{ i18n.t('folder.fork') }}</button>
          <button class="poe-btn poe-btn-primary" type="button" @click="confirmJoin">{{ i18n.t('folder.join') }}</button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
