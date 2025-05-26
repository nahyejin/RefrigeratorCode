import { Recipe, RecipeActionState } from '../types/recipe';

const STORAGE_KEYS = {
  done: 'my_completed_recipes',
  write: 'my_recorded_recipes',
};

export function getRecipeActionState(recipeId: number): RecipeActionState {
  const completedRecipes = getRecipesFromLocalStorage('done');
  const recordedRecipes = getRecipesFromLocalStorage('write');
  return {
    done: completedRecipes.some((r) => r.id === recipeId),
    write: recordedRecipes.some((r) => r.id === recipeId),
    share: false,
  };
}

export function addRecipeToLocalStorage(type: 'done'|'write', recipe: Recipe): void {
  const key = STORAGE_KEYS[type];
  const arr = getRecipesFromLocalStorage(type);
  if (!arr.some((r) => r.id === recipe.id)) {
    arr.push(recipe);
    localStorage.setItem(key, JSON.stringify(arr));
  }
}

export function removeRecipeFromLocalStorage(type: 'done'|'write', recipeId: number): void {
  const key = STORAGE_KEYS[type];
  const arr = getRecipesFromLocalStorage(type).filter((r) => r.id !== recipeId);
  localStorage.setItem(key, JSON.stringify(arr));
}

export function isRecipeInLocalStorage(type: 'done'|'write', recipeId: number): boolean {
  return getRecipesFromLocalStorage(type).some((r) => r.id === recipeId);
}

export function getRecipesFromLocalStorage(type: 'done'|'write'): Recipe[] {
  const key = STORAGE_KEYS[type];
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

export function copyRecipeUrlToClipboard(recipe: Recipe): void {
  const shareUrl = recipe.link || `${window.location.origin}/recipe/${recipe.id}`;
  navigator.clipboard.writeText(shareUrl);
}

// 냉장고 재료(myfridge_ingredients) 가져오기
export function getMyFridgeIngredients(): any[] {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room];
    }
  } catch {}
  return [];
} 