import { Recipe, RecipeMatchResult } from '../types/recipe';

// =====================
// 상수 및 유틸리티 함수
// =====================

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * 문자열 정규화: 앞뒤 공백 제거 + 소문자 변환
 */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

// =====================
// 타입 정의
// =====================

export interface SubstituteTable {
  [key: string]: { ingredient_b: string };
}

export interface FilterKeywordNode {
  keyword: string;
  synonyms: string[];
}
export interface FilterKeywordSubTree {
  [subCategory: string]: FilterKeywordNode[];
}
export interface FilterKeywordTree {
  [mainCategory: string]: FilterKeywordSubTree;
}

// =====================
// 주요 함수
// =====================

/**
 * 초기 재료를 설정한다 (재료가 없을 때만)
 */
export function initializeDefaultIngredients(ingredientDict: { [key: string]: string }): boolean {
  const STORAGE_KEY = 'myfridge_ingredients';
  
  try {
    // 이미 재료가 있는지 확인
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const data = JSON.parse(existing);
        // 데이터 구조가 올바른지 확인
        if (data && typeof data === 'object') {
          const hasData = (Array.isArray(data.frozen) && data.frozen.length > 0) ||
                         (Array.isArray(data.fridge) && data.fridge.length > 0) ||
                         (Array.isArray(data.room) && data.room.length > 0);
          if (hasData) {
            console.log('[initializeDefaultIngredients] 이미 재료가 있어서 초기화 건너뜀:', {
              frozen: data.frozen?.length || 0,
              fridge: data.fridge?.length || 0,
              room: data.room?.length || 0
            });
            return false; // 이미 재료가 있음
          }
          // 빈 데이터가 있으면 덮어쓰기 (초기화)
          console.log('[initializeDefaultIngredients] 빈 데이터 발견 - 초기 재료로 덮어쓰기');
        }
      } catch (parseError) {
        // 파싱 에러가 있으면 잘못된 데이터이므로 초기화 진행
        console.warn('[initializeDefaultIngredients] localStorage 데이터 파싱 실패 - 초기화 진행:', parseError);
      }
    }
    
    // 재료 이름을 keyword로 변환
    // ingredientDict가 비어있어도 기본 재료 이름을 그대로 사용
    const convertToKeyword = (name: string): string => {
      if (!ingredientDict || Object.keys(ingredientDict).length === 0) {
        console.warn('[initializeDefaultIngredients] 재료 사전이 비어있음 - 원래 이름 사용:', name);
        return name;
      }
      
      if (ingredientDict[name]) {
        return ingredientDict[name];
      }
      const foundKey = Object.keys(ingredientDict).find(
        key => key.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (foundKey) {
        return ingredientDict[foundKey];
      }
      const foundKeyNoSpace = Object.keys(ingredientDict).find(
        key => key.replace(/\s/g, '').toLowerCase() === name.replace(/\s/g, '').toLowerCase()
      );
      if (foundKeyNoSpace) {
        return ingredientDict[foundKeyNoSpace];
      }
      // 못 찾아도 원래 이름 반환 (기본 재료 이름은 이미 keyword일 가능성이 높음)
      return name;
    };
    
    // 기본 재료 목록
    const defaultRoomIngredients = ['소금', '설탕', '간장', '식용유', '참기름', '후추', '올리고당', '물엿', '식초', '라면'];
    const defaultFridgeIngredients = ['마늘', '대파', '달걀', '된장', '고추장', '고춧가루', '밀가루', '전분', '미림', '맛술', '양파', '감자', '당근', '두부', '우유', '김치'];
    const defaultFrozenIngredients = ['돼지고기', '닭고기', '만두'];
    
    const newRoom = defaultRoomIngredients.map((name, index) => ({
      id: `room-${Date.now()}-${index}`,
      name: convertToKeyword(name)
    }));
    
    const newFridge = defaultFridgeIngredients.map((name, index) => ({
      id: `fridge-${Date.now()}-${index}`,
      name: convertToKeyword(name)
    }));
    
    const newFrozen = defaultFrozenIngredients.map((name, index) => ({
      id: `frozen-${Date.now()}-${index}`,
      name: convertToKeyword(name)
    }));
    
    const data = {
      frozen: newFrozen,
      fridge: newFridge,
      room: newRoom
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // 같은 탭에서 변경을 알리기 위해 CustomEvent 발생
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: STORAGE_KEY }
    }));
    
    console.log('[initializeDefaultIngredients] 초기 재료 설정 완료:', {
      room: newRoom.map(r => r.name),
      fridge: newFridge.map(r => r.name),
      frozen: newFrozen.map(r => r.name),
      ingredientDictSize: ingredientDict ? Object.keys(ingredientDict).length : 0
    });
    
    return true; // 초기 재료 설정 완료
  } catch (error) {
    console.error('[initializeDefaultIngredients] 에러:', error);
    return false;
  }
}

