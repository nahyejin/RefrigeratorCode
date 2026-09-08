import { calculateMatchRate } from './recipeUtils';

/**
 * 이 레시피에서 "내 냉장고에 없고, 대체할 것도 없는" 재료 목록.
 *
 * RecipeCard 안에만 있던 계산을 꺼내 온 것이다.
 * 목록(캐러셀)에서도 같은 판단이 필요해졌기 때문 —
 * 어떤 카드 뒤에 광고 카드를 끼울지, 무슨 재료로 끼울지 정하려면
 * 카드 밖에서도 부족 재료를 알아야 한다.
 */
export function getLackingIngredients(
  recipe: { used_ingredients?: string | string[] },
  myIngredients: string[],
  substituteTable?: Record<string, { ingredient_b: string }[]> | null,
  synonymDict?: Record<string, string> | null
): string[] {
  const match = calculateMatchRate(
    myIngredients,
    Array.isArray(recipe.used_ingredients)
      ? recipe.used_ingredients.join(',')
      : recipe.used_ingredients || '',
    synonymDict || undefined
  );

  if (!match.need_ingredients || match.need_ingredients.length === 0) return [];

  const normalize = (s: string) => (s || '').trim().toLowerCase();
  const mySet = new Set(myIngredients.map(normalize));

  return match.need_ingredients.filter((ing: string) => {
    const normIng = normalize(ing);
    if (!substituteTable) return true;

    const originalKey = Object.keys(substituteTable).find(k => normalize(k) === normIng);
    const substituteList = originalKey ? substituteTable[originalKey] : undefined;
    if (substituteList && Array.isArray(substituteList)) {
      // 냉장고에 대체할 재료가 있으면 "부족" 으로 보지 않는다
      if (substituteList.some(sub => mySet.has(normalize(sub.ingredient_b)))) return false;
    }
    return true;
  });
}

/** 광고를 끼울 수 있는 부족 재료 개수의 위쪽 한계 */
export const AD_MAX_LACKING = 5;

/**
 * 광고 카드에 쓸 재료를 고른다.
 *
 * 부족 재료가 0개면 광고에 쓸 재료 자체가 없고, 너무 많으면 "몇 개만 사면
 * 완성" 이 아니라 "이 레시피는 무리" 에 가까워 구매로 이어지지 않는다.
 * 그래서 부족 재료가 **1~5개**인 카드 뒤에만 광고를 끼운다.
 *
 * 처음에는 1~3개였다. 그런데 실제 목록을 재 보니 그 범위가 너무 좁았다 —
 * 재료 12개를 넣은 사용자 기준으로 상위 40건 중
 *
 *     매칭률순(냉장고요리 기본 정렬)   광고 가능  0 / 40   (전부 부족 0개)
 *     최신순                        광고 가능  8 / 40
 *
 * 이었다. **가장 많이 보는 화면에서 광고가 하나도 안 붙는다.** 매칭률순은
 * 위에서부터 다 갖춘 레시피가 오므로 구조적으로 그렇게 된다.
 * 5개로 넓히면 같은 표본에서 8 -> 14건이 된다.
 *
 * 고르는 방식은 레시피 id 기반이라 같은 목록을 다시 그려도 결과가 바뀌지 않는다.
 * (매번 달라지면 스크롤할 때마다 광고가 바뀌어 어수선하다)
 */
export function pickAdIngredient(lacking: string[], seed: number): string | null {
  if (lacking.length === 0 || lacking.length > AD_MAX_LACKING) return null;
  return lacking[Math.abs(seed) % lacking.length];
}
