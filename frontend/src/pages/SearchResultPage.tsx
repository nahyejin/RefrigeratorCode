import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';
import { getMyIngredients } from '../utils/recipeUtils';
import FilterModal from '../components/FilterModal';
import RecipeSortBar from '../components/RecipeSortBar';
import backIcon from '../assets/뒤로가기.png';
import { addRecipeToLocalStorage, removeRecipeFromLocalStorage, getRecipesFromLocalStorage, copyRecipeUrlToClipboard, getMyFridgeIngredients } from '../utils/recipeStorage';

// =====================
// 타입 및 샘플 데이터
// =====================

const SAMPLE_RECIPES: Recipe[] = [
  // { id: 1, title: '예시 레시피', ... } // 필요시 샘플 추가
];

// =====================
// 메인 컴포넌트
// =====================

const SearchResultPage: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>(SAMPLE_RECIPES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const myIngredients = getMyIngredients();

  // =====================
  // 이벤트 핸들러 (샘플)
  // =====================

  const handleRecipeClick = (recipe: Recipe) => {
    // TODO: 상세 페이지 이동 등 구현
    setToast(`${recipe.title} 클릭됨`);
  };

  // =====================
  // 사이드 이펙트 (샘플)
  // =====================

  useEffect(() => {
    // TODO: 실제 검색 결과 fetch 구현
    // setIsLoading(true);
    // fetch(...)
    //   .then(...)
    //   .catch(...)
    //   .finally(() => setIsLoading(false));
  }, []);

  // =====================
  // 렌더링
  // =====================

  return (
    <div className="min-h-screen bg-white max-w-[430px] mx-auto pb-20">
      <TopNavBar />
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">검색 결과</h2>
        {isLoading && <div className="text-center py-8">로딩 중...</div>}
        {error && <div className="text-center text-red-500 py-8">{error}</div>}
        {!isLoading && !error && (
          <VirtualizedRecipeList
            recipes={recipes}
            myIngredients={myIngredients}
            substituteTable={{}}
            recipeActionStates={{}}
            onRecipeAction={handleRecipeClick}
          />
        )}
      </div>
      <BottomNavBar activeTab="recipe" />
      {toast && <RecipeToast message={toast} />}
    </div>
  );
};

export default SearchResultPage; 