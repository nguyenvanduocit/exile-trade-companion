import { createApp } from 'vue'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import App from './App.vue'
import cssText from '../trade.content/style.css?inline'

export default defineContentScript({
  matches: ['https://poe.ninja/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'exile-ninja-companion',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      css: cssText,
      onMount(container) {
        const mountPoint = document.createElement('div')
        container.append(mountPoint)
        const app = createApp(App, { ctx })
        app.mount(mountPoint)
        return app
      },
      onRemove(app) { app?.unmount() },
    })
    ui.mount()
  },
})
