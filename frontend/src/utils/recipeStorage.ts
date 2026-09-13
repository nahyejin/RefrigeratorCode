import { Recipe, RecipeActionState } from '../types/recipe';

// =====================
// 상수
// =====================

const STORAGE_KEYS = {
  done: 'my_completed_recipes',
  write: 'my_recorded_recipes',
  favorite: 'my_favorite_recipes',
  myfridge: 'myfridge_ingredients',
} as const;

const DEFAULT_RECIPE_URL = '/recipe/';
const USER_SAVED_AT_FIELD = 'user_saved_at';

// =====================
// 타입 정의
// =====================

export type StorageType = 'done' | 'write' | 'favorite';

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

export function normalizeRecipeId(id: number | string | null | undefined): number {
  if (id == null) return NaN;
  if (typeof id === 'number') return id;
  const parsed = Number(id);
  return Number.isNaN(parsed) ? NaN : parsed;
}

/**
 * 레시피 배열에서 특정 ID의 레시피 존재 여부 확인
 */
function hasRecipeById(recipes: Recipe[], recipeId: number | string): boolean {
  const targetId = normalizeRecipeId(recipeId);
  if (Number.isNaN(targetId)) return false;
  return recipes.some((r) => normalizeRecipeId(r.id) === targetId);
}

/**
 * 레시피 배열에서 특정 ID의 레시피 제거
 */
function removeRecipeById(recipes: Recipe[], recipeId: number | string): Recipe[] {
  const targetId = normalizeRecipeId(recipeId);
  if (Number.isNaN(targetId)) return recipes;
  return recipes.filter((r) => normalizeRecipeId(r.id) !== targetId);
}

function getSavedAtValue(recipe: Partial<Recipe>): string | undefined {
  return (
    recipe.user_saved_at ||
    recipe.saved_at ||
    recipe.recorded_at ||
    recipe.completed_at
  );
}

function getSavedAtTime(recipe: Partial<Recipe>): number {
  const savedAt = getSavedAtValue(recipe);
  if (!savedAt) return 0;

  const time = new Date(savedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function withUserSavedAt<T extends Partial<Recipe>>(recipe: T, savedAt = new Date().toISOString()): T & { user_saved_at: string } {
  return {
    ...recipe,
    [USER_SAVED_AT_FIELD]: recipe.user_saved_at || savedAt,
  } as T & { user_saved_at: string };
}

export function sortRecipesByUserSavedAtDesc<T extends Partial<Recipe>>(recipes: T[]): T[] {
  return [...recipes]
    .map((recipe, index) => ({ recipe, index, savedAtTime: getSavedAtTime(recipe) }))
    .sort((a, b) => {
      if (a.savedAtTime !== b.savedAtTime) {
        return b.savedAtTime - a.savedAtTime;
      }

      // 기존 로컬 데이터에는 저장 시각이 없으므로, 예전 push 순서 기준 최신 항목을 앞으로 보낸다.
      return b.index - a.index;
    })
    .map(({ recipe }) => recipe);
}

// =====================
// 레시피 액션 관련 함수
// =====================

/**
 * 레시피의 액션 상태를 가져온다 (완료, 기록, 공유)
 */
export function getRecipeActionState(recipeId: number | string): RecipeActionState {
  const completedRecipes = getRecipesFromLocalStorage('done');
  const recordedRecipes = getRecipesFromLocalStorage('write');
  
  return {
    done: hasRecipeById(completedRecipes, recipeId),
    write: hasRecipeById(recordedRecipes, recipeId),
    favorite: hasRecipeById(getRecipesFromLocalStorage('favorite'), recipeId),
    share: false,
  };
}

export function buildRecipeActionStatesForRecipes(
  recipes: Array<{ id: number | string }>
): Record<number, RecipeActionState> {
  const states: Record<number, RecipeActionState> = {};
  const completedIds = new Set(getRecipesFromLocalStorage('done').map((recipe) => normalizeRecipeId(recipe.id)));
  const recordedIds = new Set(getRecipesFromLocalStorage('write').map((recipe) => normalizeRecipeId(recipe.id)));
  const favoriteIds = new Set(getRecipesFromLocalStorage('favorite').map((recipe) => normalizeRecipeId(recipe.id)));

  for (const recipe of recipes) {
    const id = normalizeRecipeId(recipe?.id);
    if (!Number.isNaN(id)) {
      states[id] = {
        done: completedIds.has(id),
        write: recordedIds.has(id),
        favorite: favoriteIds.has(id),
        share: false,
      };
    }
  }

  return states;
}

export function lookupRecipeActionState(
  states: Record<number, RecipeActionState>,
  recipeId: number | string
): RecipeActionState | undefined {
  const id = normalizeRecipeId(recipeId);
  if (Number.isNaN(id)) return undefined;
  return states[id];
}

function notifyRecipeStorageChange(type: StorageType): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('localStorageChange', {
      detail: { key: STORAGE_KEYS[type] },
    })
  );
}

