// Logic thuần cho nút "+"/"-" trên dòng attribute (Armour, Quality, Block, Runic Ward,
// Requirements...) của item trong kết quả trade. Khác với mod (stat-filter.ts), site gắn
// data-field="<field>" KHÔNG prefix lên các dòng property này; field trùng khớp trực tiếp với
// key trong store Vuex ở state.persistent.filters[group].filters[field] = {min?, max?}.
//
// Field id + group xác nhận 2026-09-04 bằng cách intercept store.commit('setPropertyFilter',
// {group, index, value}) khi gõ tay vào từng ô min/max trên sidebar filter — data-field trên item
// trùng 100% với field id đó (đã verify trực tiếp: ar, ev, block, ilvl, quality, es, lvl, str, dex,
// int; các field còn lại suy ra cùng schema, chưa gặp item mẫu để verify từng cái).
//
// POE1 (/trade/) và POE2 (/trade2/) KHÔNG cùng schema group cho weapon/armour: POE2 gộp chung
// "Equipment Filters" (group `equipment_filters`), POE1 tách "Weapon Filters" (`weapon_filters`)
// và "Armour Filters" (`armour_filters`) — group id không tồn tại thì site throw
// "Unknown filter group: <id>" khi commit setPropertyFilter.

export interface PropertyFilterValue {
  min?: number
  max?: number
}

const STATIC_FIELD_GROUPS: Record<string, string> = {
  ilvl: 'type_filters',
  quality: 'type_filters',
  lvl: 'req_filters',
  str: 'req_filters',
  dex: 'req_filters',
  int: 'req_filters',
  gem_level: 'misc_filters',
  gem_sockets: 'misc_filters',
  area_level: 'misc_filters',
  stack_size: 'misc_filters',
}

const WEAPON_FIELDS = new Set(['damage', 'aps', 'crit', 'dps', 'pdps', 'edps', 'reload_time'])
const ARMOUR_FIELDS = new Set(['ar', 'ev', 'es', 'ward', 'block', 'spirit', 'rune_sockets'])

export function parsePropertyField(field: string | null | undefined): string | null {
  if (!field) return null
  return field in STATIC_FIELD_GROUPS || WEAPON_FIELDS.has(field) || ARMOUR_FIELDS.has(field) ? field : null
}

// isPoe2 xác định theo tradeRoot ('/trade2/' vs '/trade/') — xem lib/trade-url.ts.
export function resolvePropertyGroup(field: string, isPoe2: boolean): string | null {
  if (field in STATIC_FIELD_GROUPS) return STATIC_FIELD_GROUPS[field] ?? null
  if (isPoe2) return WEAPON_FIELDS.has(field) || ARMOUR_FIELDS.has(field) ? 'equipment_filters' : null
  if (WEAPON_FIELDS.has(field)) return 'weapon_filters'
  if (ARMOUR_FIELDS.has(field)) return 'armour_filters'
  return null
}

// Lấy số đầu tiên trong text hiển thị của dòng, đúng cho mọi thứ tự nhãn/giá trị site dùng:
// "Armour: 331" · "Quality: +20%" · "Level 33" · "54 Str".
export function parsePropertyValue(text: string): number | null {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

// Mutation setPropertyFilter GHI ĐÈ nguyên object {min,max} chứ không merge — phải tự giữ lại
// nhánh còn lại (max khi set min, min khi set max) để không xoá mất filter đã set trước đó.
export function planSetPropertyMin(existing: PropertyFilterValue | undefined, value: number): PropertyFilterValue {
  return { ...existing, min: value }
}

export function planSetPropertyMaxZero(existing: PropertyFilterValue | undefined): PropertyFilterValue {
  return { ...existing, max: 0 }
}
