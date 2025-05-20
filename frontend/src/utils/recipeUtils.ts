import { Recipe, RecipeMatchResult } from '../types/recipe';

export function getMyIngredients(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      const ingredients = [
        ...data.frozen,
        ...data.fridge,
        ...data.room
      ].map(i => (typeof i === 'string' ? i : i.name));
      return ingredients;
    }
  } catch (error) {
    // 에러는 콘솔에만 출력
  }
  return []; // 기본값을 빈 배열로 변경
}

export function calculateMatchRate(myIngredients: string[], recipeIngredients: string): RecipeMatchResult {
  const recipeSet = new Set(
    recipeIngredients
      .split(',')
      .map((i: string) => i.trim())
      .filter(Boolean)
  );
  const mySet = new Set(myIngredients);
  const matched = [...recipeSet].filter((i: string) => mySet.has(i));
  return {
    rate: Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet],
  };
}

export function sortRecipes(recipes: Recipe[], sortType: string, myIngredients: string[]): Recipe[] {
  const recipesWithMatch = recipes.map(recipe => {
    const match = calculateMatchRate(myIngredients, recipe.used_ingredients);
    return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
  });

  switch (sortType) {
    case 'match':
      return recipesWithMatch.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
    case 'expiry':
      // TODO: 유통기한 임박순 정렬 구현
      return recipesWithMatch;
    case 'latest':
      return recipesWithMatch.sort((a, b) => {
        const dateA = new Date((a.date as string) || '');
        const dateB = new Date((b.date as string) || '');
        return dateB.getTime() - dateA.getTime();
      });
    case 'like':
      return recipesWithMatch.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    case 'comment':
      return recipesWithMatch.sort((a, b) => (b.comments || 0) - (a.comments || 0));
    default:
      return recipesWithMatch;
  }
}

export function getDDay(expiry: string) {
  if (!expiry) return '';
  const today = new Date();
  const exp = new Date(expiry);
  if (isNaN(exp.getTime())) return expiry;
  const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / (1000*60*60*24));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${Math.abs(diff)}`;
}

// need_ingredients 기준 pill/대체 가능 로직 공통 함수
export function getIngredientPillInfo({
  needIngredients,
  myIngredients,
  substituteTable,
}: {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string } };
}) {
  // 정규화 함수 - 앞뒤 공백만 제거하고 소문자로 변환
  const normalize = (s: string) => s.trim().toLowerCase();
  
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
    // 이미 내가 가진 재료는 건너뛰기
    if (mineSet.has(need)) return;
    
    const substituteInfo = normalizedSubTable[need];
    if (substituteInfo && mySet.has(substituteInfo.ingredient_b)) {
      substituteTargets.push(needRaw);
      const displaySub = substituteTable[needRaw]?.ingredient_b || substituteInfo.ingredient_b;
      substitutes.push(`${needRaw}→${displaySub}`);
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

  // 디버깅을 위한 로그
  console.log('[getIngredientPillInfo] 상태', {
    needIngredients,
    myIngredients,
    mine,
    notMineNotSub,
    notMineSub,
    substitutes
  });

  return { pills, notMineNotSub, notMineSub, mine, substitutes };
} 