import React, { useState, useEffect, useMemo } from 'react';
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
import backIcon from '../assets/뒤로가기.png';
import axios from 'axios';
import { calculateMatchRate, getMyIngredients, sortRecipes } from '../utils/recipeUtils';
import { 
  addRecipeToLocalStorage, 
  removeRecipeFromLocalStorage, 
  getRecipesFromLocalStorage, 
  copyRecipeUrlToClipboard, 
  getMyFridgeIngredients 
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
  type: 'done' | 'write';
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

// Add CSS for loader-toast with dots
const loaderStyle = `
  .loader-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 10px;
  }

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

// Inject style into the document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = loaderStyle;
document.head.appendChild(styleSheet);

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
  
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(getInitialFilterState());
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: SubstituteInfo }>({});
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
  const [ingredientSynonyms, setIngredientSynonyms] = useState<string[]>([]);
  const [isIngredient, setIsIngredient] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

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
  const handleRecipeAction = (id: number, action: { action: 'done' | 'write' | 'share' }) => {
    setButtonStates(prev => {
      const prevState = prev[id] || { done: false, write: false, share: false };
      let newState = { ...prevState };
      
      if (action.action === 'done') {
        if (!prevState.done) {
          // 완료 추가
          const recipe = recipes.find(r => r.id === id);
          if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
            addRecipeToLocalStorage('done', recipe);
          }
          newState.done = true;
          showToast('레시피를 완료했습니다!');
        } else {
          // 완료 취소: 확인 모달만 세팅
          setPendingRemove({ type: 'done', id });
          setPendingRecipe(recipes.find(r => r.id === id));
          return prev;
        }
      }
      
      if (action.action === 'write') {
        if (!prevState.write) {
          // 기록 추가
          const recipe = recipes.find(r => r.id === id);
          if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
            addRecipeToLocalStorage('write', recipe);
          }
          newState.write = true;
          showToast('레시피를 기록했습니다!');
        } else {
          // 기록 취소: 확인 모달만 세팅
          setPendingRemove({ type: 'write', id });
          setPendingRecipe(recipes.find(r => r.id === id));
          return prev;
        }
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
      
      return newState;
    });
  };

  /**
   * 삭제 확인 처리
   */
  const handleRemoveConfirm = () => {
    if (!pendingRemove) return;
    
    if (pendingRemove.type === 'done') {
      setButtonStates(s => ({ ...s, [pendingRemove.id]: { ...s[pendingRemove.id], done: false } }));
      removeRecipeFromLocalStorage('done', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      showToast('레시피 완료를 취소했습니다!');
    } else if (pendingRemove.type === 'write') {
      setButtonStates(s => ({ ...s, [pendingRemove.id]: { ...s[pendingRemove.id], write: false } }));
      removeRecipeFromLocalStorage('write', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      showToast('레시피 기록을 취소했습니다!');
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

  // 재료 정보 로드
  useEffect(() => {
    fetch(CSV_INGREDIENT_URL)
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const synIdx = header.indexOf('synonyms');
        const catIdx = header.indexOf('대분류');
        
        if (nameIdx === -1) return;
        
        const found = lines.slice(1).find(line => {
          const cols = line.split(',');
          return cols[nameIdx]?.trim() === decodeURIComponent(name);
        });
        
        if (found) {
          const cols = found.split(',');
          const base = cols[nameIdx]?.trim();
          const syns = synIdx !== -1 ? cols[synIdx]?.split('|').map(s => s.trim()).filter(Boolean) : [];
          setIngredientSynonyms([base, ...syns]);
          setIsIngredient(cols[catIdx]?.trim() === '재료');
        } else {
          setIngredientSynonyms([decodeURIComponent(name)]);
          setIsIngredient(true);
        }
      });
  }, [name]);

  // 레시피 데이터 로드
  useEffect(() => {
    if (location.pathname === '/mypage/recorded') {
      const arr = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
      setRecipes(arr);
    } else if (location.pathname === '/mypage/completed') {
      const arr = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
      setRecipes(arr);
    } else {
      const fetchData = async () => {
        try {
          const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
          const recipeResponse = await axios.get(`${apiUrl}/api/recipes`);
          let filtered = [];
          
          if (isIngredient) {
            // 재료: used_ingredients에 동의어 포함
            filtered = recipeResponse.data.filter((r: Recipe) => {
              const ingredientsArr = toIngredientArray(r.used_ingredients).map(i => i.replace(/\s/g, ''));
              return ingredientSynonyms.some(syn => ingredientsArr.includes(syn.replace(/\s/g, '')));
            });
          } else {
            // 테마: title/content에 동의어 포함 && 2번 이상 등장
            filtered = recipeResponse.data.filter((r: Recipe) => {
              const text = ((r.title || '') + ' ' + (r.content || '')).toLowerCase();
              return ingredientSynonyms.some(syn => {
                if (!syn) return false;
                const regex = new RegExp(syn.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'), 'g');
                const matches = text.match(regex);
                return matches && matches.length >= 2;
              });
            });
          }
          setRecipes(filtered);
        } catch (error) {
          console.error('Error fetching data:', error);
          setRecipes([]);
        }
      };
      if (ingredientSynonyms.length > 0) fetchData();
    }
  }, [name, location.pathname, ingredientSynonyms, isIngredient]);

  // 대체재료 테이블 로드
  useEffect(() => {
    const loadSubstituteTable = async () => {
      try {
        const response = await fetch(CSV_SUBSTITUTE_URL);
        const csvText = await response.text();
        
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        const table: { [key: string]: SubstituteInfo } = {};
        
        // 첫 번째 줄(헤더)을 제외하고 처리
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',');
          if (values.length >= 6) {
            const ingredient_a = values[1]?.trim() || '';
            const ingredient_b = values[2]?.trim() || '';
            const substitution_direction = values[3]?.trim() || '';
            const similarity_score = parseFloat(values[4]?.trim() || '0');
            const substitution_reason = values[5]?.trim() || '';

            if (ingredient_a) {
              table[ingredient_a] = {
                ingredient_a,
                ingredient_b,
                substitution_direction,
                similarity_score,
                substitution_reason
              };
            }
          }
        }
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
    const saved = loadSortFilterState();
    if (saved) {
      if (saved.sortType) setSortType(saved.sortType);
      if (saved.matchRange) setMatchRange(saved.matchRange);
      if (saved.maxLack !== undefined) setMaxLack(saved.maxLack);
      if (saved.appliedExpiryIngredients) setAppliedExpiryIngredients(saved.appliedExpiryIngredients);
      if (saved.expirySortType) setExpirySortType(saved.expirySortType);
    }
  }, []);

  // 정렬/필터 상태 저장
  useEffect(() => {
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
    const doneList = getRecipesFromLocalStorage('done');
    const writeList = getRecipesFromLocalStorage('write');
    const newStates: { [id: number]: RecipeActionState } = {};
    
    recipes.forEach(recipe => {
      newStates[recipe.id] = {
        done: doneList.some((r: any) => r.id === recipe.id),
        write: writeList.some((r: any) => r.id === recipe.id),
        share: false // 공유는 토글이 아니므로 false로 고정
      };
    });
    setButtonStates(newStates);
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
    if (sortType === 'match') {
      arr.sort((a, b) => b.match_rate - a.match_rate);
    } else if (sortType === 'expiry') {
      arr.sort((a, b) => 0);
    } else {
      arr = sortRecipes(arr, sortType, myIngredients, appliedExpiryIngredients);
    }

    return arr;
  }, [recipes, myIngredients, sortType, selectedChannel, appliedExpiryIngredients]);

  // =====================
  // 렌더링
  // =====================

  return (
    <>
      <header className="w-full h-[56px] flex items-center px-2 bg-white">
        <button
          className="px-2 focus:outline-none bg-transparent border-none shadow-none ml-2"
          style={{ minWidth: 40, background: 'transparent' }}
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
        >
          <img
            src={backIcon}
            alt="뒤로가기"
            style={{ height: 13, width: 13, objectFit: 'contain', background: 'transparent' }}
          />
        </button>
      </header>
      
      <div 
        className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400,
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 32,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 18, textAlign: 'center' }}>
          {customTitle || `${name} 관련 레시피`}
        </div>
        
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
              총 {processedRecipes.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}건
            </span>
          </div>
          
          <div className="mt-4 flex flex-col gap-2" style={{ marginTop: 0 }}>
            <VirtualizedRecipeList
              recipes={processedRecipes}
              myIngredients={myIngredients}
              substituteTable={substituteTable}
              recipeActionStates={buttonStates}
              onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' })}
            />
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
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 400,
          zIndex: 9999,
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
            color: '#fff', 
            marginBottom: 6, 
            letterSpacing: '0.04em', 
            whiteSpace: 'nowrap', 
            display: 'inline-block',
            fontWeight: 400
          }}>
            {pendingRemove.type === 'done' ? '레시피 완료를 취소하시겠어요?' : '레시피 기록을 취소하시겠어요?'}
          </span>
          <div style={{display:'flex',flexDirection:'row',gap:12,justifyContent:'center',width:'100%'}}>
            <button 
              className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" 
              style={{marginRight:4}} 
              onClick={handleRemoveUndo}
            >
              아니요
            </button>
            <button 
              className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" 
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
      {/* Loading animation */}
      {loading && (
        <div className="loader-toast" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
          <div className="loader-dots">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      )}
    </>
  );
};

export default IngredientDetail;