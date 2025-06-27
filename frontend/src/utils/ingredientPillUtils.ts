import { SubstituteTable } from './recipeUtils';

// =====================
// 타입 정의
// =====================

export interface IngredientPillInfo {
  mine: string[];
  notMineNotSub: string[];
  notMineSub: string[];
  substitutes: string[];
  pills: string[];
}

export interface UniversalIngredientPillParams {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: SubstituteTable;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * 문자열 정규화: 앞뒤 공백 제거 + 소문자 변환
 */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

/**
 * 정규화된 대체재료 테이블 생성
 */
function createNormalizedSubstituteTable(substituteTable: SubstituteTable): SubstituteTable {
  const normalizedSubTable: SubstituteTable = {};
  Object.keys(substituteTable).forEach(key => {
    const normKey = normalize(key);
    normalizedSubTable[normKey] = { ingredient_b: normalize(substituteTable[key].ingredient_b) };
  });
  return normalizedSubTable;
}

/**
 * 내가 가진 재료 찾기
 */
function findMyIngredients(needIngredients: string[], mySet: Set<string>): string[] {
  return needIngredients.filter(i => mySet.has(normalize(i)));
}

/**
 * 대체 가능한 재료 찾기
 */
function findSubstituteIngredients(
  needIngredients: string[],
  mySet: Set<string>,
  mineSet: Set<string>,
  substituteTable: SubstituteTable
): { substituteTargets: string[]; substitutes: string[] } {
  const substituteTargets: string[] = [];
  const substitutes: string[] = [];

  needIngredients.forEach(needRaw => {
    const need = normalize(needRaw);
    if (mineSet.has(need)) return;

    // substituteTable의 키를 normalize해서 접근
    const originalKey = Object.keys(substituteTable).find(k => normalize(k) === need);
    const substituteInfo = originalKey ? substituteTable[originalKey] : undefined;
    
    if (substituteInfo && mySet.has(normalize(substituteInfo.ingredient_b))) {
      substituteTargets.push(needRaw);
      substitutes.push(`${needRaw}→${substituteInfo.ingredient_b}`);
    }
  });

  return { substituteTargets, substitutes };
}

/**
 * 대체 불가능한 재료 찾기
 */
function findNonSubstituteIngredients(
  needIngredients: string[],
  mySet: Set<string>,
  substituteTargetsSet: Set<string>
): string[] {
  return needIngredients.filter(i => {
    const norm = normalize(i);
    return !mySet.has(norm) && !substituteTargetsSet.has(norm);
  });
}

// =====================
// 메인 함수
// =====================

/**
 * 공통 pill/대체제 계산 함수 (세로형/가로형 카드 모두에서 사용)
 */
export function getUniversalIngredientPillInfo({
  needIngredients,
  myIngredients,
  substituteTable,
}: UniversalIngredientPillParams): IngredientPillInfo {
  const mySet = new Set(myIngredients.map(normalize));

  // 내가 가진 재료 찾기
  const mine = findMyIngredients(needIngredients, mySet);
  const mineSet = new Set(mine.map(normalize));

  // 대체 가능한 재료 찾기
  const { substituteTargets, substitutes } = findSubstituteIngredients(
    needIngredients,
    mySet,
    mineSet,
    substituteTable
  );

  // 대체 가능한 재료 목록
  const substituteTargetsSet = new Set(substituteTargets.map(normalize));

  // 내가 없고 대체도 불가능한 재료
  const notMineNotSub = findNonSubstituteIngredients(
    needIngredients,
    mySet,
    substituteTargetsSet
  );

  const notMineSub = substituteTargets;
  const pills = [...notMineNotSub, ...notMineSub, ...mine];

  return {
    mine,
    notMineNotSub,
    notMineSub,
    substitutes,
    pills,
  };
} 