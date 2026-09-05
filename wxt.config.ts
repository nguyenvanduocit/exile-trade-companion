import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/i18n/module'],
  // dev và build cùng ghi vào .output/chrome-mv3, load unpacked một chỗ duy nhất.
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'vi',
    // Không có entrypoint popup nên WXT không tự sinh field `action` — khai báo tay để trình duyệt
    // cấp API `action` (Chrome MV3) / `browser_action` (Firefox MV2, WXT tự backfill từ field này)
    // cho toolbar icon, nếu không `browser.action`/`browser.browserAction` sẽ undefined lúc runtime.
    action: {},
    permissions: ['storage', 'activeTab', 'contextMenus'],
    host_permissions: ['https://api.liveblocks.io/*', 'wss://api.liveblocks.io/*'],
    commands: {
      'toggle-trade-companion': {
        suggested_key: {
          default: 'Alt+Shift+B',
          mac: 'Alt+Shift+B',
        },
        description: '__MSG_commandToggleDescription__',
      },
    },
  },
})
