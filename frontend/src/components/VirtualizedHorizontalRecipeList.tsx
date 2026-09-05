import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import RecipeCard from './RecipeCard';
import CoupangAdCard from './CoupangAdCard';
import { getLackingIngredients, pickAdIngredient } from '../utils/lackingIngredients';
import { Recipe, RecipeActionState } from '../types/recipe';
import { lookupRecipeActionState } from '../utils/recipeStorage';

interface VirtualizedHorizontalRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  showRank?: boolean;
  emptyMessage?: string | React.ReactNode;
  onThumbnailError?: (recipeId: number) => void;
  /** 카드 생김새. 요즘인기는 `browse` (RecipeCard 참고). */
  variant?: 'match' | 'browse';
  /** react-window List 높이 = cardHeight + 이 값(광고·여백). 기본 64, compact 시 비율 적용 */
  listHeightExtra?: number;
  /**
   * 요즘인기·마이페이지 등: compact 시 카드~스크롤바 간격 최소(하단 패딩 없음).
   * RecipeCard 가로형 하단 쿠팡 슬롯(minHeight)에 맞춰 List 높이를 cardHeight+여백으로 잡음.
   */
  compactSectionGap?: boolean;
  /**
   * 목록 사이에 쿠팡 광고 카드를 끼울지. 기본 true.
   * 마이페이지의 '내가 즐겨찾는/기록한/완료한' 처럼 사용자가 직접 담아 둔 목록에서는
   * 끄는 편이 낫다 — 내가 모아 둔 것들 사이에 광고가 섞이면 목록의 성격이 흐려진다.
   */
  showAds?: boolean;
  /** 카드에 "OO님도 즐겨찾기함" 같은 배지를 붙일 문구. undefined면 배지 없음. */
  getAttributionLabel?: (recipe: Recipe) => string | undefined;
}

// 상수 정의
const CONSTANTS = {
  DEFAULT_CARD_WIDTH: 300, // 두 번째 카드가 더 잘 보이도록 너비 축소
  DEFAULT_CARD_HEIGHT: 280,
  DEFAULT_GAP: 16,
  DEFAULT_CONTAINER_WIDTH: 400,
  EMPTY_MESSAGE_FONT_SIZE: 13
} as const;

// 스타일 상수
const STYLES = {
  // 비어 있을 때 카드 한 장 높이(280px)를 그대로 비워 두고 있었다.
  // 마이페이지처럼 세 목록이 모두 비어 있는 화면에서는 840px, 화면 한 장을 통째로
  // 넘는 빈 공간이 생겨 "여기 뭐가 있는 화면인지" 를 알 수 없었다.
  // 안내 문구를 담을 만큼만 차지하게 한다.
  emptyContainer: (_cardHeight: number) => ({
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 96,
    padding: '20px 12px',
    color: '#B8B8C0',
    fontSize: CONSTANTS.EMPTY_MESSAGE_FONT_SIZE
  }),
  listContainer: (cardHeight: number, listExtra: number) => ({
    height: 'auto', // 광고가 있는 카드를 위해 auto로 변경
    minHeight: cardHeight + listExtra, // 가로형 쿠팡 슬롯 포함 최소 높이
    width: '100%'
  })
};

/** 광고 카드를 처음 끼울 수 있는 위치(레시피 인덱스). 첫 화면에는 광고를 두지 않는다 */
const AD_FIRST_SLOT = 2;
/** 광고와 광고 사이 최소 레시피 수 */
const AD_MIN_GAP = 4;

// 유틸리티 함수들
const Utils = {
  // 마지막 아이템인지 확인
  isLastItem: (index: number, totalCount: number): boolean => {
    return index === totalCount - 1;
  },

  // 기본 RecipeActionState 객체 생성
  getDefaultRecipeActionState: (): RecipeActionState => ({
    done: false,
    write: false,
    share: false,
    favorite: false
  }),

  // 아이템 크기 계산 (카드 너비 + 간격)
  calculateItemSize: (cardWidth: number, gap: number): number => {
    return cardWidth + gap;
  }
};

