import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import { lookupRecipeActionState } from '../utils/recipeStorage';

interface VirtualizedRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
  /** 그룹(식구) 목록에서 "누가 했는지" 배지. 없으면 배지 없음. */
  getAttributionLabel?: (recipe: Recipe) => string | undefined;
}

export interface VirtualizedRecipeListRef {
  scrollToOffset: (offset: number) => void;
  getScrollOffset: () => number;
  scrollToItem: (index: number) => void;
  getVisibleItemIndex: () => number;
}

const VirtualizedRecipeList = forwardRef<VirtualizedRecipeListRef, VirtualizedRecipeListProps>(({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
  getAttributionLabel,
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToOffset: (offset: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = offset;
      }
    },
    getScrollOffset: () => {
      return containerRef.current?.scrollTop || 0;
    },
    scrollToItem: (index: number) => {
      const container = containerRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(`[data-recipe-card-index="${index}"]`);
      if (target) {
        container.scrollTop = target.offsetTop;
      }
    },
    getVisibleItemIndex: () => {
      const container = containerRef.current;
      if (!container) return 0;
      const cards = Array.from(
        container.querySelectorAll<HTMLElement>('[data-recipe-card-index]')
      );
      const scrollTop = container.scrollTop;
      let visibleIndex = 0;
      cards.forEach((el, idx) => {
        if (el.offsetTop <= scrollTop) {
          visibleIndex = idx;
        }
      });
      return visibleIndex;
    },
  }));

  return (
    <div
      id="virtualized-recipe-list-container"
      ref={containerRef}
      style={{
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {recipes.map((recipe, index) => (
        <div key={recipe.id} data-recipe-card-index={index}>
          <RecipeCard
            recipe={recipe}
            index={index}
            recipeActionState={lookupRecipeActionState(recipeActionStates, recipe.id)}
            onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
            isLast={index === recipes.length - 1}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            attributionLabel={getAttributionLabel?.(recipe)}
          />
        </div>
      ))}
    </div>
  );
});

VirtualizedRecipeList.displayName = 'VirtualizedRecipeList';

export default VirtualizedRecipeList;
