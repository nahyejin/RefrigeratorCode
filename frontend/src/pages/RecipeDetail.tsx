import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
import { getMyIngredients } from '../utils/recipeUtils';
import { Recipe, RecipeActionState } from '../types/recipe';

const RecipeDetail = () => {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(null);
  const [actionState, setActionState] = useState<RecipeActionState>({ done: false, share: false, write: false });
  const navigate = useNavigate();
  const myIngredients = getMyIngredients();

  useEffect(() => {
    fetchRecipesDummy().then((data) => {
      const found = data.find((r: any) => String(r.id) === String(id));
      setRecipe(found);
    });
  }, [id]);

  if (!recipe) return <div className="p-8 text-center">레시피를 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-white pb-20 pt-6 px-4">
      <button className="mb-4 text-blue-500" onClick={() => navigate(-1)}>&larr; 목록으로</button>
      <RecipeCard
        recipe={recipe}
        index={0}
        actionState={actionState}
        onAction={(action) => setActionState((prev) => ({ ...prev, [action]: !prev[action] }))}
        isLast={true}
        myIngredients={myIngredients}
      />
      <div className="mt-6 text-xs text-gray-400">* 본문/재료 정보는 예시 데이터입니다.</div>
    </div>
  );
};

export default RecipeDetail; 