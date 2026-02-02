import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { getPlatformLogo } from '../utils/platform';
import { calculateMatchRate, loadIngredientSynonymDict, ingredientSynonymDictCache } from '../utils/recipeUtils';
import IngredientPillGroup from './IngredientPillGroup';
import CoupangProductAd from './CoupangProductAd';
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

// 스타일 상수
const STYLES = {
  card: {
    marginBottom: 16,
    marginLeft: 'auto',
    marginRight: 'auto',
    minWidth: 0,
    maxWidth: 400,
    width: '100%',
    textDecoration: 'none',
    color: 'inherit'
  },
  lastCard: {
    marginBottom: 40,
    marginLeft: 'auto',
    marginRight: 'auto',
    minWidth: 0,
    maxWidth: 400,
    width: '100%',
    textDecoration: 'none',
    color: 'inherit'
  },
  imageContainer: {
    position: 'relative' as const,
    width: '100%',
    height: 180
  },
  thumbnail: {
    width: '100%',
    height: 180,
    objectFit: 'cover' as const,
    borderRadius: 12,
    marginBottom: 12
  },
  rankBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    fontSize: 13,
    zIndex: 3,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
  },
  matchBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    fontSize: 12,
    zIndex: 2,
    textShadow: '0 1px 2px rgba(0,0,0,0.12)'
  },
  matchBadgeWithRank: {
    position: 'absolute' as const,
    top: 40,
    left: 8,
    fontSize: 12,
    zIndex: 2,
    textShadow: '0 1px 2px rgba(0,0,0,0.12)'
  },
  platformLogo: {
    position: 'absolute' as const,
    right: 4,
    top: 4,
    width: 24,
    height: 24,
    zIndex: 2
  },
  actionButtons: {
    position: 'absolute' as const,
    right: 8,
    bottom: 8,
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 6,
    alignItems: 'center',
    zIndex: 2
  },
  actionButtonWrapper: {
    position: 'relative' as const,
    zIndex: 2
  },
  actionButtonBackground: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: '50%',
    background: 'rgba(34,34,34,0.7)',
    zIndex: 1
  },
  actionButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    outline: 'none',
    position: 'relative' as const,
    zIndex: 2
  },
  actionIcon: {
    display: 'block',
    position: 'relative' as const,
    zIndex: 2
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 4,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  },
  stats: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4
  }
};

// 유틸리티 함수들
const Utils = {
  // 순위 표시 로직
  getRankDisplay: (rank: number) => {
    if (rank === 1) return "1위🥇";
    if (rank === 2) return "2위🥈";
    if (rank === 3) return "3위🥉";
    return `${rank}위`;
  },

  // 재료 목록 파싱
  parseIngredients: (ingredients: string | string[] | undefined): string[] => {
    if (Array.isArray(ingredients)) {
      return ingredients.map(i => i.trim()).filter(Boolean);
    }
    return (ingredients || '').split(',').map(i => i.trim()).filter(Boolean);
  },

  // 플랫폼 체크
  isYouTube: (platform?: string) => {
    return platform && (platform.toLowerCase().includes('youtube') || platform.includes('유튜브'));
  },

  // 통계 텍스트 생성
  getStatsText: (recipe: Recipe) => {
      const likes = recipe.likes?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? 0;
  const comments = recipe.comments?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? 0;
  const hits = Utils.isYouTube(recipe.platform) ? recipe.hits?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? 0 : null;
    
    let stats = `좋아요 ${likes} · 댓글 ${comments}`;
    if (hits !== null) {
      stats += ` · 조회수 ${hits}`;
    }
    return stats;
  }
};

export interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  recipeActionState?: RecipeActionState;
  onRecipeAction: (recipe: Recipe & { action: 'done' | 'share' | 'write' }) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  hideIndexNumber?: boolean;
  showRank?: boolean;
  onThumbnailError?: (recipeId: number) => void;
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
  showRank = false,
  onThumbnailError,
  hasAd: hasAdProp,
}) => {
  // 썸네일 로드 상태 추적 (null: 검증 중, true: 성공, false: 실패)
  const [thumbnailStatus, setThumbnailStatus] = React.useState<boolean | null>(null);
  
  // 동의어 사전 로드 (한 번만) - 모든 hook은 early return 이전에 호출되어야 함
  const [synonymDict, setSynonymDict] = React.useState<{ [key: string]: string } | null>(ingredientSynonymDictCache);
  
  // 이미지 로드 전 사전 검증
  React.useEffect(() => {
    if (!recipe.thumbnail || !recipe.thumbnail.trim()) {
      // 썸네일이 없으면 즉시 실패 처리
      if (onThumbnailError && recipe.id) {
        onThumbnailError(recipe.id);
      }
      setThumbnailStatus(false);
      return;
    }
    
    // 이미지 URL 유효성 사전 검증
    const img = new Image();
    img.onload = () => {
      setThumbnailStatus(true);
    };
    img.onerror = () => {
      // 이미지 로드 실패 시 즉시 알림
      if (onThumbnailError && recipe.id) {
        onThumbnailError(recipe.id);
      }
      setThumbnailStatus(false);
    };
    img.src = getProxiedImageUrl(recipe.thumbnail);
  }, [recipe.thumbnail, recipe.id, onThumbnailError]);
  
  // 동의어 사전 로드
  React.useEffect(() => {
    // 이미 캐시에 있으면 사용
    if (ingredientSynonymDictCache) {
      setSynonymDict(ingredientSynonymDictCache);
      return;
    }
    
    // 동의어 사전 로드
    loadIngredientSynonymDict().then(dict => {
      setSynonymDict(dict);
    });
  }, []);
  
  // 썸네일이 실패했거나 아직 검증 중인 경우 카드를 렌더링하지 않음
  if (thumbnailStatus === false || thumbnailStatus === null) {
    return null;
  }
  
  // used_ingredients 파싱
  const usedIngredientList = Utils.parseIngredients(recipe.used_ingredients);

  // 버튼 클릭 핸들러 하나로 통합
  const handleActionButtonClick = (action: 'done' | 'share' | 'write', e: React.MouseEvent) => {
    e.preventDefault();
    onRecipeAction({ ...recipe, action });
  };

  const match = calculateMatchRate(
    myIngredients,
    Array.isArray(recipe.used_ingredients)
      ? recipe.used_ingredients.join(',')
      : recipe.used_ingredients || '',
    synonymDict || undefined
  );
  
  // 부족한 재료가 정확히 1개인지 확인 (대체 가능한 재료 제외)
  const getLackingIngredients = () => {
    if (!match.need_ingredients || match.need_ingredients.length === 0) {
      return [];
    }
    
    // 대체 가능한 재료는 제외 (substituteTable 확인)
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const mySet = new Set(myIngredients.map(normalize));
    
    // 대체 불가능한 부족한 재료만 필터링
    return match.need_ingredients.filter(ing => {
      const normIng = normalize(ing);
      
      // substituteTable에서 해당 재료의 대체제 찾기
      if (substituteTable) {
        const originalKey = Object.keys(substituteTable).find(k => normalize(k) === normIng);
        const substituteList = originalKey ? substituteTable[originalKey] : undefined;
        
        if (substituteList && Array.isArray(substituteList)) {
          // 내 냉장고에 있는 대체제가 있는지 확인 (유사도 점수 높은 순으로 정렬되어 있음)
          const hasSubstitute = substituteList.some(sub => mySet.has(normalize(sub.ingredient_b)));
          if (hasSubstitute) {
            return false; // 대체 가능하므로 제외
          }
        }
      }
      
      return true; // 대체 불가능한 재료
    });
  };
  
  const lackingIngredients = getLackingIngredients();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 버튼 영역 클릭 시 카드 클릭 이벤트 무시
    if ((e.target as HTMLElement).closest('.action-buttons')) {
      return;
    }
    // 썸네일 이미지나 제목 클릭 시 새 창 열기
    if (recipe.link) {
      e.preventDefault();
      e.stopPropagation();
      window.open(recipe.link, '_blank', 'noopener,noreferrer');
    }
  };

  // 광고가 표시될 경우를 대비해 overflow와 min-height 조정
  const hasAd = lackingIngredients.length === 1;
  
  return (
    <div
      className="bg-white rounded-[20px] shadow-sm relative block hover:shadow-md transition cursor-pointer"
      style={{
        ...(isLast ? STYLES.lastCard : STYLES.card),
        padding: '16px', // p-4 대신 명시적으로 설정
        marginBottom: hasAd ? 16 : 8, // 광고가 있으면 16px, 없으면 8px로 간격 축소
        touchAction: 'pan-y pan-x', // 세로 및 가로 스크롤 모두 허용
        overflow: hasAd ? 'visible' : 'hidden', // 광고가 있으면 visible, 없으면 hidden
        boxSizing: 'border-box' as const, // padding 포함한 크기 계산
        WebkitOverflowScrolling: 'touch' // iOS 부드러운 스크롤
      }}
      onClick={handleCardClick}
      onMouseDown={(e) => {
        // 버튼 영역이 아닌 경우에만 처리
        if (!(e.target as HTMLElement).closest('.action-buttons')) {
          // 마우스 다운 이벤트도 처리하여 확실하게 작동하도록
        }
      }}
    >
      <div style={STYLES.imageContainer}>
        <img
          src={getProxiedImageUrl(recipe.thumbnail || '')}
          alt="썸네일"
          onError={e => {
            // 썸네일 로드 실패 시 상위 컴포넌트에 알림 (레시피 숨기기용)
            if (onThumbnailError && recipe.id) {
              onThumbnailError(recipe.id);
            }
            setThumbnailStatus(false);
            e.currentTarget.onerror = null; // 무한 루프 방지
          }}
          style={{ 
            ...STYLES.thumbnail, 
            cursor: 'pointer',
            touchAction: 'pan-y', // 세로 스크롤 허용
            userSelect: 'none', // 이미지 선택 방지
            WebkitUserSelect: 'none'
          }}
        />
        {/* 순위 표시 (Popular 페이지에서만) */}
        {showRank && (
          <div 
            className="absolute bg-[#444] bg-opacity-80 text-white font-bold rounded px-2 py-1 flex items-center gap-1" 
            style={STYLES.rankBadge}
          >
            {Utils.getRankDisplay(index + 1)}
          </div>
        )}
        {/* 재료 매칭률 뱃지 */}
        <div 
          className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center gap-1" 
          style={showRank ? STYLES.matchBadgeWithRank : STYLES.matchBadge}
        >
          재료 매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{match.rate}%</span>
        </div>
        {/* 플랫폼 로고 */}
        <img
          src={getPlatformLogo(recipe.platform) || naverLogo}
          alt="플랫폼 로고"
          style={STYLES.platformLogo}
          onError={e => { e.currentTarget.src = naverLogo; }}
        />
        {/* 완료/공유/기록 버튼 */}
        <div className="action-buttons" style={STYLES.actionButtons}>
          {ACTIONS.map(({ key, title, icon }) => (
            <span key={key} style={STYLES.actionButtonWrapper}>
              <span style={STYLES.actionButtonBackground}></span>
              <button
                title={title}
                tabIndex={0}
                style={STYLES.actionButton}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionButtonClick(key, e);
                }}
                {...(index === 0 ? { 'data-guide-target': `recipe-${key}-button` } : {})}
              >
                <img
                  src={icon}
                  alt={title}
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  style={{
                    ...STYLES.actionIcon,
                    opacity: recipeActionState?.[key] ? 0.5 : 1,
                    filter: recipeActionState?.[key] ? 'brightness(0.6)' : 'none'
                  }}
                />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div style={{ ...STYLES.title, cursor: 'pointer' }}>
        {recipe.title}
      </div>
      <div style={STYLES.stats}>
        {Utils.getStatsText(recipe)}
      </div>
      {usedIngredientList.length > 0 ? (
        <IngredientPillGroup
          needIngredients={usedIngredientList}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
        />
      ) : (
        <div className="custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, marginBottom: 4, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'auto', alignItems: 'center', paddingBottom: 4 }}>
          <span className="bg-customGray text-white rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>재료 정보 없음</span>
        </div>
      )}
      
      {/* 쿠팡 광고: 부족한 재료가 정확히 1개일 때만 표시 (대체 가능한 재료 제외) */}
      {lackingIngredients.length === 1 ? (
        <div style={{ marginTop: '12px' }}>
          <CoupangProductAd 
            ingredientName={lackingIngredients[0]}
          />
        </div>
      ) : null}
    </div>
  );
};

export default RecipeCard; 