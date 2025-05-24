import { Recipe } from '../types/recipe';
import { sortRecipes } from './recipeUtils';
import { calculateMatchRate } from './recipeUtils';

interface KeywordObject {
  keyword: string;
  synonyms?: string[];
}

interface FilterOptions {
  sortType: string;
  matchRange: [number, number];
  maxLack: number | 'unlimited';
  appliedExpiryIngredients: string[];
  myIngredients: string[];
  expiryIngredientMode?: 'and' | 'or';
  includeKeyword?: string;
  includeIngredients?: string[];
  excludeIngredients?: string[];
  categoryKeywords?: {
    효능?: (string | KeywordObject)[];
    영양분?: (string | KeywordObject)[];
    대상?: (string | KeywordObject)[];
    TPO?: (string | KeywordObject)[];
    스타일?: (string | KeywordObject)[];
  };
}

export function filterRecipes(recipes: Recipe[], options: FilterOptions): Recipe[] {
  console.log('[filterRecipes] 호출', options.categoryKeywords);
  const {
    sortType, matchRange, maxLack, appliedExpiryIngredients, myIngredients, expiryIngredientMode = 'or',
    includeKeyword = '', includeIngredients = [], excludeIngredients = [], categoryKeywords = {}
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

  return sortRecipes(recipesWithMatch, sortType, myIngredients, appliedExpiryIngredients).filter(recipe => {
    // 매칭률 필터
    const matchRate = recipe.match_rate ?? 0;
    const inMatchRange = matchRate >= matchRange[0] && matchRate <= matchRange[1];
    
    // 부족 개수 필터
    const lackCount = recipe.need_ingredients ? recipe.need_ingredients.length : 0;
    let lackOk = true;
    if (maxLack !== 'unlimited') {
      if (maxLack === 5) {
        lackOk = lackCount >= 5;
      } else {
        lackOk = lackCount <= maxLack;
      }
    }
    
    // 임박재료 필터
    let expiryOk = true;
    if (appliedExpiryIngredients.length > 0) {
      const recipeIngredients = (recipe.used_ingredients || '').split(',').map(i => i.trim());
      if (expiryIngredientMode === 'and') {
        expiryOk = appliedExpiryIngredients.every(ing => recipeIngredients.includes(ing));
      } else {
        expiryOk = appliedExpiryIngredients.some(ing => recipeIngredients.includes(ing));
      }
    }

    // 꼭 포함할 키워드(제목/본문)
    let includeKeywordOk = true;
    if (includeKeyword && includeKeyword.trim() !== '') {
      const keyword = includeKeyword.trim();
      const text = (recipe.title || '') + ' ' + (recipe.content || '');
      includeKeywordOk = text.includes(keyword);
    }

    // 꼭 포함할 재료
    let includeIngredientsOk = true;
    if (includeIngredients.length > 0) {
      const text = (recipe.title || '') + ' ' + (recipe.content || '');
      includeIngredientsOk = includeIngredients.every(ing => {
        const regex = new RegExp(ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = text.match(regex);
        return (matches ? matches.length : 0) >= 2;
      });
    }

    // 카테고리 키워드 필터
    let categoryKeywordsOk = true;
    if (Object.keys(categoryKeywords).length > 0) {
      const text = (recipe.title || '') + ' ' + (recipe.content || '');
      categoryKeywordsOk = Object.entries(categoryKeywords).every(([category, keywords]) => {
        if (!Array.isArray(keywords) || keywords.length === 0) return true;
        return keywords.some(keywordObj => {
          // keyword가 객체인 경우 처리
          const keyword = typeof keywordObj === 'string' ? keywordObj : (keywordObj as KeywordObject).keyword;
          if (!keyword) {
            console.warn(`[필터 경고] 키워드가 없습니다:`, keywordObj);
            return false;
          }
          
          const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = text.match(regex);
          const matchCount = matches ? matches.length : 0;
          
          // "주말" 키워드에 대한 로그 추가 - 매칭된 경우에만 로그 출력
          if (keyword === '주말' && matchCount >= 2) {
            console.log(`[주말 키워드 매칭 성공] ID: ${recipe.id}, 제목: ${recipe.title}`);
          }
          
          return matchCount >= 2;
        });
      });
    }

    // 꼭 제외할 재료
    let excludeIngredientsOk = true;
    if (excludeIngredients.length > 0) {
      const text = (recipe.title || '') + ' ' + (recipe.content || '');
      excludeIngredientsOk = excludeIngredients.every(ing => {
        const regex = new RegExp(ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = text.match(regex);
        return (matches ? matches.length : 0) < 2;
      });
    }

    // 모든 조건 AND
    return inMatchRange && lackOk && expiryOk && includeKeywordOk && includeIngredientsOk && excludeIngredientsOk && categoryKeywordsOk;
  });
} 