const VirtualizedHorizontalRecipeList: React.FC<VirtualizedHorizontalRecipeListProps> = ({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
  cardWidth = CONSTANTS.DEFAULT_CARD_WIDTH,
  cardHeight = CONSTANTS.DEFAULT_CARD_HEIGHT,
  gap = CONSTANTS.DEFAULT_GAP,
  showRank = false,
  emptyMessage = '레시피가 없습니다',
  onThumbnailError,
  variant = 'match',
  listHeightExtra = 64,
  compactSectionGap = false,
  showAds = true,
  getAttributionLabel
}) => {
  /** compact: List 높이 = cardHeight + extra. cardHeight는 가로 카드 실세로 요즘인기와 맞출 것(불필요하게 크면 빈 띠). */
  const resolvedListHeightExtra = compactSectionGap
    ? Math.max(5, Math.round(cardHeight * 0.022))
    : listHeightExtra;
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(CONSTANTS.DEFAULT_CONTAINER_WIDTH);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showLeftScrollIndicator, setShowLeftScrollIndicator] = useState(false);
  const itemSize = Utils.calculateItemSize(cardWidth, gap);

  /**
   * 목록에 실제로 그릴 항목들 — 레시피 사이사이에 광고 카드를 끼워 넣는다.
   *
   * 규칙: 어떤 레시피의 부족 재료가 1~3개면 **그 카드 바로 뒤**에
   *       그중 한 재료의 광고 카드를 한 장 넣는다.
   *       0개면 광고에 쓸 재료가 없고, 4개 이상이면 "몇 개만 사면 완성" 이 아니라서 제외.
   *
   * 광고가 지나치게 잦으면 목록이 광고판이 되므로 최소 간격을 둔다.
   */
  const items = React.useMemo(() => {
    type Item =
      | { kind: 'recipe'; recipe: Recipe; recipeIndex: number }
      | { kind: 'ad'; ingredient: string; recipeId?: number; lackingCount: number };

    const out: Item[] = [];
    let sinceLastAd = Number.MAX_SAFE_INTEGER;

    recipes.forEach((recipe, i) => {
      out.push({ kind: 'recipe', recipe, recipeIndex: i });
      sinceLastAd += 1;

      if (!showAds) return;
      // 첫 화면부터 광고가 보이면 목록보다 광고가 먼저 읽힌다 → 두 장 지난 뒤부터
      if (i < AD_FIRST_SLOT) return;
      if (sinceLastAd < AD_MIN_GAP) return;

      const lacking = getLackingIngredients(recipe, myIngredients, substituteTable as any);
      const ingredient = pickAdIngredient(lacking, recipe.id ?? i);
      if (!ingredient) return;

      out.push({ kind: 'ad', ingredient, recipeId: recipe.id, lackingCount: lacking.length });
      sinceLastAd = 0;
    });

    return out;
  }, [recipes, myIngredients, substituteTable, showAds]);


  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      // 컴포넌트 언마운트 시 인터벌 정리
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, []);

  // 스크롤 가능 여부 확인
  useEffect(() => {
    const container = containerRef.current;
    if (!container || recipes.length === 0) {
      setShowScrollIndicator(false);
      return;
    }

    const getScrollContainer = (): HTMLElement | null => {
      // react-window의 List 컴포넌트 내부 스크롤 컨테이너 찾기 (여러 방법 시도)
      let scrollContainer: HTMLElement | null = null;
      
      // 방법 1: ReactVirtualized__List 클래스로 찾기
      scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
      
      // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
      if (!scrollContainer) {
        const children = Array.from(container.children) as HTMLElement[];
        scrollContainer = children.find(child => 
          child.scrollWidth > child.clientWidth || 
          child.style.overflowX === 'auto' ||
          child.style.overflowX === 'scroll'
        ) || null;
      }
      
      // 방법 3: container 자체가 스크롤 가능한 경우
      if (!scrollContainer && container.scrollWidth > container.clientWidth) {
        scrollContainer = container;
      }
      
      return scrollContainer;
    };

    const checkScrollable = () => {
      const scrollContainer = getScrollContainer();
      
      if (scrollContainer) {
        const scrollWidth = scrollContainer.scrollWidth;
        const clientWidth = scrollContainer.clientWidth;
        const scrollLeft = scrollContainer.scrollLeft;
        const isScrollable = scrollWidth > clientWidth;
        
        // 끝에 도달했는지 확인 (약간의 여유를 두어 더 정확하게 감지)
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 5;
        const isAtStart = scrollLeft <= 5;
        
        setShowScrollIndicator(isScrollable && !isAtEnd);
        setShowLeftScrollIndicator(isScrollable && !isAtStart);
      } else {
        // 스크롤 컨테이너를 찾지 못한 경우, 전체 너비 계산으로 판단
        const totalWidth = recipes.length * itemSize;
        const isScrollable = totalWidth > containerWidth;
        setShowScrollIndicator(isScrollable);
        setShowLeftScrollIndicator(false);
      }
    };

    // 초기 체크 (약간의 지연을 두어 DOM이 완전히 렌더링된 후 확인)
    const timeoutId1 = setTimeout(checkScrollable, 100);
    const timeoutId2 = setTimeout(checkScrollable, 300);
    const timeoutId3 = setTimeout(checkScrollable, 500);
    const timeoutId4 = setTimeout(checkScrollable, 800);
    const timeoutId5 = setTimeout(checkScrollable, 1200);

    // 스크롤 이벤트 리스너 추가
    const scrollContainer = getScrollContainer();
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollable, { passive: true });
      window.addEventListener('resize', checkScrollable);
    } else {
      // 스크롤 컨테이너를 찾지 못한 경우에도 체크
      window.addEventListener('resize', checkScrollable);
    }

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearTimeout(timeoutId5);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', checkScrollable);
      }
      window.removeEventListener('resize', checkScrollable);
    };
  }, [recipes.length, containerWidth, itemSize]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    if (!item) return null;

    if (item.kind === 'ad') {
      return (
        <div
          style={{
            ...style,
            width: cardWidth,
            marginRight: gap,
            touchAction: 'pan-x pan-y',
            overflowY: 'visible',
          } as React.CSSProperties}
        >
          <CoupangAdCard
            ingredient={item.ingredient}
            recipeId={item.recipeId}
            lackingCount={item.lackingCount}
            width={cardWidth}
            height={cardHeight}
          />
        </div>
      );
    }

    const recipe = item.recipe;

    // react-window가 넘기는 height/width를 유지해야 함. cardContainer의 height:'auto'·minHeight가 덮어쓰면
    // 행이 List 높이만큼 비어 보이고 스크롤바가 카드에서 멀어짐.
    return (
      <div
        style={{
          ...style,
          width: cardWidth,
          marginRight: gap,
          // 카드 하나하나에 `pan-x` 만 허용해 두면, 카드 위에서 시작한 세로 스와이프가
          // 아무 데도 전달되지 않아 페이지 스크롤이 막힌다.
          // 가로 캐러셀 안이라도 세로 스크롤은 페이지로 넘어가야 한다.
          touchAction: 'pan-x pan-y',
          overflowY: 'visible',
        } as React.CSSProperties}
      >
        <RecipeCard
          recipe={recipe}
          index={item.recipeIndex}
          recipeActionState={
            lookupRecipeActionState(recipeActionStates, recipe.id) || Utils.getDefaultRecipeActionState()
          }
          onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
          isLast={Utils.isLastItem(item.recipeIndex, recipes.length)}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
          showRank={showRank}
          isHorizontal={true}
          variant={variant}
          fixedHeight={cardHeight}
          onThumbnailError={onThumbnailError}
          attributionLabel={getAttributionLabel?.(recipe)}
        />
      </div>
    );
  };

  if (recipes.length === 0) {
    return (
      <div style={{
        ...STYLES.emptyContainer(cardHeight),
        gap: 4,
        textAlign: 'center',
        color: 'var(--ink-500)',
        fontSize: '14px',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
        // 안내 문구만 있는 영역이라 배경을 옅게 깔아 "비어 있는 목록" 임을 명시한다.
        // 아무 표시도 없으면 그냥 여백으로 보여서 목록이 있다는 것조차 알 수 없다.
        background: 'var(--surface-sub)',
        borderRadius: 12
      }}>
        {typeof emptyMessage === 'string' ? (
          <div>{emptyMessage}</div>
        ) : (
          emptyMessage
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        ...(compactSectionGap ? { paddingBottom: 0 } : {}),
      }}
    >
      <div 
        ref={containerRef} 
        style={{
          ...STYLES.listContainer(cardHeight, resolvedListHeightExtra),
          overflowY: 'visible', // 광고가 잘리지 않도록 visible로 변경
          overflowX: 'auto',
          touchAction: 'pan-x pan-y', // 가로 스크롤 우선, 세로 스크롤도 허용
          WebkitOverflowScrolling: 'touch',
          position: 'relative'
        }}
      >
        <List
          ref={listRef}
          height={cardHeight + resolvedListHeightExtra}
          itemCount={items.length}
          itemSize={itemSize}
          layout="horizontal"
          width={containerWidth}
          onScroll={(props) => {
            // react-window의 onScroll 이벤트로 스크롤 위치 추적
            const container = containerRef.current;
            if (!container) return;
            
            // 실제 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = null;
            
            // 방법 1: ReactVirtualized__List 클래스로 찾기
            scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
            
            // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
            if (!scrollContainer) {
              const children = Array.from(container.children) as HTMLElement[];
              scrollContainer = children.find(child => 
                child.scrollWidth > child.clientWidth || 
                child.style.overflowX === 'auto' ||
                child.style.overflowX === 'scroll'
              ) || null;
            }
            
            // 방법 3: container 자체가 스크롤 가능한 경우
            if (!scrollContainer && container.scrollWidth > container.clientWidth) {
              scrollContainer = container;
            }
            
            if (scrollContainer) {
              const scrollWidth = scrollContainer.scrollWidth;
              const clientWidth = scrollContainer.clientWidth;
              const scrollLeft = scrollContainer.scrollLeft;
              const isScrollable = scrollWidth > clientWidth;
              // 끝에 도달했는지 확인 (약간의 여유를 두어 더 정확하게 감지)
              const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 5;
              const isAtStart = scrollLeft <= 5;
              
              setShowScrollIndicator(isScrollable && !isAtEnd);
              setShowLeftScrollIndicator(isScrollable && !isAtStart);
            }
          }}
          style={{
            overflowY: 'hidden',
            overflowX: 'auto',
            touchAction: 'pan-x pan-y' // 가로 스크롤 우선, 세로 스크롤도 허용
          }}
        >
          {Row}
        </List>
      </div>
      {/* 왼쪽 스크롤 버튼 */}
      {showLeftScrollIndicator && (
        <div
          style={{
            position: 'absolute',
            left: '8px',
            top: '35%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            zIndex: 10,
            cursor: 'pointer'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
            
            // react-window의 List 컴포넌트 내부 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = null;
            
            // 방법 1: ReactVirtualized__List 클래스로 찾기
            scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
            
            // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
            if (!scrollContainer) {
              const children = Array.from(container.children) as HTMLElement[];
              scrollContainer = children.find(child => 
                child.scrollWidth > child.clientWidth || 
                child.style.overflowX === 'auto' ||
                child.style.overflowX === 'scroll'
              ) || null;
            }
            
            // 방법 3: container 자체가 스크롤 가능한 경우
            if (!scrollContainer && container.scrollWidth > container.clientWidth) {
              scrollContainer = container;
            }
            
            if (!scrollContainer) return;
            
            // 기존 인터벌이 있으면 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
            }
            
            // 즉시 한 번 스크롤
            const scrollOnce = () => {
              const scrollAmount = itemSize;
              const currentScroll = scrollContainer!.scrollLeft;
              
              // 시작에 도달하지 않았을 때만 스크롤
              if (currentScroll > 5) {
                scrollContainer!.scrollBy({
                  left: -scrollAmount,
                  behavior: 'smooth'
                });
                return true;
              }
              return false;
            };
            
            // 즉시 한 번 실행
            scrollOnce();
            
            // 계속 스크롤하는 인터벌 시작
            scrollIntervalRef.current = setInterval(() => {
              if (!scrollOnce()) {
                // 시작에 도달했으면 인터벌 정리
                if (scrollIntervalRef.current) {
                  clearInterval(scrollIntervalRef.current);
                  scrollIntervalRef.current = null;
                }
              }
            }, 100); // 100ms마다 스크롤
          }}
          onMouseUp={() => {
            // 마우스를 떼면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // 마우스가 버튼을 벗어나면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
            
            // react-window의 List 컴포넌트 내부 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = null;
            
            // 방법 1: ReactVirtualized__List 클래스로 찾기
            scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
            
            // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
            if (!scrollContainer) {
              const children = Array.from(container.children) as HTMLElement[];
              scrollContainer = children.find(child => 
                child.scrollWidth > child.clientWidth || 
                child.style.overflowX === 'auto' ||
                child.style.overflowX === 'scroll'
              ) || null;
            }
            
            // 방법 3: container 자체가 스크롤 가능한 경우
            if (!scrollContainer && container.scrollWidth > container.clientWidth) {
              scrollContainer = container;
            }
            
            if (!scrollContainer) return;
            
            // 기존 인터벌이 있으면 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
            }
            
            // 즉시 한 번 스크롤
            const scrollOnce = () => {
              const scrollAmount = itemSize;
              const currentScroll = scrollContainer!.scrollLeft;
              
              // 시작에 도달하지 않았을 때만 스크롤
              if (currentScroll > 5) {
                scrollContainer!.scrollBy({
                  left: -scrollAmount,
                  behavior: 'smooth'
                });
                return true;
              }
              return false;
            };
            
            // 즉시 한 번 실행
            scrollOnce();
            
            // 계속 스크롤하는 인터벌 시작
            scrollIntervalRef.current = setInterval(() => {
              if (!scrollOnce()) {
                // 시작에 도달했으면 인터벌 정리
                if (scrollIntervalRef.current) {
                  clearInterval(scrollIntervalRef.current);
                  scrollIntervalRef.current = null;
                }
              }
            }, 100); // 100ms마다 스크롤
          }}
          onTouchEnd={() => {
            // 터치를 떼면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                fontSize: '26px',
                color: '#6A6A73',
                fontWeight: 400,
                lineHeight: 1,
                pointerEvents: 'none'
              }}
            >
              ‹
            </span>
          </div>
        </div>
      )}
      {/* 오른쪽 스크롤 버튼 */}
      {showScrollIndicator && (
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: '35%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            zIndex: 10,
            cursor: 'pointer'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
            
            // react-window의 List 컴포넌트 내부 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = null;
            
            // 방법 1: ReactVirtualized__List 클래스로 찾기
            scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
            
            // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
            if (!scrollContainer) {
              const children = Array.from(container.children) as HTMLElement[];
              scrollContainer = children.find(child => 
                child.scrollWidth > child.clientWidth || 
                child.style.overflowX === 'auto' ||
                child.style.overflowX === 'scroll'
              ) || null;
            }
            
            // 방법 3: container 자체가 스크롤 가능한 경우
            if (!scrollContainer && container.scrollWidth > container.clientWidth) {
              scrollContainer = container;
            }
            
            if (!scrollContainer) return;
            
            // 기존 인터벌이 있으면 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
            }
            
            // 즉시 한 번 스크롤
            const scrollOnce = () => {
              const scrollAmount = itemSize;
              const currentScroll = scrollContainer!.scrollLeft;
              const maxScroll = scrollContainer!.scrollWidth - scrollContainer!.clientWidth;
              
              // 끝에 도달하지 않았을 때만 스크롤
              if (currentScroll < maxScroll - 5) {
                scrollContainer!.scrollBy({
                  left: scrollAmount,
                  behavior: 'smooth'
                });
                return true;
              }
              return false;
            };
            
            // 즉시 한 번 실행
            scrollOnce();
            
            // 계속 스크롤하는 인터벌 시작
            scrollIntervalRef.current = setInterval(() => {
              if (!scrollOnce()) {
                // 끝에 도달했으면 인터벌 정리
                if (scrollIntervalRef.current) {
                  clearInterval(scrollIntervalRef.current);
                  scrollIntervalRef.current = null;
                }
              }
            }, 100); // 100ms마다 스크롤
          }}
          onMouseUp={() => {
            // 마우스를 떼면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // 마우스가 버튼을 벗어나면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
            
            // react-window의 List 컴포넌트 내부 스크롤 컨테이너 찾기
            let scrollContainer: HTMLElement | null = null;
            
            // 방법 1: ReactVirtualized__List 클래스로 찾기
            scrollContainer = container.querySelector('[class*="ReactVirtualized__List"]') as HTMLElement;
            
            // 방법 2: 직접 자식 요소 중 스크롤 가능한 요소 찾기
            if (!scrollContainer) {
              const children = Array.from(container.children) as HTMLElement[];
              scrollContainer = children.find(child => 
                child.scrollWidth > child.clientWidth || 
                child.style.overflowX === 'auto' ||
                child.style.overflowX === 'scroll'
              ) || null;
            }
            
            // 방법 3: container 자체가 스크롤 가능한 경우
            if (!scrollContainer && container.scrollWidth > container.clientWidth) {
              scrollContainer = container;
            }
            
            if (!scrollContainer) return;
            
            // 기존 인터벌이 있으면 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
            }
            
            // 즉시 한 번 스크롤
            const scrollOnce = () => {
              const scrollAmount = itemSize;
              const currentScroll = scrollContainer!.scrollLeft;
              const maxScroll = scrollContainer!.scrollWidth - scrollContainer!.clientWidth;
              
              // 끝에 도달하지 않았을 때만 스크롤
              if (currentScroll < maxScroll - 5) {
                scrollContainer!.scrollBy({
                  left: scrollAmount,
                  behavior: 'smooth'
                });
                return true;
              }
              return false;
            };
            
            // 즉시 한 번 실행
            scrollOnce();
            
            // 계속 스크롤하는 인터벌 시작
            scrollIntervalRef.current = setInterval(() => {
              if (!scrollOnce()) {
                // 끝에 도달했으면 인터벌 정리
                if (scrollIntervalRef.current) {
                  clearInterval(scrollIntervalRef.current);
                  scrollIntervalRef.current = null;
                }
              }
            }, 100); // 100ms마다 스크롤
          }}
          onTouchEnd={() => {
            // 터치를 떼면 인터벌 정리
            if (scrollIntervalRef.current) {
              clearInterval(scrollIntervalRef.current);
              scrollIntervalRef.current = null;
            }
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                fontSize: '26px',
                color: '#6A6A73',
                fontWeight: 400,
                lineHeight: 1,
                pointerEvents: 'none'
              }}
            >
              ›
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualizedHorizontalRecipeList; 