import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { VariableSizeList as List, ListRef } from 'react-window';
import RecipeCard from './RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';
import { calculateMatchRate } from '../utils/recipeUtils';

interface VirtualizedRecipeListProps {
  recipes: Recipe[];
  myIngredients: string[];
  substituteTable: Record<string, unknown>;
  recipeActionStates: Record<number, RecipeActionState>;
  onRecipeAction: (recipe: Recipe, action: string) => void;
}

export interface VirtualizedRecipeListRef {
  scrollToOffset: (offset: number) => void;
  getScrollOffset: () => number;
  scrollToItem: (index: number) => void;
  getVisibleItemIndex: () => number;
}

// 상수 정의
const CONSTANTS = {
  ITEM_HEIGHT_WITH_AD: 450, // 광고가 있을 때 레시피 카드의 높이 (픽셀) - 여유 공간 포함
  ITEM_HEIGHT_WITHOUT_AD: 300, // 광고가 없을 때 레시피 카드의 높이 (픽셀) - 실제 카드 높이에 맞춤
  HEADER_OFFSET: 300, // 헤더/네비게이션 영역 높이
  PAGINATION_OFFSET: 120, // 페이지네이션 영역 높이 (여백 포함)
  OVERSCAN_COUNT: 5 // 추가로 렌더링할 아이템 수
} as const;

// 유틸리티 함수들
const Utils = {
  // 화면 높이에서 헤더 영역과 페이지네이션 영역을 제외한 리스트 높이 계산
  calculateListHeight: (): number => {
    return window.innerHeight - CONSTANTS.HEADER_OFFSET - CONSTANTS.PAGINATION_OFFSET;
  },

  // 마지막 아이템인지 확인
  isLastItem: (index: number, totalCount: number): boolean => {
    return index === totalCount - 1;
  }
};

