import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';

export interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  actionState?: RecipeActionState;
  onAction: (action: keyof RecipeActionState) => void;
  isLast: boolean;
  myIngredients?: string[];
}

// 네이버 postfiles 등 외부 이미지 프록시 함수
function getProxiedImageUrl(url: string) {
  if (!url) return '';
  if (url.includes('postfiles.pstatic.net')) {
    return 'https://images.weserv.nl/?url=' + url.replace(/^https?:\/\//, '');
  }
  return url;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, index, actionState, onAction, isLast, myIngredients = [] }) => {
  console.log('RecipeCard received myIngredients:', myIngredients); // 디버깅용
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
  const notMine = ingredientList.filter(i => !mySet.has(i));
  const mine = ingredientList.filter(i => mySet.has(i));
  const sortedIngredients = [...notMine, ...mine];

  return (
    <div
      className="bg-white rounded-[20px] shadow-sm min-h-[144px] relative p-4"
      style={{ marginBottom: isLast ? 40 : 16 }}
    >
      <div className="font-bold text-[18px] text-[#222] text-left">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="h-[2px] w-[20px] bg-[#E5E5E5] mb-2"></div>
      
      <div className="flex flex-row items-center justify-between w-full min-w-[200px] flex-shrink-0">
        <a
          href={recipe.link}
          target="_blank"
          rel="noopener noreferrer"
          title={recipe.title}
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[14.4px] font-bold text-[#222] leading-tight antialiased hover:underline"
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
            onClick={() => onAction('done')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState?.done ? doneBlackIcon : doneIcon} alt="완료" width={19} height={19} className="block" />
          </button>
          <button
            title="공유"
            className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none"
            onClick={() => onAction('share')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState?.share ? shareBlackIcon : shareIcon} alt="공유" width={19} height={19} className="block" />
          </button>
          <button
            title="기록"
            className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none"
            onClick={() => onAction('write')}
            tabIndex={0}
            onMouseDown={e => e.preventDefault()}
          >
            <img src={actionState?.write ? writeBlackIcon : writeIcon} alt="기록" width={19} height={19} className="block" />
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
          <div className="flex items-center mb-1 w-full justify-between">
            <span className="text-[#FFD600] font-bold text-[12px] mr-1.5">{recipe.author}</span>
            <span className="text-[#B0B0B0] text-[10.4px]">{recipe.date}</span>
            <span className="text-[#B0B0B0] text-[10.4px] ml-auto text-right" style={{ minWidth: 80 }}>
              좋아요 {(recipe as any).likes ?? 0} · 댓글 {(recipe as any).comments ?? 0}
            </span>
          </div>
          <a
            href={recipe.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 max-h-16 overflow-y-auto pr-1 cursor-pointer custom-scrollbar text-[12px] text-[#444] hover:underline"
            title={recipe.body}
            style={{ display: 'block' }}
          >
            {recipe.body}
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-1 max-h-9 overflow-y-auto custom-scrollbar pr-1">
        {sortedIngredients.map((ing) => {
          const isMine = mySet.has(ing);
          return (
            <span
              key={ing}
              className={
                (isMine
                  ? 'bg-[#FFD600] text-[#444]'
                  : 'bg-[#D1D1D1] text-white'
                ) + ' rounded-full px-3 py-0.5 font-medium text-[10.4px]'
              }
            >
              {ing}
            </span>
          );
        })}
      </div>

      {recipe.substitutes && recipe.substitutes.length > 0 && (() => {
        const mySet = new Set(myIngredients.map(i => i.trim().toLowerCase()));
        const filteredSubs = recipe.substitutes.filter(sub => {
          const [from, to] = sub.split('→').map(s => s.trim().toLowerCase());
          return to && mySet.has(to);
        });
        return (
          <div className="mt-1 custom-scrollbar pr-1 flex flex-wrap items-start max-h-12 overflow-y-auto overflow-x-hidden gap-1 pb-1 w-full">
            <span className="bg-[#555] text-white rounded px-3 py-1 font-medium text-[12px] flex-shrink-0" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.08)' }}>
              대체 가능 :
            </span>
            <span className="ml-2 text-[12px] text-[#B0B0B0] font-normal flex-1 min-w-0 break-all whitespace-normal">
              {filteredSubs.length > 0
                ? filteredSubs.join(', ')
                : '(내 냉장고에 대체 가능한 재료가 없습니다)'}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

export default RecipeCard; 