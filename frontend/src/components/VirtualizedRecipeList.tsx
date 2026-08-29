import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import RecipeCard from './RecipeCard';
import CoupangAdCard from './CoupangAdCard';
import { getLackingIngredients, pickAdIngredient } from '../utils/lackingIngredients';
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
  /** 목록 사이에 쿠팡 광고 카드를 끼울지. 기본 true. */
  showAds?: boolean;
}

/** 광고 카드를 처음 끼울 수 있는 위치(레시피 인덱스). 첫 화면에는 광고를 두지 않는다 */
const AD_FIRST_SLOT = 2;
/** 광고와 광고 사이 최소 레시피 수 */
const AD_MIN_GAP = 4;
/** 세로 목록에서 광고 카드에 쓸 높이 — 레시피 카드처럼 썸네일이 없어 고정값으로 충분하다 */
const AD_CARD_HEIGHT = 200;

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
  showAds = true,
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

  /**
   * 목록에 실제로 그릴 항목들 — 레시피 사이사이에 광고 카드를 끼워 넣는다.
   * 가로 캐러셀(VirtualizedHorizontalRecipeList)과 같은 규칙을 쓴다:
   * 부족 재료가 1~3개인 카드 바로 뒤에, 그중 한 재료의 광고 카드를 한 장 넣는다.
   */
  const items = React.useMemo(() => {
    type Item =
      | { kind: 'recipe'; recipe: Recipe; recipeIndex: number }
      | { kind: 'ad'; key: string; ingredient: string; recipeId?: number; lackingCount: number };

    const out: Item[] = [];
    let sinceLastAd = Number.MAX_SAFE_INTEGER;

    recipes.forEach((recipe, i) => {
      out.push({ kind: 'recipe', recipe, recipeIndex: i });
      sinceLastAd += 1;

      if (!showAds) return;
      if (i < AD_FIRST_SLOT) return;
      if (sinceLastAd < AD_MIN_GAP) return;

      const lacking = getLackingIngredients(recipe, myIngredients, substituteTable as any);
      const ingredient = pickAdIngredient(lacking, recipe.id ?? i);
      if (!ingredient) return;

      out.push({ kind: 'ad', key: `ad-${recipe.id ?? i}`, ingredient, recipeId: recipe.id, lackingCount: lacking.length });
      sinceLastAd = 0;
    });

    return out;
  }, [recipes, myIngredients, substituteTable, showAds]);

  return (
    <div
      id="virtualized-recipe-list-container"
      ref={containerRef}
      style={{
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {items.map((item) => {
        if (item.kind === 'ad') {
          return (
            <div key={item.key} style={{ marginBottom: 16 }}>
              <CoupangAdCard
                ingredient={item.ingredient}
                recipeId={item.recipeId}
                lackingCount={item.lackingCount}
                width="100%"
                height={AD_CARD_HEIGHT}
              />
            </div>
          );
        }

        const { recipe, recipeIndex: index } = item;
        return (
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
        );
      })}
    </div>
  );
});

VirtualizedRecipeList.displayName = 'VirtualizedRecipeList';

export default VirtualizedRecipeList;
