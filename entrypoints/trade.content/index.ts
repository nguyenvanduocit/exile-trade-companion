import { createApp, watch } from 'vue'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import { useTradeStore } from '@/composables/useTradeStore'
import { SETTINGS_EVENT } from '@/lib/settings-bridge'
import { PRICE_LABEL_CLASS } from '@/lib/price-labels'
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

    // Nhãn quy đổi chèn thẳng vào light DOM của trang trade — nằm ngoài shadow root nên không
    // thấy được biến CSS (--bronze, --tan...) khai báo trên :host, phải style bằng giá trị cứng.
    const priceLabelStyle = document.createElement('style')
    priceLabelStyle.dataset.exileTradeCompanion = 'price-labels'
    priceLabelStyle.textContent = `.${PRICE_LABEL_CLASS} { margin-left: 6px; font: 13px/1.4 Verdana, Geneva, "DejaVu Sans", sans-serif; color: #a38d6d; white-space: nowrap; }`
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
    watch(
      () => store.state.value.settings,
      // CustomEvent#detail dạng object bị trình duyệt null hoá khi băng qua ranh giới MAIN/ISOLATED
      // world của content script thật (verify bằng CDP isolated world 2026-09-05, khác CDP tự tạo
      // isolated world dùng cho devtools/automation) — string thì qua nguyên vẹn. Bắn JSON string,
      // bên nghe (trade-stats.content.ts, trade-properties.content.ts) tự JSON.parse lại.
      (settings) => window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: JSON.stringify(settings) })),
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
