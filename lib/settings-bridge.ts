// Isolated world (trade.content, có browser.storage) bắn TradeSettings mới nhất qua CustomEvent
// mỗi khi state đổi — MAIN world (trade-stats.content.ts, trade-properties.content.ts) không có
// browser.storage nên không tự đọc được settings, phải nghe event này để biết feature nào đang bật.
export const SETTINGS_EVENT = 'etc:settings'
