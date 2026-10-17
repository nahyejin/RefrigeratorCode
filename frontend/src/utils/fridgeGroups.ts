import type { CategoryMap } from './shelfLife';

/**
 * 내냉장고 「종류별로 묶기」 — 보관함(냉동·냉장·실온) 안을 재료 종류로 다시 나눈다 (2026-10-17).
 *
 * 사전 분류를 그대로 쓰지 않는 이유:
 *   사전 중분류 '식재료 원물' 은 고기와 채소를 한데 묶고, '양념/조미료' 는 소분류가 14가지라
 *   냉장고 칸으로 쓰기엔 하나는 너무 굵고 하나는 너무 잘다. 냉장고를 열었을 때 눈이 가는
 *   단위로 8묶음을 다시 정했다. 순서는 **고정** — 매번 같은 자리에 있어야 찾는다.
 *
 * 운영 데이터(2026-10-17): 냉장고 재료 553개 전부가 사전에 있어 「그 밖에」 로 새는 것은 거의 없다.
 */

export const FRIDGE_GROUPS = [
  '고기·해산물·달걀',
  '채소·버섯',
  '과일',
  '두부·콩·곡물·견과',
  '유제품',
  '양념·소스',
  '반찬·간편식',
  '그 밖에',
] as const;
export type FridgeGroup = typeof FRIDGE_GROUPS[number];

/** 이 개수보다 적은 칸은 켜 두어도 묶지 않는다 — 몇 개 안 되는데 칸을 나누면 오히려 찾기 어렵다. */
export const GROUP_MIN_ITEMS = 8;

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
  if (mid === '즉석식/간편식') return '반찬·간편식';
  return '그 밖에'; // 베이킹·음료 등
}

/**
 * 칸 하나를 묶음으로 나눈다. 빈 묶음은 뺀다. 하나짜리 묶음은 「그 밖에」 로 합친다
 * (한 개만 든 칸이 줄줄이 생기면 묶은 의미가 없다). 묶음 안의 순서는 받은 순서 그대로 —
 * 정렬은 부르는 쪽이 이미 해서 넘긴다.
 * `null` 이면 묶지 말라는 뜻(재료가 적다).
 */
export function splitIntoGroups<T extends { name: string }>(
  items: T[], categoryMap: CategoryMap,
): { group: FridgeGroup; items: T[] }[] | null {
  if (items.length < GROUP_MIN_ITEMS) return null;
  const raw = items.map(it => groupOf(it.name, categoryMap));
  const count = new Map<FridgeGroup, number>();
  raw.forEach(g => count.set(g, (count.get(g) || 0) + 1));
  // 하나뿐인 묶음은 「그 밖에」 로. 원래 순서(= 고른 정렬)를 지키려고 재료마다 최종 묶음을 정한 뒤 거른다.
  const final = raw.map(g => (count.get(g)! > 1 ? g : '그 밖에'));
  return FRIDGE_GROUPS
    .map(g => ({ group: g, items: items.filter((_, i) => final[i] === g) }))
    .filter(x => x.items.length > 0);
}
