import axios, { AxiosResponse } from 'axios';
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import { useNavigate, useLocation } from 'react-router-dom';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import nodataImg from '../assets/nodata.png';
import FilterModal from '../components/FilterModal';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
import VirtualizedRecipeList, { VirtualizedRecipeListRef } from '../components/VirtualizedRecipeList';
import { Recipe, RecipeActionState, FilterState, SubstituteInfo } from '../types/recipe';
import { getMyIngredients, sortRecipes, calculateMatchRate, initializeDefaultIngredients, extractKeywordsAndSynonyms, FilterKeywordTree, getDictCategoryKey, preloadIngredientSynonymDict, ingredientSynonymDictCache } from '../utils/recipeUtils';
import RecipeToast from '../components/RecipeToast';
// import Slider from 'rc-slider';
// import 'rc-slider/assets/index.css';
import RecipeSortBar from '../components/RecipeSortBar';
import { getIngredientPillInfo } from '../utils/recipeUtils';
import { 
  addRecipeToLocalStorage, 
  removeRecipeFromLocalStorage, 
  getRecipesFromLocalStorage, 
  copyRecipeUrlToClipboard 
} from '../utils/recipeStorage';
import { useAuth } from '../context/AuthContext';
import RegisterPromptModal from '../components/RegisterPromptModal';
import GuideOverlay from '../components/GuideOverlay';

// =====================
// 상수
// =====================

const TOAST_DURATION = 1500;
const CSV_INGREDIENT_URL = '/ingredient_profile_dict_with_substitutes.csv';
const CSV_SUBSTITUTE_URL = '/ingredient_substitute_table.csv';
const STORAGE_KEY = 'recipe_sortbar_state_fridge';
const STORAGE_KEY_MYFRIDGE = 'myfridge_ingredients';

// =====================
// 정렬 옵션
// =====================

const sortOptions = [
  { key: 'match', label: '재료매칭률' },
  { key: 'expiry', label: '유통기한 임박순' },
  { key: 'like', label: '좋아요순' },
  { key: 'comment', label: '댓글순' },
  { key: 'latest', label: '최신순' },
];

const categoryOptions = ['한식', '중식', '양식'];
const timeOptions = ['30분 이하', '1시간 이하', '상관없음'];

// =====================
// 필터 키워드
// =====================

const FILTER_KEYWORDS = {
  효능: [
    { title: '다이어트/체중조절/식이조절', keywords: ['저지방', '저칼로리', '저당', '무설탕', '무염', '고단백', '다이어트', '포만감', '칼로리', '글레스테롤', '무염', '저염', '무가당'] },
    { title: '소화·배변·영양 흡수', keywords: ['소화', '변비', '식이섬유'] },
    { title: '노화·피부·세포 관련', keywords: ['노화', '저속노화', '주름개선', '항산화', '세포벽'] },
    { title: '면역·활력·에너지 회복', keywords: ['면역력', '에너지', '신진대사', '컨디션', '피로'] },
    { title: '해독·순환·디톡스', keywords: ['디톡스', '숙취해소', '혈액순환', '독소'] },
    { title: '질환·염증·호흡기', keywords: ['염증완화', '질환', '기관지', '호흡기', '세균'] },
    { title: '성분 특성/영양제어', keywords: ['단백질', '글루텐', '무염', '무설탕', '비정제원당'] },
    { title: '건강식·한방·보양식', keywords: ['건강', '보양', '보양음식', '약재', '한방'] },
    { title: '식이제한/특수식단', keywords: ['채식', '당뇨', '글루텐'] },
    { title: '수면·신경 안정', keywords: ['불면증'] },
  ],
  영양분: [
    { title: '', keywords: ['단백질', '아미노산', '오메가', '타우린', '카페인', '비타민', '비타민C', '비타민B', '비타민D', '미네랄', '무기질', '칼슘', '칼륨', '아연', '식이섬유', '그래놀라', '탄수화물'] },
  ],
  대상: [
    { title: '', keywords: ['부모님', '남편', '와이프', '아이', '가족', '어르신', '직장인', '환자'] },
  ],
  TPO: [
    { title: '용도', keywords: ['반찬', '술안주', '와인', '소풍'] },
    { title: '시간대', keywords: ['주말', '아침', '브런치', '간식', '점심', '저녁', '야식'] },
    { title: '상황/장소', keywords: ['운동전', '운동후', '캠핑', '명절', '생일', '추억', '소풍', '잔치상', '여행'] },
    { title: '난이도', keywords: ['초간단', '심플한', '난이도하', '초보', '즉석', '귀차니즘'] },
    { title: '계절·시기', keywords: ['봄', '여름', '가을', '겨울', '환절기', '초복', '중복', '말복', '동지'] },
  ],
  스타일: [
    { title: '', keywords: ['이국', '프랑스', '이탈리안', '스페인', '멕시코', '지중해', '프랑스', '중화', '베트남', '그리스', '서양', '태국', '동남아', '일본', '전통', '강원도', '경양식', '궁중', '경상도', '전라도', '황해도', '키토', '가니쉬', '오마카세'] },
  ],
};

// =====================
// 초기 상태
// =====================

const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

// =====================
// 유틸리티 함수
// =====================

/**
 * 게시일자 포맷을 변환한다
 */
function formatDate(dateString: string): string {
  let d = new Date(dateString);
  if (isNaN(d.getTime())) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[0].slice(2)}-${parts[1]}-${parts[2]}`;
    }
    return dateString;
  }
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * D-day를 계산한다
 */
function getDDay(expiry: string): string {
  if (!expiry) return '';
  const today = new Date();
  const exp = new Date(expiry);
  if (isNaN(exp.getTime())) return expiry;
  const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / (1000*60*60*24));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${Math.abs(diff)}`;
}

/**
 * 정렬/필터바 초기 상태를 가져온다
 */
function getInitialSortBarState() {
  // 초기 로드 시 항상 기본값 사용 (30~100%, 재료매칭률순)
  // 이후 사용자가 변경한 값은 sessionStorage에 저장되어 유지됨
  // 하지만 초기 로드 시에는 항상 기본값을 사용하여 성능 최적화
  return {
    sortType: 'match', // 재료매칭률순
    matchRange: [30, 100], // 30~100%
    maxLack: 'unlimited',
    appliedExpiryIngredients: [], // 임박재료 없음
    expirySortType: 'expiry',
  };
}

/**
 * 내 냉장고 재료 객체를 가져온다
 */
function getMyIngredientObjects() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_MYFRIDGE) || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room];
    }
  } catch (error) {
    console.warn('[RecipeList] 내 냉장고 재료 로드 실패:', error);
  }
  return [];
}

/**
 * 레시피를 정규화한다
 */
function normalizeRecipe(recipe: any) {
  return {
    id: recipe.id,
    title: recipe.title,
    content: recipe.content || '',
    author: recipe.author || '',
    date: recipe.date || '',
    body: recipe.body || recipe.content || recipe.description || '',
    description: recipe.description || '',
    thumbnail: recipe.thumbnail || recipe.image || '',
    used_ingredients: recipe.used_ingredients || '',
    used_ingredients_block: recipe.used_ingredients_block || '',
    block_reason: recipe.block_reason || '',
    link: recipe.link || '',
    platform: recipe.platform || 'youtube',
    channel: recipe.channel || 'youtube',
    likes: recipe.likes || recipe.like || 0,
    comments: recipe.comments || recipe.comment || 0,
    substitutes: recipe.substitutes || [],
    match_rate: recipe.match_rate || recipe.match || 0,
    my_ingredients: recipe.my_ingredients || [],
    need_ingredients: recipe.need_ingredients || [],
    created_at: recipe.created_at || '',
    updated_at: recipe.updated_at || '',
    like_count: recipe.like_count || 0,
    comment_count: recipe.comment_count || 0,
    post_time: recipe.post_time || '',
    collected_at: recipe.collected_at || '',
    hits: recipe.hits || 0,
    action: recipe.action,
  };
}

/**
 * 대체재료 테이블을 로드한다 (캐싱 적용)
 */
