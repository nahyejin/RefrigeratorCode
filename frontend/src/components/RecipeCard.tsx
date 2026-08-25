import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { getPlatformLogo } from '../utils/platform';
import { calculateMatchRate, loadIngredientSynonymDict, ingredientSynonymDictCache } from '../utils/recipeUtils';
import IngredientPillGroup from './IngredientPillGroup';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';
import CoupangProductAd from './CoupangProductAd';
import { resolveCoupangUrl } from '../utils/coupangLink';
import 완료하기버튼 from '../assets/완료하기버튼.png';
import 공유하기버튼 from '../assets/공유하기버튼.png';
import 기록하기버튼 from '../assets/기록하기버튼.png';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

// 버튼/아이콘/스타일 상수화
// 액션 4개 중 '완료·기록·공유'는 요리한 *뒤*에 쓰는 동작인데도 목록을 훑는 내내
// 썸네일 위에 떠서 음식 사진(레시피 선택의 주된 판단 근거)을 가리고 있었음.
// 목록에서 실제로 쓰는 '즐겨찾기'만 썸네일에 남기고 나머지는 좋아요/댓글 줄로 내림.
const THUMB_ACTIONS = [
  { key: 'favorite', title: '즐겨찾기', icon: null },
] as const;

const SECONDARY_ACTIONS = [
  { key: 'done', title: '완료', icon: 완료하기버튼 },
  { key: 'write', title: '기록', icon: 기록하기버튼 },
  { key: 'share', title: '공유', icon: 공유하기버튼 },
] as const;

const ACTIONS = THUMB_ACTIONS;

const BUTTON_SIZE = 26;
const ICON_SIZE = 19;

