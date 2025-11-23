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
}

// 상수 정의
const CONSTANTS = {
  DEFAULT_CARD_WIDTH: 360,
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
  emptyMessage = '레시피가 없습니다'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(CONSTANTS.DEFAULT_CONTAINER_WIDTH);
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
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 터치 이벤트로 세로 스크롤 완전 차단
  useEffect(() => {
    const container = containerRef.current;
    if (!container || recipes.length === 0) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startX);
      const deltaY = Math.abs(touch.clientY - startY);
      
      // 세로 스크롤이 가로 스크롤보다 크거나 같으면 무조건 차단
      if (deltaY >= deltaX && deltaY > 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // capture phase에서 처리하여 다른 핸들러보다 먼저 실행
    container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });

    // 모든 자식 요소에도 적용 - document 레벨에서 처리
    const handleDocumentTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (container.contains(target)) {
        const touch = e.touches[0];
        if (!touch) return;
        
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // 세로 스크롤 완전 차단
        if (deltaY >= deltaX && deltaY > 2) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
    };

    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false, capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, { capture: true });
      container.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true });
    };
  }, [recipes.length]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const recipe = recipes[index];
    if (!recipe) return null;

    return (
      <div style={{
        ...style,
        ...STYLES.cardContainer(cardWidth, gap, cardHeight),
        touchAction: 'pan-x', // 가로 스크롤만 허용
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
    <div 
      ref={containerRef} 
      style={{
        ...STYLES.listContainer(cardHeight),
        overflowY: 'hidden',
        overflowX: 'auto',
        touchAction: 'pan-x', // 가로 스크롤만 허용
        WebkitOverflowScrolling: 'touch',
        position: 'relative'
      }}
    >
      <List
        height={cardHeight}
        itemCount={recipes.length}
        itemSize={itemSize}
        layout="horizontal"
        width={containerWidth}
        style={{
          overflowY: 'hidden',
          overflowX: 'auto',
          touchAction: 'pan-x'
        }}
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualizedHorizontalRecipeList; 