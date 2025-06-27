// =====================
// 상수
// =====================

const MATCH_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20,
} as const;

// =====================
// 타입 정의
// =====================

export interface MatchResult {
  rate: number;
  my_ingredients: string[];
  need_ingredients: string[];
}

export type MatchLevel = 'high' | 'medium' | 'low' | 'none';

// =====================
// 유틸리티 함수
// =====================

/**
 * 문자열 정규화: 앞뒤 공백 제거 + 소문자 변환
 */
function normalizeString(s: string): string {
  return (s || '').trim().toLowerCase();
}

/**
 * 재료 배열을 정규화된 Set으로 변환
 */
function createNormalizedSet(ingredients: string[]): Set<string> {
  return new Set(ingredients.map(normalizeString));
}

/**
 * 매칭률에 따른 레벨을 반환
 */
function getMatchLevel(rate: number): MatchLevel {
  if (rate >= MATCH_THRESHOLDS.HIGH) return 'high';
  if (rate >= MATCH_THRESHOLDS.MEDIUM) return 'medium';
  if (rate >= MATCH_THRESHOLDS.LOW) return 'low';
  return 'none';
}

// =====================
// 메인 함수
// =====================

/**
 * 내 재료와 레시피 재료를 비교해 매칭률(%)과 보유/부족 재료를 반환한다.
 */
export function calculateMatchRate(
  myIngredients: string[],
  recipeIngredients: string | string[]
): MatchResult {
  // 레시피 재료를 배열로 변환
  const recipeArr = Array.isArray(recipeIngredients)
    ? recipeIngredients
    : recipeIngredients.split(',');
  
  // 정규화된 Set 생성
  const recipeSet = new Set(
    recipeArr.map(normalizeString).filter(Boolean)
  );
  const mySet = createNormalizedSet(myIngredients);
  
  // 매칭된 재료 찾기
  const matched = [...recipeSet].filter(ingredient => mySet.has(ingredient));
  
  // 매칭률 계산
  const rate = recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100);
  
  return {
    rate,
    my_ingredients: matched,
    need_ingredients: [...recipeSet],
  };
}

/**
 * 매칭률에 따른 레벨을 반환한다.
 */
export function getMatchLevelFromRate(rate: number): MatchLevel {
  return getMatchLevel(rate);
} 