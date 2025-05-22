import { Recipe } from '../types/recipe';
import { sortRecipes } from './recipeUtils';
import { calculateMatchRate } from './recipeUtils';

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
    효능?: string[];
    영양분?: string[];
    대상?: string[];
    TPO?: string[];
    스타일?: string[];
  };
}

export function filterRecipes(recipes: Recipe[], options: FilterOptions): Recipe[] {
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
      const text = (recipe.title || '') + ' ' + (recipe.body || '');
      includeKeywordOk = text.includes(keyword);
    }

    // 꼭 포함할 재료
    let includeIngredientsOk = true;
    if (includeIngredients.length > 0) {
      const recipeIngredients = (recipe.used_ingredients || '').split(',').map(i => i.trim());
      includeIngredientsOk = includeIngredients.every(ing => recipeIngredients.includes(ing));
    }

    // 꼭 제외할 재료
    let excludeIngredientsOk = true;
    if (excludeIngredients.length > 0) {
      const recipeIngredients = (recipe.used_ingredients || '').split(',').map(i => i.trim());
      excludeIngredientsOk = excludeIngredients.every(ing => !recipeIngredients.includes(ing));
    }

    // 하단 카테고리 키워드(효능, 영양분, 대상, TPO, 스타일)
    let categoryOk = true;
    const text = (recipe.title || '') + ' ' + (recipe.body || '');
    for (const key of ['효능', '영양분', '대상', 'TPO', '스타일'] as const) {
      const keywords = categoryKeywords[key] || [];
      if (keywords.length > 0) {
        // 모두 포함(AND)
        if (!keywords.every(kw => text.includes(kw))) {
          categoryOk = false;
          break;
        }
      }
    }

    // 모든 조건 AND
    return inMatchRange && lackOk && expiryOk && includeKeywordOk && includeIngredientsOk && excludeIngredientsOk && categoryOk;
  });
} 