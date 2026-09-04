import { createApp } from 'vue'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import App from './App.vue'
import cssText from './style.css?inline'

export default defineContentScript({
  matches: [
    'https://www.pathofexile.com/trade/*',
    'https://www.pathofexile.com/trade2/*',
    'https://pathofexile.com/trade/*',
    'https://pathofexile.com/trade2/*',
  ],
  runAt: 'document_idle',

  async main(ctx) {
    const badgeStyle = document.createElement('style')
    badgeStyle.dataset.exileTradeCompanion = 'hide-liveblocks-badge'
    badgeStyle.textContent = '#liveblocks-badge { display: none !important; }'
    document.head.append(badgeStyle)

    const ui = await createShadowRootUi(ctx, {
      name: 'exile-trade-companion',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      css: cssText,
      onMount(container) {
        const mountPoint = document.createElement('div')
        container.append(mountPoint)
        const app = createApp(App)
        app.mount(mountPoint)
        return app
      },
      onRemove(app) {
        app?.unmount()
      },
    })

    ui.mount()
  },
})
