import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { openCookMode } from '../utils/cookMode';
import { getMyIngredientsAsKeywords, preloadIngredientSynonymDict } from '../utils/recipeUtils';

/**
 * 가족이 보낸 레시피 알림을 누르면 `/recipe-list?open=<id>&from=family` 로 들어온다(2026-10-16).
 * 냉장고요리 화면 위에 그 레시피 패널을 바로 열고, 닫을 때 「언제 해먹을까요?」를 묻게 한다.
 * 주소의 `open` 은 한 번 쓰고 지운다 — 뒤로 갔다 오거나 새로고침해도 또 열리지 않게.
 */
const RecipeShareOpener: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (location.pathname !== '/recipe-list') return;
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('open'));
    if (!id || !Number.isFinite(id)) return;
    const fromFamily = params.get('from') === 'family';
    params.delete('open');
    params.delete('from');
    const rest = params.toString();
    navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
    // 내 재료(대표어)가 있어야 패널이 있는 것/없는 것을 나눠 보여 준다 — 사전을 기다렸다가 연다
    void preloadIngredientSynonymDict().catch(() => {}).then(() => {
      let mine: string[] = [];
      try { mine = getMyIngredientsAsKeywords(); } catch { /* 없으면 빈 채로 */ }
      openCookMode({ id, myIngredients: mine, askPlanOnClose: fromFamily });
    });
  }, [location.pathname, location.search, navigate]);

  return null;
};

export default RecipeShareOpener;
