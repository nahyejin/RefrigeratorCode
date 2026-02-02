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
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
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
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] }
): { substituteTargets: string[]; substitutes: string[] } {
  const substituteTargets: string[] = [];
  const substitutes: string[] = [];

  // 디버깅: substituteTable이 비어있는지 확인
  if (Object.keys(substituteTable).length === 0) {
    console.warn('[findSubstituteIngredients] substituteTable이 비어있습니다.');
  }

  needIngredients.forEach(needRaw => {
    const need = normalize(needRaw);
    if (mineSet.has(need)) return;

    // substituteTable의 키를 normalize해서 접근
    const originalKey = Object.keys(substituteTable).find(k => normalize(k) === need);
    const substituteList = originalKey ? substituteTable[originalKey] : undefined;
    
    // 디버깅: 대체제 찾기 과정
    if (needRaw === '설탕' || needRaw.includes('설탕')) {
      console.log(`[findSubstituteIngredients] "${needRaw}" 검색 중:`, {
        normalized: need,
        originalKey: originalKey,
        substituteList: substituteList,
        substituteTableKeys: Object.keys(substituteTable).slice(0, 10)
      });
    }
    
    if (!substituteList || !Array.isArray(substituteList)) {
      // 디버깅: 대체제를 찾지 못한 경우
      if (originalKey) {
        console.log(`[findSubstituteIngredients] "${needRaw}"의 대체제 리스트가 배열이 아닙니다:`, substituteList);
      } else if (Object.keys(substituteTable).length > 0) {
        // 대체제 테이블은 있지만 해당 재료가 없는 경우
        const similarKeys = Object.keys(substituteTable).filter(k => 
          normalize(k).includes(need) || need.includes(normalize(k))
        ).slice(0, 3);
        if (similarKeys.length > 0) {
          console.log(`[findSubstituteIngredients] "${needRaw}" (정규화: "${need}")의 대체제를 찾지 못했습니다. 유사한 키:`, similarKeys);
        }
      }
      return;
    }
    
    // 내 냉장고에 있는 대체제 중 유사도 점수가 가장 높은 것만 선택
    const availableSubstitutes = substituteList
      .filter(sub => {
        const hasSubstitute = mySet.has(normalize(sub.ingredient_b));
        if (hasSubstitute) {
          console.log(`[findSubstituteIngredients] 대체제 발견: "${needRaw}" → "${sub.ingredient_b}" (유사도: ${sub.similarity_score ?? 'N/A'})`);
        }
        return hasSubstitute;
      })
      .sort((a, b) => {
        // 유사도 점수가 높은 순으로 정렬 (없으면 0으로 처리)
        const scoreA = a.similarity_score ?? 0;
        const scoreB = b.similarity_score ?? 0;
        return scoreB - scoreA;
      });
    
    if (availableSubstitutes.length > 0) {
      // 유사도 점수가 가장 높은 것만 사용
      const bestSubstitute = availableSubstitutes[0];
      substituteTargets.push(needRaw);
      substitutes.push(`${needRaw}→${bestSubstitute.ingredient_b}`);
      console.log(`[findSubstituteIngredients] 최종 선택: "${needRaw}" → "${bestSubstitute.ingredient_b}"`);
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

  // 디버깅: 입력 데이터 확인
  if (needIngredients.length > 0 && myIngredients.length > 0) {
    console.log('[getUniversalIngredientPillInfo] 입력 확인:', {
      needIngredientsCount: needIngredients.length,
      myIngredientsCount: myIngredients.length,
      substituteTableKeys: Object.keys(substituteTable).length,
      sampleNeedIngredients: needIngredients.slice(0, 3),
      sampleMyIngredients: myIngredients.slice(0, 3),
      sampleSubstituteTableKeys: Object.keys(substituteTable).slice(0, 3)
    });
  }

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
  
  // 디버깅: 결과 확인
  if (substitutes.length > 0) {
    console.log('[getUniversalIngredientPillInfo] 대체제 발견:', substitutes);
  } else if (needIngredients.length > 0 && Object.keys(substituteTable).length > 0) {
    console.log('[getUniversalIngredientPillInfo] 대체제 없음 - 확인 필요:', {
      needIngredients: needIngredients,
      substituteTableSample: Object.keys(substituteTable).slice(0, 5)
    });
  }

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