const VirtualizedRecipeList = forwardRef<VirtualizedRecipeListRef, VirtualizedRecipeListProps>(({
  recipes,
  myIngredients,
  substituteTable,
  recipeActionStates,
  onRecipeAction,
}, ref) => {
  // 화면 높이 상태
  const [listHeight, setListHeight] = useState(Utils.calculateListHeight());
  const listRef = useRef<ListRef>(null);
  const scrollOffsetRef = useRef<number>(0);

  // ref를 통해 스크롤 제어 메서드 노출
  useImperativeHandle(ref, () => ({
    scrollToOffset: (offset: number) => {
      if (listRef.current) {
        listRef.current.scrollTo(offset);
      } else {
        // 대안: 직접 DOM 조작
        const container = document.getElementById('virtualized-recipe-list-container');
        if (container) {
          const scrollableDiv = container.querySelector('div[style*="overflow"]') as HTMLElement;
          if (scrollableDiv) {
            scrollableDiv.scrollTop = offset;
          }
        }
      }
    },
    getScrollOffset: () => {
      // 저장된 스크롤 위치 반환
      return scrollOffsetRef.current;
    },
    scrollToItem: (index: number) => {
      if (listRef.current) {
        listRef.current.scrollToItem(index, 'start');
      }
    },
    getVisibleItemIndex: () => {
      // 현재 보이는 아이템의 인덱스 계산 (평균 높이 사용)
      const avgHeight = (CONSTANTS.ITEM_HEIGHT_WITH_AD + CONSTANTS.ITEM_HEIGHT_WITHOUT_AD) / 2;
      return Math.floor(scrollOffsetRef.current / avgHeight);
    }
  }));

  // 화면 크기 변경 시 높이 조정
  useEffect(() => {
    const handleResize = () => {
      setListHeight(Utils.calculateListHeight());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 스크롤바 스타일 적용
  useEffect(() => {
    const container = document.getElementById('virtualized-recipe-list-container');
    if (!container) return;

    const applyScrollbarStyle = () => {
      // react-window는 내부에 스크롤 가능한 div를 생성
      const scrollableDiv = container.querySelector('div[style*="overflow"]') as HTMLElement;
      if (scrollableDiv) {
        scrollableDiv.style.scrollbarWidth = 'thin';
        scrollableDiv.style.scrollbarColor = '#bdbdbd #f3f4f6';
        // WebKit 스크롤바 스타일은 CSS로 처리
        scrollableDiv.classList.add('virtualized-recipe-list-scrollbar');
      }
    };

    // 즉시 적용
    applyScrollbarStyle();

    // 약간의 지연 후 다시 시도 (DOM이 완전히 렌더링된 후)
    const timeoutId = setTimeout(applyScrollbarStyle, 100);
    
    return () => clearTimeout(timeoutId);
  }, [recipes.length]);

  // 각 레시피의 광고 유무를 확인하는 함수
  const getHasAd = (recipe: Recipe): boolean => {
    const match = calculateMatchRate(
      myIngredients,
      Array.isArray(recipe.used_ingredients)
        ? recipe.used_ingredients.join(',')
        : recipe.used_ingredients || ''
    );
    
    if (!match.need_ingredients || match.need_ingredients.length === 0) {
      return false;
    }
    
    // 대체 가능한 재료는 제외 (substituteTable 확인)
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const mySet = new Set(myIngredients.map(normalize));
    
    // 대체 불가능한 부족한 재료만 필터링
    const lackingIngredients = match.need_ingredients.filter(ing => {
      const normIng = normalize(ing);
      
      // substituteTable에서 해당 재료의 대체제 찾기
      if (substituteTable && typeof substituteTable === 'object') {
        const originalKey = Object.keys(substituteTable).find(k => normalize(k) === normIng);
        const substituteList = originalKey ? (substituteTable as any)[originalKey] : undefined;
        
        if (substituteList && Array.isArray(substituteList)) {
          // 내 냉장고에 있는 대체제가 있는지 확인
          const hasSubstitute = substituteList.some((sub: any) => mySet.has(normalize(sub.ingredient_b)));
          if (hasSubstitute) {
            return false; // 대체 가능하므로 제외
          }
        }
      }
      
      return true; // 대체 불가능한 재료
    });
    
    return lackingIngredients.length === 1;
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const recipe = recipes[index];
    
    if (!recipe) return null;

    const hasAd = getHasAd(recipe);

    return (
      <div style={{ 
        ...style, 
        pointerEvents: 'auto',
        overflow: 'visible', // react-window가 제공하는 높이 내에서 visible로 설정
        minHeight: hasAd ? CONSTANTS.ITEM_HEIGHT_WITH_AD : CONSTANTS.ITEM_HEIGHT_WITHOUT_AD // 최소 높이 보장
      }}>
        <RecipeCard
          recipe={recipe}
          index={index}
          recipeActionState={recipeActionStates[recipe.id]}
          onRecipeAction={({ action }) => onRecipeAction(recipe, action)}
          isLast={Utils.isLastItem(index, recipes.length)}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
          hasAd={hasAd}
        />
      </div>
    );
  };

  // 스크롤 이벤트 핸들러
  const handleScroll = ({ scrollOffset }: { scrollOffset: number }) => {
    scrollOffsetRef.current = scrollOffset;
  };

  // 각 아이템의 높이를 계산하는 함수
  const getItemSize = (index: number): number => {
    const recipe = recipes[index];
    if (!recipe) return CONSTANTS.ITEM_HEIGHT_WITHOUT_AD;
    
    const hasAd = getHasAd(recipe);
    return hasAd ? CONSTANTS.ITEM_HEIGHT_WITH_AD : CONSTANTS.ITEM_HEIGHT_WITHOUT_AD;
  };

  return (
    <div id="virtualized-recipe-list-container" style={{ pointerEvents: 'auto', marginBottom: '0' }}>
      <List
        ref={listRef}
        height={listHeight}
        itemCount={recipes.length}
        itemSize={getItemSize}
        width="100%"
        overscanCount={CONSTANTS.OVERSCAN_COUNT}
        onScroll={handleScroll}
        style={{ pointerEvents: 'auto' }}
        className="virtualized-recipe-list-scrollbar"
      >
        {Row}
      </List>
    </div>
  );
});

VirtualizedRecipeList.displayName = 'VirtualizedRecipeList';

export default VirtualizedRecipeList; 