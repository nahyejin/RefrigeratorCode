import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import RecipeSortBar from '../components/RecipeSortBar';
import { getMyIngredients } from '../utils/recipeUtils';
import { Recipe, RecipeActionState } from '../types/recipe';

const RecipeList: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const myIngredients = useMemo(() => getMyIngredients(), []);

  // 최초 마운트 시 localStorage에서 복원 (useRef)
  const saved = React.useRef<any>(null);
  if (saved.current === null) {
    const raw = localStorage.getItem('recipe_sortbar_state_fridge');
    saved.current = raw ? JSON.parse(raw) : {};
  }

  const [sortType, setSortType] = useState(saved.current.sortType || 'match');
  const [matchRange, setMatchRange] = useState<[number, number]>(saved.current.matchRange || [30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>(saved.current.maxLack !== undefined ? saved.current.maxLack : 'unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>(saved.current.expirySortType || 'expiry');
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>(saved.current.appliedExpiryIngredients || []);

  // 필터/정렬 상태 저장
  useEffect(() => {
    const state = {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      expirySortType
    };
    localStorage.setItem('recipe_sortbar_state_fridge', JSON.stringify(state));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

  if (saved.current === null) return null;

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
        <h2 className="text-lg font-bold mb-4 text-center">내 냉장고 기반 레시피 추천</h2>
        <RecipeSortBar
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
      </div>
    </>
  );
};

export default RecipeList; 