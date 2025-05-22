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

// Add FilterState interface definition after imports
interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
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
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room];
    }
  } catch {}
  return [];
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

  useEffect(() => {
    function load() {
      const arr = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
      setRecipes(arr);
    }
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

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

  const processedRecipes = useMemo(() => {
    let arr = [...recipes];
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
  }, [recipes, sortType]);

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
        />
        <div className="mt-4">
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              actionState={recipeActionStates[recipe.id]}
              onAction={(action) => handleRecipeAction(recipe.id, action)}
              isLast={index === processedRecipes.length - 1}
              myIngredients={myIngredients}
            />
          ))}
        </div>
      </div>
      <BottomNavBar activeTab="mypage" />
      {toast && <RecipeToast message={toast} />}
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

export default RecordedRecipeListPage; 