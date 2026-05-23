import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
import { getMyIngredients } from '../utils/recipeUtils';
import { Recipe, RecipeActionState } from '../types/recipe';
import CoupangAd from '../components/CoupangAd';

// =====================
// 상수
// =====================

const CONTAINER_STYLE = {
  maxWidth: '430px',
  minHeight: '100vh',
  paddingBottom: '80px',
  paddingTop: '24px',
  paddingLeft: '16px',
  paddingRight: '16px'
};

// =====================
// 메인 컴포넌트
// =====================

const RecipeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(null);
  const [actionState, setActionState] = useState<RecipeActionState>({ 
    done: false, 
    share: false, 
    write: false,
    favorite: false
  });
  const navigate = useNavigate();
  const myIngredients = getMyIngredients();

  // =====================
  // 이벤트 핸들러
  // =====================

  /**
   * 뒤로가기 처리
   */
  const handleBackClick = () => {
    navigate(-1);
  };

  /**
   * 레시피 액션 처리
   */
  const handleAction = (action: keyof RecipeActionState) => {
    setActionState((prev) => ({ ...prev, [action]: !prev[action] }));
  };

  // =====================
  // 사이드 이펙트
  // =====================

  // 레시피 데이터 로드
  useEffect(() => {
    const loadRecipe = async () => {
      try {
        const data = await fetchRecipesDummy();
        const found = data.find((r: any) => String(r.id) === String(id));
        setRecipe(found);
      } catch (error) {
        console.warn('[RecipeDetail] 레시피 로드 실패:', error);
        setRecipe(null);
      }
    };

    if (id) {
      loadRecipe();
    }
  }, [id]);

  // =====================
  // 렌더링
  // =====================

  if (!recipe) {
    return (
      <div className="p-8 text-center">
        레시피를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div 
      className="mx-auto bg-white"
      style={CONTAINER_STYLE}
    >
      <button 
        className="mb-4 text-blue-500" 
        onClick={handleBackClick}
      >
        &larr; 목록으로
      </button>
      
      <RecipeCard
        recipe={recipe}
        index={0}
        recipeActionState={actionState}
        onRecipeAction={(recipeWithAction) => {
          const action = recipeWithAction.action;
          setActionState((prev) => ({ ...prev, [action]: !prev[action] }));
        }}
        isLast={true}
        myIngredients={myIngredients}
      />
      
      {/* 쿠팡 광고 */}
      <CoupangAd 
        style={{ 
          marginTop: '24px',
          marginBottom: '24px'
        }} 
      />
      
      <div className="mt-6 text-xs text-gray-400">
        * 본문/재료 정보는 예시 데이터입니다.
      </div>
    </div>
  );
};

export default RecipeDetail; 