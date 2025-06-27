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
  showRank = false
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

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const recipe = recipes[index];
    if (!recipe) return null;

    return (
      <div style={{
        ...style,
        ...STYLES.cardContainer(cardWidth, gap, cardHeight)
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
      <div style={STYLES.emptyContainer(cardHeight)}>
        레시피가 없습니다
      </div>
    );
  }

  return (
    <div ref={containerRef} style={STYLES.listContainer(cardHeight)}>
      <List
        height={cardHeight}
        itemCount={recipes.length}
        itemSize={itemSize}
        layout="horizontal"
        width={containerWidth}
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualizedHorizontalRecipeList; 