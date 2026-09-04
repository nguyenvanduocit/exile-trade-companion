// Logic thuần cho nút "+" trên dòng mod của kết quả trade.
// Site gắn data-field="stat.<section>.stat_<hash>" (hoặc "statgroup.…") lên mỗi dòng mod;
// store Vuex của site giữ Stat Filters ở state.persistent.stats[group].filters.

export interface StatFilterValue {
  id: string
  value: Record<string, never>
  disabled: boolean
}

// Shape đầy đủ của một dòng filter đã tồn tại trong group (đọc từ state.persistent.stats) — khác
// StatFilterValue (chỉ dùng khi TẠO filter mới, value luôn rỗng), filter đã tồn tại có thể mang
// value {min,max} người dùng đã nhập.
export interface StatFilterEntry {
  id: string
  value?: { min?: number; max?: number }
  disabled?: boolean
}

export interface StatGroup {
  type: string
  filters: StatFilterEntry[]
}

export type AddStatPlan =
  | { action: 'add'; group: number; value: StatFilterValue }
  | { action: 'add-group'; value: StatFilterValue }
  | { action: 'exists'; group: number; index: number }

export function parseStatField(field: string | null | undefined): string | null {
  if (!field) return null
  if (field.startsWith('stat.')) return field.slice('stat.'.length)
  if (field.startsWith('statgroup.')) return field
  return null
}

export function planAddStat(groups: StatGroup[], id: string): AddStatPlan {
  const value: StatFilterValue = { id, value: {}, disabled: false }
  const first = groups[0]
  if (!first) return { action: 'add-group', value }

  const index = first.filters.findIndex((filter) => filter.id === id)
  if (index >= 0) return { action: 'exists', group: 0, index }
  return { action: 'add', group: 0, value }
}

// Nút "-" trên dòng mod: thêm vào group "not" ĐẦU TIÊN tìm thấy trong danh sách group hiện tại,
// tự tạo group "not" mới nếu chưa có group nào cùng type.
export function planAddStatNot(groups: StatGroup[], id: string): AddStatPlan {
  const value: StatFilterValue = { id, value: {}, disabled: false }
  const group = groups.find((group) => group.type === 'not')
  if (!group) return { action: 'add-group', value }

  const groupIndex = groups.indexOf(group)
  const index = group.filters.findIndex((filter) => filter.id === id)
  if (index >= 0) return { action: 'exists', group: groupIndex, index }
  return { action: 'add', group: groupIndex, value }
}
