import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { getPlatformLogo } from '../utils/platform';
import { calculateMatchRate } from '../utils/recipeUtils';
import IngredientPillGroup from './IngredientPillGroup';
import 완료하기버튼 from '../assets/완료하기버튼.png';
import 공유하기버튼 from '../assets/공유하기버튼.png';
import 기록하기버튼 from '../assets/기록하기버튼.png';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

// 버튼/아이콘/스타일 상수화
const ACTIONS = [
  { key: 'done', title: '완료', icon: 완료하기버튼 },
  { key: 'share', title: '공유', icon: 공유하기버튼 },
  { key: 'write', title: '기록', icon: 기록하기버튼 },
] as const;
const BUTTON_SIZE = 26;
const ICON_SIZE = 19;

export interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  recipeActionState?: RecipeActionState;
  onRecipeAction: (recipe: Recipe & { action: 'done' | 'share' | 'write' }) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: any };
  hideIndexNumber?: boolean;
}

// RecipeCard는 UI만 담당, 상태/스토리지/토스트 등은 상위에서 관리
const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  index,
  recipeActionState,
  onRecipeAction,
  isLast,
  myIngredients = [],
  substituteTable = {},
  hideIndexNumber = false,
}) => {
  // used_ingredients 파싱
  const usedIngredientList = Array.isArray(recipe.used_ingredients)
    ? recipe.used_ingredients.map(i => i.trim()).filter(Boolean)
    : (recipe.used_ingredients || '').split(',').map(i => i.trim()).filter(Boolean);

  // 버튼 클릭 핸들러 하나로 통합
  const handleActionButtonClick = (action: 'done' | 'share' | 'write', e: React.MouseEvent) => {
    e.preventDefault();
    onRecipeAction({ ...recipe, action });
  };

  const match = calculateMatchRate(
    myIngredients,
    Array.isArray(recipe.used_ingredients)
      ? recipe.used_ingredients.join(',')
      : recipe.used_ingredients || ''
  );

  return (
    <div
      className="bg-white rounded-[20px] shadow-sm min-h-[144px] relative p-4 block hover:shadow-md transition cursor-pointer"
      style={{ 
        marginBottom: isLast ? 40 : 16,
        marginLeft: 'auto',
        marginRight: 'auto',
        minWidth: 0, 
        maxWidth: 400, 
        width: '100%', 
        textDecoration: 'none', 
        color: 'inherit' 
      }}
      onClick={(e) => {
        // 버튼 영역 클릭 시 카드 클릭 이벤트 무시
        if ((e.target as HTMLElement).closest('.action-buttons')) {
          return;
        }
        if (recipe.link) {
          window.open(recipe.link, '_blank');
        }
      }}
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
        <div className="action-buttons" style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', zIndex: 2 }}>
          {ACTIONS.map(({ key, title, icon }) => (
            <span key={key} style={{ position: 'relative', zIndex: 2 }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
              <button
                title={title}
                tabIndex={0}
                style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2 }}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionButtonClick(key, e);
                }}
              >
                <img
                  src={icon}
                  alt={title}
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  style={{ display: 'block', position: 'relative', zIndex: 2, opacity: recipeActionState?.[key] ? 0.5 : 1, filter: recipeActionState?.[key] ? 'brightness(0.6)' : 'none' }}
                />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{recipe.title}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        좋아요 {(recipe as any).likes?.toLocaleString() ?? 0} · 댓글 {(recipe as any).comments?.toLocaleString() ?? 0}
        {recipe.platform && (recipe.platform.includes('youtube') || recipe.platform.includes('유튜브(인플루언서)')) && ` · 조회수 ${(recipe as any).hits?.toLocaleString() ?? 0}`}
      </div>
      <IngredientPillGroup
        needIngredients={usedIngredientList}
        myIngredients={myIngredients}
        substituteTable={substituteTable}
      />
    </div>
  );
};

export default RecipeCard; 