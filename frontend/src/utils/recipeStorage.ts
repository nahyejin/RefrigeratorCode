import { Recipe, RecipeActionState } from '../types/recipe';

// =====================
// 상수
// =====================

const STORAGE_KEYS = {
  done: 'my_completed_recipes',
  write: 'my_recorded_recipes',
  myfridge: 'myfridge_ingredients',
} as const;

const DEFAULT_RECIPE_URL = '/recipe/';

// =====================
// 타입 정의
// =====================

export type StorageType = 'done' | 'write';

export interface FridgeIngredient {
  name?: string;
  [key: string]: any;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * localStorage에서 안전하게 JSON 파싱
 */
function safeJsonParse<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    
    const parsed = JSON.parse(data);
    return parsed || defaultValue;
  } catch (error) {
    console.warn(`[Storage] JSON 파싱 실패: ${key}`, error);
    return defaultValue;
  }
}

/**
 * localStorage에 안전하게 JSON 저장
 */
function safeJsonSet(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[Storage] JSON 저장 실패: ${key}`, error);
  }
}

/**
 * 레시피 배열에서 특정 ID의 레시피 존재 여부 확인
 */
function hasRecipeById(recipes: Recipe[], recipeId: number): boolean {
  return recipes.some((r) => r.id === recipeId);
}

/**
 * 레시피 배열에서 특정 ID의 레시피 제거
 */
function removeRecipeById(recipes: Recipe[], recipeId: number): Recipe[] {
  return recipes.filter((r) => r.id !== recipeId);
}

// =====================
// 레시피 액션 관련 함수
// =====================

/**
 * 레시피의 액션 상태를 가져온다 (완료, 기록, 공유)
 */
export function getRecipeActionState(recipeId: number): RecipeActionState {
  const completedRecipes = getRecipesFromLocalStorage('done');
  const recordedRecipes = getRecipesFromLocalStorage('write');
  
  return {
    done: hasRecipeById(completedRecipes, recipeId),
    write: hasRecipeById(recordedRecipes, recipeId),
    share: false,
  };
}

/**
 * 레시피를 localStorage에 추가한다
 */
export function addRecipeToLocalStorage(type: StorageType, recipe: Recipe): void {
  const key = STORAGE_KEYS[type];
  const recipes = getRecipesFromLocalStorage(type);
  
  if (!hasRecipeById(recipes, recipe.id)) {
    recipes.push(recipe);
    safeJsonSet(key, recipes);
  }
}

/**
 * localStorage에서 레시피를 제거한다
 */
export function removeRecipeFromLocalStorage(type: StorageType, recipeId: number): void {
  const key = STORAGE_KEYS[type];
  const recipes = getRecipesFromLocalStorage(type);
  const filteredRecipes = removeRecipeById(recipes, recipeId);
  
  safeJsonSet(key, filteredRecipes);
}

/**
 * localStorage에 레시피가 존재하는지 확인한다
 */
export function isRecipeInLocalStorage(type: StorageType, recipeId: number): boolean {
  const recipes = getRecipesFromLocalStorage(type);
  return hasRecipeById(recipes, recipeId);
}

/**
 * localStorage에서 레시피 목록을 가져온다
 */
export function getRecipesFromLocalStorage(type: StorageType): Recipe[] {
  const key = STORAGE_KEYS[type];
  const recipes = safeJsonParse<Recipe[]>(key, []);
  
  if (Array.isArray(recipes)) {
    return recipes;
  }
  
  console.warn(`[Storage] 잘못된 레시피 데이터 형식: ${key}`);
  return [];
}

// =====================
// 공유 관련 함수
// =====================

/**
 * 레시피 URL을 클립보드에 복사한다
 */
export function copyRecipeUrlToClipboard(recipe: Recipe): void {
  const shareUrl = recipe.link || `${window.location.origin}${DEFAULT_RECIPE_URL}${recipe.id}`;
  
  navigator.clipboard.writeText(shareUrl)
    .then(() => {
      console.log('[Share] URL이 클립보드에 복사되었습니다:', shareUrl);
    })
    .catch((error) => {
      console.error('[Share] 클립보드 복사 실패:', error);
    });
}

// =====================
// 냉장고 재료 관련 함수
// =====================

/**
 * 냉장고 재료 목록을 가져온다
 */
export function getMyFridgeIngredients(): FridgeIngredient[] {
  const data = safeJsonParse<{
    frozen?: FridgeIngredient[];
    fridge?: FridgeIngredient[];
    room?: FridgeIngredient[];
  } | null>(STORAGE_KEYS.myfridge, null);
  
  if (data && 
      Array.isArray(data.frozen) && 
      Array.isArray(data.fridge) && 
      Array.isArray(data.room)) {
    return [...data.frozen, ...data.fridge, ...data.room];
  }
  
  return [];
} 