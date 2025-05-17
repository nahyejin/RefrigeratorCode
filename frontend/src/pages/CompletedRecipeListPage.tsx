import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';

// 더미 데이터
const dummyCompletedRecipes: Recipe[] = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '',
    match_rate: 85,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '',
    match_rate: 78,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '두릅 장아찌 만드는법 레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '',
    match_rate: 70,
  },
];

const CompletedRecipeListPage = () => {
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

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
      <TopNavBar title="내가 완료한 레시피" />
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
        <div className="flex flex-col gap-2">
          {dummyCompletedRecipes.map((recipe, idx) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={idx}
              actionState={recipeActionStates[recipe.id]}
              onAction={action => handleRecipeAction(recipe.id, action)}
              isLast={idx === dummyCompletedRecipes.length - 1}
            />
          ))}
        </div>
      </div>
      <BottomNavBar activeTab="mypage" />
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default CompletedRecipeListPage; 