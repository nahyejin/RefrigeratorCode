import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import RecipeCard from '../components/RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import RecipeToast from '../components/RecipeToast';
import { getMyIngredients } from '../utils/recipeUtils';

// 더미 데이터
const dummyCompletedRecipes: Recipe[] = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '오징어,고춧가루,참기름,간장,설탕',
    match_rate: 85,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '삼겹살,고추장,참기름,고춧가루,대파',
    match_rate: 78,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '두릅 장아찌 만드는법 레시피',
    author: '홍길동',
    date: '24-05-01',
    body: '',
    used_ingredients: '두릅,고춧가루,참기름,간장,식초',
    match_rate: 70,
  },
];

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

const CompletedRecipeListPage = () => {
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const myIngredients = getMyIngredients();

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
        <div className="flex flex-col gap-2">
          {dummyCompletedRecipes.map((recipe, idx) => {
            const match = getMatchRate(myIngredients, recipe.used_ingredients || '');
            return (
              <RecipeCard
                key={recipe.id}
                recipe={{ ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients }}
                index={idx}
                actionState={recipeActionStates[recipe.id]}
                onAction={action => handleRecipeAction(recipe.id, action)}
                isLast={idx === dummyCompletedRecipes.length - 1}
                myIngredients={myIngredients}
              />
            );
          })}
        </div>
      </div>
      <BottomNavBar activeTab="mypage" />
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default CompletedRecipeListPage; 