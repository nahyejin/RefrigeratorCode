import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';

interface VirtualizedHorizontalRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: { [key: string]: string[] };
  recipeActionStates: { [id: number]: RecipeActionState };
  onRecipeAction: (recipe: Recipe, action: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  showRank?: boolean;
}

const VirtualizedHorizontalRecipeList: React.FC<VirtualizedHorizontalRecipeListProps> = ({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
  cardWidth = 360,
  cardHeight = 280,
  gap = 16,
  showRank = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const itemSize = cardWidth + gap;

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
        width: cardWidth,
        marginRight: gap,
        display: 'inline-block',
        height: 'auto',
        minHeight: cardHeight
      }}>
        <RecipeCard
          recipe={recipe}
          index={index}
          recipeActionState={recipeActionStates[recipe.id] || { done: false, write: false, share: false }}
          onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
          isLast={index === recipes.length - 1}
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
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: cardHeight,
        color: '#bbb',
        fontSize: 13
      }}>
        레시피가 없습니다
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: cardHeight, width: '100%' }}>
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