/**
 * 냉장고 내 내 재료 목록을 localStorage에서 불러온다.
 */
export function getMyIngredients(): string[] {
  try {
    const STORAGE_KEY = 'myfridge_ingredients';
    
    // localStorage의 모든 키 확인
    const allKeys = Object.keys(localStorage);
    const rawValue = localStorage.getItem(STORAGE_KEY);
    const hasKey = rawValue !== null;
    
    console.log('[getMyIngredients] localStorage 상태 확인:', {
      allKeys: allKeys,
      allKeysCount: allKeys.length,
      hasMyFridgeKey: hasKey,
      myFridgeKeyValue: rawValue ? rawValue.substring(0, 100) : null,
      rawValueLength: rawValue?.length || 0,
      localStorageLength: localStorage.length,
      currentUrl: window.location.href,
      currentOrigin: window.location.origin,
      storageKey: STORAGE_KEY
    });
    
    const rawData = localStorage.getItem(STORAGE_KEY);
    
    // 디버깅: localStorage에서 읽은 원시 데이터 확인
    if (!rawData) {
      console.log('[getMyIngredients] localStorage에 데이터 없음 - 모든 키:', allKeys);
      console.log('[getMyIngredients] 키 검색 시도:', {
        directGet: localStorage.getItem(STORAGE_KEY),
        directGetLength: localStorage.getItem(STORAGE_KEY)?.length,
        allKeysIncludes: allKeys.includes(STORAGE_KEY),
        allKeysFiltered: allKeys.filter(k => k.includes('fridge') || k.includes('ingredient'))
      });
      return [];
    }
    
    console.log('[getMyIngredients] localStorage에서 데이터 읽음:', {
      rawDataLength: rawData.length,
      rawDataPreview: rawData.substring(0, 200) // 처음 200자만
    });
    
    const data = JSON.parse(rawData);
    if (data && typeof data === 'object') {
      // 데이터 구조 확인 및 정규화
      const frozen = Array.isArray(data.frozen) ? data.frozen : [];
      const fridge = Array.isArray(data.fridge) ? data.fridge : [];
      const room = Array.isArray(data.room) ? data.room : [];
      
      console.log('[getMyIngredients] 파싱된 데이터:', {
        frozenCount: frozen.length,
        fridgeCount: fridge.length,
        roomCount: room.length,
        frozenSample: frozen.slice(0, 3),
        fridgeSample: fridge.slice(0, 3),
        roomSample: room.slice(0, 3)
      });
      
      const ingredients = [
        ...frozen,
        ...fridge,
        ...room
      ].map(i => {
        if (typeof i === 'string') {
          return i;
        } else if (i && typeof i === 'object' && i.name) {
          return i.name;
        }
        return String(i);
      }).filter(Boolean);
      
      // 디버깅: 재료 읽기 확인
      console.log('[getMyIngredients] 최종 재료 목록:', {
        count: ingredients.length,
        ingredients: ingredients
      });
      
      return ingredients;
    } else {
      // 데이터 형식이 잘못된 경우
      console.warn('[getMyIngredients] 데이터 형식 오류:', {
        data: data,
        dataType: typeof data
      });
    }
  } catch (error) {
    console.error('[getMyIngredients] 에러:', error);
  }
  return [];
}

/**
 * 내 재료와 레시피 재료를 비교해 매칭률(%)과 보유/부족 재료를 반환한다.
 */
