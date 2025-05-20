import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';
import { getMyIngredients } from '../utils/recipeUtils';
import FilterModal from '../components/FilterModal';
import RecipeSortBar from '../components/RecipeSortBar';

// Add FilterState interface definition after imports
interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
}

// Add initialFilterState definition after imports
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

// Add getMatchRate function after parseIngredientNames
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

// Update dummy data variable name
const dummyRecordedRecipes: Recipe[] = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '요즘 틱톡에서 유행하는 초간단 안주레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '오징어,대파,고추,양파',
    match_rate: 80,
    link: 'https://example.com/recipe1',
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '다이어트 김밥 만들기 오이김밥 레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '오이,김,밥,계란,당근',
    match_rate: 90,
    link: 'https://example.com/recipe2',
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '숙취해소로 최고의 황태해장국',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '황태,무,대파,달걀,마늘',
    match_rate: 75,
    link: 'https://example.com/recipe3',
  },
];

const CompletedRecipeListPage = () => {
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const myIngredients = getMyIngredients();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [sortType, setSortType] = useState('match');
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
      });
  }, []);

  const handleRecipeAction = (recipeId: number, action: keyof RecipeActionState) => {
    const prevState = recipeActionStates[recipeId] || { done: false, share: false, write: false };
    const isActive = prevState[action];
    setRecipeActionStates(prev => ({
      ...prev,
      [recipeId]: { ...prevState, [action]: !isActive }
    }));
    switch (action) {
      case 'done':
        setToast(isActive ? '레시피 완료를 취소했습니다!' : '레시피를 완료했습니다!');
        break;
      case 'write':
        setToast(isActive ? '레시피 기록을 취소했습니다!' : '레시피를 기록했습니다!');
        break;
      case 'share':
        navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipeId}`);
        setToast('URL이 복사되었습니다!');
        break;
    }
    setTimeout(() => setToast(''), 1500);
  };

  return (
    <>
      <TopNavBar />
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
        <RecipeSortBar
          recipes={dummyRecordedRecipes}
          myIngredients={myIngredients}
        />
      </div>
      <BottomNavBar activeTab="mypage" />
      {toast && <RecipeToast message={toast} />}
      <RecipeSortBar
        sortType={sortType}
        onSortChange={setSortType}
        sortOptions={[
          { value: 'match', label: '재료매칭률순' },
          { value: 'expiry', label: '유통기한 임박순' },
          { value: 'like', label: '좋아요순' },
          { value: 'comment', label: '댓글순' },
          { value: 'latest', label: '최신순' },
        ]}
        onFilterClick={() => setFilterOpen(true)}
      >
        <button
          className="h-6 border border-gray-300 rounded text-xs px-2 font-bold bg-white text-gray-700 min-w-[70px] hover:bg-gray-50 flex items-center"
          onClick={() => setMatchRateModalOpen(true)}
        >
          재료 매칭도 설정
        </button>
        <button
          className="h-6 border border-gray-300 rounded text-xs px-2 font-bold bg-white text-gray-700 min-w-[70px] hover:bg-gray-50 flex items-center"
          onClick={() => setExpiryModalOpen(true)}
        >
          임박 재료 설정
        </button>
      </RecipeSortBar>
      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filterState={selectedFilter}
          setFilterState={setSelectedFilter}
          includeInput={includeInput}
          setIncludeInput={setIncludeInput}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          allIngredients={allIngredients}
          includeKeyword={includeKeyword}
          setIncludeKeyword={setIncludeKeyword}
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
    </>
  );
};

export default CompletedRecipeListPage; 