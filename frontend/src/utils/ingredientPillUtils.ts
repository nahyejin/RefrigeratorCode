// 공통 pill/대체제 계산 함수 (세로형/가로형 카드 모두에서 사용)
export function getUniversalIngredientPillInfo({
  needIngredients,
  myIngredients,
  substituteTable,
}: {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string } };
}) {
  // 정규화 함수 - 앞뒤 공백만 제거하고 소문자로 변환
  const normalize = (s: string) => (s || '').trim().toLowerCase();

  const mySet = new Set(myIngredients.map(normalize));

  // substituteTable도 정규화된 키로 변환
  const normalizedSubTable: { [key: string]: { ingredient_b: string } } = {};
  Object.keys(substituteTable).forEach(key => {
    const normKey = normalize(key);
    normalizedSubTable[normKey] = { ingredient_b: normalize(substituteTable[key].ingredient_b) };
  });

  // 대체 가능한 재료 찾기
  let substituteTargets: string[] = [];
  let substitutes: string[] = [];

  // 먼저 내가 가진 재료 찾기
  const mine = needIngredients.filter(i => mySet.has(normalize(i)));
  const mineSet = new Set(mine.map(normalize));

  // 대체 가능한 재료 찾기
  needIngredients.forEach(needRaw => {
    const need = normalize(needRaw);
    if (mineSet.has(need)) return;

    // substituteTable의 키를 normalize해서 접근
    const originalKey = Object.keys(substituteTable).find(k => normalize(k) === need);
    const substituteInfo = originalKey ? substituteTable[originalKey] : undefined;
    if (substituteInfo && mySet.has(normalize(substituteInfo.ingredient_b))) {
      substituteTargets.push(needRaw);
      substitutes.push(`${needRaw}→${substituteInfo.ingredient_b}`);
    }
  });

  // 대체 가능한 재료 목록
  const substituteTargetsSet = new Set(substituteTargets.map(normalize));

  // 내가 없고 대체도 불가능한 재료
  const notMineNotSub = needIngredients.filter(i => {
    const norm = normalize(i);
    return !mySet.has(norm) && !substituteTargetsSet.has(norm);
  });

  const notMineSub = substituteTargets;
  const pills = [...notMineNotSub, ...notMineSub, ...mine];

  return {
    mine,
    notMineNotSub,
    notMineSub,
    substitutes,
    pills: [...notMineNotSub, ...notMineSub, ...mine],
  };
} 