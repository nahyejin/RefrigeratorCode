import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import BackButton from '../components/ui/BackButton';
import RecipeCardSkeleton from '../components/RecipeCardSkeleton';
import IngredientLegend from '../components/IngredientLegend';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import BottomNavBar from '../components/BottomNavBar';
import FilterModal from '../components/FilterModal';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import RecipeCard from '../components/RecipeCard';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeSortBar from '../components/RecipeSortBar';
import TopNavBar from '../components/TopNavBar';
import RecipeToast from '../components/RecipeToast';
import axios from 'axios';
import { calculateMatchRate, compareByMatchRateThenLatest, getMyIngredients, sortRecipes } from '../utils/recipeUtils';
import { 
  addRecipeToLocalStorage, 
  removeRecipeFromLocalStorage, 
  getRecipesFromLocalStorage, 
  copyRecipeUrlToClipboard, 
  getMyFridgeIngredients,
  sortRecipesByUserSavedAtDesc,
  buildRecipeActionStatesForRecipes,
  getRecipeActionState,
} from '../utils/recipeStorage';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'recipe_sortbar_state_ingredient';
const TOAST_DURATION = 1500;
const CSV_INGREDIENT_URL = '/ingredient_profile_dict_with_substitutes.csv';
const CSV_SUBSTITUTE_URL = '/ingredient_substitute_table.csv';
const SCROLL_THRESHOLD = 100;
const VISIBLE_INCREMENT = 2;

// =====================
// 타입 정의
// =====================

interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
  [key: string]: string[];
}

interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

interface KeywordObject {
  keyword: string;
  synonyms?: string[];
}

interface IngredientDetailProps {
  customTitle?: string;
}

interface PendingRemove {
  type: 'done' | 'write' | 'favorite';
  id: number;
}

interface SortFilterState {
  sortType: string;
  matchRange: [number, number];
  maxLack: number | 'unlimited';
  appliedExpiryIngredients: string[];
  expirySortType: 'expiry' | 'purchase';
}

// =====================
// 유틸리티 함수
// =====================

/**
 * 초기 필터 상태를 반환한다
 */
function getInitialFilterState(): FilterState {
  return {
    효능: [],
    영양분: [],
    대상: [],
    TPO: [],
    스타일: [],
  };
}

/**
 * 더미 레시피 데이터를 가져온다
 */
function fetchRecipesDummy(name?: string): Promise<any[]> {
  const dataMap: Record<string, any[]> = {
    '두릅': [
      {
        id: 1,
        thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
        title: '두릅 오징어볶음 레시피 만드는법 간단',
        body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은 두릅 오징어볶음 레시피입니다.',
        used_ingredients: '두릅,오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
        author: '꼬마츄츄',
        date: '25-03-08',
        like: 77,
        comment: 12,
        substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
      },
    ],
  };
  
  const key = name || '두릅';
  if (dataMap[key]) {
    return Promise.resolve(dataMap[key]);
  } else {
    // 동적 예시 4개 생성
    return Promise.resolve([
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: `${key}가 들어간 예시 레시피`,
        body: `이것은 ${key}가 포함된 예시 레시피입니다.`,
        used_ingredients: `${key},소금,후추,마늘,양파`,
        author: '예시봇',
        date: '25-05-15',
        like: 1,
        comment: 0,
        substitutes: [`${key}→다른재료`],
      },
    ]);
  }
}

/**
 * 재료 배열로 변환한다
 */
function toIngredientArray(recipeIngredients: string | string[] | null | undefined): string[] {
  if (typeof recipeIngredients === 'string') {
    return recipeIngredients.split(',').map(i => i.trim()).filter(Boolean);
  } else if (Array.isArray(recipeIngredients)) {
    return recipeIngredients.map(i => (typeof i === 'string' ? i.trim() : '')).filter(Boolean);
  }
  return [];
}

/**
 * 재료 매칭률을 계산한다
 */
function getMatchRate(myIngredients: string[], recipeIngredients: string | string[] | null | undefined) {
  const ingredientsArr = toIngredientArray(recipeIngredients);
  const recipeSet = new Set<string>(ingredientsArr);
  const mySet = new Set<string>(myIngredients);
  const matched = [...recipeSet].filter(i => mySet.has(i));
  
  return {
    rate: recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet].filter(i => !mySet.has(i)),
  };
}

/**
 * CSV에서 재료명 목록을 파싱한다
 */
function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('keyword');
  
  if (nameIdx === -1) return [];
  
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'keyword');
}

