import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';
import { getMyIngredients, sortRecipes } from '../utils/recipeUtils';
import FilterModal from '../components/FilterModal';
import RecipeSortBar from '../components/RecipeSortBar';
import backIcon from '../assets/뒤로가기.png';
import { 
  addRecipeToLocalStorage, 
  removeRecipeFromLocalStorage, 
  getRecipesFromLocalStorage, 
  copyRecipeUrlToClipboard, 
  getMyFridgeIngredients,
  buildRecipeActionStatesForRecipes,
  getRecipeActionState,
} from '../utils/recipeStorage';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'recipe_sortbar_state_completed';
const TOAST_DURATION = 1500;
const CSV_INGREDIENT_URL = '/ingredient_profile_dict_with_substitutes.csv';

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
 * 재료 매칭률을 계산한다
 */
function getMatchRate(myIngredients: string[], recipeIngredients: string) {
  const recipeSet = new Set(
    recipeIngredients.split(',').map((i) => i.trim()).filter(Boolean)
  );
  const mySet = new Set(myIngredients);
  const matched = [...recipeSet].filter((i) => mySet.has(i));
  
  return {
    rate: recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet].filter((i) => !mySet.has(i)),
  };
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

const CompletedRecipeListPage: React.FC = () => {
  // =====================
  // 상태 관리
  // =====================
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(getInitialFilterState());
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [sortType, setSortType] = useState('match');
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [matchRange, setMatchRange] = useState<[number, number]>([30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [expirySortType, setExpirySortType] = useState<'expiry' | 'purchase'>('expiry');
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [filterKeywordTree, setFilterKeywordTree] = useState<any>(null);
  const [selectedChannel, setSelectedChannel] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const myIngredients = useMemo(() => getMyIngredients(), []);
  const myIngredientObjects = getMyIngredientObjects();

  // =====================
  // 계산된 값
  // =====================

  const processedRecipes = useMemo(() => {
    return sortRecipes([...recipes], sortType, myIngredients, appliedExpiryIngredients);
  }, [recipes, sortType, myIngredients, appliedExpiryIngredients]);

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
    const prev = recipeActionStates[id] || { done: false, write: false, share: false, favorite: false };
    
    if (!prev.done) {
      // 완료 추가
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
        addRecipeToLocalStorage('done', recipe);
      }
      setRecipeActionStates(s => ({ ...s, [id]: getRecipeActionState(id) }));
      showToast('레시피를 완료했습니다!');
    } else {
      // 완료 취소: 확인 모달만 세팅
      setPendingRemove({ type: 'done', id });
      setPendingRecipe(recipes.find(r => r.id === id) || null);
    }
  };

  /**
   * 기록 버튼 클릭 처리
   */
  const handleWriteClick = (id: number) => {
    const prev = recipeActionStates[id] || { done: false, write: false, share: false, favorite: false };
    
    if (!prev.write) {
      // 기록 추가
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
        addRecipeToLocalStorage('write', recipe);
      }
      setRecipeActionStates(s => ({ ...s, [id]: getRecipeActionState(id) }));
      showToast('레시피를 기록했습니다!');
    } else {
      // 기록 취소: 확인 모달만 세팅
      setPendingRemove({ type: 'write', id });
      setPendingRecipe(recipes.find(r => r.id === id) || null);
    }
  };

  /**
   * 공유 버튼 클릭 처리
   */
  const handleShareClick = (id: number) => {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
      try {
        copyRecipeUrlToClipboard(recipe);
        showToast('URL이 복사되었습니다!');
      } catch {
        showToast('URL 복사에 실패했습니다.');
      }
    }
  };

  const handleFavoriteClick = (id: number) => {
    const prev = recipeActionStates[id] || { done: false, write: false, share: false, favorite: false };
    const recipe = recipes.find(r => r.id === id);

    if (!prev.favorite) {
      if (recipe && !getRecipesFromLocalStorage('favorite').some((r: any) => r.id === id)) {
        addRecipeToLocalStorage('favorite', recipe);
      }
      setRecipeActionStates(s => ({ ...s, [id]: getRecipeActionState(id) }));
      showToast('레시피를 즐겨찾기에 추가했습니다!');
    } else {
      setPendingRemove({ type: 'favorite', id });
      setPendingRecipe(recipe || null);
    }
  };

  /**
   * 삭제 확인 처리
   */
  const handleRemoveConfirm = () => {
    if (!pendingRemove) return;
    
    if (pendingRemove.type === 'done') {
      setRecipeActionStates(s => ({ ...s, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      removeRecipeFromLocalStorage('done', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      showToast('레시피 완료를 취소했습니다!');
    } else if (pendingRemove.type === 'write') {
      setRecipeActionStates(s => ({ ...s, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      removeRecipeFromLocalStorage('write', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      showToast('레시피 기록을 취소했습니다!');
    } else if (pendingRemove.type === 'favorite') {
      setRecipeActionStates(s => ({ ...s, [pendingRemove.id]: getRecipeActionState(pendingRemove.id) }));
      removeRecipeFromLocalStorage('favorite', pendingRemove.id);
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
    console.log('[CompletedRecipeListPage] 필터 버튼 클릭');
    setFilterOpen(true);
  };

  /**
   * 레시피 액션 처리
   */
  const handleRecipeAction = (recipe: Recipe, action: string) => {
    switch (action) {
      case 'favorite':
        handleFavoriteClick(recipe.id);
        break;
      case 'done':
        handleDoneClick(recipe.id);
        break;
      case 'write':
        handleWriteClick(recipe.id);
        break;
      case 'share':
        handleShareClick(recipe.id);
        break;
    }
  };

  // =====================
  // 사이드 이펙트
  // =====================

  // 레시피 데이터 로드
  useEffect(() => {
    function load() {
      setRecipes(getRecipesFromLocalStorage('done'));
    }
    load();
    window.addEventListener('storage', load);
    window.addEventListener('localStorageChange', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('localStorageChange', load);
    };
  }, []);

  useEffect(() => {
    setRecipeActionStates(buildRecipeActionStatesForRecipes(recipes));
  }, [recipes]);

  // 재료 사전 로드
  useEffect(() => {
    fetch(CSV_INGREDIENT_URL)
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
      })
      .catch(error => {
        console.error('[CompletedRecipeListPage] 재료 사전 로드 실패:', error);
      });
  }, []);

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
  }, []);

  // 필터링된 레시피 업데이트
  useEffect(() => {
    setFilteredRecipes(processedRecipes);
  }, [processedRecipes]);

  // =====================
  // 렌더링
  // =====================

  return (
    <>
      <header 
        className="w-full h-[56px] flex items-center px-2 bg-white"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          maxWidth: '100%',
          margin: '0 auto'
        }}
      >
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
        <button
          aria-label="필터 모달 열기"
          style={{ 
            height: 28, 
            border: '1px solid #D1D5DB', 
            borderRadius: 999, 
            fontSize: 12, 
            padding: '0 12px', 
            fontWeight: 600, 
            background: '#fff', 
            color: '#222', 
            minWidth: 50, 
            whiteSpace: 'nowrap', 
            boxSizing: 'border-box', 
            cursor: 'pointer', 
            marginLeft: 'auto' 
          }}
          onClick={handleFilterButtonClick}
        >
          <span style={{ fontWeight: 600 }}>필터</span>
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
          paddingTop: 88, // 헤더 높이(56px) + 여백(32px)
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 18, textAlign: 'center' }}>
          내가 완료한 레시피
        </div>
        
        {loading && (
          <div className="loader-toast">
            <div className="loader-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        )}
        
        {!loading && (
          <>
            <div>
              {/* 정렬/필터 바 + 재료 pill 범례를 상단 고정 (냉장고요리 페이지와 동일) */}
              <div
                style={{
                  position: 'sticky',
                  top: 56,
                  zIndex: 40,
                  background: '#fff',
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
                marginTop: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ 
                      width: 24, 
                      height: 14, 
                      borderRadius: 7, 
                      background: '#D1D1D1', border: '1px solid #C4C4C8', 
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
                  총 {recipes.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}건
                </span>
              </div>
              </div>
              {/* /sticky */}

              <div className="mt-4 flex flex-col gap-2" style={{ marginTop: 0 }}>
                <VirtualizedRecipeList
                  recipes={filteredRecipes}
                  myIngredients={myIngredients}
                  substituteTable={{}}
                  recipeActionStates={recipeActionStates}
                  onRecipeAction={handleRecipeAction}
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      <BottomNavBar activeTab="mypage" />
      
      {toast && <RecipeToast message={toast} />}
      
      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onClose={() => {
            console.log('[CompletedRecipeListPage] FilterModal 닫기 전 selectedChannel:', selectedChannel);
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
            console.log('[CompletedRecipeListPage] FilterModal에서 채널 선택:', channels);
            setSelectedChannel(channels);
          }}
          onApply={() => {
            console.log('[CompletedRecipeListPage] FilterModal 적용 버튼 클릭, selectedChannel:', selectedChannel);
            setFilterOpen(false);
          }}
        />
      )}
      
      {matchRateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" style={{ zIndex: 1001 }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span 
              className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" 
              onClick={() => setMatchRateModalOpen(false)}
            >
              ×
            </span>
            <div className="text-center font-bold text-[14px] mb-4">
              재료 매칭도 설정 (임시 모달)
            </div>
          </div>
        </div>
      )}
      
      {expiryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" style={{ zIndex: 1001 }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span 
              className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" 
              onClick={() => setExpiryModalOpen(false)}
            >
              ×
            </span>
            <div className="text-center font-bold text-[14px] mb-4">
              임박 재료 설정 (임시 모달)
            </div>
          </div>
        </div>
      )}
      
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
            display: 'inline-block' 
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
    </>
  );
};

export default CompletedRecipeListPage; 