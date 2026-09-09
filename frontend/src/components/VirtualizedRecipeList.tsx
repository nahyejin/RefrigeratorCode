import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import RecipeCard from './RecipeCard';
import CoupangAdCard from './CoupangAdCard';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { preloadCoupangAds } from '../utils/recipeUtils';
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
/**
 * 세로 목록의 광고 카드는 **높이를 고정하지 않는다.**
 *
 * 예전에는 200px 로 잡아 뒀다. 그런데 이 카드에는 상품 이미지도 가격도 없고
 * `광고` 배지 · 대가성 문구 · 재료 이름 한 줄 · 버튼 하나가 전부다.
 * 남는 자리를 벌려 두니 재료 이름 위아래가 텅 비어 **광고만 커 보였다.**
 *
 * (가로 캐러셀은 옆 레시피 카드와 높이가 같아야 줄이 안 깨져서 그대로 둔다)
 */

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
   * **광고 CSV 를 다 읽었나.**
   *
   * 다 읽기 전에는 어떤 재료에 파트너스 링크가 있는지 알 수 없다. 그 상태로
   * 광고 자리를 만들어 두면 `CoupangAdCard` 가 아무것도 안 그려서 그 칸이
   * **빈 채로 남는다.** 아래 `items` 가 이 값을 보고 자리를 만든다.
   */
  const [adsReady, setAdsReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    preloadCoupangAds()
      .then(() => { if (alive) setAdsReady(true); })
      .catch(() => { /* 못 읽으면 광고를 안 넣는다 */ });
    return () => { alive = false; };
  }, []);

  /**
   * 목록에 실제로 그릴 항목들 — 레시피 사이사이에 광고 카드를 끼워 넣는다.
   * 가로 캐러셀(VirtualizedHorizontalRecipeList)과 같은 규칙을 쓴다:
   * 부족 재료가 1~5개인 카드 바로 뒤에, 그중 한 재료의 광고 카드를 한 장 넣는다.
   * (개수 기준은 `pickAdIngredient` 한 곳에서 정한다 — 왜 5인지도 거기에 적혀 있다)
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

      if (!showAds || !adsReady) return;
      if (i < AD_FIRST_SLOT) return;
      if (sinceLastAd < AD_MIN_GAP) return;

      const lacking = getLackingIngredients(recipe, myIngredients, substituteTable as any);
      const ingredient = pickAdIngredient(lacking, recipe.id ?? i);
      if (!ingredient) return;
      // **그릴 수 없는 자리는 만들지 않는다.** 파트너스 링크가 없는 재료면
      // 카드가 아무것도 안 그려서 그 칸이 빈 채로 남는다.
      if (!resolveCoupangUrl(ingredient)) return;

      out.push({ kind: 'ad', key: `ad-${recipe.id ?? i}`, ingredient, recipeId: recipe.id, lackingCount: lacking.length });
      sinceLastAd = 0;
    });

    return out;
  }, [recipes, myIngredients, substituteTable, showAds, adsReady]);

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