/**
 * 레시피를 localStorage에 추가한다
 */
export function addRecipeToLocalStorage(type: StorageType, recipe: Recipe): void {
  const key = STORAGE_KEYS[type];
  const normalizedId = normalizeRecipeId(recipe.id);
  const recipes = removeRecipeById(getRecipesFromLocalStorage(type), normalizedId);
  const savedRecipe = withUserSavedAt({
    ...recipe,
    id: Number.isNaN(normalizedId) ? recipe.id : normalizedId,
  });
  
  safeJsonSet(key, sortRecipesByUserSavedAtDesc([savedRecipe, ...recipes]));
  notifyRecipeStorageChange(type);
}

/**
 * localStorage에서 레시피를 제거한다
 */
export function removeRecipeFromLocalStorage(type: StorageType, recipeId: number | string): void {
  const key = STORAGE_KEYS[type];
  const recipes = getRecipesFromLocalStorage(type);
  const filteredRecipes = removeRecipeById(recipes, recipeId);

  safeJsonSet(key, filteredRecipes);
  notifyRecipeStorageChange(type);
}

/**
 * 해당 타입(즐겨찾기/기록/완료)의 레시피를 전부 지운다 (마이페이지 "전체보기" 목록의 전체삭제용)
 */
export function clearRecipesFromLocalStorage(type: StorageType): void {
  const key = STORAGE_KEYS[type];
  safeJsonSet(key, []);
  notifyRecipeStorageChange(type);
}

/**
 * localStorage에 레시피가 존재하는지 확인한다
 */
export function isRecipeInLocalStorage(type: StorageType, recipeId: number | string): boolean {
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
    return sortRecipesByUserSavedAtDesc(recipes);
  }
  
  console.warn(`[Storage] 잘못된 레시피 데이터 형식: ${key}`);
  return [];
}

// =====================
// 서버(DB) 동기화 — 즐겨찾기/기록/완료
// =====================
//
// 왜 여기 한 곳에만 있어야 하나:
//   즐겨찾기·기록·완료는 로그인 상태면 localStorage 뿐 아니라 서버에도
//   남아야(다른 기기에서도 보이고, 마이페이지가 새로 불러와도 안 사라지게)
//   한다. 그런데 이 호출을 `MyPage.tsx`, `CompletedRecipeListPage.tsx`,
//   `RecordedRecipeListPage.tsx` 가 각자 인라인으로 구현하고 있었다.
//   `MyPage.tsx` 만 추가(POST)·삭제(DELETE) 둘 다 서버에 반영했고, 나머지
//   두 목록 화면은 **로컬만 지우고 서버 호출 자체가 없었다.** 그래서 그
//   화면에서 "완료 해제" 를 눌러도 DB 행이 그대로 남아, 마이페이지로
//   돌아가 다시 불러오면 (DB 값을 신뢰하는) 항목이 되살아났다(실사용 보고,
//   2026-09-13). 앞으로 또 갈라지지 않도록 이 파일에만 둔다.

const RECIPE_ACTION_ENDPOINT: Record<StorageType, string> = {
  write: 'recorded-recipes',
  done: 'completed-recipes',
  favorite: 'favorite-recipes',
};

function getAuthTokenForRecipeSync(): string | null {
  try {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

function recipeSyncApiBase(): string {
  return (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
}

/** 로그인 상태가 아니면 아무 일도 하지 않는다 — 호출부에서 userId 를 안 넘기면 됨. */
export async function addRecipeActionToDB(type: StorageType, userId: number, recipeId: number): Promise<void> {
  const token = getAuthTokenForRecipeSync();
  if (!token) return;
  try {
    await fetch(`${recipeSyncApiBase()}/api/users/${userId}/${RECIPE_ACTION_ENDPOINT[type]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
  } catch (error) {
    console.error(`[recipeStorage] DB 추가 실패 (${type}):`, error);
  }
}

export async function removeRecipeActionFromDB(type: StorageType, userId: number, recipeId: number): Promise<void> {
  const token = getAuthTokenForRecipeSync();
  if (!token) return;
  try {
    await fetch(`${recipeSyncApiBase()}/api/users/${userId}/${RECIPE_ACTION_ENDPOINT[type]}/${recipeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error(`[recipeStorage] DB 삭제 실패 (${type}):`, error);
  }
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