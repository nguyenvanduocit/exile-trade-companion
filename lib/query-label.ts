// Suy ra nhãn mô tả món đồ đang search từ state Vuex + DOM của trade site.
// Ưu tiên: unique/item name > base type > rarity + category filter đang chọn > stat filter đầu tiên > cặp currency đang exchange.

export interface QueryLabelInput {
  name?: string | null
  type?: string | null
  rarityLabel?: string | null
  categoryLabel?: string | null
  statLabels?: string[]
  exchangeAlts?: string[]
}

function normalizeFilterValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed !== 'Any' ? trimmed : null
}

// DOM trade site hiện text stat filter dạng "#% increased Rarity of Items found" khi chưa nhập min/max
// (# là placeholder cho giá trị số) — bỏ token đó đi cho label đọc tự nhiên hơn.
function cleanStatText(text: string): string {
  return text.replace(/[+-]?#%?/g, '').replace(/\s{2,}/g, ' ').trim()
}

export function buildQueryLabel(input: QueryLabelInput): string | null {
  const name = input.name?.trim()
  if (name) return name

  const type = input.type?.trim()
  if (type) return type

  const rarity = normalizeFilterValue(input.rarityLabel)
  const category = normalizeFilterValue(input.categoryLabel)
  if (rarity && category) return `${rarity} ${category}`
  if (category) return category
  if (rarity) return rarity

  const [firstStat, ...restStats] = (input.statLabels ?? []).map(cleanStatText).filter(Boolean)
  if (firstStat) {
    return restStats.length ? `${firstStat} +${restStats.length}` : firstStat
  }

  const alts = [...new Set((input.exchangeAlts ?? []).map((alt) => alt.trim()).filter(Boolean))]
  if (alts.length) return alts.join(' ↔ ')

  return null
}
