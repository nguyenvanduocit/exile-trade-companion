export default defineContentScript({
  matches: [
    'https://poe-trade.aiocean.io/*',
  ],
  runAt: 'document_start',

  main() {
    document.documentElement.dataset.exileTradeCompanion = 'installed'
  },
})
