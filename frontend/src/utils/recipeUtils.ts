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
    need_ingredients: [...recipeSet].filter((i: string) => !mySet.has(i)),
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