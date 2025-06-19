import React, { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';

interface VirtualizedRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: { [key: string]: any };
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
}

const VirtualizedRecipeList: React.FC<VirtualizedRecipeListProps> = ({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
}) => {
  // 각 레시피 카드의 높이 (픽셀)
  const ITEM_HEIGHT = 280;
  
  // 화면 높이 상태
  const [listHeight, setListHeight] = useState(window.innerHeight - 300);

  // 화면 크기 변경 시 높이 조정
  useEffect(() => {
    const handleResize = () => {
      setListHeight(window.innerHeight - 300);
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
          isLast={index === recipes.length - 1}
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
      itemSize={ITEM_HEIGHT}
      width="100%"
      overscanCount={5} // 추가로 렌더링할 아이템 수
    >
      {Row}
    </List>
  );
};

export default VirtualizedRecipeList; 