async function loadSubstituteTable(): Promise<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }> {
  const CACHE_KEY = 'substitute_table_cache';
  const CACHE_VERSION = '2.1'; // 배열 구조 및 유사도 점수 포함으로 버전 업데이트
  
  try {
    // 캐시 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          if (parsedCache.version === CACHE_VERSION && parsedCache.data) {
            console.log('[RecipeList] 캐시된 대체재료 테이블 사용');
            return parsedCache.data;
          }
        } catch (e) {
          // 캐시 파싱 실패 시 무시하고 새로 로드
        }
      }
    }
    
    // 캐시가 없으면 새로 로드
    const response = await fetch(CSV_SUBSTITUTE_URL);
    const csv = await response.text();
    
    const lines = csv.split('\n').filter(line => line.trim()); // 빈 행 제거
    if (lines.length === 0) {
      console.warn('[RecipeList] CSV 파일이 비어있습니다.');
      return {};
    }
    
    // 헤더 파싱 (따옴표 처리)
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
    
    const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const aIdx = header.indexOf('ingredient_a');
    const bIdx = header.indexOf('ingredient_b');
    const scoreIdx = header.indexOf('similarity_score');
    
    console.log('[RecipeList] CSV 헤더 파싱:', {
      headerLength: header.length,
      header: header,
      aIdx: aIdx,
      bIdx: bIdx,
      scoreIdx: scoreIdx
    });
    
    if (aIdx === -1 || bIdx === -1) {
      console.error('[RecipeList] 필요한 컬럼을 찾을 수 없습니다. ingredient_a:', aIdx, 'ingredient_b:', bIdx);
      return {};
    }
    
    const table: { [key: string]: { ingredient_b: string; similarity_score?: number }[] } = {};
    let processedCount = 0;
    let skippedCount = 0;
    
    lines.slice(1).forEach((line, lineIdx) => {
      const cols = parseCSVLine(line);
      if (cols.length < Math.max(aIdx, bIdx) + 1) {
        skippedCount++;
        if (lineIdx < 5) {
          console.warn(`[RecipeList] 행 ${lineIdx + 2} 컬럼 수 부족:`, cols.length, '컬럼, 필요:', Math.max(aIdx, bIdx) + 1);
        }
        return;
      }
      
      const a = cols[aIdx]?.trim();
      const b = cols[bIdx]?.trim();
      const scoreStr = scoreIdx >= 0 && cols[scoreIdx] ? cols[scoreIdx]?.trim() : undefined;
      
      if (a && b) {
        const score = scoreStr ? parseFloat(scoreStr) : undefined;
        
        // 하나의 재료에 대해 여러 대체제가 있을 수 있으므로 배열로 저장
        if (!table[a]) {
          table[a] = [];
        }
        table[a].push({
          ingredient_b: b,
          similarity_score: isNaN(score as number) ? undefined : score
        });
        processedCount++;
        
        // 디버깅: 처음 몇 개만 로그
        if (processedCount <= 5) {
          console.log(`[RecipeList] 대체제 추가: "${a}" → "${b}" (유사도: ${score ?? 'N/A'})`);
        }
      } else {
        skippedCount++;
      }
    });
    
    console.log(`[RecipeList] 대체제 테이블 파싱 완료: 처리 ${processedCount}개, 스킵 ${skippedCount}개`);
    
    // 각 재료별로 유사도 점수 순으로 정렬 (높은 순)
    Object.keys(table).forEach(key => {
      table[key].sort((a, b) => {
        const scoreA = a.similarity_score ?? 0;
        const scoreB = b.similarity_score ?? 0;
        return scoreB - scoreA;
      });
    });
    
    // 캐시에 저장
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          version: CACHE_VERSION,
          data: table
        }));
        console.log('[RecipeList] 대체재료 테이블 캐시 저장 완료', Object.keys(table).length, '개 재료');
        // 디버깅: 샘플 데이터 확인
        const sampleKeys = Object.keys(table).slice(0, 3);
        sampleKeys.forEach(key => {
          console.log(`[RecipeList] 샘플: "${key}" → ${table[key].length}개 대체제`, table[key]);
        });
      } catch (e) {
        console.warn('[RecipeList] 캐시 저장 실패:', e);
      }
    }
    
    return table;
  } catch (error) {
    console.warn('[RecipeList] 대체재료 테이블 로드 실패:', error);
    return {};
  }
}

/**
 * 재료 사전을 로드한다 (캐싱 적용)
 */
async function loadIngredientDictionary(): Promise<string[]> {
  const CACHE_KEY = 'ingredient_dict_cache';
  const CACHE_VERSION = '1.0';
  
  try {
    // 캐시 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          if (parsedCache.version === CACHE_VERSION && parsedCache.data) {
            console.log('[RecipeList] 캐시된 재료 사전 사용');
            return parsedCache.data;
          }
        } catch (e) {
          // 캐시 파싱 실패 시 무시하고 새로 로드
        }
      }
    }
    
    // 캐시가 없으면 새로 로드
    const response = await fetch(CSV_INGREDIENT_URL);
    const csv = await response.text();
    
    const lines = csv.split('\n');
    const header = lines[0].split(',');
    const nameIdx = header.indexOf('keyword');
    
    if (nameIdx === -1) return [];
    
    const ingredients = lines.slice(1)
      .map(line => line.split(',')[nameIdx]?.trim())
      .filter(name => !!name && name !== 'keyword');
    
    // 캐시에 저장
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          version: CACHE_VERSION,
          data: ingredients
        }));
        console.log('[RecipeList] 재료 사전 캐시 저장 완료');
      } catch (e) {
        console.warn('[RecipeList] 캐시 저장 실패:', e);
      }
    }
    
    return ingredients;
  } catch (error) {
    console.warn('[RecipeList] 재료 사전 로드 실패:', error);
    return [];
  }
}

/**
 * 레시피 데이터를 페이징으로 로드한다
 */
async function loadRecipesPaged(
  page = 1, 
  size = 20, 
  filters: {
    matchRateMin?: number;
    matchRateMax?: number;
    sortBy?: string;
    platform?: string;
    keyword?: string;
    includeIngredients?: string[];
    excludeIngredients?: string[];
    categoryKeywords?: Record<string, string[]>;
    appliedExpiryIngredients?: string[];
  } = {},
  categoryKeywordTree?: FilterKeywordTree | null
): Promise<{recipes: any[], total: number}> {
  try {
    // 환경변수가 없거나 빈 문자열이면 프로덕션 URL 사용
    // 로컬 개발 시 백엔드가 실행 중이면 localhost:5000 사용, 아니면 프로덕션 URL 사용
    const envApiUrl = import.meta.env?.VITE_API_BASE_URL;
    let apiUrl = 'https://refrigeratorcode-production.up.railway.app'; // 기본값: 프로덕션
    
    if (envApiUrl && envApiUrl.trim() !== '') {
      const trimmedUrl = envApiUrl.trim();
      // localhost:5000이 설정되어 있으면 그대로 사용 (백엔드 서버 실행 필요)
      if (trimmedUrl.includes('localhost:5000')) {
        apiUrl = trimmedUrl;
      } else {
        apiUrl = trimmedUrl;
      }
    }
    
    // 필터링 API 사용 - 필터가 가장 우선적으로 적용
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sort_by: filters.sortBy || 'match_rate'
    });
    
    // 재료 매칭도 필터 추가
    if (filters.matchRateMin !== undefined) {
      params.append('match_rate_min', filters.matchRateMin.toString());
    }
    if (filters.matchRateMax !== undefined) {
      params.append('match_rate_max', filters.matchRateMax.toString());
    }
    
    // 필터 파라미터 추가 (가장 우선순위)
    if (filters.platform) {
      params.append('platform', filters.platform);
    }
    
    if (filters.keyword) {
      params.append('keyword', filters.keyword);
    }
    
    if (filters.includeIngredients && filters.includeIngredients.length > 0) {
      params.append('include_ingredients', filters.includeIngredients.join(','));
    }
    
    if (filters.excludeIngredients && filters.excludeIngredients.length > 0) {
      params.append('exclude_ingredients', filters.excludeIngredients.join(','));
    }
    
    if (filters.categoryKeywords && Object.keys(filters.categoryKeywords).length > 0) {
      const hasAnyKeyword = Object.values(filters.categoryKeywords).some(keywords => keywords.length > 0);
      if (hasAnyKeyword) {
        // 동의어를 포함하여 키워드 확장
        const expanded: Record<string, string[]> = {};
        Object.entries(filters.categoryKeywords).forEach(([category, keywords]) => {
          if (keywords && keywords.length > 0) {
            const expandedKeywords = categoryKeywordTree
              ? extractKeywordsAndSynonyms(category, keywords, categoryKeywordTree)
              : keywords;
            expanded[category] = expandedKeywords;
          }
        });
        params.append('category_keywords', JSON.stringify(expanded));
      }
    }

    // 임박재료 필터 추가
    if (filters.appliedExpiryIngredients && filters.appliedExpiryIngredients.length > 0) {
      params.append('applied_expiry_ingredients', filters.appliedExpiryIngredients.join(','));
    }

    // 서버가 매칭률을 계산할 수 있도록 내 보유 재료 전달
    try {
      const my = getMyIngredients();
      if (my && my.length > 0) {
        params.append('my_ingredients', my.join(','));
      }
    } catch {}
    
    console.log('[RecipeList] loadRecipesPaged - API URL:', apiUrl, 'env:', import.meta.env?.VITE_API_BASE_URL, 'fullUrl:', `${apiUrl}/api/recipes/filter?${params.toString().substring(0, 100)}...`);
    
    const response: AxiosResponse<any> = await axios.get(`${apiUrl}/api/recipes/filter?${params}`);
    console.log('[RecipeList] API 전체 응답:', response.data);
    console.log('[RecipeList] API 응답 total:', response.data?.total);
    console.log('[RecipeList] API 응답 recipes 개수:', Array.isArray(response.data) ? response.data.length : (response.data?.recipes?.length || 0));
    console.log('[RecipeList] 요청 파라미터:', { page, size, filters });
    
    // response.data가 직접 배열인 경우와 response.data.recipes인 경우 모두 처리
    const recipesData = Array.isArray(response.data) ? response.data : (response.data.recipes || []);

    // 서버에서 필터링된 결과를 받아옴
    const recipes = recipesData.map((recipe: any) => ({
      ...recipe,
      date: formatDate(recipe.post_time || recipe.date || ''),
    }));

    // 플랫폼별 분포 확인
    const platformCounts: { [key: string]: number } = {};
    recipes.forEach((recipe: any) => {
      const platform = recipe.platform || 'unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    console.log('[RecipeList] API 응답 플랫폼별 분포:', platformCounts);
    
    const total = response.data?.total || recipes.length;
    console.log('[RecipeList] 최종 반환값:', { recipesCount: recipes.length, total });
    
    return {
      recipes,
      total
    };
  } catch (error) {
    console.warn('[RecipeList] API 레시피 로드 실패, 더미 데이터 사용:', error);
    const dummyData = await fetchRecipesDummy();
    return { recipes: dummyData, total: dummyData.length };
  }
}

