import type { CategoryMap } from './shelfLife';

/**
 * 내냉장고 「종류별로 묶기」 — 보관함(냉동·냉장·실온) 안을 재료 종류로 다시 나눈다 (2026-10-17).
 *
 * 사전 분류를 그대로 쓰지 않는 이유:
 *   사전 중분류 '식재료 원물' 은 고기와 채소를 한데 묶고, '양념/조미료' 는 소분류가 14가지라
 *   냉장고 칸으로 쓰기엔 하나는 너무 굵고 하나는 너무 잘다. 냉장고를 열었을 때 눈이 가는
 *   단위로 다시 정했다.
 *
 * 처음엔 8개 미만인 칸은 안 묶고, 한 개짜리 묶음은 「그 밖에」 로 합쳤다. 사용자가 개수와
 * 상관없이 다 묶어 달라고 했고(2026-10-17), 합치기 때문에 냉장고에 하나뿐인 과일(방울토마토)이
 * 「그 밖에」 로 밀려나 "분류가 틀렸다" 로 보였다 — 둘 다 없앴다. 한 개짜리 묶음도 그대로 둔다.
 *
 * 사전에서 같은 재료가 두 번 다른 분류로 올라 있던 18건(방울토마토↔토마토, 통깨↔참깨 등)은
 * 사전 자체를 맞췄다(scripts/unify_dictionary_categories_20261017.py) — 여기 예외 표는 두지 않는다.
 */

/**
 * 묶음 순서 — **고정**(매번 같은 자리에 있어야 찾는다). 사용자가 "엑셀 순서 같다, 다시 정할 필요
 * 없나"(2026-10-17) 해서 기준을 세웠다: 요리의 중심이 되는 재료 → 곁들이는 재료 → 그냥 먹는 것 →
 * 오래 두고 조금씩 쓰는 것. 특히 양념은 칸마다 가장 많은데(운영 실온 칸 180개 중 양념) 맨 위
 * 가까이 있으면 칸이 접혔을 때 정작 고기·채소가 가려져서 맨 뒤로 보냈다.
 */
export const FRIDGE_GROUPS = [
  '고기·해산물·달걀',
  '채소·버섯',
  '두부·콩·곡물·견과',
  '유제품',
  '과일',
  '간편식·반찬',
  '면·빵·가루',
  '양념·소스',
  '그 밖에',
] as const;
export type FridgeGroup = typeof FRIDGE_GROUPS[number];

export function groupOf(name: string, categoryMap: CategoryMap): FridgeGroup {
  const cat = categoryMap[name];
  if (!cat) return '그 밖에';
  const { mid, sub } = cat;
  if (mid === '식재료 원물') {
    if (sub === '육류/수산/달걀') return '고기·해산물·달걀';
    if (sub === '채소류' || sub === '버섯류') return '채소·버섯';
    if (sub === '과일류') return '과일';
    return '두부·콩·곡물·견과'; // 곡류·두류/콩류·견과/씨앗/고추류·기타 기능성
  }
  if (mid === '양념/조미료') return '양념·소스';
  if (mid === '유제품') return '유제품';
  if (mid === '즉석식/간편식') return '간편식·반찬';
  // 소면·밀가루·빵·떡 — 처음엔 「그 밖에」 였는데 운영 냉장고에서 그 밖에의 대부분이 이것이었다
  if (mid.startsWith('베이킹·제면·디저트용')) return '면·빵·가루';
  return '그 밖에'; // 음료·주류·얼음 등
}

/**
 * 칸 하나를 묶음으로 나눈다. 빈 묶음은 뺀다. 묶음 안의 순서는 받은 순서 그대로 —
 * 정렬은 부르는 쪽이 이미 해서 넘긴다.
 */
export function splitIntoGroups<T extends { name: string }>(
  items: T[], categoryMap: CategoryMap,
): { group: FridgeGroup; items: T[] }[] {
  const of = items.map(it => groupOf(it.name, categoryMap));
  return FRIDGE_GROUPS
    .map(g => ({ group: g, items: items.filter((_, i) => of[i] === g) }))
    .filter(x => x.items.length > 0);
}