export function calculateMatchRate(myIngredients: string[], recipeIngredients: string | string[]): RecipeMatchResult {
  const recipeArr = Array.isArray(recipeIngredients)
    ? recipeIngredients
    : recipeIngredients.split(',');
  const recipeList = recipeArr.map((i: string) => i.trim()).filter(Boolean);
  const recipeSet = new Set(recipeList);
  
  // 정규화된 비교를 위한 Set 생성
  const mySet = new Set(myIngredients.map(i => normalize(i)));
  
  // 매칭된 재료와 부족한 재료 분리 (원본 재료명 유지)
  const matched: string[] = [];
  const needIngredients: string[] = [];
  
  recipeList.forEach(ingredient => {
    const normalized = normalize(ingredient);
    if (mySet.has(normalized)) {
      matched.push(ingredient);
    } else {
      needIngredients.push(ingredient);
    }
  });
  
  return {
    rate: recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: needIngredients, // 부족한 재료만 반환 (원본 재료명 유지)
  };
}

/**
 * 레시피 리스트를 정렬 기준/임박재료 등으로 정렬한다.
 */
export function sortRecipes(
  recipes: Recipe[],
  sortType: string,
  myIngredients: string[],
  appliedExpiryIngredients: string[]
): Recipe[] {
  const sorted = [...recipes];
  switch (sortType) {
    case 'latest':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'like':
      sorted.sort((a, b) => {
        const aLike = a.like_count ?? a.likes ?? 0;
        const bLike = b.like_count ?? b.likes ?? 0;
        return bLike - aLike;
      });
      break;
    case 'comment':
      sorted.sort((a, b) => {
        const aComment = a.comment_count ?? a.comments ?? 0;
        const bComment = b.comment_count ?? b.comments ?? 0;
        return bComment - aComment;
      });
      break;
    case 'hits':
      sorted.sort((a, b) => {
        // 플랫폼별 분리 정렬: 유튜브(인플루언서)는 hits 기준, 네이버는 likes 기준
        const aPlatform = a.platform || '';
        const bPlatform = b.platform || '';
        
        // 유튜브(인플루언서) 플랫폼인지 확인
        const aIsYoutube = aPlatform.includes('youtube');
        const bIsYoutube = bPlatform.includes('youtube');
        
        // 둘 다 유튜브인 경우 hits로 정렬
        if (aIsYoutube && bIsYoutube) {
          const aHits = a.hits || 0;
          const bHits = b.hits || 0;
          return bHits - aHits;
        }
        
        // 둘 다 네이버인 경우 likes로 정렬
        if (!aIsYoutube && !bIsYoutube) {
          const aLike = a.like_count ?? a.likes ?? 0;
          const bLike = b.like_count ?? b.likes ?? 0;
          return bLike - aLike;
        }
        
        // 유튜브가 네이버보다 우선 (유튜브가 위로)
        if (aIsYoutube && !bIsYoutube) return -1;
        if (!aIsYoutube && bIsYoutube) return 1;
        
        // 기본값
        return 0;
      });
      break;
    case 'match':
      sorted.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
      break;
    case 'expiry':
      sorted.sort((a, b) => {
        // 임박재료가 선택되지 않은 경우 매칭률순으로 정렬
        if (appliedExpiryIngredients.length === 0) {
          return (b.match_rate || 0) - (a.match_rate || 0);
        }
        
        const aIngredients = Array.isArray(a.used_ingredients)
          ? a.used_ingredients.map(i => (typeof i === 'string' ? i.trim() : ''))
          : (typeof a.used_ingredients === 'string' ? a.used_ingredients.split(',').map(i => i.trim()) : []);
        const bIngredients = Array.isArray(b.used_ingredients)
          ? b.used_ingredients.map(i => (typeof i === 'string' ? i.trim() : ''))
          : (typeof b.used_ingredients === 'string' ? b.used_ingredients.split(',').map(i => i.trim()) : []);
        
        // 임박재료 포함 개수 계산
        const aCount = appliedExpiryIngredients.filter(ing => aIngredients.includes(ing)).length;
        const bCount = appliedExpiryIngredients.filter(ing => bIngredients.includes(ing)).length;
        
        // 임박재료 개수가 다르면 임박재료가 많은 순으로 정렬
        if (aCount !== bCount) {
          return bCount - aCount;
        }
        
        // 임박재료 개수가 같으면 매칭률순으로 정렬
        return (b.match_rate || 0) - (a.match_rate || 0);
      });
      break;
    default:
      sorted.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));
  }
  return sorted;
}

