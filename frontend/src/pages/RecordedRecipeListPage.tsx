import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';
import { getMyIngredients } from '../utils/recipeUtils';
import RecipeSortBar from '../components/RecipeSortBar';
import FilterModal from '../components/FilterModal';
import backIcon from '../assets/뒤로가기.png';
import { addRecipeToLocalStorage, removeRecipeFromLocalStorage, getRecipesFromLocalStorage, copyRecipeUrlToClipboard, getMyFridgeIngredients } from '../utils/recipeStorage';

// Add FilterState interface definition after imports
interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
  [key: string]: string[]; // string index signature 추가
}

// Update initialFilterState to use FilterState interface
const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

// Add parseIngredientNames function after initialFilterState
function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

// Update dummy data to include 'link' property
// const dummyRecordedRecipes: Recipe[] = [ ... ];

// getMatchRate 함수 정의 (중복 방지 위해 컴포넌트 내에 정의)
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

function getMyIngredientObjects() {
  return getMyFridgeIngredients();
}

const RecordedRecipeListPage = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const myIngredients = useMemo(() => getMyIngredients(), []);
  const myIngredientObjects = getMyIngredientObjects();
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [matchRange, setMatchRange] = useState<[number, number]>([30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [expirySortType, setExpirySortType] = useState<'expiry' | 'purchase'>('expiry');
  const [pendingRemove, setPendingRemove] = useState<{type: 'done'|'write', id: number}|null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<any>(null);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [filterKeywordTree, setFilterKeywordTree] = useState<any>(null);
  const [selectedChannel, setSelectedChannel] = useState<string[]>([]);

  useEffect(() => {
    function load() {
      setRecipes(getRecipesFromLocalStorage('write'));
    }
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        if (nameIdx === -1) return;
        setAllIngredients(
          lines.slice(1)
            .map(line => line.split(',')[nameIdx]?.trim())
            .filter(name => !!name && name !== 'keyword')
        );
      });
  }, []);

  // Restore sort/filter state from localStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('recipe_sortbar_state_recorded');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.sortType) setSortType(state.sortType);
        if (state.matchRange) setMatchRange(state.matchRange);
        if (state.maxLack !== undefined) setMaxLack(state.maxLack);
        if (state.appliedExpiryIngredients) setAppliedExpiryIngredients(state.appliedExpiryIngredients);
        if (state.expirySortType) setExpirySortType(state.expirySortType);
      } catch {}
    }
  }, []);

  // Save sort/filter state to localStorage on change
  useEffect(() => {
    sessionStorage.setItem('recipe_sortbar_state_recorded', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleDoneClick = (id: number) => {
    const prev = recipeActionStates[id] || { done: false, write: false, share: false };
    console.log('handleDoneClick', { id, prev });
    if (!prev.done) {
      // 완료 추가
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
        addRecipeToLocalStorage('done', recipe);
      }
      setRecipeActionStates(s => ({ ...s, [id]: { ...prev, done: true } }));
      setToast('레시피를 완료했습니다!');
      setTimeout(() => setToast(''), 1500);
    } else {
      // 완료 취소: 확인 모달만 세팅
      console.log('setPendingRemove for done', id);
      setPendingRemove({ type: 'done', id });
      setPendingRecipe(recipes.find(r => r.id === id));
    }
  };

  const handleWriteClick = (id: number) => {
    const prev = recipeActionStates[id] || { done: false, write: false, share: false };
    console.log('handleWriteClick', { id, prev });
    if (!prev.write) {
      // 기록 추가
      const recipe = recipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
        addRecipeToLocalStorage('write', recipe);
      }
      setRecipeActionStates(s => ({ ...s, [id]: { ...prev, write: true } }));
      setToast('레시피를 기록했습니다!');
      setTimeout(() => setToast(''), 1500);
    } else {
      // 기록 취소: 확인 모달만 세팅
      console.log('setPendingRemove for write', id);
      setPendingRemove({ type: 'write', id });
      setPendingRecipe(recipes.find(r => r.id === id));
    }
  };

  const handleShareClick = (id: number) => {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
      try {
        copyRecipeUrlToClipboard(recipe);
        setToast('URL이 복사되었습니다!');
        setTimeout(() => setToast(''), 1500);
      } catch {
        setToast('URL 복사에 실패했습니다.');
        setTimeout(() => setToast(''), 1500);
      }
    }
  };

  const handleRemoveConfirm = () => {
    console.log('handleRemoveConfirm', pendingRemove);
    if (!pendingRemove) return;
    if (pendingRemove.type === 'done') {
      setRecipeActionStates(s => ({ ...s, [pendingRemove.id]: { ...s[pendingRemove.id], done: false } }));
      removeRecipeFromLocalStorage('done', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setToast('레시피 완료를 취소했습니다!');
      setTimeout(() => setToast(''), 1500);
    } else if (pendingRemove.type === 'write') {
      setRecipeActionStates(s => ({ ...s, [pendingRemove.id]: { ...s[pendingRemove.id], write: false } }));
      removeRecipeFromLocalStorage('write', pendingRemove.id);
      setRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setFilteredRecipes(prev => prev.filter(r => r.id !== pendingRemove.id));
      setToast('레시피 기록을 취소했습니다!');
      setTimeout(() => setToast(''), 1500);
    }
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  const handleRemoveUndo = () => {
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  const processedRecipes = useMemo(() => {
    let arr = [...recipes];
    // 채널 필터링 추가
    if (selectedChannel.length > 0) {
      arr = arr.filter(recipe => {
        const platform = (recipe.platform || '').toLowerCase();
        return (
          (selectedChannel.includes('youtube') && (platform.includes('youtube') || platform.includes('유튜브')))
          ||
          (selectedChannel.includes('naver') && (platform.includes('naver') || platform.includes('네이버')))
        );
      });
    }
    arr.sort((a, b) => {
      const matchA = a.match_rate ?? 0;
      const matchB = b.match_rate ?? 0;
      if (sortType === 'match') {
        return matchB - matchA;
      } else if (sortType === 'expiry') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortType === 'like') {
          return (b.likes ?? 0) - (a.likes ?? 0);
      } else if (sortType === 'comment') {
          return (b.comments ?? 0) - (a.comments ?? 0);
      } else if (sortType === 'latest') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return 0;
    });
    return arr;
  }, [recipes, sortType, selectedChannel]);

  useEffect(() => {
    setFilteredRecipes(processedRecipes);
  }, [processedRecipes]);

  const handleFilterButtonClick = () => {
    console.log('[RecordedRecipeListPage] 필터 버튼 클릭');
    setFilterOpen(true);
  };

  useEffect(() => {
    console.log('[RecordedRecipeListPage] FilterModal open:', filterOpen);
  }, [filterOpen]);

  useEffect(() => {
    console.log('[RecordedRecipeListPage] selectedChannel:', selectedChannel);
  }, [selectedChannel]);

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
        <button
          aria-label="필터 모달 열기"
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 999, fontSize: 12, padding: '0 12px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 50, whiteSpace: 'nowrap', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto' }}
          onClick={handleFilterButtonClick}
        >
          <span style={{ fontWeight: 600 }}>필터</span>
        </button>
      </header>
      <div className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400,
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 32,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 18, textAlign: 'center' }}>내가 기록한 레시피</div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>부족 재료</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>대체 가능</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>보유 재료</span>
              </div>
            </div>
            <span style={{ color: '#666', fontSize: '12px' }}>총 {recipes.length.toLocaleString()}건</span>
          </div>
          <div className="mt-4 flex flex-col gap-2" style={{ marginTop: 0 }}>
            {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              recipeActionState={recipeActionStates[recipe.id]}
              onRecipeAction={({ action }) => {
                console.log('onRecipeAction', { action, recipeId: recipe.id });
                if (action === 'done') handleDoneClick(recipe.id);
                else if (action === 'write') handleWriteClick(recipe.id);
                else if (action === 'share') handleShareClick(recipe.id);
              }}
              isLast={index === processedRecipes.length - 1}
              myIngredients={myIngredients}
            />
          ))}
          </div>
        </div>
      </div>
      <BottomNavBar activeTab="mypage" />
      {toast && <RecipeToast message={toast} />}
      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onClose={() => {
            console.log('[RecordedRecipeListPage] FilterModal 닫기 전 selectedChannel:', selectedChannel);
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
            console.log('[RecordedRecipeListPage] FilterModal에서 채널 선택:', channels);
            setSelectedChannel(channels);
          }}
          onApply={() => {
            console.log('[RecordedRecipeListPage] FilterModal 적용 버튼 클릭, selectedChannel:', selectedChannel);
            setFilterOpen(false);
          }}
        />
      )}
      {matchRateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => setMatchRateModalOpen(false)}>×</span>
            <div className="text-center font-bold text-[14px] mb-4">재료 매칭도 설정 (임시 모달)</div>
          </div>
        </div>
      )}
      {expiryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => setExpiryModalOpen(false)}>×</span>
            <div className="text-center font-bold text-[14px] mb-4">임박 재료 설정 (임시 모달)</div>
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
          <span style={{ color: '#fff', marginBottom: 6, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>
            {pendingRemove.type === 'done' ? '레시피 완료를 취소하시겠어요?' : '레시피 기록을 취소하시겠어요?'}
          </span>
          <div style={{display:'flex',flexDirection:'row',gap:12,justifyContent:'center',width:'100%'}}>
            <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" style={{marginRight:4}} onClick={handleRemoveUndo}>아니요</button>
            <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={handleRemoveConfirm}>네</button>
          </div>
        </div>
      )}
    </>
  );
};

export default RecordedRecipeListPage; 