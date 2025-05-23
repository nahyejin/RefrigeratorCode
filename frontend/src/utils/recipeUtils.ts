import { Recipe, RecipeMatchResult } from '../types/recipe';

/**
 * 냉장고 내 내 재료 목록을 localStorage에서 불러온다.
 */
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

/**
 * 내 재료와 레시피 재료를 비교해 매칭률(%)과 보유/부족 재료를 반환한다.
 */
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

/**
 * 레시피 리스트를 정렬 기준/임박재료 등으로 정렬한다.
 */
export function sortRecipes(recipes: Recipe[], sortType: string, myIngredients: string[], appliedExpiryIngredients: string[]): Recipe[] {
  const sorted = [...recipes];
  switch (sortType) {
    case 'latest':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'like':
      sorted.sort((a, b) => {
        const aLike = a.like_count ?? a.likes ?? a.like ?? 0;
        const bLike = b.like_count ?? b.likes ?? b.like ?? 0;
        return bLike - aLike;
      });
      break;
    case 'comment':
      sorted.sort((a, b) => {
        const aComment = a.comment_count ?? a.comments ?? a.comment ?? 0;
        const bComment = b.comment_count ?? b.comments ?? b.comment ?? 0;
        return bComment - aComment;
      });
      break;
    case 'match':
      sorted.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
      break;
    case 'expiry':
      // 임박재료활용도순 정렬: 임박재료를 많이 포함하는 레시피가 상위에 오도록 정렬
      sorted.sort((a, b) => {
        const aIngredients = (a.used_ingredients || '').split(',').map(i => i.trim());
        const bIngredients = (b.used_ingredients || '').split(',').map(i => i.trim());
        const aCount = appliedExpiryIngredients.filter(ing => aIngredients.includes(ing)).length;
        const bCount = appliedExpiryIngredients.filter(ing => bIngredients.includes(ing)).length;
        if (aCount !== bCount) {
          return bCount - aCount;
        }
        // 임박재료 활용도가 같으면 재료매칭률순으로 2차 정렬
        return (b.match_rate || 0) - (a.match_rate || 0);
      });
      break;
    default:
      sorted.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
  }
  return sorted;
}

/**
 * 유통기한 문자열을 받아 D-day 포맷 문자열로 반환한다.
 */
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

/**
 * need_ingredients 기준 pill/대체 가능 로직 공통 함수
 */
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

  return { pills, notMineNotSub, notMineSub, mine, substitutes };
}

/**
 * 카테고리명을 트리의 key로 변환한다.
 */
export function getDictCategoryKey(category: string): string {
  // 현재는 카테고리명이 트리의 key와 동일하다고 가정
  // 만약 변환이 필요하다면 아래에서 매핑 추가
  return category;
}

/**
 * 타입 정의 추가
 */
export interface FilterKeywordNode {
  keyword: string;
  synonyms: string[];
}
export interface FilterKeywordSubTree {
  [subCategory: string]: FilterKeywordNode[];
}
export interface FilterKeywordTree {
  [mainCategory: string]: FilterKeywordSubTree;
}

/**
 * 카테고리 키워드 트리에서 키워드와 동의어를 추출한다.
 */
export function extractKeywordsAndSynonyms(
  category: string,
  keywords: string[],
  tree: FilterKeywordTree | null
): string[] {
  const dictKey = getDictCategoryKey(category);
  if (!tree) return [];
  if (!tree[dictKey]) return [];
  const result: string[] = [];
  keywords.forEach(keyword => {
    if (!keyword) return;
    const node = Object.values(tree[dictKey] || {}).flat().find(
      (n: FilterKeywordNode) => n.keyword && n.keyword.trim().toLowerCase() === keyword.trim().toLowerCase()
    );
    if (node) {
      const pushed = [keyword.trim(), ...node.synonyms.map((s: string) => s.trim())];
      result.push(...pushed);
    }
  });
  return result;
} 