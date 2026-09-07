import { createApp, toRaw, watch } from 'vue'
import { track } from '@/lib/track'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import { useTradeStore } from '@/composables/useTradeStore'
import { onMessage as onWindowMessage, sendMessage as sendWindowMessage } from '@/lib/window-messaging'
import { PRICE_LABEL_CLASS, PRICE_LABEL_ICON_CLASS, PRICE_LABELED_ATTR } from '@/lib/price-labels'
import { BULK_SELLER_BADGE_CLASS, BULK_SELLER_ROW_CLASS } from '@/composables/useSellerGrouping'
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

    // Nhãn quy đổi chèn thẳng vào trong [data-field="price"] của trang (light DOM, ngoài shadow
    // root nên không thấy biến CSS trên :host). Font/màu kế thừa từ dòng giá của site nên nhãn
    // luôn khớp chữ "5×" bên cạnh; icon vẽ đúng cỡ 18px + vertical-align middle như icon của site.
    // Dòng giá là flex item co giãn theo cột bên cạnh (IGN dài thì cột giá bị ép hẹp) — nowrap để
    // nhãn không rớt xuống dòng riêng.
    const priceLabelStyle = document.createElement('style')
    priceLabelStyle.dataset.exileTradeCompanion = 'price-labels'
    priceLabelStyle.textContent = `[${PRICE_LABELED_ATTR}] { white-space: nowrap; } .${PRICE_LABEL_CLASS} { margin-left: 4px; } .${PRICE_LABEL_ICON_CLASS} { height: 18px; width: 18px; vertical-align: middle; }`
    document.head.append(priceLabelStyle)

    // Cùng lý do như price-labels ở trên: đánh dấu row/badge nằm ngoài shadow root nên phải
    // style bằng giá trị cứng thay vì biến CSS (--bronze-strong, --cream) khai báo trên :host.
    const bulkSellerStyle = document.createElement('style')
    bulkSellerStyle.dataset.exileTradeCompanion = 'bulk-seller-grouping'
    // box-shadow inset thay vì border-left: trang trade đã có sẵn rule border trên .row, cùng
    // specificity (một class) thì thắng-thua phụ thuộc thứ tự nạp CSS — verify sống 2026-09-05 cho
    // thấy border-left của mình bị site đè trên một phần row dù cùng selector. box-shadow là
    // property riêng, không đụng rule border của site nên luôn thắng.
    bulkSellerStyle.textContent = `.${BULK_SELLER_ROW_CLASS} { box-shadow: inset 3px 0 0 0 #8a6a3a; } .${BULK_SELLER_BADGE_CLASS} { margin-left: 6px; padding: 0 5px; font: 11px/1.6 Verdana, Geneva, "DejaVu Sans", sans-serif; color: #fff8e1; background: #8a6a3a; border-radius: 3px; white-space: nowrap; }`
    document.head.append(bulkSellerStyle)

    const store = useTradeStore()
    await store.init()
    const publishSettings = () => void sendWindowMessage('settingsUpdated', toRaw(store.state.value.settings)).catch(() => undefined)
    const stopSettingsRequests = onWindowMessage('settingsRequested', publishSettings)
    ctx.onInvalidated(stopSettingsRequests)
    watch(
      () => store.state.value.settings,
      // MAIN world (trade-stats.content.ts, trade-properties.content.ts) không có browser.storage —
      // bắn broadcast qua window-messaging (window.postMessage, structuredClone payload) mỗi khi
      // settings đổi thay vì để chúng tự đọc storage. toRaw bắt buộc: settings là Vue 3 reactive
      // Proxy, structuredClone (dùng nội bộ bởi @webext-core/messaging) throw DataCloneError trên
      // Proxy — lỗi bị .catch() nuốt âm thầm nên broadcast không bao giờ tới nơi (verify sống
      // 2026-09-05: PoC structuredClone(new Proxy(...)) tái tạo đúng DataCloneError).
      publishSettings,
      { immediate: true, deep: true },
    )

    const ui = await createShadowRootUi(ctx, {
      name: 'exile-trade-companion',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      css: cssText,
      onMount(container) {
        const mountPoint = document.createElement('div')
        container.append(mountPoint)
        const app = createApp(App, { ctx })
        app.config.errorHandler = (error) => {
          track('ui.error', { message: String(error instanceof Error ? error.message : error).slice(0, 200) })
          console.error(error)
        }
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
