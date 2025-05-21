import { Recipe } from '../types/recipe';
import { sortRecipes } from './recipeUtils';

interface FilterOptions {
  sortType: string;
  matchRange: [number, number];
  maxLack: number | 'unlimited';
  appliedExpiryIngredients: string[];
  myIngredients: string[];
}

export function filterRecipes(recipes: Recipe[], options: FilterOptions): Recipe[] {
  const { sortType, matchRange, maxLack, appliedExpiryIngredients, myIngredients } = options;

  return sortRecipes(recipes, sortType, myIngredients).filter(recipe => {
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
      expiryOk = appliedExpiryIngredients.every(ing => 
        (recipe.used_ingredients || '').includes(ing)
      );
    }

    // 디버깅을 위한 로그
    console.log('Recipe filtering:', {
      title: recipe.title,
      matchRate,
      inMatchRange,
      lackCount,
      lackOk,
      expiryOk,
      used_ingredients: recipe.used_ingredients,
      appliedExpiryIngredients
    });

    return inMatchRange && lackOk && expiryOk;
  });
} 