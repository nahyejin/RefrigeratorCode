import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
import { getMyIngredients } from '../utils/recipeUtils';
import { Recipe, RecipeActionState } from '../types/recipe';
import {
  getRecipeActionState,
  addRecipeToLocalStorage,
  removeRecipeFromLocalStorage,
} from '../utils/recipeStorage';
import CoupangAd from '../components/CoupangAd';
import Dialog from '../components/ui/Dialog';

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
  /** 즐겨찾기·기록·완료를 **해제**할 때 한 번 묻는다 — 다른 모든 화면(목록·시트)과 같다. */
  const [pendingRemove, setPendingRemove] = useState<'favorite' | 'done' | 'write' | null>(null);
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
  const handleRecipeAction = (recipeWithAction: Recipe & { action: keyof RecipeActionState }) => {
    if (!recipe) return;

    const action = recipeWithAction.action;
    if (action === 'share') {
      return;
    }

    const current = getRecipeActionState(recipe.id);
    if (action === 'favorite' || action === 'done' || action === 'write') {
      if (current[action]) {
        setPendingRemove(action);
      } else {
        addRecipeToLocalStorage(action, recipe);
      }
      setActionState(getRecipeActionState(recipe.id));
    }
  };

  const confirmRemove = () => {
    if (recipe && pendingRemove) {
      removeRecipeFromLocalStorage(pendingRemove, recipe.id);
      setActionState(getRecipeActionState(recipe.id));
    }
    setPendingRemove(null);
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

  useEffect(() => {
    if (recipe?.id != null) {
      setActionState(getRecipeActionState(recipe.id));
    }
  }, [recipe?.id]);

  useEffect(() => {
    const syncActionState = () => {
      if (recipe?.id != null) {
        setActionState(getRecipeActionState(recipe.id));
      }
    };

    window.addEventListener('localStorageChange', syncActionState);
    window.addEventListener('focus', syncActionState);
    return () => {
      window.removeEventListener('localStorageChange', syncActionState);
      window.removeEventListener('focus', syncActionState);
    };
  }, [recipe?.id]);

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
        onRecipeAction={handleRecipeAction}
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

      {pendingRemove && (
        <Dialog
          open
          onClose={() => setPendingRemove(null)}
          title={
            pendingRemove === 'done' ? '레시피 완료를 취소하시겠어요?'
            : pendingRemove === 'write' ? '레시피 기록을 취소하시겠어요?'
            : '레시피 즐겨찾기를 취소하시겠어요?'
          }
          width={320}
          actions={[
            { label: '아니요', onClick: () => setPendingRemove(null), variant: 'outline' },
            { label: '네, 취소할게요', onClick: confirmRemove, variant: 'danger' },
          ]}
        />
      )}
    </div>
  );
};

export default RecipeDetail; 