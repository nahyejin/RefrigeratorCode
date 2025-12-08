import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';

interface VirtualizedHorizontalRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: Record<string, string[]>;
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  showRank?: boolean;
  emptyMessage?: string | React.ReactNode;
  onThumbnailError?: (recipeId: number) => void;
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
  cardContainer: (cardWidth: number, gap: number, cardHeight: number) => ({
    width: cardWidth,
    marginRight: gap,
    display: 'inline-block' as const,
    height: 'auto',
    minHeight: cardHeight
  }),
  emptyContainer: (cardHeight: number) => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: cardHeight,
    color: '#bbb',
    fontSize: CONSTANTS.EMPTY_MESSAGE_FONT_SIZE
  }),
  listContainer: (cardHeight: number) => ({
    height: cardHeight,
    width: '100%'
  })
};

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
    share: false
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
  onThumbnailError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(CONSTANTS.DEFAULT_CONTAINER_WIDTH);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showLeftScrollIndicator, setShowLeftScrollIndicator] = useState(false);
  const itemSize = Utils.calculateItemSize(cardWidth, gap);

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
    const recipe = recipes[index];
    if (!recipe) return null;

    return (
      <div style={{
        ...style,
        ...STYLES.cardContainer(cardWidth, gap, cardHeight),
        touchAction: 'pan-x', // 가로 스크롤 허용
        overflowY: 'hidden'
      }}>
        <RecipeCard
          recipe={recipe}
          index={index}
          recipeActionState={recipeActionStates[recipe.id] || Utils.getDefaultRecipeActionState()}
          onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
          isLast={Utils.isLastItem(index, recipes.length)}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
          showRank={showRank}
          onThumbnailError={onThumbnailError}
        />
      </div>
    );
  };

  if (recipes.length === 0) {
    return (
      <div style={{
        ...STYLES.emptyContainer(cardHeight),
        flexDirection: 'column',
        gap: 4,
        textAlign: 'center',
        padding: '50px 20px',
        color: '#666',
        fontSize: '14px',
        lineHeight: '1.6',
        whiteSpace: 'pre-line',
        justifyContent: 'flex-start',
        alignItems: 'center'
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
    <div style={{ position: 'relative' }}>
      <div 
        ref={containerRef} 
        style={{
          ...STYLES.listContainer(cardHeight),
          overflowY: 'hidden',
          overflowX: 'auto',
          touchAction: 'pan-x pan-y', // 가로 스크롤 우선, 세로 스크롤도 허용
          WebkitOverflowScrolling: 'touch',
          position: 'relative'
        }}
      >
        <List
          ref={listRef}
          height={cardHeight}
          itemCount={recipes.length}
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
            top: '50%',
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
                fontSize: '24px',
                color: '#666666',
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
            top: '50%',
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
                fontSize: '24px',
                color: '#666666',
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