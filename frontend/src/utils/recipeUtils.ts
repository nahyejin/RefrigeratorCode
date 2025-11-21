import { Recipe, RecipeMatchResult } from '../types/recipe';

// =====================
// 상수 및 유틸리티 함수
// =====================

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * 문자열 정규화: 앞뒤 공백 제거 + 소문자 변환
 */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

// =====================
// 타입 정의
// =====================

export interface SubstituteTable {
  [key: string]: { ingredient_b: string };
}

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

// =====================
// 주요 함수
// =====================

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
  return [];
}

/**
 * 내 재료와 레시피 재료를 비교해 매칭률(%)과 보유/부족 재료를 반환한다.
 */
export function calculateMatchRate(myIngredients: string[], recipeIngredients: string | string[]): RecipeMatchResult {
  const recipeArr = Array.isArray(recipeIngredients)
    ? recipeIngredients
    : recipeIngredients.split(',');
  const recipeList = recipeArr.map((i: string) => i.trim()).filter(Boolean);
  const recipeSet = new Set(recipeList);
  
  // 정규화된 비교를 위한 Set 생성
  const mySet = new Set(myIngredients.map(i => normalize(i)));
  
  // 매칭된 재료와 부족한 재료 분리 (원본 재료명 유지)
  const matched: string[] = [];
  const needIngredients: string[] = [];
  
  recipeList.forEach(ingredient => {
    const normalized = normalize(ingredient);
    if (mySet.has(normalized)) {
      matched.push(ingredient);
    } else {
      needIngredients.push(ingredient);
    }
  });
  
  return {
    rate: recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: needIngredients, // 부족한 재료만 반환 (원본 재료명 유지)
  };
}

/**
 * 레시피 리스트를 정렬 기준/임박재료 등으로 정렬한다.
 */
export function sortRecipes(
  recipes: Recipe[],
  sortType: string,
  myIngredients: string[],
  appliedExpiryIngredients: string[]
): Recipe[] {
  const sorted = [...recipes];
  switch (sortType) {
    case 'latest':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'like':
      sorted.sort((a, b) => {
        const aLike = a.like_count ?? a.likes ?? 0;
        const bLike = b.like_count ?? b.likes ?? 0;
        return bLike - aLike;
      });
      break;
    case 'comment':
      sorted.sort((a, b) => {
        const aComment = a.comment_count ?? a.comments ?? 0;
        const bComment = b.comment_count ?? b.comments ?? 0;
        return bComment - aComment;
      });
      break;
    case 'hits':
      sorted.sort((a, b) => {
        // 플랫폼별 분리 정렬: 유튜브(인플루언서)는 hits 기준, 네이버는 likes 기준
        const aPlatform = a.platform || '';
        const bPlatform = b.platform || '';
        
        // 유튜브(인플루언서) 플랫폼인지 확인
        const aIsYoutube = aPlatform.includes('youtube');
        const bIsYoutube = bPlatform.includes('youtube');
        
        // 둘 다 유튜브인 경우 hits로 정렬
        if (aIsYoutube && bIsYoutube) {
          const aHits = a.hits || 0;
          const bHits = b.hits || 0;
          return bHits - aHits;
        }
        
        // 둘 다 네이버인 경우 likes로 정렬
        if (!aIsYoutube && !bIsYoutube) {
          const aLike = a.like_count ?? a.likes ?? 0;
          const bLike = b.like_count ?? b.likes ?? 0;
          return bLike - aLike;
        }
        
        // 유튜브가 네이버보다 우선 (유튜브가 위로)
        if (aIsYoutube && !bIsYoutube) return -1;
        if (!aIsYoutube && bIsYoutube) return 1;
        
        // 기본값
        return 0;
      });
      break;
    case 'match':
      sorted.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
      break;
    case 'expiry':
      sorted.sort((a, b) => {
        // 임박재료가 선택되지 않은 경우 매칭률순으로 정렬
        if (appliedExpiryIngredients.length === 0) {
          return (b.match_rate || 0) - (a.match_rate || 0);
        }
        
        const aIngredients = Array.isArray(a.used_ingredients)
          ? a.used_ingredients.map(i => (typeof i === 'string' ? i.trim() : ''))
          : (typeof a.used_ingredients === 'string' ? a.used_ingredients.split(',').map(i => i.trim()) : []);
        const bIngredients = Array.isArray(b.used_ingredients)
          ? b.used_ingredients.map(i => (typeof i === 'string' ? i.trim() : ''))
          : (typeof b.used_ingredients === 'string' ? b.used_ingredients.split(',').map(i => i.trim()) : []);
        
        // 임박재료 포함 개수 계산
        const aCount = appliedExpiryIngredients.filter(ing => aIngredients.includes(ing)).length;
        const bCount = appliedExpiryIngredients.filter(ing => bIngredients.includes(ing)).length;
        
        // 임박재료 개수가 다르면 임박재료가 많은 순으로 정렬
        if (aCount !== bCount) {
          return bCount - aCount;
        }
        
        // 임박재료 개수가 같으면 매칭률순으로 정렬
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
export function getDDay(expiry: string): string {
  if (!expiry) return '';
  const today = new Date();
  const exp = new Date(expiry);
  if (isNaN(exp.getTime())) return expiry;
  const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / MS_PER_DAY);
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
  substituteTable: SubstituteTable;
}) {
  const mySet = new Set(myIngredients.map(normalize));

  // substituteTable도 정규화된 키로 변환
  const normalizedSubTable: SubstituteTable = {};
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
  return category;
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