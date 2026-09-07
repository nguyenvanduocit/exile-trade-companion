// Logic thuần cho nút "+"/"-" trên dòng mod của kết quả trade.
// Site gắn data-field="stat.<section>.stat_<hash>" (hoặc "statgroup.…") lên mỗi dòng mod;
// store Vuex của site giữ Stat Filters ở state.persistent.stats[group].filters.

export interface StatFilterValue {
  id: string
  value: { min?: number; max?: number }
  disabled: boolean
}

export interface StatFilterEntry {
  id: string
  value?: { min?: number; max?: number }
  disabled?: boolean
}

export interface StatGroup {
  type: string
  // Group `count` (và `weight`) có min/max riêng: count với min 1 = "ít nhất một trong các filter".
  value?: { min?: number; max?: number }
  filters: StatFilterEntry[]
}

export type AddStatPlan =
  | { action: 'add'; group: number; value: StatFilterValue }
  | { action: 'add-group'; value: StatFilterValue }
  | { action: 'update'; group: number; index: number; value: StatFilterValue }
  | { action: 'exists'; group: number; index: number }

export function parseStatField(field: string | null | undefined): string | null {
  if (!field) return null
  if (field.startsWith('stat.')) return field.slice('stat.'.length)
  if (field.startsWith('statgroup.')) return field
  return null
}

export interface StatDefinition {
  text: string
  option?: unknown
}

export function parseStatValue(text: string, definition?: StatDefinition): number | null {
  if (definition?.option) return null
  const normalized = text.replaceAll('−', '-').trim()
  let values: number[]
  if (definition) {
    // Only # placeholders are rolls; digits in skill names and durations stay literal.
    const pattern = definition.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replaceAll('#', '([+-]?\\d+(?:\\.\\d+)?)').replace(/\s+/g, '\\s+')
    const expression = new RegExp(`^${pattern}$`, 'i')
    let match = normalized.match(expression)
    let sign = 1
    if (!match) {
      for (const [from, to] of [['reduced', 'increased'], ['increased', 'reduced'], ['less', 'more'], ['more', 'less']]) {
        const alternate = normalized.replace(new RegExp(`\\b${from}\\b`, 'i'), to!)
        const inverted = alternate.match(expression)
        if (inverted?.length === 2) {
          match = inverted
          sign = -1
          break
        }
      }
    }
    if (!match) return null
    values = match.slice(1).map((value) => sign * Number(value))
  } else {
    values = (normalized.match(/[+-]?\d+(?:\.\d+)?/g) ?? []).map(Number)
  }
  if (values.length === 1) return values[0]!
  // Trade compares flat damage ranges using the average of the two rolls.
  if (values.length === 2 && /[\d#]\s+to\s+[+\-]?[\d#].*\bdamage\b/i.test(normalized)) {
    return (values[0]! + values[1]!) / 2
  }
  return null
}

export function planAddStat(groups: StatGroup[], id: string, bounds?: StatFilterValue['value']): AddStatPlan {
  const value: StatFilterValue = { id, value: bounds ?? {}, disabled: false }
  const first = groups[0]
  if (!first) return { action: 'add-group', value }

  const index = first.filters.findIndex((filter) => filter.id === id)
  if (index >= 0) {
    if (!bounds) return { action: 'exists', group: 0, index }
    const preserved = { ...first.filters[index]?.value }
    delete preserved.min
    delete preserved.max
    return { action: 'update', group: 0, index, value: { ...first.filters[index], ...value, value: { ...preserved, ...bounds } } }
  }
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

// Id của mọi filter đang thực sự "đang search" trên toàn bộ group (and/not/weight…), dùng để
// highlight đúng dòng mod khớp Stat Filters hiện tại. filter.disabled=true nghĩa là user đã tắt
// điều kiện đó trong query, không tính là đang search dù vẫn còn nằm trong danh sách filters.
export function activeStatIds(groups: StatGroup[]): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const filter of group.filters) {
      if (!filter.disabled) ids.add(filter.id)
    }
  }
  return ids
}