/** 가로형 카드: 쿠팡 노출 여부와 무관하게 동일 하단 영역(쿠팡 블록 실제 높이에 맞춤·과도한 빈칸 방지) */
const HORIZONTAL_COUPANG_SLOT_MIN_HEIGHT_PX = 62;

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
    marginBottom: 20,
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
    height: 120
  },
  thumbnail: {
    width: '100%',
    height: 120,
    objectFit: 'cover' as const,
    borderRadius: 12,
    marginBottom: 12
  },
  rankBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    fontSize: 15,
    zIndex: 3,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
  },
  matchBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    fontSize: 13,
    zIndex: 2,
    textShadow: '0 1px 2px rgba(0,0,0,0.12)'
  },
  matchBadgeWithRank: {
    position: 'absolute' as const,
    top: 40,
    left: 8,
    fontSize: 13,
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
    fontSize: 16,
    marginBottom: 4,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  },
  stats: {
    fontSize: 15,
    color: '#9A9AA2',
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
  onRecipeAction: (recipe: Recipe & { action: 'done' | 'share' | 'write' | 'favorite' }) => void;
  isLast: boolean;
  myIngredients?: string[];
  substituteTable?: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  hideIndexNumber?: boolean;
  showRank?: boolean;
  onThumbnailError?: (recipeId: number) => void;
  hasAd?: boolean; // 광고 표시 여부
  isHorizontal?: boolean; // 가로 스크롤형 카드 여부 (썸네일 높이 조정용)
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
  isHorizontal = false,
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
  
  // used_ingredients 파싱 (pill용: 한글 한 글자 토큰은 ` 한글 ` 쉼표 구간만 노이즈 제외)
  const usedIngredientList = parseUsedIngredientsForPills(recipe.used_ingredients);

  // 버튼 클릭 핸들러 하나로 통합
  const handleActionButtonClick = (action: 'done' | 'share' | 'write' | 'favorite', e: React.MouseEvent) => {
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
    // 쿠팡 광고 영역 클릭 시 카드 클릭 이벤트 무시 (링크가 정상 작동하도록)
    if ((e.target as HTMLElement).closest('.coupang-product-ad')) {
      return;
    }
    // 썸네일 이미지나 제목 클릭 시 새 창 열기
    if (recipe.link) {
      e.preventDefault();
      e.stopPropagation();
      window.open(recipe.link, '_blank', 'noopener,noreferrer');
    }
  };

  const horizontalIngredientSectionStyle = isHorizontal
    ? { minHeight: 54 }
    : undefined;

  return (
    <div
      className="recipe-card-press bg-white rounded-[20px] relative block cursor-pointer"
      style={{
        ...(isLast ? STYLES.lastCard : STYLES.card),
        padding: '3px 8px', // 상하 3px, 좌우 8px
        marginBottom: isHorizontal ? 0 : 8, // 가로 리스트: 행 높이 안에서 카드~스크롤바 사이 빈칸 방지
        touchAction: 'pan-y pan-x', // 세로 및 가로 스크롤 모두 허용
        overflow: 'visible', // 항상 visible로 설정하여 광고가 잘리지 않도록
        boxSizing: 'border-box' as const, // padding 포함한 크기 계산
        WebkitOverflowScrolling: 'touch', // iOS 부드러운 스크롤
        border: '0.5px solid rgba(0, 0, 0, 0.06)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onClick={handleCardClick}
      onMouseDown={(e) => {
        // 버튼 영역이 아닌 경우에만 처리
        if (!(e.target as HTMLElement).closest('.action-buttons')) {
          // 마우스 다운 이벤트도 처리하여 확실하게 작동하도록
        }
      }}
    >
      <div style={{
        ...STYLES.imageContainer,
        height: isHorizontal ? 100 : STYLES.imageContainer.height
      }}>
        <img
          src={getProxiedImageUrl(recipe.thumbnail || '')}
          alt="썸네일"
          className="img-fade-in"
          loading="lazy"
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
            height: isHorizontal ? 100 : STYLES.thumbnail.height,
            cursor: 'pointer',
            touchAction: 'pan-y', // 세로 스크롤 허용
            userSelect: 'none', // 이미지 선택 방지
            WebkitUserSelect: 'none'
          }}
        />
        {/* 순위 표시 (Popular 페이지에서만) */}
        {showRank && (
          <div 
            className="absolute bg-[#3A3A42] bg-opacity-80 text-white font-bold rounded px-2 py-1 flex items-center gap-1" 
            style={STYLES.rankBadge}
          >
            {Utils.getRankDisplay(index + 1)}
          </div>
        )}
        {/* 재료 상태 뱃지.
            예전엔 "재료 매칭률 83%" 였는데, 냉털이 관점에서 실제로 필요한 정보는
            비율이 아니라 "지금 만들 수 있나 / 몇 개를 더 사야 하나" 임.
            부족 개수(대체 가능한 재료는 제외)를 앞세우고 매칭률은 보조로 둔다. */}
        <div
          className="absolute rounded flex items-center gap-1.5"
          style={{
            ...(showRank ? STYLES.matchBadgeWithRank : STYLES.matchBadge),
            padding: '4px 10px',
            background: lackingIngredients.length === 0 ? 'var(--brand)' : 'rgba(26,26,30,0.82)',
            color: lackingIngredients.length === 0 ? 'var(--ink-900)' : '#FFFFFF',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.75 }}>재료 매칭률</span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '0.2px',
              color: lackingIngredients.length === 0 ? 'var(--ink-900)' : 'var(--brand)',
            }}
          >
            {match.rate}%
          </span>
          {lackingIngredients.length > 0 && (
            <span style={{ opacity: 0.6, fontWeight: 500, fontSize: 12 }}>
              · {lackingIngredients.length}개 부족
            </span>
          )}
        </div>
        {/* 플랫폼 로고 */}
        <img
          src={getPlatformLogo(recipe.platform) || naverLogo}
          alt="플랫폼 로고"
          style={STYLES.platformLogo}
          onError={e => { e.currentTarget.src = naverLogo; }}
        />
        {/* 즐겨찾기/완료/공유/기록 버튼 */}
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
                {key === 'favorite' ? (
                  <svg
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    viewBox="0 0 24 24"
                    aria-label={title}
                    style={{
                      ...STYLES.actionIcon,
                      opacity: recipeActionState?.favorite ? 0.5 : 1,
                      filter: recipeActionState?.favorite ? 'brightness(0.6)' : 'none'
                    }}
                  >
                    <path
                      d="M12 2.75l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.62 6.56 19.48l1.04-6.05-4.4-4.29 6.08-.88L12 2.75z"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
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
                )}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div style={{ ...STYLES.title, cursor: 'pointer' }}>
        {recipe.title}
      </div>
      <div style={{ ...STYLES.stats, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{Utils.getStatsText(recipe)}</span>
        {/* 완료 / 기록 / 공유 — 사진을 가리지 않도록 이 줄로 내림. 줄 높이를 그대로 써서
            카드가 더 길어지지 않고, 터치 영역은 36px 로 확보 */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {SECONDARY_ACTIONS.map(({ key, title, icon }) => (
            <button
              key={key}
              title={title}
              aria-label={title}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActionButtonClick(key, e);
              }}
              style={{
                width: 36,
                height: 36,
                padding: 0,
                border: 'none',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: 9999,
              }}
            >
              <img
                src={icon}
                alt={title}
                width={18}
                height={18}
                style={{
                  opacity: recipeActionState?.[key] ? 0.35 : 0.62,
                  filter: 'grayscale(1)',
                }}
              />
            </button>
          ))}
        </span>
      </div>
      <div style={horizontalIngredientSectionStyle}>
        {usedIngredientList.length > 0 ? (
          <IngredientPillGroup
            needIngredients={usedIngredientList}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            onMissingClick={(name) => {
              const url = resolveCoupangUrl(name);
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            }}
          />
        ) : (
          <div className="custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, marginBottom: 4, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'auto', alignItems: 'center', paddingBottom: 4 }}>
            <span className="bg-customGray text-[#6A6A73] rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '12px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', border: '1px solid #D2D2D8' }}>재료 정보 없음</span>
          </div>
        )}
      </div>
      
      {/* 쿠팡 광고.
          예전엔 모든 카드에 전체폭 CTA + 2줄 고지문이 붙어 목록이 광고로 무거웠음.
          이제 부족 재료 pill 자체가 구매 동선이므로, 별도 CTA 는 "하나만 사면 완성"에
          가까운 카드(부족 1~2개)에만 남긴다 — 구매 전환이 실제로 일어나는 구간. */}
      {isHorizontal ? (
        <div
          style={{
            marginTop: 8,
            minHeight: HORIZONTAL_COUPANG_SLOT_MIN_HEIGHT_PX,
            boxSizing: 'border-box',
          }}
        >
          {lackingIngredients.length > 0 && lackingIngredients.length <= 2 ? (
            <CoupangProductAd
              ingredientCandidates={lackingIngredients}
              seedKey={recipe.id}
            />
          ) : null}
        </div>
      ) : lackingIngredients.length > 0 && lackingIngredients.length <= 2 ? (
        <div style={{ marginTop: '8px' }}>
          <CoupangProductAd
            ingredientCandidates={lackingIngredients}
            seedKey={recipe.id}
          />
        </div>
      ) : null}
    </div>
  );
};

export default RecipeCard; 