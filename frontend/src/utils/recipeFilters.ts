import { Recipe } from '../types/recipe';
import { sortRecipes, calculateMatchRate } from './recipeUtils';

// =====================
// 상수
// =====================

const MIN_KEYWORD_MATCH_COUNT = 2;
const MAX_LACK_THRESHOLD = 5;

// =====================
// 타입 정의
// =====================

export interface KeywordObject {
  keyword: string;
  synonyms?: string[];
}

export interface CategoryKeywords {
  효능?: (string | KeywordObject)[];
  영양분?: (string | KeywordObject)[];
  대상?: (string | KeywordObject)[];
  TPO?: (string | KeywordObject)[];
  스타일?: (string | KeywordObject)[];
}

export interface FilterOptions {
  sortType: string;
  matchRange: [number, number];
  maxLack: number | 'unlimited';
  appliedExpiryIngredients: string[];
  myIngredients: string[];
  expiryIngredientMode?: 'and' | 'or';
  includeKeyword?: string;
  includeIngredients?: string[];
  excludeIngredients?: string[];
  categoryKeywords?: CategoryKeywords;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * 정규식 특수문자 이스케이프 처리
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 레시피 텍스트에서 키워드 매칭 횟수 계산
 */
function getKeywordMatchCount(text: string, keyword: string): number {
  const regex = new RegExp(escapeRegex(keyword), 'g');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * 레시피의 전체 텍스트 생성 (제목 + 본문)
 */
function getRecipeText(recipe: Recipe): string {
  return `${recipe.title || ''} ${recipe.content || ''}`;
}

// =====================
// 필터 조건 함수들
// =====================

/**
 * 매칭률 범위 필터
 */
function filterByMatchRange(recipe: Recipe, matchRange: [number, number]): boolean {
  const matchRate = recipe.match_rate ?? 0;
  return matchRate >= matchRange[0] && matchRate <= matchRange[1];
}

/**
 * 부족 재료 개수 필터
 */
function filterByLackCount(recipe: Recipe, maxLack: number | 'unlimited'): boolean {
  if (maxLack === 'unlimited') return true;
  
  const lackCount = recipe.need_ingredients ? recipe.need_ingredients.length : 0;
  
  if (maxLack === MAX_LACK_THRESHOLD) {
    return lackCount >= MAX_LACK_THRESHOLD;
  }
  return lackCount <= maxLack;
}

/**
 * 임박재료 필터
 */
function filterByExpiryIngredients(
  recipe: Recipe,
  appliedExpiryIngredients: string[],
  expiryIngredientMode: 'and' | 'or'
): boolean {
  if (appliedExpiryIngredients.length === 0) return true;
  
  const usedIngredients = recipe.used_ingredients || '';
  const recipeIngredients = (typeof usedIngredients === 'string' 
    ? usedIngredients.split(',')
    : usedIngredients
  ).map((i: string) => i.trim());
  
  if (expiryIngredientMode === 'and') {
    return appliedExpiryIngredients.every(ing => recipeIngredients.includes(ing));
  }
  return appliedExpiryIngredients.some(ing => recipeIngredients.includes(ing));
}

/**
 * 포함 키워드 필터
 */
function filterByIncludeKeyword(recipe: Recipe, includeKeyword: string): boolean {
  if (!includeKeyword || includeKeyword.trim() === '') return true;
  
  const text = getRecipeText(recipe);
  const keyword = includeKeyword.trim();
  return text.includes(keyword);
}

/**
 * 포함 재료 필터
 */
function filterByIncludeIngredients(recipe: Recipe, includeIngredients: string[]): boolean {
  if (includeIngredients.length === 0) return true;
  
  const text = getRecipeText(recipe);
  return includeIngredients.every(ing => {
    const matchCount = getKeywordMatchCount(text, ing);
    return matchCount >= MIN_KEYWORD_MATCH_COUNT;
  });
}

/**
 * 카테고리 키워드 필터
 */
function filterByCategoryKeywords(recipe: Recipe, categoryKeywords: CategoryKeywords): boolean {
  if (Object.keys(categoryKeywords).length === 0) return true;
  
  const text = getRecipeText(recipe);
  
  return Object.entries(categoryKeywords).every(([category, keywords]) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return true;
    
    return keywords.some(keywordObj => {
      const keyword = typeof keywordObj === 'string' 
        ? keywordObj 
        : (keywordObj as KeywordObject).keyword;
      
      if (!keyword) {
        console.warn(`[필터 경고] 키워드가 없습니다:`, keywordObj);
        return false;
      }
      
      const matchCount = getKeywordMatchCount(text, keyword);
      
      // "주말" 키워드에 대한 로그 추가 - 매칭된 경우에만 로그 출력
      if (keyword === '주말' && matchCount >= MIN_KEYWORD_MATCH_COUNT) {
        console.log(`[주말 키워드 매칭 성공] ID: ${recipe.id}, 제목: ${recipe.title}`);
      }
      
      return matchCount >= MIN_KEYWORD_MATCH_COUNT;
    });
  });
}

/**
 * 제외 재료 필터
 */
function filterByExcludeIngredients(recipe: Recipe, excludeIngredients: string[]): boolean {
  if (excludeIngredients.length === 0) return true;
  
  const text = getRecipeText(recipe);
  return excludeIngredients.every(ing => {
    const matchCount = getKeywordMatchCount(text, ing);
    return matchCount < MIN_KEYWORD_MATCH_COUNT;
  });
}

// =====================
// 메인 필터 함수
// =====================

/**
 * 레시피 목록을 다양한 조건으로 필터링한다.
 */
export function filterRecipes(recipes: Recipe[], options: FilterOptions): Recipe[] {
  console.log('[filterRecipes] 호출', options.categoryKeywords);
  
  const {
    sortType,
    matchRange,
    maxLack,
    appliedExpiryIngredients,
    myIngredients,
    expiryIngredientMode = 'or',
    includeKeyword = '',
    includeIngredients = [],
    excludeIngredients = [],
    categoryKeywords = {}
  } = options;

  // 각 레시피에 match_rate, my_ingredients, need_ingredients 추가
  const recipesWithMatch = recipes.map(recipe => {
    const match = calculateMatchRate(myIngredients, recipe.used_ingredients || '');
    return {
      ...recipe,
      match_rate: match.rate,
      my_ingredients: match.my_ingredients,
      need_ingredients: match.need_ingredients,
    };
  });

  // 정렬 후 필터링
  return sortRecipes(recipesWithMatch, sortType, myIngredients, appliedExpiryIngredients)
    .filter(recipe => {
      return (
        filterByMatchRange(recipe, matchRange) &&
        filterByLackCount(recipe, maxLack) &&
        filterByExpiryIngredients(recipe, appliedExpiryIngredients, expiryIngredientMode) &&
        filterByIncludeKeyword(recipe, includeKeyword) &&
        filterByIncludeIngredients(recipe, includeIngredients) &&
        filterByExcludeIngredients(recipe, excludeIngredients) &&
        filterByCategoryKeywords(recipe, categoryKeywords)
      );
    });
} 