// =====================
// 메인 컴포넌트
// =====================

const RecipeList: React.FC = () => {
  // =====================
  // 상태 관리
  // =====================
  
  const initialSortBarState = getInitialSortBarState();
  const [sortType, setSortType] = useState(initialSortBarState.sortType);
  const [matchRange, setMatchRange] = useState(initialSortBarState.matchRange);
  const [maxLack, setMaxLack] = useState(initialSortBarState.maxLack);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState(initialSortBarState.appliedExpiryIngredients);
  const [expirySortType, setExpirySortType] = useState(initialSortBarState.expirySortType);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [selectedTime, setSelectedTime] = useState('상관없음');
  const [recipes, setRecipes] = useState<any[]>([]); // 서버에서 받은 전체 데이터 (필터 버튼 조건 적용 후)
  const [filteredRecipes, setFilteredRecipes] = useState<any[]>([]); // 클라이언트 필터링 결과 (재료 매칭도, 임박 재료, maxLack 적용)
  const [cachedFilteredRecipes, setCachedFilteredRecipes] = useState<any[]>([]); // 필터링된 전체 결과 캐시 (정렬 기준 변경 시 재사용)
  const [lastFilterHash, setLastFilterHash] = useState<string>(''); // 마지막 필터 조건의 해시값 (필터 변경 감지용)
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }>({});
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerModalMessage, setRegisterModalMessage] = useState('');
  const [pendingRecipe, setPendingRecipe] = useState<{ id: number; type: 'done' | 'write'; recipe: any } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const { isLoggedIn } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<string[]>([]);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [selectedCategoryKeywords, setSelectedCategoryKeywords] = useState<FilterState>(initialFilterState);
  const [categoryKeywordTree, setCategoryKeywordTree] = useState<FilterKeywordTree | null>(null);
  // 페이징 관련 상태
  const [page, setPage] = useState(1);
  const [size] = useState(30); // 서버 사이드 페이지네이션용 크기
  const [total, setTotal] = useState(0); // 서버에서 필터링된 전체 개수
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // 로딩 진행률 (0-100)
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null); // 프로그레스 애니메이션 ref
  const currentProgressRef = useRef(0); // 현재 진행률을 추적하는 ref (애니메이션 충돌 방지)
  const listRef = useRef<VirtualizedRecipeListRef>(null);

  const [myIngredients, setMyIngredients] = useState<string[]>(getMyIngredients());
  const navigate = useNavigate();
  const location = useLocation();
  
  // 페이지 상태 저장/복원을 위한 키
  const STORAGE_KEY_RECIPE_LIST = 'recipe_list_state';
  const STORAGE_KEY_INGREDIENTS_HASH = 'recipe_list_ingredients_hash';
  
  // 재료 목록의 해시값 계산 (변경 감지용)
  const getIngredientsHash = useCallback(() => {
    const ingredients = getMyIngredients();
    return JSON.stringify(ingredients.sort());
  }, []);
  
  // 이전 재료 목록 해시값 저장
  const previousIngredientsHashRef = useRef<string>(getIngredientsHash());
  
  // 컴포넌트 마운트 시 sessionStorage에서 상태 복원 (재료 변경 감지 포함)
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(STORAGE_KEY_RECIPE_LIST);
      const savedIngredientsHash = sessionStorage.getItem(STORAGE_KEY_INGREDIENTS_HASH);
      const currentIngredientsHash = getIngredientsHash();
      
      console.log('[RecipeList] 마운트 시 재료 해시 확인:', {
        savedHash: savedIngredientsHash,
        currentHash: currentIngredientsHash,
        isMatch: savedIngredientsHash === currentIngredientsHash,
        hasSavedState: !!savedState
      });
      
      // 재료 목록이 변경되지 않았고 저장된 상태가 있으면 복원
      if (savedState && savedIngredientsHash === currentIngredientsHash) {
        const parsedState = JSON.parse(savedState);
        console.log('[RecipeList] 저장된 상태 복원:', {
          cachedRecipesCount: parsedState.cachedFilteredRecipes?.length || 0,
          total: parsedState.total,
          page: parsedState.page,
          sortType: parsedState.sortType,
          matchRange: parsedState.matchRange
        });
        
        // 상태 복원
        if (parsedState.cachedFilteredRecipes && parsedState.cachedFilteredRecipes.length > 0) {
          console.log('[RecipeList] 상태 복원 시작 - 레시피 즉시 표시');
          isRestoringState.current = true; // 복원 중 플래그 설정
          
          // 로딩 상태 및 프로그레스 바 초기화 (프로그레스 바가 표시되지 않도록)
          setLoading(false);
          setLoadingProgress(0);
          currentProgressRef.current = 0;
          
          // 먼저 lastFilterHash를 설정하여 필터 변경 useEffect가 실행되지 않도록 함
          setLastFilterHash(parsedState.lastFilterHash || '');
          initialLoadDone.current = true; // 복원했으므로 초기 로드 완료로 표시
          
          // 상태 복원
          setCachedFilteredRecipes(parsedState.cachedFilteredRecipes);
          setTotal(parsedState.total || 0);
          setPage(parsedState.page || 1);
          setSortType(parsedState.sortType || 'match');
          setMatchRange(parsedState.matchRange || [30, 100]);
          setSelectedChannel(parsedState.selectedChannel || []);
          setIncludeKeyword(parsedState.includeKeyword || '');
          setIncludeIngredients(parsedState.includeIngredients || []);
          setExcludeIngredients(parsedState.excludeIngredients || []);
          setSelectedCategoryKeywords(parsedState.selectedCategoryKeywords || initialFilterState);
          setAppliedExpiryIngredients(parsedState.appliedExpiryIngredients || []);
          previousIngredientsHashRef.current = currentIngredientsHash;
          
          // 복원된 데이터로 즉시 레시피 표시 (정렬 useEffect가 실행되기 전에 미리 설정)
          const restoredRecipes = parsedState.cachedFilteredRecipes;
          const restoredPage = parsedState.page || 1;
          const restoredSortType = parsedState.sortType || 'match';
          const restoredMyIngredients = getMyIngredients();
          const restoredAppliedExpiry = parsedState.appliedExpiryIngredients || [];
          
          // 클라이언트에서 정렬
          const sortedRecipes = sortRecipes(
            restoredRecipes,
            restoredSortType,
            restoredMyIngredients,
            restoredAppliedExpiry
          );
          
          // 페이지네이션 적용
          const startIndex = (restoredPage - 1) * size;
          const endIndex = startIndex + size;
          const paginatedRecipes = sortedRecipes.slice(startIndex, endIndex);
          
          setRecipes(paginatedRecipes);
          setMyIngredients(restoredMyIngredients);
          
          console.log('[RecipeList] 상태 복원 완료 - 레시피 즉시 표시됨:', {
            recipesCount: paginatedRecipes.length,
            total: parsedState.total,
            page: restoredPage,
            lastFilterHash: parsedState.lastFilterHash
          });
          
          // 복원 완료 후 플래그 해제 (필터 변경 useEffect가 실행되지 않도록 충분한 시간 확보)
          setTimeout(() => {
            isRestoringState.current = false;
          }, 500);
          
          return; // 복원했으면 초기 재료 설정 스킵
        }
      } else {
        // 재료 목록이 변경되었거나 저장된 상태가 없으면 재료 해시 업데이트
        console.log('[RecipeList] 재료 목록이 변경되었거나 저장된 상태 없음 - 다시 로드 필요:', {
          savedHash: savedIngredientsHash,
          currentHash: currentIngredientsHash,
          hasSavedState: !!savedState
        });
        
        // 재료가 변경되었으면 상태 초기화 및 다시 로드
        if (savedIngredientsHash && savedIngredientsHash !== currentIngredientsHash) {
          console.log('[RecipeList] 재료 목록 변경 감지 (마운트 시) - 상태 초기화 및 다시 로드');
          setCachedFilteredRecipes([]);
          setRecipes([]);
          setFilteredRecipes([]);
          setLastFilterHash('');
          initialLoadDone.current = false;
          
          // sessionStorage 초기화
          sessionStorage.removeItem(STORAGE_KEY_RECIPE_LIST);
        }
        
        sessionStorage.setItem(STORAGE_KEY_INGREDIENTS_HASH, currentIngredientsHash);
        previousIngredientsHashRef.current = currentIngredientsHash;
      }
    } catch (error) {
      console.warn('[RecipeList] 상태 복원 실패:', error);
    }
  }, [getIngredientsHash]); // 재료 해시가 변경될 때마다 확인

  // 컴포넌트 마운트 시 재료 상태 확인 및 초기 재료 설정
  useEffect(() => {
    const checkAndInitializeIngredients = async () => {
      // 먼저 현재 재료 확인
      let ingredients = getMyIngredients();
      console.log('[RecipeList] 마운트 시 재료 확인:', {
        count: ingredients.length,
        ingredients: ingredients,
        localStorageKeys: Object.keys(localStorage),
        hasMyFridgeKey: localStorage.getItem('myfridge_ingredients') !== null
      });
      
      // 재료가 없으면 초기 재료 설정
      console.log('[RecipeList] 재료 개수 체크:', {
        length: ingredients.length,
        isEmpty: ingredients.length === 0,
        ingredients: ingredients
      });
      
      if (ingredients.length === 0) {
        console.log('[RecipeList] 재료가 없음 - 초기 재료 설정 시작');
        
        let ingredientDict: { [key: string]: string } = {};
        
        try {
          // CSV 파일 로드하여 재료 사전 구축
          const csvResponse = await fetch(CSV_INGREDIENT_URL);
          if (!csvResponse.ok) {
            throw new Error(`CSV 파일 로드 실패: ${csvResponse.status} ${csvResponse.statusText}`);
          }
          const csv = await csvResponse.text();
          
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
          
          lines.slice(1).forEach(line => {
            if (!line.trim()) return; // 빈 줄 스킵
            
            const values = parseCSVLine(line);
            const keyword = values[nameIdx]?.trim();
            const synonymsStr = values[synonymsIdx]?.trim();
            const category = values[categoryIdx]?.trim();
            
            if (keyword && category === '재료') {
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
          
          console.log('[RecipeList] CSV 파일 로드 완료, 재료 사전 크기:', Object.keys(ingredientDict).length);
        } catch (error) {
          console.error('[RecipeList] CSV 파일 로드 실패 - 빈 재료 사전으로 초기화 진행:', error);
          // CSV 로드 실패해도 빈 사전으로 초기화 진행 (기본 재료 이름은 그대로 사용)
        }
        
        // CSV 로드 성공/실패와 관계없이 초기 재료 설정 시도
        const initialized = initializeDefaultIngredients(ingredientDict);
        if (initialized) {
          console.log('[RecipeList] 초기 재료 설정 완료');
          // 재료 다시 읽기
          ingredients = getMyIngredients();
          setMyIngredients(ingredients);
        } else {
          console.warn('[RecipeList] 초기 재료 설정 실패 또는 이미 재료가 있음');
        }
      } else {
        setMyIngredients(ingredients);
      }
    };
    
    checkAndInitializeIngredients();
  }, []);

  // localStorage 변경 감지 및 myIngredients 업데이트
  useEffect(() => {
    const updateMyIngredients = () => {
      const ingredients = getMyIngredients();
      console.log('[RecipeList] 재료 업데이트:', {
        count: ingredients.length,
        ingredients: ingredients,
        localStorageKeys: Object.keys(localStorage),
        hasMyFridgeKey: localStorage.getItem('myfridge_ingredients') !== null
      });
      setMyIngredients(ingredients);
    };

    // 페이지 포커스 시 업데이트
    const handleFocus = () => {
      console.log('[RecipeList] 페이지 포커스 - 재료 업데이트');
      updateMyIngredients();
    };

    // storage 이벤트 리스너 (다른 탭에서 변경 시)
    const handleStorageChange = (e: StorageEvent) => {
      console.log('[RecipeList] storage 이벤트:', e.key);
      if (e.key === 'myfridge_ingredients') {
        updateMyIngredients();
      }
    };

    // CustomEvent 리스너 (같은 탭에서 변경 시)
    const handleLocalStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('[RecipeList] localStorageChange 이벤트:', customEvent.detail);
      if (customEvent.detail?.key === 'myfridge_ingredients') {
        updateMyIngredients();
      }
    };

    // location 변경 시 업데이트 (페이지 이동 시)
    updateMyIngredients();

    // 주기적으로 재료 확인 (localStorage 동기화 문제 해결)
    const intervalId = setInterval(() => {
      const current = getMyIngredients();
      if (current.length !== myIngredients.length) {
        console.log('[RecipeList] 주기적 재료 확인 - 변경 감지:', {
          before: myIngredients.length,
          after: current.length
        });
        updateMyIngredients();
      }
    }, 1000); // 1초마다 확인

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleLocalStorageChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleLocalStorageChange);
    };
  }, [location, myIngredients.length]);

  // Filter_Keywords.csv 로드 (캐싱 적용)
  useEffect(() => {
    const CACHE_KEY = 'filter_keywords_cache';
    const CACHE_VERSION = '1.0';
    
    // 캐시 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          if (parsedCache.version === CACHE_VERSION && parsedCache.data) {
            console.log('[RecipeList] 캐시된 Filter_Keywords 사용');
            setCategoryKeywordTree(parsedCache.data);
            return;
          }
        } catch (e) {
          // 캐시 파싱 실패 시 무시하고 새로 로드
        }
      }
    }
    
    // 캐시가 없으면 새로 로드
    fetch('/Filter_Keywords.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(Boolean);
        const header = lines[0].split(',').map(h => h.trim());
        const idxMap = {
          대분류: header.indexOf('대분류'),
          중분류: header.indexOf('중분류'),
          키워드: header.indexOf('키워드'),
          동의어: header.indexOf('동의어'),
        };
        const tree: FilterKeywordTree = {};
        
        // CSV 파싱 헬퍼 함수 (따옴표 안의 쉼표 처리)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          
          return result;
        };
        
        for (let i = 1; i < lines.length; ++i) {
          const cols = parseCSVLine(lines[i]);
          const main = cols[idxMap.대분류]?.trim();
          const sub = cols[idxMap.중분류]?.trim();
          const keyword = cols[idxMap.키워드]?.trim();
          
          let synonymText = cols[idxMap.동의어]?.trim() || '';
          synonymText = synonymText.replace(/^["']|["']$/g, '');
          const synonyms = synonymText
            .split(/[,/|]/)
            .map(s => s.trim())
            .filter(Boolean);
          
          if (!main || !sub || !keyword) continue;
          
          if (!tree[main]) tree[main] = {};
          if (!tree[main][sub]) tree[main][sub] = [];
          tree[main][sub].push({ keyword, synonyms });
        }
        
        // 캐시에 저장
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('filter_keywords_cache', JSON.stringify({
              version: '1.0',
              data: tree
            }));
            console.log('[RecipeList] Filter_Keywords 캐시 저장 완료');
          } catch (e) {
            console.warn('[RecipeList] 캐시 저장 실패:', e);
          }
        }
        
        setCategoryKeywordTree(tree);
      })
      .catch(error => {
        console.error('Failed to load Filter_Keywords.csv:', error);
        setCategoryKeywordTree({});
      });
  }, []);

  // =====================
  // 이벤트 핸들러
  // =====================

  /**
   * 토스트 메시지를 표시한다
   */
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), TOAST_DURATION);
  };

  /**
   * 완료 버튼 클릭 처리
   */
  const handleDoneClick = (id: number) => {
    const isActive = recipeActionStates[id]?.done;
    
    if (!isActive) {
      // 완료 추가 전에 5개 조건 체크
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
        const currentCount = getRecipesFromLocalStorage('done').length;
        const totalCount = currentCount + 1;
        
        // 완료한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
        if (totalCount >= 5 && !isLoggedIn) {
          // 레시피 저장 전에 모달 표시
          const normalized = normalizeRecipe(recipe);
          setPendingRecipe({ id, type: 'done', recipe: normalized });
          setRegisterModalMessage('더 많은 레시피를 완료하려면');
          setShowRegisterModal(true);
          return;
        }
        
        // 조건 통과 시 레시피 저장
        const normalized = normalizeRecipe(recipe);
        addRecipeToLocalStorage('done', normalized);
        setRecipeActionStates(prev => ({ ...prev, [id]: { ...prev[id], done: true } }));
        showToast('레시피를 완료했습니다!');
      }
    } else {
      // 완료 취소
      removeRecipeFromLocalStorage('done', id);
      setRecipeActionStates(prev => ({ ...prev, [id]: { ...prev[id], done: false } }));
      showToast('레시피 완료를 취소했습니다!');
    }
  };

  /**
   * 기록 버튼 클릭 처리
   */
  const handleWriteClick = (id: number) => {
    const isActive = recipeActionStates[id]?.write;
    
    if (!isActive) {
      // 기록 추가 전에 5개 조건 체크
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
        const currentCount = getRecipesFromLocalStorage('write').length;
        const totalCount = currentCount + 1;
        
        // 기록한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
        if (totalCount >= 5 && !isLoggedIn) {
          // 레시피 저장 전에 모달 표시
          const normalized = normalizeRecipe(recipe);
          setPendingRecipe({ id, type: 'write', recipe: normalized });
          setRegisterModalMessage('더 많은 레시피를 기록하려면');
          setShowRegisterModal(true);
          return;
        }
        
        // 조건 통과 시 레시피 저장
        const normalized = normalizeRecipe(recipe);
        addRecipeToLocalStorage('write', normalized);
        setRecipeActionStates(prev => ({ ...prev, [id]: { ...prev[id], write: true } }));
        showToast('레시피를 기록했습니다!');
      }
    } else {
      // 기록 취소
      removeRecipeFromLocalStorage('write', id);
      setRecipeActionStates(prev => ({ ...prev, [id]: { ...prev[id], write: false } }));
      showToast('레시피 기록을 취소했습니다!');
    }
  };

  /**
   * 공유 버튼 클릭 처리
   */
  const handleShareClick = (recipe: any) => {
    try {
      copyRecipeUrlToClipboard(recipe);
      showToast('URL이 복사되었습니다!');
    } catch {
      showToast('URL 복사에 실패했습니다.');
    }
  };

  /**
   * 레시피 액션 처리
   */
  const handleRecipeAction = (recipe: any, action: string) => {
    switch (action) {
      case 'done':
        handleDoneClick(recipe.id);
        break;
      case 'write':
        handleWriteClick(recipe.id);
        break;
      case 'share':
        handleShareClick(recipe);
        break;
    }
  };

  // Reverting changes made to the filter button functionality
  // Remove the handleFilterButtonClick function and FilterModal rendering
  // This will restore the previous state before the recent changes

  // Remove the handleFilterButtonClick function
  // Remove the FilterModal rendering block

  // Ensure the previous state is restored
  // No changes to the existing filter button functionality

  // =====================
  // 사이드 이펙트
  // =====================

  // 재료 사전 및 대체재료 테이블 병렬 로드 (API 호출 최적화)
  useEffect(() => {
    // 두 CSV 파일을 병렬로 로드하여 로딩 시간 단축
    Promise.all([
      loadIngredientDictionary(),
      loadSubstituteTable(),
      preloadIngredientSynonymDict() // 동의어 사전도 미리 로드
    ]).then(([ingredients, substitutes]) => {
      setAllIngredients(ingredients);
      setSubstituteTable(substitutes);
      console.log('[RecipeList] CSV 파일 병렬 로드 완료');
      console.log('[RecipeList] 대체제 테이블 로드 확인:', {
        substituteTableKeys: Object.keys(substitutes).length,
        sampleKeys: Object.keys(substitutes).slice(0, 5),
        sampleData: Object.keys(substitutes).slice(0, 2).map(key => ({
          ingredient_a: key,
          substitutes: substitutes[key]
        }))
      });
    }).catch(error => {
      console.error('[RecipeList] CSV 파일 로드 실패:', error);
    });
  }, []);

  // 초기 로드 완료 여부 추적 (중복 쿼리 방지)
  const initialLoadDone = useRef(false);
  const isRestoringState = useRef(false); // 상태 복원 중인지 여부
  
  // 초기 로드는 필터 조건 변경 useEffect에서 처리하므로 별도의 초기 로드 useEffect 제거

  // 가이드 단계 정의
  const guideSteps = [
    {
      targetSelector: '[data-guide-target="match-rate-button"]',
      message: '내 냉장고 재료와 레시피의 매칭률을\n조정할 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="expiry-button"]',
      message: '유통기한이 임박한 재료를 선택해서\n그 재료를 활용한 레시피를 우선 볼 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="sort-dropdown"]',
      message: '여기서 레시피 정렬 기준을 선택할 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="filter-button"]',
      message: '효능, 영양분, 대상, TPO 등\n다양한 조건으로 레시피를 필터링할 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="recipe-done-button"]',
      message: (
        <>
          완료(<span style={{ color: '#000' }}>✓</span>) 버튼을 누르면 레시피를 완료 상태로 저장해요.<br />
          완료 레시피는 마이페이지에서 확인할 수 있어요.
        </>
      ),
      position: 'left' as const,
    },
    {
      targetSelector: '[data-guide-target="recipe-share-button"]',
      message: (
        <>
          공유(<span style={{ color: '#000' }}>➣</span>) 레시피 링크를 복사해서<br />
          다른 사람과 공유할 수 있어요.
        </>
      ),
      position: 'left' as const,
    },
    {
      targetSelector: '[data-guide-target="recipe-write-button"]',
      message: (
        <>
          기록(<span style={{ color: '#000' }}>⟎</span>) 버튼을 누르면 레시피를 기록 상태로 저장해요.<br />
          기록한 레시피는 마이페이지에서 확인할 수 있어요.
        </>
      ),
      position: 'left' as const,
    },
  ];

  // 가이드 표시 로직
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceShowGuide = urlParams.get('showGuide') === 'true';
    const fromGuide = urlParams.get('fromGuide') === 'true';
    const guideShown = localStorage.getItem('recipe_guide_shown');
    const myFridgeGuideCompleted = localStorage.getItem('myfridge_guide_completed');

    console.log('[RecipeList] 가이드 표시 로직 체크:', {
      myFridgeGuideCompleted,
      guideShown,
      forceShowGuide,
      fromGuide,
      loading,
      filteredRecipesLength: filteredRecipes.length,
      recipesLength: recipes.length,
      showGuideState: showGuide
    });

    // 강제 표시 또는 내냉장고 가이드에서 온 경우에는 guideShown 무시
    const shouldForceShow = forceShowGuide || fromGuide || myFridgeGuideCompleted === 'true';
    
    // 가이드가 이미 표시 중이거나, 강제 표시가 아닌데 이미 본 경우 스킵
    if (showGuide || (!shouldForceShow && guideShown)) {
      return;
    }

    // 내냉장고 가이드에서 온 경우 또는 플래그가 있는 경우
    const shouldShowGuide = shouldForceShow;

    if (shouldShowGuide) {
      // 레시피가 로드된 후 가이드 표시
      const showGuideWhenReady = () => {
        if (!loading && (filteredRecipes.length > 0 || recipes.length > 0)) {
          console.log('[RecipeList] 레시피 로드 완료 - 가이드 표시 예정');
          if (myFridgeGuideCompleted === 'true') {
            localStorage.removeItem('myfridge_guide_completed');
          }
          // URL 파라미터 제거
          if (fromGuide) {
            window.history.replaceState({}, '', '/recipe-list');
          }
          setTimeout(() => {
            console.log('[RecipeList] 가이드 표시 실행');
            setShowGuide(true);
            setGuideStep(0);
          }, 2000); // 웹에서 더 긴 대기 시간
          return true;
        }
        return false;
      };

      // 즉시 체크
      if (!showGuideWhenReady()) {
        console.log('[RecipeList] 레시피가 아직 로드되지 않음 - 대기 중');
        // 레시피가 아직 로드되지 않았으면 주기적으로 체크
        const checkInterval = setInterval(() => {
          if (showGuideWhenReady()) {
            clearInterval(checkInterval);
          }
        }, 500);
        
        // 최대 30초 대기 (웹에서 더 긴 대기)
        setTimeout(() => {
          clearInterval(checkInterval);
          if (localStorage.getItem('myfridge_guide_completed') === 'true') {
            localStorage.removeItem('myfridge_guide_completed');
          }
          if (fromGuide) {
            window.history.replaceState({}, '', '/recipe-list');
          }
        }, 30000);
        
        return () => clearInterval(checkInterval);
      }
    }
  }, [filteredRecipes.length, recipes.length, loading, showGuide]);

  // 필터 조건 변경 감지 (정렬 기준 제외)
  // 초기 로드 시에도 기본값 [30, 100]을 사용하도록 보장
  const filterHash = useMemo(() => {
    // 초기 로드 시 기본값 강제 적용 (sessionStorage에 저장된 값이 있어도 초기 로드 시에는 기본값 사용)
    const effectiveMatchRange = initialLoadDone.current ? matchRange : [30, 100];
    
    return JSON.stringify({
      selectedChannel,
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      selectedCategoryKeywords,
      matchRange: effectiveMatchRange,
      appliedExpiryIngredients
    });
  }, [selectedChannel, includeKeyword, includeIngredients, excludeIngredients, selectedCategoryKeywords, matchRange, appliedExpiryIngredients]);

  // 필터 조건이 변경되면 전체 필터링된 결과를 한 번에 받아서 캐싱
  useEffect(() => {
    // 상태 복원 중이면 스킵
    if (isRestoringState.current) {
      console.log('[RecipeList] 상태 복원 중 - 필터 변경 useEffect 스킵');
      return;
    }
    
    // 필터 조건이 변경되지 않았으면 스킵 (단, 초기 로드 시에는 실행)
    if (filterHash === lastFilterHash && cachedFilteredRecipes.length > 0 && initialLoadDone.current) {
      return;
    }

    setLoading(true);
    // 기존 애니메이션 정리
    if (progressAnimationRef.current) {
      clearInterval(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
    setLoadingProgress(0);
    currentProgressRef.current = 0; // ref도 초기화
    setRecipes([]);
    setFilteredRecipes([]);
    setCachedFilteredRecipes([]);
    
    // 필터 조건과 재료 매칭도 필터를 서버에 전달 (사용자가 선택한 정렬 기준 사용)
    // 초기 로드 시 기본값 [30, 100] 강제 적용 (initialLoadDone이 false일 때)
    const effectiveMatchRange = initialLoadDone.current ? matchRange : [30, 100];
    
    // sortType을 서버 API의 sort_by 형식으로 변환
    const getSortByForAPI = (sortType: string): string => {
      switch (sortType) {
        case 'match': return 'match_rate';
        case 'latest': return 'date';
        case 'like': return 'like';
        case 'comment': return 'comment';
        case 'hits': return 'hits';
        case 'expiry': return 'match_rate'; // expiry는 임박재료 우선, 그 다음 매칭률
        default: return 'match_rate';
      }
    };
    
    const filterParams = {
      matchRateMin: effectiveMatchRange[0],
      matchRateMax: effectiveMatchRange[1],
      sortBy: getSortByForAPI(sortType), // 사용자가 선택한 정렬 기준 사용
      platform: selectedChannel.length > 0 ? selectedChannel[0] : undefined,
      keyword: includeKeyword || undefined,
      includeIngredients: includeIngredients.length > 0 ? includeIngredients : undefined,
      excludeIngredients: excludeIngredients.length > 0 ? excludeIngredients : undefined,
      categoryKeywords: selectedCategoryKeywords && Object.keys(selectedCategoryKeywords).length > 0 ? selectedCategoryKeywords : undefined,
      appliedExpiryIngredients: appliedExpiryIngredients.length > 0 ? appliedExpiryIngredients : undefined
    };
    
    // 프로그레스 바를 부드럽게 증가시키는 헬퍼 함수
    const animateProgress = (targetProgress: number, duration: number = 500) => {
      // 기존 애니메이션 정리
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
      
      // ref에서 현재 진행률 가져오기 (항상 최신 값)
      const startProgress = currentProgressRef.current;
      const difference = targetProgress - startProgress;
      
      // 차이가 너무 작으면 애니메이션 생략
      if (Math.abs(difference) < 1) {
        setLoadingProgress(targetProgress);
        currentProgressRef.current = targetProgress;
        return;
      }
      
      const steps = Math.max(10, Math.min(30, Math.abs(difference) * 2)); // 차이에 따라 단계 수 조정
      const stepDuration = duration / steps;
      const stepIncrement = difference / steps;
      
      let currentStep = 0;
      progressAnimationRef.current = setInterval(() => {
        currentStep++;
        const newProgress = Math.min(
          Math.max(startProgress + (stepIncrement * currentStep), 0),
          targetProgress
        );
        const roundedProgress = Math.round(newProgress);
        setLoadingProgress(roundedProgress);
        currentProgressRef.current = roundedProgress; // ref 업데이트
        
        if (currentStep >= steps || newProgress >= targetProgress) {
          setLoadingProgress(targetProgress);
          currentProgressRef.current = targetProgress;
          if (progressAnimationRef.current) {
            clearInterval(progressAnimationRef.current);
            progressAnimationRef.current = null;
          }
        }
      }, stepDuration);
    };
    
    // 전체 필터링된 결과를 한 번에 받기 위해 큰 size 사용 (서버에서 정렬된 상태로)
    // 먼저 total을 확인하기 위해 작은 size로 요청한 후, 실제 total만큼 받기
    animateProgress(10, 200); // 초기 진행률
    loadRecipesPaged(1, 1, filterParams, categoryKeywordTree).then(({total: initialTotal}) => {
      animateProgress(30, 300); // total 확인 완료
      // total이 확인되면 실제 전체 개수만큼 받기 (제한 없음)
      const actualSize = initialTotal;
      console.log('[RecipeList] 레시피 로드:', {
        total: initialTotal,
        actualSize: actualSize
      });
      
      // 데이터 로드 시작 시 중간 단계 추가
      const loadPromise = loadRecipesPaged(1, actualSize, filterParams, categoryKeywordTree);
      
      // 데이터 로드 중간에 진행률 업데이트 (시간 기반)
      const progressInterval = setInterval(() => {
        const current = currentProgressRef.current;
        if (current < 60) {
          animateProgress(60, 500); // 데이터 로드 중 60%
        } else if (current < 80) {
          animateProgress(80, 500); // 데이터 로드 중 80%
        }
      }, 800); // 0.8초마다 체크
      
      return loadPromise.then((result) => {
        clearInterval(progressInterval); // 인터벌 정리
        return result;
      });
    }).then(({recipes, total}) => {
      // 데이터 로드 완료 시 90%로 이동
      animateProgress(90, 300);
      // 서버에서 정렬된 전체 데이터를 캐시에 저장
      setCachedFilteredRecipes(recipes);
      setTotal(total);
      setPage(1); // 필터 변경 시 항상 1페이지로 리셋
      setLastFilterHash(filterHash);
      // 초기 로드 완료 표시
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
      }
      // 약간의 지연 후 100%로
      setTimeout(() => {
        animateProgress(100, 200); // 완료
      }, 100);
      // 약간의 지연 후 로딩 상태 해제 (프로그레스 바가 100%까지 보이도록)
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
        currentProgressRef.current = 0;
        // 애니메이션 정리
        if (progressAnimationRef.current) {
          clearInterval(progressAnimationRef.current);
          progressAnimationRef.current = null;
        }
      }, 500);
    }).catch(error => {
      console.error('Error loading recipes:', error);
      setLoading(false);
      setLoadingProgress(0);
      currentProgressRef.current = 0;
      // 애니메이션 정리
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    });
  }, [filterHash, lastFilterHash, cachedFilteredRecipes.length, selectedChannel, includeKeyword, includeIngredients, excludeIngredients, selectedCategoryKeywords, matchRange, appliedExpiryIngredients, categoryKeywordTree, loadRecipesPaged]);
  
  // 상태가 변경될 때마다 sessionStorage에 저장
  useEffect(() => {
    if (cachedFilteredRecipes.length > 0 && initialLoadDone.current) {
      try {
        const stateToSave = {
          cachedFilteredRecipes,
          total,
          page,
          sortType,
          matchRange,
          lastFilterHash,
          selectedChannel,
          includeKeyword,
          includeIngredients,
          excludeIngredients,
          selectedCategoryKeywords,
          appliedExpiryIngredients,
          ingredientsHash: getIngredientsHash()
        };
        sessionStorage.setItem(STORAGE_KEY_RECIPE_LIST, JSON.stringify(stateToSave));
        sessionStorage.setItem(STORAGE_KEY_INGREDIENTS_HASH, getIngredientsHash());
        previousIngredientsHashRef.current = getIngredientsHash();
      } catch (error) {
        console.warn('[RecipeList] 상태 저장 실패:', error);
      }
    }
  }, [cachedFilteredRecipes, total, page, sortType, matchRange, lastFilterHash, selectedChannel, includeKeyword, includeIngredients, excludeIngredients, selectedCategoryKeywords, appliedExpiryIngredients, getIngredientsHash]);
  
  // 재료 목록 변경 감지 및 처리 (localStorage 변경 이벤트 감지)
  useEffect(() => {
    const handleLocalStorageChange = (e: CustomEvent) => {
      // myfridge_ingredients가 변경되었는지 확인
      if (e.detail?.key === STORAGE_KEY_MYFRIDGE) {
        const currentIngredientsHash = getIngredientsHash();
        
        // 재료 목록이 변경되었는지 확인
        if (previousIngredientsHashRef.current !== currentIngredientsHash) {
          console.log('[RecipeList] 재료 목록 변경 감지 (CustomEvent) - 상태 초기화 및 다시 로드');
          
          // 재료 목록이 변경되었으면 상태 초기화 및 다시 로드
          setCachedFilteredRecipes([]);
          setRecipes([]);
          setFilteredRecipes([]);
          setLastFilterHash('');
          initialLoadDone.current = false;
          
          // sessionStorage 초기화
          sessionStorage.removeItem(STORAGE_KEY_RECIPE_LIST);
          sessionStorage.setItem(STORAGE_KEY_INGREDIENTS_HASH, currentIngredientsHash);
          previousIngredientsHashRef.current = currentIngredientsHash;
          
          // 재료 목록 업데이트
          setMyIngredients(getMyIngredients());
        }
      }
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      // 다른 탭에서 변경된 경우
      if (e.key === STORAGE_KEY_MYFRIDGE || e.key === null) {
        const currentIngredientsHash = getIngredientsHash();
        
        if (previousIngredientsHashRef.current !== currentIngredientsHash) {
          console.log('[RecipeList] 재료 목록 변경 감지 (StorageEvent) - 상태 초기화 및 다시 로드');
          
          setCachedFilteredRecipes([]);
          setRecipes([]);
          setFilteredRecipes([]);
          setLastFilterHash('');
          initialLoadDone.current = false;
          
          sessionStorage.removeItem(STORAGE_KEY_RECIPE_LIST);
          sessionStorage.setItem(STORAGE_KEY_INGREDIENTS_HASH, currentIngredientsHash);
          previousIngredientsHashRef.current = currentIngredientsHash;
          
          setMyIngredients(getMyIngredients());
        }
      }
    };
    
    // CustomEvent 리스너 등록 (같은 탭에서 변경된 경우)
    window.addEventListener('localStorageChange', handleLocalStorageChange as EventListener);
    
    // StorageEvent 리스너 등록 (다른 탭에서 변경된 경우)
    window.addEventListener('storage', handleStorageChange);
    
    // 주기적으로 재료 목록 변경 확인 (백업용)
    const checkInterval = setInterval(() => {
      const currentIngredientsHash = getIngredientsHash();
      if (previousIngredientsHashRef.current !== currentIngredientsHash) {
        console.log('[RecipeList] 재료 목록 변경 감지 (polling) - 상태 초기화 및 다시 로드');
        
        setCachedFilteredRecipes([]);
        setRecipes([]);
        setFilteredRecipes([]);
        setLastFilterHash('');
        initialLoadDone.current = false;
        
        sessionStorage.removeItem(STORAGE_KEY_RECIPE_LIST);
        sessionStorage.setItem(STORAGE_KEY_INGREDIENTS_HASH, currentIngredientsHash);
        previousIngredientsHashRef.current = currentIngredientsHash;
        
        setMyIngredients(getMyIngredients());
      }
    }, 2000); // 2초마다 확인 (성능 고려)
    
    return () => {
      window.removeEventListener('localStorageChange', handleLocalStorageChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [getIngredientsHash]);

  // 정렬 기준만 변경되면 캐시된 데이터를 클라이언트에서 정렬 (서버에서 이미 정렬된 데이터 사용)
  // 페이지 변경 시에도 캐시된 데이터에서 페이지네이션
  useEffect(() => {
    if (cachedFilteredRecipes.length === 0) {
      return;
    }

    // maxLack 필터 적용 (cachedFilteredRecipes에 적용)
    let filteredByMaxLack = [...cachedFilteredRecipes];
    if (maxLack !== 'unlimited') {
      filteredByMaxLack = filteredByMaxLack.filter(recipe => {
        // need_ingredients가 없으면 calculateMatchRate를 사용하여 계산
        let needIngredients = recipe.need_ingredients;
        if (!needIngredients || needIngredients.length === 0) {
          const matchResult = calculateMatchRate(myIngredients, recipe.used_ingredients || []);
          needIngredients = matchResult.need_ingredients;
        }
        
        const lackCount = needIngredients.length;
        // maxLack === 5는 '최대 5개 부족'을 의미하므로 <= 5로 처리
        return lackCount <= maxLack;
      });
    }

    // maxLack 필터가 적용된 후의 총 개수를 total로 업데이트
    setTotal(filteredByMaxLack.length);

    // 서버에서 정렬된 데이터이지만, 동의어 처리를 고려하여 프론트엔드에서 다시 정렬해야 함
    // 서버는 동의어를 고려하지 않고 match_rate를 계산하므로, 프론트엔드에서 동의어를 고려한 매칭률로 재정렬 필요
    const effectiveSortType = initialLoadDone.current ? sortType : 'match';
    
    // 동의어를 고려하여 매칭률을 다시 계산하고 정렬
    // 먼저 모든 레시피에 대해 동의어를 고려한 매칭률 계산
    const recipesWithCorrectMatchRate = filteredByMaxLack.map(recipe => {
      const matchResult = calculateMatchRate(
        myIngredients,
        recipe.used_ingredients || '',
        ingredientSynonymDictCache // 동의어 사전 사용
      );
      return {
        ...recipe,
        match_rate: matchResult.rate, // 동의어를 고려한 정확한 매칭률
        my_ingredients: matchResult.my_ingredients,
        need_ingredients: matchResult.need_ingredients
      };
    });
    
    // 정렬 기준에 따라 정렬
    const sortedRecipes = sortRecipes(
      recipesWithCorrectMatchRate,
      effectiveSortType,
      myIngredients,
      appliedExpiryIngredients
    );

    // 페이지네이션 적용
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    const paginatedRecipes = sortedRecipes.slice(startIndex, endIndex);

    setRecipes(paginatedRecipes);
  }, [sortType, cachedFilteredRecipes, page, size, myIngredients, appliedExpiryIngredients, maxLack, initialLoadDone]);
  
  // 필터가 변경되면 초기 로드 플래그 리셋 (필터 적용 시 다시 로드)
  useEffect(() => {
    if (selectedCategoryKeywords && Object.keys(selectedCategoryKeywords).length > 0) {
      initialLoadDone.current = false;
    }
  }, [selectedCategoryKeywords]);
  
  // RecipeSortBar에서 임박 재료와 maxLack 필터를 적용하여 filteredRecipes를 업데이트함
  // 재료 매칭도 필터는 서버에서 적용됨

  // 키워드/재료 필터가 적용될 때는 더 많은 데이터를 로드
  const loadMoreDataForFiltering = useCallback(async () => {
    setLoading(true);
    
    // 필터링을 위해 더 많은 데이터를 로드 (최대 1000개)
    const filters = {
      matchRateMin: matchRange[0],
      matchRateMax: matchRange[1],
      sortBy: sortType === 'match' ? 'match_rate' : 
              sortType === 'latest' ? 'date' : 
              sortType === 'like' ? 'like' : 
              sortType === 'comment' ? 'comment' : 
              sortType === 'hits' ? 'hits' : 
              sortType === 'expiry' ? 'match_rate' : 'match_rate',
      platform: selectedChannel.length > 0 ? selectedChannel[0] : undefined,
      appliedExpiryIngredients: appliedExpiryIngredients.length > 0 ? appliedExpiryIngredients : undefined
    };
    
    try {
      const {recipes: newRecipes, total: newTotal} = await loadRecipesPaged(1, 1000, filters, categoryKeywordTree);
      setRecipes(newRecipes);
      setTotal(newTotal);
      setPage(1);
    } catch (error) {
      console.error('Error loading more data for filtering:', error);
    } finally {
      setLoading(false);
    }
  }, [matchRange, sortType, selectedChannel, appliedExpiryIngredients]);

  // 필터/정렬 상태 저장
  useEffect(() => {
    const state = {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      expirySortType
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

  // =====================
  // 계산된 값
  // =====================

  const myIngredientObjects = getMyIngredientObjects();
  const sortedExpiryList = useMemo(() => {
    if (expirySortType === 'expiry') {
      return myIngredientObjects.filter(i => i.expiry).sort((a, b) => (a.expiry > b.expiry ? 1 : -1));
    } else {
      return myIngredientObjects.filter(i => i.purchase).sort((a, b) => (a.purchase > b.purchase ? 1 : -1));
    }
  }, [myIngredientObjects, expirySortType]);

  // 페이지 변경 핸들러 (클라이언트 사이드 페이지네이션)
  const handlePageChange = (newPage: number) => {
    // 페이지 상단으로 즉시 스크롤 (페이지 변경 전에)
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // VirtualizedRecipeList의 스크롤도 제어
    if (listRef.current) {
      listRef.current.scrollToOffset(0);
    }
    
    setPage(newPage);
    // 페이지 변경은 위의 useEffect에서 자동으로 처리됨
  };

  // 페이지 변경 시 데이터 로딩 완료 후 스크롤 (useLayoutEffect로 DOM 업데이트 직후 실행)
  useLayoutEffect(() => {
    // 페이지가 변경되었을 때만 스크롤
    if (!loading && filteredRecipes.length > 0) {
      // 레이아웃이 완전히 렌더링된 후 상단으로 스크롤
      const scrollToTop = () => {
        // window 스크롤
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        // VirtualizedRecipeList의 스크롤도 제어
        if (listRef.current) {
          listRef.current.scrollToOffset(0);
        }
        
        // 모든 스크롤 가능한 요소도 확인
        const scrollableElements = document.querySelectorAll('[data-scroll-container], .custom-scrollbar, [style*="overflow"]');
        scrollableElements.forEach((el: any) => {
          if (el.scrollTop !== undefined) {
            el.scrollTop = 0;
          }
        });
      };
      
      // 즉시 실행
      scrollToTop();
      
      // requestAnimationFrame으로 한 번 더
      requestAnimationFrame(() => {
        scrollToTop();
        // 추가로 약간의 지연 후 한 번 더 (레이아웃 완전 반영 대기)
        setTimeout(() => {
          scrollToTop();
        }, 50);
        // 더 긴 지연 후 한 번 더 (가상화 리스트 렌더링 완료 대기)
        setTimeout(() => {
          scrollToTop();
        }, 200);
      });
    }
  }, [page, loading, filteredRecipes.length]);

  // =====================
  // 렌더링
  // =====================

  return (
    <>
      <div 
        className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400,
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 88, // 헤더 높이(56px) + 여백(32px)
        }}
      >
        <h2 className="text-lg font-bold mb-4 text-center">
          내 냉장고 기반 레시피 추천
        </h2>
        
        <RecipeSortBar
          recipes={recipes}
          myIngredients={myIngredients}
          onFilteredRecipesChange={setFilteredRecipes}
          onLoadMoreDataForFiltering={loadMoreDataForFiltering}
          sortType={sortType}
          setSortType={setSortType}
          matchRange={matchRange}
          setMatchRange={setMatchRange}
          maxLack={maxLack}
          setMaxLack={setMaxLack}
          appliedExpiryIngredients={appliedExpiryIngredients}
          setAppliedExpiryIngredients={setAppliedExpiryIngredients}
          expirySortType={expirySortType}
          setExpirySortType={setExpirySortType}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          includeKeyword={includeKeyword}
          setIncludeKeyword={setIncludeKeyword}
          includeIngredients={includeIngredients}
          setIncludeIngredients={setIncludeIngredients}
          excludeIngredients={excludeIngredients}
          setExcludeIngredients={setExcludeIngredients}
          selectedCategoryKeywords={selectedCategoryKeywords}
          setSelectedCategoryKeywords={setSelectedCategoryKeywords}
          includeInput={includeInput}
          setIncludeInput={setIncludeInput}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          onToast={msg => {
            setToast(msg);
            setTimeout(() => setToast(''), 3000);
          }}
        />
        
        {/* 재료 pill 범례와 카드 리스트를 같은 부모 div 안에 배치 */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: 16, 
            marginTop: 8 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ 
                  width: 24, 
                  height: 14, 
                  borderRadius: 7, 
                  background: '#D1D1D1', 
                  display: 'inline-block', 
                  marginRight: 2 
                }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>부족 재료</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ 
                  width: 24, 
                  height: 14, 
                  borderRadius: 7, 
                  background: '#555', 
                  display: 'inline-block', 
                  marginRight: 2 
                }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>대체 가능</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ 
                  width: 24, 
                  height: 14, 
                  borderRadius: 7, 
                  background: '#FFD600', 
                  display: 'inline-block', 
                  marginRight: 2 
                }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>보유 재료</span>
              </div>
            </div>
            <span style={{ color: '#666', fontSize: '12px' }}>
              총 {total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}건
            </span>
          </div>
          
          {/* Render recipe cards only when not loading */}
          {!loading && (
            <div className="flex flex-col gap-2">
              {(() => {
                // 재료가 없거나, 디폴트 '달걀'만 있고 레시피가 없을 때 안내 문구 표시
                const hasOnlyDefaultEgg = myIngredients.length === 1 && 
                  (myIngredients[0] === '달걀' || myIngredients[0] === '계란');
                const currentRecipes = filteredRecipes.length > 0 ? filteredRecipes : recipes;
                const hasNoRecipes = currentRecipes.length === 0;
                const hasNoIngredients = myIngredients.length === 0;
                const hasIngredientsButNoRecipes = !hasNoIngredients && !hasOnlyDefaultEgg && hasNoRecipes;
                const shouldShowNoIngredientsMessage = hasNoIngredients || (hasOnlyDefaultEgg && hasNoRecipes);
                
                // 디버깅용 로그
                console.log('RecipeList 안내 문구 체크:', {
                  myIngredientsLength: myIngredients.length,
                  myIngredients: myIngredients,
                  hasOnlyDefaultEgg,
                  currentRecipesLength: currentRecipes.length,
                  cachedFilteredRecipesLength: cachedFilteredRecipes.length,
                  hasNoRecipes,
                  hasNoIngredients,
                  hasIngredientsButNoRecipes,
                  shouldShowNoIngredientsMessage,
                  loading
                });
                
                // 로딩이 완료되었고 캐시된 데이터가 있을 때만 "노데이터" 화면 표시
                // (로딩 중이거나 데이터가 로드 중일 때는 표시하지 않음)
                if (cachedFilteredRecipes.length === 0 && !loading) {
                  // 데이터 로드가 완료되었지만 캐시가 비어있으면 빈 화면 표시하지 않음
                  // (로딩 화면이 계속 표시됨)
                  return null;
                }
                
                if (shouldShowNoIngredientsMessage) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '180px 20px',
                      color: '#666',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px',
                      minHeight: '50vh'
                    }}>
                      <img 
                        src={nodataImg} 
                        alt="데이터 없음" 
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'contain'
                        }}
                      />
                      <div>
                        등록된 재료가 없습니다.<br />
                        내냉장고 페이지에서 재료를 등록해 주세요.
                      </div>
                    </div>
                  );
                } else if (hasIngredientsButNoRecipes) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '180px 20px',
                      color: '#666',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px',
                      minHeight: '50vh'
                    }}>
                      <img 
                        src={nodataImg} 
                        alt="데이터 없음" 
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'contain'
                        }}
                      />
                      <div>
                        등록된 내냉장고 재료가 부족하거나<br />
                        검색·필터 조건이 너무 좁습니다.<br />
                        재료를 추가하거나 조건을 넓혀주세요.
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <VirtualizedRecipeList
                      ref={listRef}
                      recipes={currentRecipes}
                      myIngredients={myIngredients}
                      substituteTable={substituteTable}
                      recipeActionStates={recipeActionStates}
                      onRecipeAction={handleRecipeAction}
                    />
                  );
                }
              })()}
            </div>
          )}
          
          {/* 페이지네이션 - 이미지 형식 */}
          {!loading && total > 0 && (() => {
          const totalPages = Math.ceil(total / size);
          const getPageNumbers = () => {
            const pages: number[] = [];
            const maxVisible = 5; // 현재 페이지 주변에 표시할 페이지 수
            
            if (totalPages <= maxVisible) {
              // 전체 페이지가 적으면 모두 표시
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              // 현재 페이지 주변 페이지 계산
              let start = Math.max(1, page - 2);
              let end = Math.min(totalPages, page + 2);
              
              // 앞쪽에 페이지가 부족하면 뒤쪽으로 보정
              if (end - start < 4) {
                if (start === 1) {
                  end = Math.min(totalPages, start + 4);
                } else if (end === totalPages) {
                  start = Math.max(1, end - 4);
                }
              }
              
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
            }
            
            return pages;
          };
          
          const pageNumbers = getPageNumbers();
          
          return (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '4px', 
              marginTop: '0px',
              marginBottom: '8px',
              width: '100%',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
              padding: '0 14px',
              boxSizing: 'border-box'
            }}>
              {/* 맨 처음으로 << */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                style={{
                  padding: '6px 8px',
                  background: 'transparent',
                  color: page === 1 ? '#d1d5db' : '#222',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                &laquo;
              </button>
              
              {/* 이전 페이지 < */}
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                style={{
                  padding: '6px 8px',
                  background: 'transparent',
                  color: page === 1 ? '#d1d5db' : '#222',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                &lsaquo;
              </button>
              
              {/* 페이지 번호 */}
              <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                {pageNumbers.map((pageNum) => {
                  const isCurrentPage = pageNum === page;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '6px 10px',
                        background: isCurrentPage ? '#222' : 'transparent',
                        color: isCurrentPage ? '#fff' : '#222',
                        fontWeight: '500',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        minWidth: '32px',
                        height: '32px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentPage) {
                          e.currentTarget.style.background = '#f5f5f5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentPage) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              {/* 다음 페이지 > */}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                style={{
                  padding: '6px 8px',
                  background: 'transparent',
                  color: page >= totalPages ? '#d1d5db' : '#222',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                &rsaquo;
              </button>
              
              {/* 맨 끝으로 >> */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={page >= totalPages}
                style={{
                  padding: '6px 8px',
                  background: 'transparent',
                  color: page >= totalPages ? '#d1d5db' : '#222',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                &raquo;
              </button>
            </div>
          );
        })()}
        </div>
        
      </div>
      
      <BottomNavBar activeTab="recipe" />
      
      {toast && <RecipeToast message={toast} />}
        {/* Loading animation - 초기 로드/필터 변경/페이지 변경 시 표시 */}
        {loading && (
          <div className="loader-toast" style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.98)',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            minWidth: '200px',
            maxWidth: '240px',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            <div className="loader-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <div style={{ 
              textAlign: 'center',
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '2px', color: '#222', fontSize: '14px' }}>
                레시피를 불러오는 중...
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                재료 수에 따라<br />
                시간이 걸릴 수 있습니다
              </div>
            </div>
            {/* 프로그레스 바 */}
            <div style={{
              width: '100%',
              height: '6px',
              background: '#f0f0f0',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '4px',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${loadingProgress}%`,
                background: 'linear-gradient(90deg, #FFD600 0%, #FFC107 100%)',
                borderRadius: '3px',
                transition: 'width 0.3s ease-out'
              }}></div>
            </div>
            {/* 진행률 텍스트 */}
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#FFD600',
              marginTop: '-4px'
            }}>
              {loadingProgress}%
            </div>
          </div>
        )}
      {/* 회원가입 유도 모달 */}
      <RegisterPromptModal
        visible={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          setPendingRecipe(null);
        }}
        onConfirm={() => {
          // 회원가입하기를 누르면 레시피 저장 진행
          if (pendingRecipe) {
            if (pendingRecipe.type === 'done') {
              addRecipeToLocalStorage('done', pendingRecipe.recipe);
              setRecipeActionStates(prev => ({ ...prev, [pendingRecipe.id]: { ...prev[pendingRecipe.id], done: true } }));
            } else if (pendingRecipe.type === 'write') {
              addRecipeToLocalStorage('write', pendingRecipe.recipe);
              setRecipeActionStates(prev => ({ ...prev, [pendingRecipe.id]: { ...prev[pendingRecipe.id], write: true } }));
            }
            setPendingRecipe(null);
          }
        }}
        message={registerModalMessage || '더 많은 기능을 사용하려면'}
      />
      
      {/* 사용 가이드 오버레이 */}
      <GuideOverlay
        visible={showGuide}
        currentStep={guideStep}
        onNext={() => {
          if (guideStep < guideSteps.length - 1) {
            setGuideStep(guideStep + 1);
          } else {
            setShowGuide(false);
            localStorage.setItem('recipe_guide_shown', 'true');
          }
        }}
        onClose={() => {
          setShowGuide(false);
          localStorage.setItem('recipe_guide_shown', 'true');
        }}
        steps={guideSteps}
        isLastStepConfirm={true}
        totalSteps={9}
        startStepOffset={2}
      />
    </>
  );
};

// 로더 스타일 추가
const loaderStyle = `
  .loader-dots {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loader-dots div {
    width: 12px;
    height: 12px;
    margin: 2px;
    border-radius: 50%;
    background-color: #FFD600;
    animation: dot-blink 1.2s infinite ease-in-out both;
  }

  .loader-dots div:nth-child(1) { animation-delay: -0.32s; }
  .loader-dots div:nth-child(2) { animation-delay: -0.16s; }

  @keyframes dot-blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }
`;

// 스타일을 문서에 주입
if (typeof document !== 'undefined') {
  const styleId = 'recipe-list-loader-style';
  if (!document.getElementById(styleId)) {
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.type = "text/css";
    styleSheet.innerText = loaderStyle;
    document.head.appendChild(styleSheet);
  }
}

export default RecipeList; 