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
  const regex = new RegExp(escapeRegex(keyword), 'gi'); // i 플래그 추가 (대소문자 무시)
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;
  
  // 디버깅 로그
  console.log(`[키워드 매칭 상세] 텍스트: "${text.substring(0, 100)}..."`);
  console.log(`[키워드 매칭 상세] 키워드: "${keyword}"`);
  console.log(`[키워드 매칭 상세] 매치 결과:`, matches);
  console.log(`[키워드 매칭 상세] 매치 개수: ${count}`);
  
  return count;
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
  if (maxLack === 'unlimited') {
    console.log(`  [maxLack 필터] 레시피: "${recipe.title}", maxLack: unlimited -> 통과`);
    return true;
  }
  
  const lackCount = recipe.need_ingredients ? recipe.need_ingredients.length : 0;
  console.log(`  [maxLack 필터] 레시피: "${recipe.title}", maxLack: ${maxLack}, lackCount: ${lackCount}, need_ingredients:`, recipe.need_ingredients);
  
  if (maxLack === MAX_LACK_THRESHOLD) {
    const result = lackCount >= MAX_LACK_THRESHOLD;
    console.log(`  [maxLack 필터] 5개 이상 부족 조건: ${lackCount} >= ${MAX_LACK_THRESHOLD} = ${result}`);
    return result;
  }
  const result = lackCount <= maxLack;
  console.log(`  [maxLack 필터] 최대 ${maxLack}개 부족 조건: ${lackCount} <= ${maxLack} = ${result}`);
  return result;
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
  const matchCount = getKeywordMatchCount(text, keyword);
  console.log(`[필터링 디버그] 레시피: "${recipe.title}", 키워드: "${keyword}", 매칭 횟수: ${matchCount}`);
  return matchCount >= 2; // 최소 2번 이상 나타나야 매칭
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
  console.log(`[키워드 필터 시작] 함수 호출됨 - 레시피: "${recipe.title}"`);
  console.log(`[키워드 필터 시작] categoryKeywords:`, categoryKeywords);
  console.log(`[키워드 필터 시작] categoryKeywords 키 개수:`, Object.keys(categoryKeywords).length);
  
  if (Object.keys(categoryKeywords).length === 0) {
    console.log(`[키워드 필터 시작] 키워드가 비어있음 - true 반환`);
    return true;
  }
  
  const text = getRecipeText(recipe);
  console.log(`[키워드 필터] 레시피 "${recipe.title}" 검사 중...`);
  console.log(`[키워드 필터] 텍스트 길이: ${text.length}, 처음 100자: ${text.substring(0, 100)}`);
  
  return Object.entries(categoryKeywords).every(([category, keywords]) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return true;
    
    console.log(`[키워드 필터] 카테고리 "${category}"의 키워드들:`, keywords);
    
    return keywords.some(keywordObj => {
      const keyword = typeof keywordObj === 'string' 
        ? keywordObj 
        : (keywordObj as KeywordObject).keyword;
      
      if (!keyword) {
        console.warn(`[필터 경고] 키워드가 없습니다:`, keywordObj);
        return false;
      }
      
      const matchCount = getKeywordMatchCount(text, keyword);
      console.log(`[키워드 필터] "${keyword}" 매칭 횟수: ${matchCount} (최소 필요: 2)`);
      
      const isMatch = matchCount >= 2; // 최소 2번 이상 나타나야 매칭
      if (isMatch) {
        console.log(`[키워드 필터] ✅ "${keyword}" 매칭 성공 - 레시피: "${recipe.title}"`);
      }
      
      return isMatch;
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
  console.log('🔍 [filterRecipes 시작] 레시피 수:', recipes.length);
  console.log('Filter options:', options);
  console.log('Category Keywords:', options.categoryKeywords);
  console.log('Category Keywords keys:', Object.keys(options.categoryKeywords || {}));
  console.log('Category Keywords values:', Object.values(options.categoryKeywords || {}));
  
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
  
  console.log('Destructured categoryKeywords:', categoryKeywords);
  console.log('categoryKeywords type:', typeof categoryKeywords);
  console.log('categoryKeywords is empty?', Object.keys(categoryKeywords).length === 0);

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
  const sortedRecipes = sortRecipes(recipesWithMatch, sortType, myIngredients, appliedExpiryIngredients);
  console.log('🔍 [정렬 후] 레시피 수:', sortedRecipes.length);
  
  const filteredRecipes = sortedRecipes.filter(recipe => {
    console.log(`🔍 [필터링 시작] 레시피: "${recipe.title}"`);
    
    const matchRangeResult = filterByMatchRange(recipe, matchRange);
    console.log(`  - matchRange 결과: ${matchRangeResult}`);
    if (!matchRangeResult) return false;
    
    const lackCountResult = filterByLackCount(recipe, maxLack);
    console.log(`  - lackCount 결과: ${lackCountResult}`);
    if (!lackCountResult) return false;
    
    const expiryResult = filterByExpiryIngredients(recipe, appliedExpiryIngredients, expiryIngredientMode);
    console.log(`  - expiry 결과: ${expiryResult}`);
    if (!expiryResult) return false;
    
    const includeKeywordResult = filterByIncludeKeyword(recipe, includeKeyword);
    console.log(`  - includeKeyword 결과: ${includeKeywordResult}`);
    if (!includeKeywordResult) return false;
    
    const includeIngredientsResult = filterByIncludeIngredients(recipe, includeIngredients);
    console.log(`  - includeIngredients 결과: ${includeIngredientsResult}`);
    if (!includeIngredientsResult) return false;
    
    const excludeIngredientsResult = filterByExcludeIngredients(recipe, excludeIngredients);
    console.log(`  - excludeIngredients 결과: ${excludeIngredientsResult}`);
    if (!excludeIngredientsResult) return false;
    
    console.log(`  - 🔍 키워드 필터링 시작! categoryKeywords:`, categoryKeywords);
    const categoryKeywordsResult = filterByCategoryKeywords(recipe, categoryKeywords);
    console.log(`  - categoryKeywords 결과: ${categoryKeywordsResult}`);
    
    return categoryKeywordsResult;
  });
  
  console.log('🔍 [필터링 완료] 결과 레시피 수:', filteredRecipes.length);
  return filteredRecipes;
} 