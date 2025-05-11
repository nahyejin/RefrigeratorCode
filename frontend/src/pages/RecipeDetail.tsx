import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// 더미 fetch 함수 (RecipeList와 동일)
function fetchRecipesDummy() {
  return Promise.resolve([
    {
      id: 1,
      thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
      title: '오징어볶음 레시피 만드는법 간단',
      body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다.',
      used_ingredients: '오징어,대파,고추,양파,당근,고추장',
      author: '꼬마츄츄',
      date: '25-03-08',
      like: 77,
      comment: 12,
      substitutes: ['양파→대파', '고추장→된장'],
    },
    {
      id: 2,
      thumbnail: 'https://cdn.pixabay.com/photo/2017/05/07/08/56/food-2290814_1280.jpg',
      title: '대패삼겹살 제육볶음 레시피',
      body: '미리 양념장을 만들어서 볶아도 좋고... 대패삼겹살 제육볶음 레시피입니다.',
      used_ingredients: '삼겹살,대파,고추,양파,고추장,설탕',
      author: '꼬마츄츄',
      date: '25-04-09',
      like: 55,
      comment: 8,
      substitutes: ['설탕→올리고당'],
    },
  ]);
}

function getMatchRate(myIngredients: string[], recipeIngredients: string) {
  const recipeSet = new Set(recipeIngredients.split(',').map((i: string) => i.trim()));
  const mySet = new Set(myIngredients);
  const matched = [...recipeSet].filter((i: string) => mySet.has(i));
  return {
    rate: Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet].filter((i: string) => !mySet.has(i)),
  };
}

function getMyIngredients() {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room].map((i: any) => (typeof i === 'string' ? i : i.name));
    }
  } catch {}
  return ['오징어', '대파', '고추', '삼겹살'];
}

const RecipeDetail = () => {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const navigate = useNavigate();
  const myIngredients = getMyIngredients();

  useEffect(() => {
    fetchRecipesDummy().then((data) => {
      const found = data.find((r) => String(r.id) === String(id));
      setRecipe(found);
      if (found) setMatch(getMatchRate(myIngredients, found.used_ingredients));
    });
  }, [id]);

  if (!recipe) return <div className="p-8 text-center">레시피를 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-white pb-20 pt-6 px-4">
      <button className="mb-4 text-blue-500" onClick={() => navigate(-1)}>&larr; 목록으로</button>
      <img src={recipe.thumbnail} alt="썸네일" className="w-full h-48 object-cover rounded-xl mb-4" />
      <div className="text-2xl font-bold mb-2">{recipe.title}</div>
      <div className="text-sm text-gray-500 mb-2">{recipe.author} · {recipe.date}</div>
      <div className="text-base text-gray-700 mb-4 whitespace-pre-line">{recipe.body}</div>
      <div className="mb-2">
        <span className="text-xs bg-yellow-200 text-yellow-800 rounded px-2 py-0.5 font-semibold">재료 매칭률 {match?.rate}%</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {match?.my_ingredients.map((ing: string) => (
          <span key={ing} className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs">{ing}</span>
        ))}
        {match?.need_ingredients.map((ing: string) => (
          <span key={ing} className="bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 text-xs">{ing}</span>
        ))}
      </div>
      {recipe.substitutes && recipe.substitutes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {recipe.substitutes.map((sub: string) => (
            <span key={sub} className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs">대체: {sub}</span>
          ))}
        </div>
      )}
      <div className="mt-6 text-xs text-gray-400">* 본문/재료 정보는 예시 데이터입니다.</div>
    </div>
  );
};

export default RecipeDetail; 