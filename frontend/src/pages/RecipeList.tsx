import axios, { AxiosResponse } from 'axios';
import React, { useState, useEffect, useMemo } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import { useNavigate, useLocation } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import FilterModal from '../components/FilterModal';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import { Recipe, RecipeActionState, FilterState, SubstituteInfo } from '../types/recipe';
import { getMyIngredients, sortRecipes, calculateMatchRate } from '../utils/recipeUtils';
import RecipeToast from '../components/RecipeToast';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import RecipeSortBar from '../components/RecipeSortBar';
import { getIngredientPillInfo } from '../utils/recipeUtils';
import { 
  addRecipeToLocalStorage, 
  removeRecipeFromLocalStorage, 
  getRecipesFromLocalStorage, 
  copyRecipeUrlToClipboard 
} from '../utils/recipeStorage';

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
  // 혹시 남아있을 수 있는 localStorage 값은 한 번 삭제
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('[RecipeList] 정렬바 상태 로드 실패:', error);
    }
  }
  return {
    sortType: 'match',
    matchRange: [30, 100],
    maxLack: 'unlimited',
    appliedExpiryIngredients: [],
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
 * 대체재료 테이블을 로드한다
 */
async function loadSubstituteTable(): Promise<{ [key: string]: SubstituteInfo }> {
  try {
    const response = await fetch(CSV_SUBSTITUTE_URL);
    const csv = await response.text();
    
    const lines = csv.split('\n');
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const aIdx = header.indexOf('ingredient_a');
    const bIdx = header.indexOf('ingredient_b');
    const dirIdx = header.indexOf('substitution_direction');
    const scoreIdx = header.indexOf('similarity_score');
    const reasonIdx = header.indexOf('substitution_reason');
    
    if (aIdx === -1 || bIdx === -1) return {};
    
    const table: { [key: string]: SubstituteInfo } = {};
    lines.slice(1).forEach(line => {
      const cols = line.split(',');
      const a = cols[aIdx]?.trim();
      const b = cols[bIdx]?.trim();
      const direction = cols[dirIdx]?.trim() || '';
      const score = parseFloat(cols[scoreIdx]?.trim() || '0');
      const reason = cols[reasonIdx]?.trim() || '';
      
      if (a && b) {
        table[a] = {
          ingredient_a: a,
          ingredient_b: b,
          substitution_direction: direction,
          similarity_score: score,
          substitution_reason: reason
        };
      }
    });
    
    return table;
  } catch (error) {
    console.warn('[RecipeList] 대체재료 테이블 로드 실패:', error);
    return {};
  }
}

/**
 * 재료 사전을 로드한다
 */
async function loadIngredientDictionary(): Promise<string[]> {
  try {
    const response = await fetch(CSV_INGREDIENT_URL);
    const csv = await response.text();
    
    const lines = csv.split('\n');
    const header = lines[0].split(',');
    const nameIdx = header.indexOf('keyword');
    
    if (nameIdx === -1) return [];
    
    return lines.slice(1)
      .map(line => line.split(',')[nameIdx]?.trim())
      .filter(name => !!name && name !== 'keyword');
  } catch (error) {
    console.warn('[RecipeList] 재료 사전 로드 실패:', error);
    return [];
  }
}

/**
 * 레시피 데이터를 페이징으로 로드한다
 */
async function loadRecipesPaged(page = 1, size = 20): Promise<{recipes: any[], total: number}> {
  try {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const response: AxiosResponse<any> = await axios.get(`${apiUrl}/api/recipes?page=${page}&size=${size}`);
    return {
      recipes: response.data.recipes
        .filter((recipe: any) =>
          !!(recipe.body && recipe.body.trim()) ||
          !!(recipe.content && recipe.content.trim()) ||
          !!(recipe.description && recipe.description.trim())
        )
        .map((recipe: any) => ({
          ...recipe,
          date: formatDate(recipe.post_time || recipe.date || ''),
        })),
      total: response.data.total
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
  const [recipes, setRecipes] = useState<any[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<any[]>([]);
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: SubstituteInfo }>({});
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string[]>([]);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [selectedCategoryKeywords, setSelectedCategoryKeywords] = useState<FilterState>(initialFilterState);
  // 페이징 관련 상태
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const myIngredients = useMemo(() => getMyIngredients(), []);
  const navigate = useNavigate();
  const location = useLocation();

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
    setRecipeActionStates(prev => {
      const isActive = !!prev[id]?.done;
      const newState = { ...prev, [id]: { ...prev[id], done: !isActive } };
      
      if (!isActive) {
        // 완료 추가
        const recipe = recipes.find(r => r.id === id);
        if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
          const normalized = normalizeRecipe(recipe);
          addRecipeToLocalStorage('done', normalized);
        }
        showToast('레시피를 완료했습니다!');
      } else {
        // 완료 취소
        removeRecipeFromLocalStorage('done', id);
        showToast('레시피 완료를 취소했습니다!');
      }
      
      return newState;
    });
  };

  /**
   * 기록 버튼 클릭 처리
   */
  const handleWriteClick = (id: number) => {
    setRecipeActionStates(prev => {
      const isActive = !!prev[id]?.write;
      const newState = { ...prev, [id]: { ...prev[id], write: !isActive } };
      
      if (!isActive) {
        // 기록 추가
        const recipe = recipes.find(r => r.id === id);
        if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
          const normalized = normalizeRecipe(recipe);
          addRecipeToLocalStorage('write', normalized);
        }
        showToast('레시피를 기록했습니다!');
      } else {
        // 기록 취소
        removeRecipeFromLocalStorage('write', id);
        showToast('레시피 기록을 취소했습니다!');
      }
      
      return newState;
    });
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

  // =====================
  // 사이드 이펙트
  // =====================

  // 재료 사전 로드
  useEffect(() => {
    loadIngredientDictionary().then(setAllIngredients);
  }, []);

  // 대체재료 테이블 로드
  useEffect(() => {
    loadSubstituteTable().then(setSubstituteTable);
  }, []);

  // 레시피 데이터 로드
  useEffect(() => {
    setLoading(true);
    loadRecipesPaged(1, size).then(({recipes, total}) => {
      setRecipes(recipes);
      setTotal(total);
      setPage(1);
      setLoading(false);
    });
  }, []);

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

  // 더보기 버튼 클릭 시 다음 페이지 로드
  const handleLoadMore = () => {
    setLoading(true);
    loadRecipesPaged(page + 1, size).then(({recipes: newRecipes}) => {
      setRecipes(prev => [...prev, ...newRecipes]);
      setPage(prev => prev + 1);
      setLoading(false);
    });
  };

  // =====================
  // 렌더링
  // =====================

  return (
    <>
      <TopNavBar />
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
        <h2 className="text-lg font-bold mb-4 text-center">
          내 냉장고 기반 레시피 추천
        </h2>
        
        <RecipeSortBar
          recipes={recipes}
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
              총 {filteredRecipes.length.toLocaleString()}건
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <VirtualizedRecipeList
              recipes={filteredRecipes.length ? filteredRecipes : recipes}
              myIngredients={myIngredients}
              substituteTable={substituteTable}
              recipeActionStates={recipeActionStates}
              onRecipeAction={handleRecipeAction}
            />
          </div>
        </div>
        {/* 더보기 버튼 */}
        {recipes.length < total && (
          <button
            onClick={handleLoadMore}
            disabled={loading}
            style={{
              width: '100%',
              margin: '20px 0',
              padding: '12px',
              background: '#FFD600',
              color: '#222',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '로딩 중...' : '더보기'}
          </button>
        )}
      </div>
      
      <BottomNavBar activeTab="recipe" />
      
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default RecipeList; 