/**
 * 내 냉장고 재료 객체를 가져온다
 */
function getMyIngredientObjects() {
  return getMyFridgeIngredients();
}

/**
 * 정렬/필터 상태를 저장한다
 */
function saveSortFilterState(state: SortFilterState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[Storage] 정렬/필터 상태 저장 실패:', error);
  }
}

/**
 * 정렬/필터 상태를 로드한다
 */
function loadSortFilterState(): Partial<SortFilterState> | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('[Storage] 정렬/필터 상태 로드 실패:', error);
    return null;
  }
}

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

// =====================
// 카테고리 키워드
// =====================

const categoryKeywords = {
  TPO: [
    { keyword: '주말', synonyms: ['주말요리', '주말식사', '주말특별식', '주말특별요리'] }
  ]
};

// =====================
// 메인 컴포넌트
// =====================

const IngredientDetail: React.FC<IngredientDetailProps> = ({ customTitle }) => {
  // =====================
  // 상태 관리
  // =====================
  
  const { name = '' } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const myPageRecipeStorageType =
    location.pathname === '/mypage/recorded'
      ? 'write'
      : location.pathname === '/mypage/completed'
        ? 'done'
        : location.pathname === '/mypage/favorite'
          ? 'favorite'
          : null;
  const isMyPageRecipeList = myPageRecipeStorageType !== null;
  const searchParams = new URLSearchParams(location.search);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(getInitialFilterState());
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }>({});
  const [buttonStates, setButtonStates] = useState<{ [id: number]: RecipeActionState }>({});
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [matchRange, setMatchRange] = useState<[number, number]>([30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [filteredRecipes, setFilteredRecipes] = useState<any[]>([]);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<any>(null);
  const [selectedChannel, setSelectedChannel] = useState<string[]>([]);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [filterKeywordTree, setFilterKeywordTree] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;  // 페이지당 레시피 수
  
  // 키워드 변경 추적용 ref (컴포넌트 최상위 레벨)
  const prevNameRef = useRef(name);

  const myIngredients = useMemo(() => getMyIngredients(), []);
  const myIngredientObjects = getMyIngredientObjects();

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
   * 가능한 대체재료를 찾는다
   */
  const findPossibleSubstitutes = (recipeIngredients: string | string[] | null | undefined, userIngredients: string[]): string[] => {
    const ingredientsArr = toIngredientArray(recipeIngredients);
    const recipeIngredientSet = new Set(ingredientsArr);
    const userIngredientSet = new Set(userIngredients.map(i => i.trim()));

    const substitutes: string[] = [];

    for (const recipeIngredient of recipeIngredientSet) {
      const substituteInfo = substituteTable[recipeIngredient];

      if (substituteInfo) {
        const possibleSubstitute = substituteInfo.ingredient_b;

        if (userIngredientSet.has(possibleSubstitute)) {
          substitutes.push(`${recipeIngredient} → ${possibleSubstitute}`);
        }
      }
    }

    return substitutes.length > 0 ? substitutes : ['(내 냉장고에 대체 가능한 재료가 없습니다)'];
  };

  /**
   * 레시피 액션 처리
   */
  const handleRecipeAction = (id: number, action: { action: 'done' | 'write' | 'share' | 'favorite' }) => {
    const prevState = buttonStates[id] || getRecipeActionState(id);

    if (action.action === 'favorite') {
      if (!prevState.favorite) {
        const recipe = recipes.find(r => r.id === id);
        if (recipe && !getRecipesFromLocalStorage('favorite').some((r: any) => r.id === id)) {
          addRecipeToLocalStorage('favorite', recipe);
        }
        setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
        showToast('레시피를 즐겨찾기에 추가했습니다!');
      } else {
        setPendingRemove({ type: 'favorite', id });
        setPendingRecipe(recipes.find(r => r.id === id));
      }
      return;
    }

    if (action.action === 'done') {
      if (!prevState.done) {
        const recipe = recipes.find(r => r.id === id);
        if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
          addRecipeToLocalStorage('done', recipe);
        }
        setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
        showToast('레시피를 완료했습니다!');
      } else {
        setPendingRemove({ type: 'done', id });
        setPendingRecipe(recipes.find(r => r.id === id));
      }
      return;
    }

    if (action.action === 'write') {
      if (!prevState.write) {
        const recipe = recipes.find(r => r.id === id);
        if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
          addRecipeToLocalStorage('write', recipe);
        }
        setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
        showToast('레시피를 기록했습니다!');
      } else {
        setPendingRemove({ type: 'write', id });
        setPendingRecipe(recipes.find(r => r.id === id));
      }
      return;
    }

    if (action.action === 'share') {
      const recipe = recipes.find(r => r.id === id);
      if (recipe) {
        try {
          copyRecipeUrlToClipboard(recipe);
          showToast('URL이 복사되었습니다!');
        } catch {
          showToast('URL 복사에 실패했습니다.');
        }
      }
    }
  };

  /**
   * 삭제 확인 처리
   */
  const handleRemoveConfirm = () => {
    if (!pendingRemove) return;
    
    if (pendingRemove.type === 'done') {
      removeRecipeFromLocalStorage('done', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setButtonStates(prev => ({ ...prev, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      showToast('레시피 완료를 취소했습니다!');
    } else if (pendingRemove.type === 'write') {
      removeRecipeFromLocalStorage('write', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setButtonStates(prev => ({ ...prev, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      showToast('레시피 기록을 취소했습니다!');
    } else if (pendingRemove.type === 'favorite') {
      removeRecipeFromLocalStorage('favorite', pendingRemove.id);
      if (location.pathname === '/mypage/favorite') {
        setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
        setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      }
      setButtonStates(prev => ({ ...prev, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      showToast('레시피 즐겨찾기를 취소했습니다!');
    }
    
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  /**
   * 삭제 취소 처리
   */
  const handleRemoveUndo = () => {
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  /**
   * 필터 버튼 클릭 처리
   */
  const handleFilterButtonClick = () => {
    console.log('[IngredientDetail] 필터 버튼 클릭');
    setFilterOpen(true);
  };

  // =====================
  // 사이드 이펙트
  // =====================

  // CSV 로딩 제거 - 단순 키워드 검색으로 변경

  // 레시피 데이터 로드
  useEffect(() => {
    if (myPageRecipeStorageType) {
      const storageKeyByType = {
        write: 'my_recorded_recipes',
        done: 'my_completed_recipes',
        favorite: 'my_favorite_recipes',
      } as const;
      const arr = JSON.parse(localStorage.getItem(storageKeyByType[myPageRecipeStorageType]) || '[]');
      setRecipes(Array.isArray(arr) ? arr : []);
      setSortType('latest');
      setTotal(0);
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      console.log('IngredientDetail - fetchData 시작, keyword:', name, 'page:', page);
      console.log('IngredientDetail - startDate:', startDate, 'endDate:', endDate);
      
      try {
        const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
        const searchKeyword = decodeURIComponent(name);
        
        // 서버 사이드 키워드 검색 API 사용 (페이징 적용)
        const recipeResponse = await axios.get(`${apiUrl}/api/recipes/search`, {
          params: {
            keyword: searchKeyword,
            page: page,
            size: pageSize
          }
        });
        
        let filtered = Array.isArray(recipeResponse.data?.recipes) 
          ? recipeResponse.data.recipes 
          : [];
        
        const totalCount = recipeResponse.data?.total || 0;
        setTotal(totalCount);
        
        console.log('IngredientDetail - 서버에서 필터링된 레시피 수:', filtered.length, '전체:', totalCount);
        
        // 기간 필터 적용 (클라이언트 사이드)
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          
          const beforeDateFilter = filtered.length;
          filtered = filtered.filter((r: Recipe) => {
            if (!r.post_time) return false;
            const postDate = new Date(r.post_time);
            return postDate >= start && postDate <= end;
          });
          console.log('IngredientDetail - 기간 필터링 전:', beforeDateFilter, '후:', filtered.length);
          console.log('IngredientDetail - 기간:', start, '~', end);
        }
        
        console.log('IngredientDetail - 최종 필터링된 레시피 수:', filtered.length);
        setRecipes(filtered);
      } catch (error) {
        console.error('IngredientDetail - Error fetching data:', error);
        setRecipes([]);
        setTotal(0);
      } finally {
        console.log('IngredientDetail - fetchData 완료, 로딩 해제');
        setLoading(false);
      }
    };
    
    // 키워드가 변경되면 첫 페이지로 리셋
    if (name && location.pathname.startsWith('/ingredient/') && prevNameRef.current !== name) {
      prevNameRef.current = name;
      setPage(1);
      // 페이지가 리셋되면 다음 렌더에서 fetchData가 실행됨
      return;
    }
    prevNameRef.current = name;
    
    fetchData();
  }, [name, location.pathname, location.search, myPageRecipeStorageType, startDate, endDate, page]);

  // 페이지 변경 핸들러
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // 페이지 상단으로 즉시 스크롤
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  
  // 페이지 변경 시 데이터 로딩 완료 후 스크롤 (useLayoutEffect로 DOM 업데이트 직후 실행)
  useLayoutEffect(() => {
    if (!loading && recipes.length > 0 && location.pathname.startsWith('/ingredient/')) {
      // 레이아웃이 완전히 렌더링된 후 상단으로 스크롤
      const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        // 모든 스크롤 가능한 요소도 확인
        const scrollableElements = document.querySelectorAll('[data-scroll-container]');
        scrollableElements.forEach((el: any) => {
          if (el.scrollTop !== undefined) el.scrollTop = 0;
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
        }, 200);
      });
    }
  }, [page, loading, recipes.length, location.pathname]);

  // 대체재료 테이블 로드
  useEffect(() => {
    const loadSubstituteTable = async () => {
      try {
        const response = await fetch(CSV_SUBSTITUTE_URL);
        const csvText = await response.text();
        
        const lines = csvText.split('\n').filter(line => line.trim()); // 빈 행 제거
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const aIdx = header.indexOf('ingredient_a');
        const bIdx = header.indexOf('ingredient_b');
        const scoreIdx = header.indexOf('similarity_score');
        
        if (aIdx === -1 || bIdx === -1) return;
        
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
          result.push(current.trim());
          return result;
        };
        
        const table: { [key: string]: { ingredient_b: string; similarity_score?: number }[] } = {};
        
        // 첫 번째 줄(헤더)을 제외하고 처리
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseCSVLine(line);
          const ingredient_a = cols[aIdx]?.trim();
          const ingredient_b = cols[bIdx]?.trim();
          const scoreStr = scoreIdx >= 0 ? cols[scoreIdx]?.trim() : undefined;

          if (ingredient_a && ingredient_b) {
            const score = scoreStr ? parseFloat(scoreStr) : undefined;
            
            if (!table[ingredient_a]) {
              table[ingredient_a] = [];
            }
            table[ingredient_a].push({
              ingredient_b: ingredient_b,
              similarity_score: isNaN(score as number) ? undefined : score
            });
          }
        }
        
        // 각 재료별로 유사도 점수 순으로 정렬 (높은 순)
        Object.keys(table).forEach(key => {
          table[key].sort((a, b) => {
            const scoreA = a.similarity_score ?? 0;
            const scoreB = b.similarity_score ?? 0;
            return scoreB - scoreA;
          });
        });
        
        setSubstituteTable(table);
      } catch (error) {
        // 에러 발생 시 콘솔에만 출력
        console.warn('[IngredientDetail] 대체재료 테이블 로드 실패:', error);
      }
    };

    loadSubstituteTable();
  }, []);

  // 스크롤 이벤트 처리
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - SCROLL_THRESHOLD &&
        visibleCount < recipes.length
      ) {
        setVisibleCount((prev) => prev + VISIBLE_INCREMENT);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, recipes.length]);

  // 정렬/필터 상태 복원
  useEffect(() => {
    if (isMyPageRecipeList) {
      setSortType('latest');
      return;
    }

    const saved = loadSortFilterState();
    if (saved) {
      if (saved.sortType) setSortType(saved.sortType);
      if (saved.matchRange) setMatchRange(saved.matchRange);
      if (saved.maxLack !== undefined) setMaxLack(saved.maxLack);
      if (saved.appliedExpiryIngredients) setAppliedExpiryIngredients(saved.appliedExpiryIngredients);
      if (saved.expirySortType) setExpirySortType(saved.expirySortType);
    }
  }, [isMyPageRecipeList]);

  // 정렬/필터 상태 저장
  useEffect(() => {
    if (isMyPageRecipeList) return;

    saveSortFilterState({
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      expirySortType,
    });
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

  // 페이지 상단으로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [name, location.pathname]);

  // 버튼 상태 동기화
  useEffect(() => {
    const syncButtonStates = () => {
      setButtonStates(buildRecipeActionStatesForRecipes(recipes));
    };

    syncButtonStates();

    const handleRecipeStorageChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (
        key === 'my_recorded_recipes' ||
        key === 'my_completed_recipes' ||
        key === 'my_favorite_recipes'
      ) {
        syncButtonStates();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === 'my_recorded_recipes' ||
        event.key === 'my_completed_recipes' ||
        event.key === 'my_favorite_recipes'
      ) {
        syncButtonStates();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncButtonStates();
      }
    };

    window.addEventListener('localStorageChange', handleRecipeStorageChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', syncButtonStates);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('localStorageChange', handleRecipeStorageChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', syncButtonStates);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recipes]);

  // =====================
  // 계산된 값
  // =====================

  const processedRecipes = useMemo(() => {
    console.log('[IngredientDetail] processedRecipes useMemo 실행', { recipes, selectedChannel, sortType });
    
    let arr = [...recipes].map(recipe => {
      const match = getMatchRate(myIngredients, recipe.used_ingredients);
      const substitutes = findPossibleSubstitutes(recipe.used_ingredients, myIngredients);
      
      return { 
        ...recipe, 
        match_rate: match.rate, 
        my_ingredients: match.my_ingredients, 
        need_ingredients: match.need_ingredients,
        substitutes: substitutes.length > 0 ? substitutes : ['(내 냉장고에 대체 가능한 재료가 없습니다)'],
        link: recipe.link || `https://blog.naver.com/jjangda1105/${recipe.id}`
      };
    });

    // 채널 필터링
    if (selectedChannel.length > 0) {
      arr = arr.filter(recipe => {
        const platform = recipe.platform?.toLowerCase() || '';
        if (selectedChannel.includes('naver')) {
          return platform.includes('naver(주제별보기)') || platform.includes('naver(인플루언서핫토픽)');
        }
        if (selectedChannel.includes('youtube')) {
          return platform.includes('youtube(인플루언서)');
        }
        return true;
      });
    }

    // 정렬
    if (isMyPageRecipeList) {
      arr = sortRecipesByUserSavedAtDesc(arr);
    } else if (sortType === 'match') {
      arr.sort(compareByMatchRateThenLatest);
    } else if (sortType === 'expiry') {
      arr.sort((a, b) => 0);
    } else {
      arr = sortRecipes(arr, sortType, myIngredients, appliedExpiryIngredients);
    }

    return arr;
  }, [recipes, myIngredients, sortType, selectedChannel, appliedExpiryIngredients, isMyPageRecipeList]);

  // =====================
  // 렌더링
  // =====================

  return (
    <>
      {/* 예전에는 이 페이지가 top:0 에 자체 고정 헤더를 그려서 공통 GNB 와 정확히 겹쳤다.
          (둘 다 높이 56px, 같은 z-index) → 헤더를 없애고 뒤로가기는 본문 제목 줄에 둔다. */}
      <div 
        className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400,
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 72, // 공통 GNB(56px) + 여백(16px)
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, minHeight: 36 }}>
          <BackButton onClick={() => navigate(-1)} style={{ left: 0, top: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 18, textAlign: 'center', padding: '0 44px' }}>
            {customTitle || `${name} 관련 레시피`}
          </div>
        </div>
        
        <div>
          {/* 정렬/필터 바 + 재료 pill 범례를 상단 고정 (냉장고요리 페이지와 동일) */}
          <div
            style={{
              position: 'sticky',
              top: 56,
              zIndex: 'var(--z-sticky)',
              background: '#FFFFFF',
              marginLeft: -14,
              marginRight: -14,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 10, // 범례 아래 흰 여백
            }}
          >
          <RecipeSortBar
            recipes={processedRecipes}
            myIngredients={myIngredients}
            onFilteredRecipesChange={setFilteredRecipes}
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
            selectedCategoryKeywords={selectedFilter}
            setSelectedCategoryKeywords={setSelectedFilter}
            includeInput={includeInput}
            setIncludeInput={setIncludeInput}
            excludeInput={excludeInput}
            setExcludeInput={setExcludeInput}
          />
          <IngredientLegend total={total > 0 ? total : processedRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
          </div>
          {/* /sticky */}

          <div className="mt-4 flex flex-col gap-2" style={{ marginTop: 0 }}>
            {/* 로딩 중에는 실제 카드와 같은 모양의 뼈대를 목록 자리에 보여준다 */}
            {loading && <RecipeCardSkeleton count={4} />}
            {!loading && (
            <VirtualizedRecipeList
              recipes={processedRecipes}
              myIngredients={myIngredients}
              substituteTable={substituteTable}
              recipeActionStates={buttonStates}
              onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' | 'favorite' })}
            />
            )}

            {/* 페이지네이션 */}
            {!loading && total > 0 && location.pathname.startsWith('/ingredient/') && (() => {
              const totalPages = Math.ceil(total / pageSize);
              const maxVisiblePages = 5;
              let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
              
              if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }
              
              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '24px',
                  marginBottom: '24px',
                  flexWrap: 'wrap'
                }}>
                  {/* 맨 처음으로 << */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={page <= 1}
                    style={{
                      padding: '6px 8px',
                      background: 'transparent',
                      color: page <= 1 ? '#D2D2D8' : '#1A1A1E',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '32px',
                      height: '32px'
                    }}
                    onMouseEnter={(e) => {
                      if (page > 1) {
                        e.currentTarget.style.background = '#F5F5F7';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page > 1) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    &laquo;
                  </button>
                  
                  {/* 이전 페이지 < */}
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    style={{
                      padding: '6px 8px',
                      background: 'transparent',
                      color: page <= 1 ? '#D2D2D8' : '#1A1A1E',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '32px',
                      height: '32px'
                    }}
                    onMouseEnter={(e) => {
                      if (page > 1) {
                        e.currentTarget.style.background = '#F5F5F7';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page > 1) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    &lsaquo;
                  </button>
                  
                  {/* 페이지 번호 */}
                  {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '6px 12px',
                        background: pageNum === page ? '#FFD600' : 'transparent',
                        color: pageNum === page ? '#1A1A1E' : '#1A1A1E',
                        fontWeight: pageNum === page ? '600' : '500',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '15px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        height: '32px'
                      }}
                      onMouseEnter={(e) => {
                        if (pageNum !== page) {
                          e.currentTarget.style.background = '#F5F5F7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (pageNum !== page) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  ))}
                  
                  {/* 다음 페이지 > */}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    style={{
                      padding: '6px 8px',
                      background: 'transparent',
                      color: page >= totalPages ? '#D2D2D8' : '#1A1A1E',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
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
                        e.currentTarget.style.background = '#F5F5F7';
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
                      color: page >= totalPages ? '#D2D2D8' : '#1A1A1E',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '15px',
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
                        e.currentTarget.style.background = '#F5F5F7';
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
      </div>
      
      <BottomNavBar activeTab={location.pathname.startsWith('/mypage') ? 'mypage' : 'popularity'} />
      
      {toast && <RecipeToast message={toast} />}
      
      {pendingRemove && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34, 34, 34, 0.9)',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 400,
          zIndex: 'var(--z-toast)',
          maxWidth: 320,
          width: 'max-content',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ 
            color: '#FFFFFF', 
            marginBottom: 6, 
            letterSpacing: '0.04em', 
            whiteSpace: 'nowrap', 
            display: 'inline-block',
            fontWeight: 400
          }}>
            {pendingRemove.type === 'done'
              ? '레시피 완료를 취소하시겠어요?'
              : pendingRemove.type === 'write'
                ? '레시피 기록을 취소하시겠어요?'
                : '레시피 즐겨찾기를 취소하시겠어요?'}
          </span>
          <div style={{display:'flex',flexDirection:'row',gap:12,justifyContent:'center',width:'100%'}}>
            <button 
              className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap" 
              style={{marginRight:4}} 
              onClick={handleRemoveUndo}
            >
              아니요
            </button>
            <button 
              className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap" 
              onClick={handleRemoveConfirm}
            >
              네
            </button>
          </div>
        </div>
      )}
      
      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onClose={() => {
            console.log('[IngredientDetail] FilterModal 닫기 전 selectedChannel:', selectedChannel);
            setFilterOpen(false);
          }}
          filterState={selectedFilter}
          setFilterState={setSelectedFilter}
          includeIngredients={includeIngredients}
          setIncludeIngredients={setIncludeIngredients}
          excludeIngredients={excludeIngredients}
          setExcludeIngredients={setExcludeIngredients}
          includeInput={includeInput}
          setIncludeInput={setIncludeInput}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          allIngredients={allIngredients}
          includeKeyword={includeKeyword}
          setIncludeKeyword={setIncludeKeyword}
          filterKeywordTree={filterKeywordTree}
          setFilterKeywordTree={setFilterKeywordTree}
          selectedChannel={selectedChannel}
          setSelectedChannel={(channels) => {
            console.log('[IngredientDetail] FilterModal에서 채널 선택:', channels);
            setSelectedChannel(channels);
          }}
          onApply={() => {
            console.log('[IngredientDetail] FilterModal 적용 버튼 클릭, selectedChannel:', selectedChannel);
            setFilterOpen(false);
          }}
        />
      )}
    </>
  );
};

export default IngredientDetail;