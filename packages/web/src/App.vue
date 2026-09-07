<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { enterFolderRoom } from 'shared/liveblocks-room'
import { isBlankFolderMeta, resolveShareMode, toSharedTradeQuery, type SharedFolderMeta, type SharedSearchFields } from 'shared/folder-sync-types'
import { buildDurableUrl } from 'shared/trade-url'
import { buildJoinHash } from 'shared/join-hash'
import ShareItemRow from 'shared/ShareItemRow.vue'
import { parseShareKeyFromLocation, resolveJoinGame, watchExtensionInstalled } from './share-page'

type DisplayItem = { id: string; title: string; note?: string; href: string | null }
type LoadState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'not-found' }
  | { status: 'config-error' }
  | { status: 'error' }
  | { status: 'ready'; meta: SharedFolderMeta; items: DisplayItem[] }

const shareKey = parseShareKeyFromLocation(window.location.search)
const chromeWebStoreUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL?.trim()
const installUrl = chromeWebStoreUrl || 'https://github.com/nguyenvanduocit/exile-trade-companion#cài-đặt'
const state = ref<LoadState>({ status: 'loading' })
const extensionInstalled = ref(false)
const joinUrl = ref<string | null>(null)
let stopWatchingExtension: (() => void) | undefined

async function load() {
  if (!shareKey) {
    state.value = { status: 'invalid' }
    return
  }
  if (!import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY) {
    state.value = { status: 'config-error' }
    return
  }

  let leave: (() => void) | undefined
  try {
    const roomEntry = enterFolderRoom(shareKey)
    leave = roomEntry.leave
    const { root } = await roomEntry.room.getStorage()
    const meta = root.get('folder').toJSON() as SharedFolderMeta

    if (isBlankFolderMeta(meta)) {
      state.value = { status: 'not-found' }
      return
    }

    const entries: [string, SharedSearchFields][] = [...root.get('searches').entries()]
      .map(([id, fields]) => [id, fields.toJSON() as SharedSearchFields])
    const items = await Promise.all(entries.map(async ([id, fields]) => ({
      id,
      title: fields.title,
      note: fields.note || undefined,
      href: await buildDurableUrl({
        url: fields.url,
        title: fields.title,
        game: fields.game,
        league: fields.league,
        mode: fields.mode,
        queryId: fields.queryId,
        query: toSharedTradeQuery(fields.query),
      }),
    })))

    const game = resolveJoinGame(entries.map(([, fields]) => fields))
    joinUrl.value = `https://www.pathofexile.com/${game === 'poe2' ? 'trade2' : 'trade'}/${buildJoinHash(shareKey)}`

    state.value = { status: 'ready', meta: { ...meta, mode: resolveShareMode(meta) }, items }
  } catch {
    state.value = { status: 'error' }
  } finally {
    leave?.()
  }
}

function retryLoad() {
  state.value = { status: 'loading' }
  joinUrl.value = null
  void load()
}

onMounted(() => {
  stopWatchingExtension = watchExtensionInstalled(document.documentElement, (installed) => {
    extensionInstalled.value = installed
  })
  void load()
})

onUnmounted(() => stopWatchingExtension?.())
</script>

<template>
  <main class="page">
    <h1 class="page__title">Exile Trade Companion</h1>

    <p v-if="state.status === 'loading'" class="page__message">Đang tải folder…</p>
    <p v-else-if="state.status === 'invalid'" class="page__message page__message--error">
      Link không hợp lệ — key bị thiếu hoặc sai định dạng.
    </p>
    <p v-else-if="state.status === 'not-found'" class="page__message page__message--error">
      Link đã hết hạn hoặc đã bị thu hồi. Hỏi người gửi share lại cho bạn.
    </p>
    <p v-else-if="state.status === 'config-error'" class="page__message page__message--error">
      Trang chia sẻ chưa được cấu hình Liveblocks. Vui lòng báo cho quản trị viên.
    </p>
    <div v-else-if="state.status === 'error'">
      <p class="page__message page__message--error">
        Không tải được dữ liệu chia sẻ. Kiểm tra kết nối mạng rồi thử lại.
      </p>
      <button class="page__retry-button" type="button" @click="retryLoad">Thử lại</button>
    </div>

    <template v-else-if="state.status === 'ready'">
      <div class="page__folder-header">
        <h2 class="page__folder-name">{{ state.meta.name }}</h2>
        <p v-if="state.meta.note" class="page__folder-note">{{ state.meta.note }}</p>
        <p class="page__folder-mode">
          {{ state.meta.mode === 'once' ? 'Bản chụp một lần' : 'Đang chia sẻ trực tiếp' }}
        </p>
      </div>

      <a v-if="extensionInstalled && joinUrl" :href="joinUrl" class="page__join-button">
        Mở trong extension
      </a>
      <a v-else :href="installUrl" target="_blank" rel="noopener noreferrer" class="page__install-banner">
        {{ chromeWebStoreUrl ? 'Cài Exile Trade Companion để đồng bộ trực tiếp folder này' : 'Xem hướng dẫn cài Exile Trade Companion' }}
      </a>

      <ShareItemRow v-for="item in state.items" :key="item.id" :title="item.title" :note="item.note" :href="item.href" />
    </template>
  </main>
</template>

<style>
html,
body,
#app {
  min-height: 100%;
  margin: 0;
  background: #1a1108;
}
</style>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: Verdana, Geneva, "DejaVu Sans", sans-serif;
  color: #e9cf9f;
  background: #1a1108;
  min-height: 100vh;
}
.page__title {
  font-size: 20px;
  margin-bottom: 16px;
}
.page__message {
  color: #9c8f7a;
}
.page__message--error {
  color: #d9534f;
}
.page__folder-header {
  margin-bottom: 12px;
}
.page__folder-name {
  font-size: 17px;
  font-weight: 600;
}
.page__folder-note {
  margin-top: 4px;
  font-size: 13px;
  color: #9c8f7a;
  white-space: pre-wrap;
}
.page__folder-mode {
  margin-top: 4px;
  font-size: 12px;
  color: #9c8f7a;
}
.page__join-button,
.page__install-banner {
  display: block;
  margin: 12px 0;
  padding: 10px 14px;
  text-align: center;
  border-radius: 4px;
  text-decoration: none;
  font-size: 14px;
}
.page__join-button {
  background: #c9a227;
  color: #1a1108;
  font-weight: 600;
}
.page__install-banner {
  border: 1px solid #3a2a12;
  color: #c9a227;
}
.page__retry-button {
  margin-top: 12px;
  padding: 8px 12px;
  border: 1px solid #c9a227;
  border-radius: 4px;
  color: #c9a227;
  background: transparent;
  cursor: pointer;
}
</style>
