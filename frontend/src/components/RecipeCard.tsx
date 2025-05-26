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
import { getPlatformLogo } from '../utils/platform';
import { calculateMatchRate } from '../utils/recipeUtils';
import 완료하기버튼 from '../assets/완료하기버튼.png';
import 공유하기버튼 from '../assets/공유하기버튼.png';
import 기록하기버튼 from '../assets/기록하기버튼.png';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

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
  onAction: (recipe: Recipe) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: SubstituteInfo };
  hideIndexNumber?: boolean;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, index, actionState: propActionState, onAction, isLast, myIngredients = [], substituteTable = {}, hideIndexNumber = false }) => {
  // used_ingredients에서 pill 리스트 만들기
  const ingredientList = (() => {
    if (Array.isArray(recipe.used_ingredients)) {
      return recipe.used_ingredients.map(i => i.trim()).filter(Boolean);
    }
    return (recipe.used_ingredients || '').split(',').map(i => i.trim()).filter(Boolean);
  })();

  const mySet = new Set((myIngredients || []).map(i => i.trim()));

  // 버튼 클릭 시 onAction만 호출
  const handleDoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onAction({ ...recipe, action: 'done' });
  };
  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onAction({ ...recipe, action: 'share' });
  };
  const handleRecordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onAction({ ...recipe, action: 'write' });
  };

  const match = calculateMatchRate(myIngredients, Array.isArray(recipe.used_ingredients) 
    ? recipe.used_ingredients.join(',') 
    : recipe.used_ingredients || '');

  return (
    <div
      className="bg-white rounded-[20px] shadow-sm min-h-[144px] relative p-4 block hover:shadow-md transition cursor-pointer"
      style={{ marginBottom: isLast ? 40 : 16, minWidth: 0, maxWidth: 400, width: '100%', margin: '0 auto', textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ position: 'relative', width: '100%', height: 180 }}>
        <img
          src={getProxiedImageUrl(recipe.thumbnail)}
          alt="썸네일"
          onError={e => { e.currentTarget.src = '/default-thumbnail.png'; }}
          style={{
            width: '100%',
            height: 180,
            objectFit: 'cover',
            borderRadius: 12,
            marginBottom: 12,
          }}
        />
        {/* 재료 매칭률 뱃지 */}
        <div className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center gap-1" style={{ position: 'absolute', top: 8, left: 8, fontSize: 12, zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
          재료 매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{match.rate}%</span>
        </div>
        {/* 플랫폼 로고 */}
        <img
          src={getPlatformLogo(recipe.platform) || naverLogo}
          alt="플랫폼 로고"
          style={{ position: 'absolute', right: 4, top: 4, width: 24, height: 24, zIndex: 2 }}
          onError={e => { e.currentTarget.src = naverLogo; }}
        />
        {/* 완료/공유/기록 버튼 */}
        <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', zIndex: 2 }}>
          <span style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
            <button title="완료" tabIndex={0} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2 }} onClick={handleDoneClick}>
              <img src={완료하기버튼} alt="완료" width={19} height={19} style={{ display: 'block', position: 'relative', zIndex: 2, opacity: propActionState?.done ? 0.5 : 1, filter: propActionState?.done ? 'brightness(0.6)' : 'none' }} />
            </button>
          </span>
          <span style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
            <button title="공유" tabIndex={0} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2 }} onClick={handleShareClick}>
              <img src={공유하기버튼} alt="공유" width={19} height={19} style={{ display: 'block', position: 'relative', zIndex: 2, opacity: propActionState?.share ? 0.5 : 1, filter: propActionState?.share ? 'brightness(0.6)' : 'none' }} />
            </button>
          </span>
          <span style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
            <button title="기록" tabIndex={0} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2 }} onClick={handleRecordClick}>
              <img src={기록하기버튼} alt="기록" width={19} height={19} style={{ display: 'block', position: 'relative', zIndex: 2, opacity: propActionState?.write ? 0.5 : 1, filter: propActionState?.write ? 'brightness(0.6)' : 'none' }} />
            </button>
          </span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{recipe.title}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        좋아요 {(recipe as any).likes?.toLocaleString() ?? 0} · 댓글 {(recipe as any).comments?.toLocaleString() ?? 0}
        {recipe.platform && (recipe.platform.includes('youtube') || recipe.platform.includes('유튜브(인플루언서)')) && ` · 조회수 ${(recipe as any).hits?.toLocaleString() ?? 0}`}
      </div>
      <IngredientPillGroup
        needIngredients={ingredientList}
        myIngredients={myIngredients}
        substituteTable={substituteTable}
      />
    </div>
  );
};

export default RecipeCard; 