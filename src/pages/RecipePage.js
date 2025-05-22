import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const RecipePage = () => {
  const location = useLocation();

  const STORAGE_KEY = 'recipe_sortbar_state_recipe';

  // 필터/정렬 상태
  const [matchRange, setMatchRange] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).matchRange : [30, 100];
  });
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).appliedExpiryIngredients : [];
  });
  const [sortType, setSortType] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).sortType : 'match';
  });
  const [expirySortType, setExpirySortType] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).expirySortType : 'expiry';
  });
  const [maxLack, setMaxLack] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).maxLack : 'unlimited';
  });

  // 필터/정렬 상태 저장
  useEffect(() => {
    const state = {
      matchRange,
      appliedExpiryIngredients,
      sortType,
      expirySortType,
      maxLack
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [matchRange, appliedExpiryIngredients, sortType, expirySortType, maxLack]);

  // SPA 라우팅에서 상태 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      if (state.matchRange) setMatchRange(state.matchRange);
      if (state.appliedExpiryIngredients) setAppliedExpiryIngredients(state.appliedExpiryIngredients);
      if (state.sortType) setSortType(state.sortType);
      if (state.expirySortType) setExpirySortType(state.expirySortType);
      if (state.maxLack !== undefined) setMaxLack(state.maxLack);
    }
  }, [location.key]); // location.key가 변경될 때마다 실행

  // ... 나머지 컴포넌트 코드 ...
}

export default RecipePage; 