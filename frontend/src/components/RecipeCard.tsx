import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { getPlatformLogo } from '../utils/platform';
import { calculateMatchRate, loadIngredientSynonymDict, ingredientSynonymDictCache } from '../utils/recipeUtils';
import IngredientPillGroup from './IngredientPillGroup';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';
import CoupangAdSheet from './CoupangAdSheet';
import 완료하기버튼 from '../assets/완료하기버튼.png';
import 공유하기버튼 from '../assets/공유하기버튼.png';
import 기록하기버튼 from '../assets/기록하기버튼.png';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';
import { openCookMode } from '../utils/cookMode';
import { track } from '../utils/track';

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
  // 순위 표시 로직.
  // 1~3위에 메달 이모지를 붙였었는데, 기기마다 그림체와 크기가 달라
  // 같은 줄의 글자와 높이가 안 맞고 앱의 다른 표식들과 톤이 겉돌았다.
  // 순위 자체가 이미 정보라 장식을 덧붙이지 않는다.
  getRankDisplay: (rank: number) => `${rank}위`,

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

/** 레시피를 열었다는 기록. 어떤 레시피가 실제로 열리는지 알아야 추천을 고칠 수 있다. */
const trackRecipeOpen = (id: number) => {
  try { track('recipe_open', String(id)); } catch { /* 기록 실패가 화면을 막지 않는다 */ }
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
  /**
   * "OO님이 즐겨찾기함" 처럼, 가족 그룹에서 이 항목을 누가 남겼는지 보여주는
   * 작은 배지 문구. 그룹에 속하지 않았거나 본인 것만 있으면 상위에서 아예
   * 넘기지 않으면 된다(그때는 아무것도 렌더링하지 않음).
   */
  attributionLabel?: string;
  /**
   * 가로 목록에서 카드 높이를 이 값으로 고정한다.
   * 재료 pill 이 몇 줄로 감기느냐에 따라 카드 높이가 228~280px 로 들쭉날쭉했고,
   * 그 사이에 규격이 같아야 할 광고 카드가 끼면 높이 차이가 그대로 드러났다.
   * 목록이 잡아 둔 슬롯 높이와 카드 높이를 같게 맞춰 한 줄로 가지런하게 만든다.
   */
  fixedHeight?: number;
  /**
   * 가로 목록에게 **지금 이 카드가 얼마나 높은지** 알려 준다.
   *
   * 재료를 펼치면 카드는 늘어나는데, 바깥 목록(`react-window`)의 높이는
   * 고정이라 거기서 다시 잘렸다. 카드 높이만 풀어서는 안 되고 목록도
   * 같이 늘어나야 해서, 접고 펼 때마다 실제 높이를 올려 보낸다.
   */
  onHeightChange?: (height: number) => void;
  /**
   * 이 카드가 **무엇을 위한 자리인가.**
   *
   *  - `match`  (기본) — 냉장고요리. 매칭률이 곧 정렬 기준이라 그 숫자가
   *    카드에서 제일 중요하다. 지금까지의 생김새 그대로.
   *  - `browse` — 요즘인기. **내 냉장고와 상관없이 요즘 뭐가 유행하나**를 보는
   *    자리다. 여기서 매칭률을 사진 위에 크게 얹으면, 카드마다 "너는 이거 못
   *    만들어" 를 먼저 읽게 된다. 실제로 재 보니 카드 280px 중 제목이 24px
   *    (9%)뿐이고 나머지를 배지·칩·아이콘이 먹고 있었다.
   *    그래서 사진과 제목에 자리를 몰아주고 나머지는 접는다.
   */
  variant?: 'match' | 'browse';
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
  variant = 'match',
  isHorizontal = false,
  fixedHeight,
  onHeightChange,
  attributionLabel,
}) => {
  // 부족 재료 pill 을 눌렀을 때 열리는 구매 안내 시트의 대상 재료
  const [adIngredient, setAdIngredient] = React.useState<string | null>(null);

  // 썸네일 로드 상태 추적 (null: 검증 중, true: 성공, false: 실패)
  /** 훑어보는 자리인가. 사진과 제목에 자리를 몰아준다. */
  const browse = variant === 'browse';
  /** 재료 칩을 펼쳤나. `browse` 에서는 기본으로 접어 둔다. */
  const [chipsOpen, setChipsOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // 접고 펼 때마다 **실제 높이**를 위로 올려 보낸다. 가로 목록은 이 값으로
  // 자기 높이를 늘린다 — 카드만 늘어나면 목록 상자에서 그대로 잘린다.
  React.useEffect(() => {
    if (!onHeightChange) return;
    const el = rootRef.current;
    if (!el) return;
    // 펼침 애니메이션 없이 즉시 바뀌지만, 칩이 몇 줄로 감길지는 그려 봐야
    // 안다. 한 프레임 뒤에 잰다.
    const id = window.requestAnimationFrame(() => {
      const el2 = rootRef.current;
      if (el2) onHeightChange(el2.getBoundingClientRect().height);
    });
    return () => window.cancelAnimationFrame(id);
  }, [chipsOpen, onHeightChange]);

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
    // 앱 안에서 조리 순서를 연다.
    //
    // 전에는 원문을 새 창으로 열었다. 그런데 **요리하는 중에 블로그 원문을 보는 건
    // 사실상 못 할 짓이다** — 손에 물이 묻어 있고, 위아래로 한참 스크롤해야 하고,
    // 중간에 광고와 잡담이 섞여 있다. 원문은 시트 안의 버튼으로 여전히 갈 수 있다.
    e.preventDefault();
    e.stopPropagation();
    trackRecipeOpen(recipe.id);
    openCookMode({
      id: recipe.id,
      title: recipe.title,
      link: recipe.link,
      myIngredients,
    });
  };

  const horizontalIngredientSectionStyle = isHorizontal
    ? { minHeight: 54 }
    : undefined;

  /*
   * 마우스를 올렸을 때의 표시는 **CSS 로만** 한다 (`.recipe-card-press:hover`).
   *
   * 전에는 카드에 `onMouseEnter` 로 `transform: translateY(-2px)` 를 직접
   * 넣었는데 둘이 문제였다:
   *  - 카드가 2px 올라가면 커서가 있던 아래쪽 2px 이 카드 밖이 된다 →
   *    `mouseleave` → 내려옴 → 다시 `mouseenter` → **떨림.** 전환이 0.12s 라
   *    그 왕복이 눈에 그대로 보였다.
   *  - 올라간 2px 이 가로 목록(`overflow-y: hidden`) 밖으로 나가
   *    **카드 위쪽 선이 잘렸다.**
   *
   * 이제 자리를 안 옮기고 그림자만 진해진다. 손가락으로 쓰는 화면에서는 아예
   * 안 걸리게 `@media (hover: hover)` 로 막아 뒀다 — 터치에서는 한 번 누르면
   * hover 가 그대로 붙어 있어서 카드가 들린 채로 남았다.
   */

  return (
    <div
      ref={rootRef}
      className="recipe-card-press bg-white rounded-[20px] relative block cursor-pointer"
      style={{
        ...(isLast ? STYLES.lastCard : STYLES.card),
        // 사방을 같게. 전에는 `3px 8px` 이라 **좌우 9px, 위아래 4px**(테두리 1px
        // 포함)이었다. 썸네일이 위쪽에만 바짝 붙어 카드가 위로 쏠려 보였다.
        padding: 8,
        marginBottom: isHorizontal ? 0 : 8, // 가로 리스트: 행 높이 안에서 카드~스크롤바 사이 빈칸 방지
        touchAction: 'pan-y pan-x', // 세로 및 가로 스크롤 모두 허용
        // 가로 목록에서는 높이를 고정해 모든 카드(광고 카드 포함)를 같은 규격으로 맞춘다.
        // 내용이 적은 카드는 아래가 남지만, 높이가 제각각인 것보다 훨씬 정돈돼 보인다.
        // **펼쳤을 때는 높이를 풀어 준다.**
        //
        // 가로 목록은 모든 카드를 같은 규격으로 맞추려고 높이를 고정하고 남는
        // 것을 잘라 낸다. 그런데 `재료 N개 · 대체 가능 보기 ▾` 를 누르면 알약이
        // 여러 줄로 늘어나는데, 높이가 고정이라 **펼친 내용이 그대로 잘렸다** —
        // 누른 보람이 없다. 접혀 있는 동안만 고정하고, 펼친 카드는 제 높이를
        // 갖게 한다(그 줄만 잠시 높아졌다가 접으면 돌아온다).
        ...(isHorizontal && fixedHeight && !chipsOpen
          ? { height: fixedHeight, overflow: 'hidden' as const }
          : { overflow: 'visible' as const }),
        ...(isHorizontal && fixedHeight && chipsOpen
          ? { minHeight: fixedHeight, zIndex: 2 }
          : null),
        boxSizing: 'border-box' as const, // padding 포함한 크기 계산
        WebkitOverflowScrolling: 'touch', // iOS 부드러운 스크롤
        // 카드 경계.
        //
        // 전에는 `0.5px solid rgba(0,0,0,0.06)` 이었다. 카드도 흰색이고 뒤 배경도
        // 흰색인데 선이 `#F0F0F0` 쯤이라, 목록을 훑으면 **어디까지가 한 장인지**
        // 안 보였다. 0.5px 이라 배율에 따라 아예 안 그려지는 화면도 있었다.
        //
        // 앱의 기본 구분선(`--line-200`)을 1px 로 쓰고, 옅은 그림자를 더해
        // 카드가 바닥에서 살짝 떠 보이게 한다. 선 하나만 진하게 하면 표처럼
        // 딱딱해지는데, 그림자가 같이 있으면 얇은 선으로도 경계가 읽힌다.
        border: '1px solid var(--line-200)',
        boxShadow: '0 1px 3px rgba(26,26,30,0.05)',
      }}
      onClick={handleCardClick}
      onMouseDown={(e) => {
        // 버튼 영역이 아닌 경우에만 처리
        if (!(e.target as HTMLElement).closest('.action-buttons')) {
          // 마우스 다운 이벤트도 처리하여 확실하게 작동하도록
        }
      }}
    >
      {/* 사진은 **사람을 끌어당기는 유일한 요소**다. 280×100 은 3:1 띠라
          음식이 뭉개진다. 훑어보는 자리(`browse`)에서는 키운다. */}
      <div style={{
        ...STYLES.imageContainer,
        height: browse ? 160 : (isHorizontal ? 100 : 160)
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
            height: browse ? 160 : (isHorizontal ? 100 : 160),
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
        {/* **사진에 숫자를 얹지 않는다.**
            제일 크게 읽히는 것이 `0%` 가 되어, 카드마다 "너는 이거 못 만들어"
            를 먼저 말하게 된다. 냉장고요리에서는 매칭률이 정렬 기준이라 숫자
            자체는 필요하지만, 그건 아래 줄에서 **가진 것**으로 센다.
            (사진은 사람을 끌어당기는 유일한 요소다. 가리지 않는다) */}
        {false && (
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
        )}
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
              {/* 켜진 것은 **노란 원**. 전에는 켜지면 흐려져서(투명도 .5) 오히려
                  못 누르는 것처럼 보였다 — 토글은 켜졌을 때 도드라져야 한다. */}
              <span style={{
                ...STYLES.actionButtonBackground,
                background: recipeActionState?.[key] ? '#FFD600' : 'rgba(34,34,34,0.7)',
              }}></span>
              <button
                title={title}
                tabIndex={0}
                aria-pressed={!!recipeActionState?.[key]}
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
                    style={STYLES.actionIcon}
                  >
                    <path
                      d="M12 2.75l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.62 6.56 19.48l1.04-6.05-4.4-4.29 6.08-.88L12 2.75z"
                      fill={recipeActionState?.favorite ? '#1A1A1E' : 'none'}
                      stroke={recipeActionState?.favorite ? '#1A1A1E' : '#FFFFFF'}
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
                      // 노란 원 위에서는 흰 아이콘이 안 보인다. 검게 뒤집는다.
                      filter: recipeActionState?.[key] ? 'brightness(0) saturate(0)' : 'none',
                    }}
                  />
                )}
              </button>
            </span>
          ))}
        </div>
      </div>
      {/* 훑을 때 필요한 건 제목 하나다. 한 줄로 잘라 놓으면 무슨 요리인지
          모르는 채 지나간다 — 두 줄까지 준다. */}
      <div style={{
        ...STYLES.title,
        cursor: 'pointer',
        ...({
          fontSize: 15,
          lineHeight: 1.35,
          whiteSpace: 'normal' as const,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          minHeight: 40,
        }),
      }}>
        {recipe.title}
      </div>
      {attributionLabel && (
        <div style={{ marginBottom: 4 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ink-700)',
              background: 'var(--surface-sub)',
              border: '1px solid var(--line-200)',
              borderRadius: 9999,
              padding: '2px 8px',
            }}
          >
            {attributionLabel}
          </span>
        </div>
      )}
      <div style={{ ...STYLES.stats, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        {/* 좋아요·댓글·조회수가 줄바꿈되면 카드 높이가 들쭉날쭉해져 한 줄로 고정 */}
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            fontSize: 12.5,
          }}
        >
          {/* **가진 것**으로 센다. `4개 부족` 과 같은 값인데 부정이 아니다.
              냉장고요리는 매칭률이 정렬 기준이므로 %도 함께 적는다 — 그게
              없으면 "왜 이 순서지" 를 알 수 없다. 요즘인기는 인기순이라
              정렬과 무관하므로 개수만 센다.
              `좋아요 0` 은 뺐다. 네이버 블로그는 대부분 0이라 늘 노이즈였다. */}
          {usedIngredientList.length > 0 ? (
            <>
              <b style={{ color: match.rate >= 70 ? '#3A6B2E' : 'var(--ink-700)' }}>
                내 재료 {usedIngredientList.length - lackingIngredients.length}
                /{usedIngredientList.length}
              </b>
              {!browse && ` (${match.rate}%)`}
              {recipe.comments ? ` · 댓글 ${recipe.comments}` : ''}
            </>
          ) : (
            recipe.comments ? `댓글 ${recipe.comments}` : ''
          )}
        </span>
        {/* 완료 / 기록 / 공유 — 사진을 가리지 않도록 이 줄로 내림. 줄 높이를 그대로 써서
            카드가 더 길어지지 않고, 터치 영역은 36px 로 확보 */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, marginRight: -6 }}>
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
                width: 34,
                height: 34,
                padding: 0,
                border: 'none',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: 9999,
              }}
              {...(index === 0 ? { 'data-guide-target': `recipe-${key}-button` } : {})}
            >
              <img
                src={icon}
                alt={title}
                width={22}
                height={22}
                style={{
                  opacity: recipeActionState?.[key] ? 0.32 : 0.7,
                  filter: 'grayscale(1)',
                }}
              />
            </button>
          ))}
        </span>
      </div>
      {/* 재료 칩은 **접어 둔다.** 다섯 개가 두 줄이면 제목(한 줄)보다 크고,
          점선 칩은 전부 "없는 재료" 라 카드 절반이 없는 것 목록이 된다.
          궁금한 사람만 편다. */}
      {browse && usedIngredientList.length > 0 && (
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setChipsOpen(v => !v); }}
          style={{
            alignSelf: 'flex-start', height: 26, padding: 0, border: 'none',
            background: 'transparent', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)',
          }}
        >
          {chipsOpen
            ? '재료 접기 ▴'
            : `재료 ${usedIngredientList.length}개 · 대체 가능 보기 ▾`}
        </button>
      )}
      <div style={{
        ...horizontalIngredientSectionStyle,
        ...(browse && !chipsOpen ? { display: 'none' } : null),
      }}>
        {usedIngredientList.length > 0 ? (
          <IngredientPillGroup
            needIngredients={usedIngredientList}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            // 예전에는 여기서 곧바로 쿠팡 창을 열었다. 하지만 pill 은 "없는 재료" 를
            // 알려주는 정보 표시로 보이기 때문에, 누른 사람이 광고 클릭을 의도했다고 보기 어렵다.
            // 쿠팡 파트너스 운영정책은 광고 클릭이 사용자의 의도일 때만 발생할 것을 요구한다.
            // → 시트로 광고를 보여주고, 쿠팡으로 나가는 클릭은 사용자가 직접 하게 한다.
            onMissingClick={(name) => setAdIngredient(name)}
            compact={isHorizontal}
          />
        ) : (
          <div className="custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, marginBottom: 4, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'auto', alignItems: 'center', paddingBottom: 4 }}>
            <span className="bg-customGray text-[#6A6A73] rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '12px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', border: '1px solid #D2D2D8' }}>재료 정보 없음</span>
          </div>
        )}
      </div>
      
      {/* 카드 하단 쿠팡 CTA 는 제거했다.
          - 부족 재료 pill 이 이미 같은 재료의 같은 목적지로 가는 동선이라 중복이었고,
          - CTA 유무에 따라 카드 높이가 달라져 가로 캐러셀의 고정 높이를 쓸 수 없었다.
            (실측: 슬롯 286px / 실제 카드 236~239px → 카드마다 47px 이 빈 채로 남음)
          광고는 목록 안에 카드 규격 그대로 끼우는 CoupangAdCard 로 옮겼다. */}

      {/* 부족 재료를 눌렀을 때 뜨는 구매 안내 */}
      <CoupangAdSheet
        ingredient={adIngredient}
        onClose={() => setAdIngredient(null)}
        recipeId={recipe.id}
        lackingCount={lackingIngredients.length}
      />
    </div>
  );
};

export default RecipeCard; 