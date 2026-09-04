<script setup lang="ts">
import { ref, watch } from 'vue'
import { i18n } from '#i18n'
import { Copy, RefreshCw, Share2, X } from 'lucide-vue-next'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useFolderSync } from '@/composables/useFolderSync'
import type { SearchFolder } from '@/types/trading'

const props = defineProps<{
  open: boolean
  folder: SearchFolder
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const folderSync = useFolderSync()
const loading = ref(false)
const onceKey = ref<string | null>(null)

watch(() => props.open, (isOpen) => {
  if (!isOpen) onceKey.value = null
})

async function startLiveSharing() {
  loading.value = true
  try {
    await folderSync.shareFolderLive(props.folder.id)
  } finally {
    loading.value = false
  }
}

async function startOnceSharing() {
  loading.value = true
  try {
    onceKey.value = await folderSync.shareFolderOnce(props.folder.id) ?? null
  } finally {
    loading.value = false
  }
}

async function rotateKey() {
  loading.value = true
  try {
    await folderSync.rotateShareKey(props.folder.id)
  } finally {
    loading.value = false
  }
}

async function stopSharing() {
  loading.value = true
  try {
    await folderSync.stopSharing(props.folder.id)
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}

function closeOnceResult() {
  onceKey.value = null
  emit('update:open', false)
}

async function copyKey(key: string) {
  await navigator.clipboard.writeText(key)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <div class="flex items-center justify-between">
        <DialogTitle class="font-display text-[17px] text-cream">
          {{ folder.shareKey ? i18n.t('folder.shareSettings') : i18n.t('folder.share') }}
        </DialogTitle>
        <DialogClose class="icon-btn" :aria-label="i18n.t('panel.closeLabel')">
          <X />
        </DialogClose>
      </div>

      <p v-if="loading" class="mt-3 px-1 py-6 text-center leading-5 text-dim">{{ i18n.t('folder.shareLoading') }}</p>

      <template v-else-if="folder.shareKey">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareActiveText') }}</p>
        <div class="mt-2 flex items-center gap-2">
          <input class="poe-input flex-1" readonly :value="folder.shareKey" :aria-label="i18n.t('folder.shareKeyLabel')">
          <button class="icon-btn" type="button" :aria-label="i18n.t('folder.copyShareKey')" @click="copyKey(folder.shareKey!)">
            <Copy />
          </button>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button class="poe-btn" type="button" @click="rotateKey">
            <RefreshCw /> {{ i18n.t('folder.rotateShareKey') }}
          </button>
          <button class="poe-btn text-danger" type="button" @click="stopSharing">
            {{ i18n.t('folder.stopSharing') }}
          </button>
        </div>
      </template>

      <template v-else-if="onceKey">
        <p class="mt-3 text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareOnceResultText') }}</p>
        <div class="mt-2 flex items-center gap-2">
          <input class="poe-input flex-1" readonly :value="onceKey" :aria-label="i18n.t('folder.shareKeyLabel')">
          <button class="icon-btn" type="button" :aria-label="i18n.t('folder.copyShareKey')" @click="copyKey(onceKey)">
            <Copy />
          </button>
        </div>
        <div class="mt-3 flex justify-end">
          <button class="poe-btn poe-btn-primary" type="button" @click="closeOnceResult">{{ i18n.t('folder.done') }}</button>
        </div>
      </template>

      <template v-else>
        <div class="mt-3 flex flex-col gap-3">
          <div>
            <p class="text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareLiveDesc') }}</p>
            <button class="poe-btn poe-btn-primary mt-2 w-full" type="button" @click="startLiveSharing">
              <Share2 /> {{ i18n.t('folder.shareLive') }}
            </button>
          </div>
          <div>
            <p class="text-[13px] leading-5 text-grey">{{ i18n.t('folder.shareOnceDesc') }}</p>
            <button class="poe-btn mt-2 w-full" type="button" @click="startOnceSharing">
              {{ i18n.t('folder.shareOnce') }}
            </button>
          </div>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
