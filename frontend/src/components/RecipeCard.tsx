import React, { useState } from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';
import IngredientPillGroup from './IngredientPillGroup';
import { getProxiedImageUrl } from '../utils/imageUtils';

interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

export interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  actionState?: RecipeActionState;
  onAction: (action: keyof RecipeActionState) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: SubstituteInfo };
  hideIndexNumber?: boolean;
}

export interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  actionState?: RecipeActionState;
  onAction: (action: keyof RecipeActionState) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: SubstituteInfo };
  hideIndexNumber?: boolean;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, index, actionState: propActionState, onAction, isLast, myIngredients = [], substituteTable = {}, hideIndexNumber = false }) => {
  const allIngredients = [
    ...(recipe.need_ingredients || []).map(ing => ({ ing, type: 'need' })),
    ...(recipe.my_ingredients || []).map(ing => ({ ing, type: 'have' })),
    ...(recipe.substitutes || []).map(ing => ({ ing, type: 'substitute' })),
  ];

  // used_ingredients에서 pill 리스트 만들기
  const ingredientList = (recipe.used_ingredients || '')
    .split(',')
    .map(i => i.trim())
    .filter(Boolean);

  const mySet = new Set((myIngredients || []).map(i => i.trim()));

  // 대체 가능 재료 추출 (need_ingredients 중 대체 가능성이 있는 것)
  let substituteTarget: string | null = null;
  let substituteTargetTo: string | null = null;
  if (recipe.need_ingredients && substituteTable) {
    for (const needRaw of recipe.need_ingredients) {
      const need = needRaw.trim();
      const substituteInfo = substituteTable[need];
      if (substituteInfo && mySet.has(substituteInfo.ingredient_b)) {
        substituteTarget = need;
        substituteTargetTo = substituteInfo.ingredient_b;
        break; // 여러 개면 첫 번째만 표시
      }
    }
  }

  // 1) 내가 보유하지 않고 대체도 불가한 재료
  const notMineNotSub = ingredientList.filter(i => !mySet.has(i) && (!substituteTarget || i !== substituteTarget));
  // 2) 내가 보유하지 않지만 대체 가능한 재료
  const notMineSub = substituteTarget ? [substituteTarget] : [];
  // 3) 내가 보유한 재료
  const mine = ingredientList.filter(i => mySet.has(i));

  const pills = [...notMineNotSub, ...notMineSub, ...mine];

  // 공백/대소문자 무시 매칭 (표시는 원본)
  const needIngredients = recipe.need_ingredients || [];
  const substitutes: string[] = [];
  needIngredients.forEach(needRaw => {
    const need = needRaw.trim();
    const substituteInfo = substituteTable[need];
    if (substituteInfo && mySet.has(substituteInfo.ingredient_b)) {
      substitutes.push(`${needRaw}→${substituteInfo.ingredient_b}`);
    }
  });

  // 상태 및 토스트 관리
  const [actionState, setActionState] = useState({
    done: isRecipeInStorage('my_completed_recipes', recipe.id),
    write: isRecipeInStorage('my_recorded_recipes', recipe.id),
    share: false,
  });
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1500);
  }

  function isRecipeInStorage(key: string, id: number) {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    return arr.some((r: any) => r.id === id);
  }
  function addRecipeToStorage(key: string, recipe: any, myIngredients: string[], substituteTable: any) {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    const needIngredients = recipe.need_ingredients || (recipe.used_ingredients || '').split(',').map((i: string) => i.trim()).filter(Boolean);
    const { substitutes } = getUniversalIngredientPillInfo({
      needIngredients,
      myIngredients,
      substituteTable,
    });
    const newRecipe = {
      ...recipe,
      like: recipe.like ?? recipe.likes ?? 0,
      comment: recipe.comment ?? recipe.comments ?? 0,
      substitutes,
      my_ingredients: myIngredients,
    };
    arr.push(newRecipe);
    localStorage.setItem(key, JSON.stringify(arr));
  }
  function removeRecipeFromStorage(key: string, id: number) {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(arr.filter((r: any) => r.id !== id)));
  }

  const handleAction = (action: 'done' | 'write' | 'share') => {
    if (action === 'done') {
      if (!actionState.done) {
        addRecipeToStorage('my_completed_recipes', recipe, myIngredients, substituteTable);
        showToast('레시피를 완료했습니다!');
      } else {
        removeRecipeFromStorage('my_completed_recipes', recipe.id);
        showToast('레시피 완료를 취소했습니다!');
      }
      setActionState(s => ({ ...s, done: !s.done }));
    }
    if (action === 'write') {
      if (!actionState.write) {
        addRecipeToStorage('my_recorded_recipes', recipe, myIngredients, substituteTable);
        showToast('레시피를 기록했습니다!');
      } else {
        removeRecipeFromStorage('my_recorded_recipes', recipe.id);
        showToast('레시피 기록을 취소했습니다!');
      }
      setActionState(s => ({ ...s, write: !s.write }));
    }
    if (action === 'share') {
      const shareUrl = recipe.link || window.location.origin + `/recipe-detail/${recipe.id}`;
      navigator.clipboard.writeText(shareUrl);
      showToast('URL이 복사되었습니다!');
      setActionState(s => ({ ...s, share: true }));
      setTimeout(() => setActionState(s => ({ ...s, share: false })), 1000);
    }
  };

  // 본문 통합 렌더링
  const recipeAny = recipe as any;
  const recipeBody = recipeAny.body || recipeAny.content || recipeAny.description || '';

  return (
    <div
      className="bg-white rounded-[20px] shadow-sm min-h-[144px] relative p-4"
      style={{ marginBottom: isLast ? 40 : 16, minWidth: 350, maxWidth: 400, width: '100%', margin: '0 auto' }}
    >
      {!hideIndexNumber && (
        <div className="font-bold text-[18px] text-[#222] text-left">
          {String(index + 1).padStart(2, '0')}
        </div>
      )}
      {!hideIndexNumber && (
        <div className="h-[2px] w-[20px] bg-[#E5E5E5] mb-2"></div>
      )}
      
      <div className="flex flex-row items-center justify-between w-full min-w-[200px] flex-shrink-0">
        <a
          href={recipe.link}
          target="_blank"
          rel="noopener noreferrer"
          title={recipe.title}
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-[#222] leading-tight antialiased hover:underline"
          style={{
            fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            fontWeight: 700,
            textShadow: 'none'
          }}
        >
          {recipe.title}
        </a>
        <div className="flex flex-row gap-[6px] items-center">
          <button
            title="완료"
            className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none"
            onClick={() => handleAction('done')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState.done ? doneBlackIcon : doneIcon} alt="완료" width={19} height={19} className="block" />
          </button>
          <button
            title="공유"
            className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none"
            onClick={() => handleAction('share')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState.share ? shareBlackIcon : shareIcon} alt="공유" width={19} height={19} className="block" />
          </button>
          <button
            title="기록"
            className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none"
            onClick={() => handleAction('write')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState.write ? writeBlackIcon : writeIcon} alt="기록" width={19} height={19} className="block" />
          </button>
        </div>
      </div>

      <div className="flex flex-row gap-6 items-start mb-2">
        <a
          href={recipe.link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative min-w-[97px] max-w-[97px] h-[79px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 group"
          style={{ display: 'block' }}
        >
          <img src={getProxiedImageUrl(recipe.thumbnail)} alt="썸네일" className="w-full h-full object-cover object-center group-hover:opacity-80 transition" />
          <div className="absolute bg-[#444] bg-opacity-80 text-white text-[10px] font-medium rounded px-2 py-0.5 flex items-center gap-1" style={{ top: 0, left: 0, textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
            재료매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{recipe.match_rate}%</span>
          </div>
        </a>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center mb-1 w-full" style={{ gap: 4 }}>
            <span
              className="text-[#FFD600] font-bold text-[12px] mr-1.5"
              style={{
                minWidth: 0,
                maxWidth: 110,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                verticalAlign: 'bottom',
                flexShrink: 1,
                flexGrow: 1,
              }}
            >
              {recipe.author}
            </span>
            <span
              className="text-[#B0B0B0] text-[10.4px] ml-auto"
              style={{
                minWidth: 44,
                textAlign: 'right',
                flexShrink: 0,
                marginRight: 4,
              }}
            >
              {recipe.date}
            </span>
            <span
              className="text-[#B0B0B0] text-[10.4px] text-right"
              style={{
                minWidth: 90,
                maxWidth: 120,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                overflow: 'visible',
                textOverflow: 'clip',
              }}
            >
              좋아요 {(recipe as any).likes ?? 0} · 댓글 {(recipe as any).comments ?? 0}
            </span>
          </div>
          <a
            href={recipe.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 max-h-16 overflow-y-auto pr-1 cursor-pointer custom-scrollbar text-[12px] text-[#444] hover:underline"
            title={recipeBody}
            style={{ display: 'block' }}
          >
            {recipeBody}
          </a>
        </div>
      </div>

      <IngredientPillGroup
        needIngredients={(recipe.used_ingredients || '').split(',').map((i: string) => (i ? i.trim() : '')).filter(Boolean)}
        myIngredients={myIngredients}
        substituteTable={substituteTable}
      />

      {toast && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: 80,
          transform: 'translateX(-50%)',
          background: '#222',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 12,
          fontWeight: 500,
          fontSize: 15,
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
          textShadow: 'none',
        }}>
          {toast}
      </div>
      )}
    </div>
  );
};

export default RecipeCard; 