/**
 * 유통기한 문자열을 받아 D-day 포맷 문자열로 반환한다.
 */
export function getDDay(expiry: string): string {
  if (!expiry) return '';
  const today = new Date();
  const exp = new Date(expiry);
  if (isNaN(exp.getTime())) return expiry;
  const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / MS_PER_DAY);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${Math.abs(diff)}`;
}

/**
 * need_ingredients 기준 pill/대체 가능 로직 공통 함수
 */
export function getIngredientPillInfo({
  needIngredients,
  myIngredients,
  substituteTable,
}: {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: SubstituteTable;
}) {
  const mySet = new Set(myIngredients.map(normalize));

  // substituteTable도 정규화된 키로 변환
  const normalizedSubTable: SubstituteTable = {};
  Object.keys(substituteTable).forEach(key => {
    const normKey = normalize(key);
    normalizedSubTable[normKey] = { ingredient_b: normalize(substituteTable[key].ingredient_b) };
  });

  // 대체 가능한 재료 찾기
  let substituteTargets: string[] = [];
  let substitutes: string[] = [];

  // 먼저 내가 가진 재료 찾기
  const mine = needIngredients.filter(i => mySet.has(normalize(i)));
  const mineSet = new Set(mine.map(normalize));

  // 대체 가능한 재료 찾기
  needIngredients.forEach(needRaw => {
    const need = normalize(needRaw);
    if (mineSet.has(need)) return;
    const substituteInfo = normalizedSubTable[need];
    if (substituteInfo && mySet.has(substituteInfo.ingredient_b)) {
      substituteTargets.push(needRaw);
      const displaySub = substituteTable[needRaw]?.ingredient_b || substituteInfo.ingredient_b;
      substitutes.push(`${needRaw}→${displaySub}`);
    }
  });

  // 대체 가능한 재료 목록
  const substituteTargetsSet = new Set(substituteTargets.map(normalize));

  // 내가 없고 대체도 불가능한 재료
  const notMineNotSub = needIngredients.filter(i => {
    const norm = normalize(i);
    return !mySet.has(norm) && !substituteTargetsSet.has(norm);
  });

  const notMineSub = substituteTargets;
  const pills = [...notMineNotSub, ...notMineSub, ...mine];

  return { pills, notMineNotSub, notMineSub, mine, substitutes };
}

/**
 * 카테고리명을 트리의 key로 변환한다.
 * FilterState의 카테고리명을 Filter_Keywords.csv의 대분류명으로 매핑
 */
export function getDictCategoryKey(category: string): string {
  const categoryMap: Record<string, string> = {
    '효능': '요리효능',
    '영양분': '요리영양분',
    '대상': '식사대상',
    'TPO': '요리TPO',
    '스타일': '요리스타일'
  };
  return categoryMap[category] || category;
}

/**
 * 카테고리 키워드 트리에서 키워드와 동의어를 추출한다.
 */
export function extractKeywordsAndSynonyms(
  category: string,
  keywords: string[],
  tree: FilterKeywordTree | null
): string[] {
  const dictKey = getDictCategoryKey(category);
  if (!tree) return [];
  if (!tree[dictKey]) return [];
  const result: string[] = [];
  keywords.forEach(keyword => {
    if (!keyword) return;
    const node = Object.values(tree[dictKey] || {}).flat().find(
      (n: FilterKeywordNode) => n.keyword && n.keyword.trim().toLowerCase() === keyword.trim().toLowerCase()
    );
    if (node) {
      const pushed = [keyword.trim(), ...node.synonyms.map((s: string) => s.trim())];
      result.push(...pushed);
    }
  });
  return result;
}

/**
 * 동의어 사전을 로드한다 (캐싱 적용)
 */
export async function loadIngredientSynonymDict(): Promise<{ [key: string]: string }> {
  const CACHE_KEY = 'ingredient_synonym_dict_cache';
  const CACHE_VERSION = '1.1'; // CSV 파싱 로직 개선으로 버전 업데이트
  
  try {
    // 캐시 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          if (parsedCache.version === CACHE_VERSION && parsedCache.data) {
            return parsedCache.data;
          }
        } catch (e) {
          // 캐시 파싱 실패 시 무시하고 새로 로드
        }
      }
    }
    
    // 캐시가 없으면 새로 로드
    const response = await fetch('/ingredient_profile_dict_with_substitutes.csv');
    const csv = await response.text();
    
    const lines = csv.split('\n');
    const header = lines[0].split(',');
    const nameIdx = header.indexOf('keyword');
    const synonymsIdx = header.indexOf('synonyms');
    const categoryIdx = header.indexOf('대분류');
    
    // CSV 파싱 함수 (따옴표로 감싸진 필드 처리)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim()); // 마지막 필드
      return result;
    };
    
    const ingredientDict: { [key: string]: string } = {};
    
    lines.slice(1).forEach(line => {
      if (!line.trim()) return; // 빈 줄 스킵
      
      const values = parseCSVLine(line);
      const keyword = values[nameIdx]?.trim();
      const synonymsStr = values[synonymsIdx]?.trim();
      const category = values[categoryIdx]?.trim();
      
      if (keyword && category === '재료') {
        // keyword를 keyword로 매핑
        ingredientDict[keyword] = keyword;
        
        // synonyms 파싱 (쉼표로 구분, 빈 값 제거)
        if (synonymsStr) {
          const synonyms = synonymsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          synonyms.forEach(synonym => {
            if (synonym) {
              ingredientDict[synonym] = keyword;
            }
          });
        }
      }
    });
    
    // 캐시에 저장
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          version: CACHE_VERSION,
          data: ingredientDict
        }));
      } catch (e) {
        console.warn('[recipeUtils] 동의어 사전 캐시 저장 실패:', e);
      }
    }
    
    return ingredientDict;
  } catch (error) {
    console.warn('[recipeUtils] 동의어 사전 로드 실패:', error);
    return {};
  }
}

// 동의어 사전을 메모이제이션
let ingredientSynonymDictCache: { [key: string]: string } | null = null;
let loadingSynonymDict = false;

/**
 * 동의어를 keyword로 변환한다
 * @param ingredientName 재료명 (동의어일 수 있음)
 * @returns keyword (표준 재료명)
 */
export async function convertSynonymToKeyword(ingredientName: string): Promise<string> {
  if (!ingredientName) return ingredientName;
  
  // 캐시가 없으면 로드
  if (!ingredientSynonymDictCache && !loadingSynonymDict) {
    loadingSynonymDict = true;
    ingredientSynonymDictCache = await loadIngredientSynonymDict();
    loadingSynonymDict = false;
  }
  
  // 동기적으로 사용할 수 있도록 즉시 반환 (캐시가 있으면)
  if (ingredientSynonymDictCache) {
    return ingredientSynonymDictCache[ingredientName] || ingredientName;
  }
  
  // 캐시가 없으면 비동기로 로드 후 반환
  if (!ingredientSynonymDictCache) {
    ingredientSynonymDictCache = await loadIngredientSynonymDict();
  }
  
  return ingredientSynonymDictCache[ingredientName] || ingredientName;
}

/**
 * 동의어를 keyword로 변환한다 (동기 버전, 캐시가 이미 로드되어 있어야 함)
 * @param ingredientName 재료명 (동의어일 수 있음)
 * @param dict 동의어 사전 (선택사항, 없으면 캐시 사용)
 * @returns keyword (표준 재료명)
 */
export function convertSynonymToKeywordSync(ingredientName: string, dict?: { [key: string]: string }): string {
  if (!ingredientName) return ingredientName;
  
  const synonymDict = dict || ingredientSynonymDictCache;
  if (synonymDict) {
    return synonymDict[ingredientName] || ingredientName;
  }
  
  return ingredientName;
}

/**
 * 동의어 사전을 미리 로드한다 (선택사항)
 */
export async function preloadIngredientSynonymDict(): Promise<void> {
  if (!ingredientSynonymDictCache && !loadingSynonymDict) {
    loadingSynonymDict = true;
    ingredientSynonymDictCache = await loadIngredientSynonymDict();
    loadingSynonymDict = false;
  }
} 