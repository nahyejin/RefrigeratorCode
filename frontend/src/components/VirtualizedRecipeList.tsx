import React, { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';

interface VirtualizedRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: Record<string, unknown>;
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
}

// 상수 정의
const CONSTANTS = {
  ITEM_HEIGHT: 320, // 각 레시피 카드의 높이 (픽셀)
  HEADER_OFFSET: 300, // 헤더/네비게이션 영역 높이
  OVERSCAN_COUNT: 5 // 추가로 렌더링할 아이템 수
} as const;

// 유틸리티 함수들
const Utils = {
  // 화면 높이에서 헤더 영역을 제외한 리스트 높이 계산
  calculateListHeight: (): number => {
    return window.innerHeight - CONSTANTS.HEADER_OFFSET;
  },

  // 마지막 아이템인지 확인
  isLastItem: (index: number, totalCount: number): boolean => {
    return index === totalCount - 1;
  }
};

const VirtualizedRecipeList: React.FC<VirtualizedRecipeListProps> = ({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
}) => {
  // 화면 높이 상태
  const [listHeight, setListHeight] = useState(Utils.calculateListHeight());

  // 화면 크기 변경 시 높이 조정
  useEffect(() => {
    const handleResize = () => {
      setListHeight(Utils.calculateListHeight());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const recipe = recipes[index];
    
    if (!recipe) return null;

    return (
      <div style={style}>
        <RecipeCard
          recipe={recipe}
          index={index}
          recipeActionState={recipeActionStates[recipe.id]}
          onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
          isLast={Utils.isLastItem(index, recipes.length)}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
        />
      </div>
    );
  };

  return (
    <List
      height={listHeight}
      itemCount={recipes.length}
      itemSize={CONSTANTS.ITEM_HEIGHT}
      width="100%"
      overscanCount={CONSTANTS.OVERSCAN_COUNT}
    >
      {Row}
    </List>
  );
};

export default VirtualizedRecipeList; 