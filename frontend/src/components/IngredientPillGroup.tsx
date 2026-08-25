import React, { useRef, useEffect, useState } from 'react';
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';
import { convertSynonymToKeywordSync, preloadIngredientSynonymDict, loadIngredientSynonymDict } from '../utils/recipeUtils';
import { pillStyle, type PillState } from '../styles/ingredientPill';

interface IngredientPillGroupProps {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  style?: React.CSSProperties;
  /** 부족 재료 pill 을 눌렀을 때 (구매 연결 등). 없으면 pill 은 표시 전용 */
  onMissingClick?: (ingredient: string) => void;
}

// 전역 동의어 사전 캐시 (모든 IngredientPillGroup 인스턴스가 공유)
let globalSynonymDict: { [key: string]: string } | null = null;
let globalSynonymDictLoading = false;
let globalSynonymDictPromise: Promise<{ [key: string]: string }> | null = null;

const IngredientPillGroup: React.FC<IngredientPillGroupProps> = ({ needIngredients, myIngredients, substituteTable, style, onMissingClick }) => {
  const [synonymDict, setSynonymDict] = useState<{ [key: string]: string } | null>(globalSynonymDict);
  const [isDictLoaded, setIsDictLoaded] = useState(!!globalSynonymDict);
  
  // 동의어 사전 미리 로드 (전역 캐시 사용)
  useEffect(() => {
    // 이미 전역 캐시에 있으면 사용
    if (globalSynonymDict) {
      setSynonymDict(globalSynonymDict);
      setIsDictLoaded(true);
      return;
    }
    
    // 이미 로딩 중이면 기다림
    if (globalSynonymDictLoading && globalSynonymDictPromise) {
      globalSynonymDictPromise.then(dict => {
        setSynonymDict(dict);
        setIsDictLoaded(true);
      });
      return;
    }
    
    // 새로 로드
    globalSynonymDictLoading = true;
    globalSynonymDictPromise = loadIngredientSynonymDict();
    
    globalSynonymDictPromise.then(dict => {
      globalSynonymDict = dict;
      globalSynonymDictLoading = false;
      setSynonymDict(dict);
      setIsDictLoaded(true);
      // 첫 로드 시에만 로그 출력 (중복 로그 방지)
      console.log('[IngredientPillGroup] 동의어 사전 로드 완료 (전역 캐시):', Object.keys(dict).length, '개');
      // 샘플 데이터 확인
      const sampleKeys = ['깐대파', '대파', '파'];
      sampleKeys.forEach(key => {
        if (dict[key]) {
          console.log(`[IngredientPillGroup] 동의어 샘플: "${key}" → "${dict[key]}"`);
        }
      });
    }).catch(e => {
      console.error('[IngredientPillGroup] 동의어 사전 로드 실패:', e);
      globalSynonymDictLoading = false;
    });
  }, []);
  
  // 동의어를 keyword로 변환 (레시피 재료) - 원본과 변환된 것 매핑
  const { convertedNeedIngredients, originalToConverted } = React.useMemo(() => {
    if (!isDictLoaded || !synonymDict) {
      // 사전이 로드되지 않았으면 원본 반환 (나중에 다시 렌더링됨)
      const mapping = new Map<string, string>();
      needIngredients.forEach(ing => mapping.set(ing, ing));
      return { convertedNeedIngredients: needIngredients, originalToConverted: mapping };
    }
    const converted = needIngredients.map(ing => {
      const converted = convertSynonymToKeywordSync(ing, synonymDict);
      if (converted !== ing) {
        console.log(`[IngredientPillGroup] 레시피 재료 동의어 변환: "${ing}" → "${converted}"`);
      }
      return converted;
    });
    const mapping = new Map<string, string>();
    needIngredients.forEach((original, idx) => {
      mapping.set(converted[idx], original); // 변환된 것 → 원본 매핑
    });
    return { convertedNeedIngredients: converted, originalToConverted: mapping };
  }, [needIngredients, synonymDict, isDictLoaded]);
  
  // 동의어를 keyword로 변환 (내 냉장고 재료)
  const convertedMyIngredients = React.useMemo(() => {
    if (!isDictLoaded || !synonymDict) {
      // 사전이 로드되지 않았으면 원본 반환 (나중에 다시 렌더링됨)
      return myIngredients;
    }
    return myIngredients.map(ing => {
      const converted = convertSynonymToKeywordSync(ing, synonymDict);
      if (converted !== ing) {
        console.log(`[IngredientPillGroup] 내 냉장고 재료 동의어 변환: "${ing}" → "${converted}"`);
      }
      return converted;
    });
  }, [myIngredients, synonymDict, isDictLoaded]);
  
  const pillInfo = getUniversalIngredientPillInfo({ 
    needIngredients: convertedNeedIngredients, 
    myIngredients: convertedMyIngredients, 
    substituteTable 
  });
  
  // 디버깅: 대체제 정보 확인
  if (pillInfo.substitutes.length > 0) {
    console.log('[IngredientPillGroup] 대체제 발견:', pillInfo.substitutes);
  }
  const normalize = (s: string) => (s || '').trim().toLowerCase();
  const mySet = new Set(convertedMyIngredients.map(normalize));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  // 스크롤 가능 여부 확인
  useEffect(() => {
    const checkScrollable = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const isScrollable = container.scrollWidth > container.clientWidth;
        const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
        setShowScrollIndicator(isScrollable && !isAtEnd);
      }
    };

    checkScrollable();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollable);
      window.addEventListener('resize', checkScrollable);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollable);
        window.removeEventListener('resize', checkScrollable);
      }
    };
  }, [pillInfo.pills]);

  // 접힘 상태에서 보여줄 pill 개수. pills 는 [부족 → 대체가능 → 보유] 순이라
  // 잘리더라도 "무엇이 부족한지"가 먼저 보인다.
  // 8개면 카드마다 3줄까지 늘어나 목록이 무거워진다는 피드백 → 6개(보통 2줄)로 줄임
  const COLLAPSED_COUNT = 6;
  const [expanded, setExpanded] = useState(false);
  const overflowCount = pillInfo.pills.length - COLLAPSED_COUNT;
  const visiblePills = expanded ? pillInfo.pills : pillInfo.pills.slice(0, COLLAPSED_COUNT);

  const stateOf = (ing: string): PillState =>
    mySet.has(normalize(ing))
      ? 'owned'
      : pillInfo.notMineSub.map(normalize).includes(normalize(ing))
        ? 'substitutable'
        : 'missing';

  return (
    <div style={style}>
      {/* 재료 pill.
          예전엔 가로 스크롤(nowrap + overflowX)이라 이 앱의 핵심 정보인 재료 구성이
          카드마다 잘려 있었고, 몇 개가 부족한지 보려면 카드마다 옆으로 밀어야 했음.
          → 줄바꿈으로 한눈에 보이게 하고, 너무 많으면 "+N" 으로 접는다. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4, alignItems: 'center' }}>
        {visiblePills.map((ing) => {
          const displayName = originalToConverted.get(ing) || ing;
          const state = stateOf(ing);
          // 부족 재료는 "채워야 할 빈 칸" → 눌러서 바로 채울(구매할) 수 있게 한다.
          const clickable = state === 'missing' && !!onMissingClick;
          if (!clickable) {
            return <span key={ing} style={pillStyle(state)}>{displayName}</span>;
          }
          return (
            <button
              key={ing}
              type="button"
              title={`${displayName} 구매하러 가기`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMissingClick!(displayName); }}
              style={{ ...pillStyle(state), cursor: 'pointer' }}
            >
              {displayName}
              <span aria-hidden style={{ marginLeft: 5, opacity: 0.55, fontWeight: 700 }}>+</span>
            </button>
          );
        })}
        {!expanded && overflowCount > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            style={{
              ...pillStyle('missing'),
              background: 'transparent',
              borderStyle: 'dashed',
              color: 'var(--ink-500)',
              cursor: 'pointer',
              padding: '0 10px',
            }}
          >
            +{overflowCount}
          </button>
        )}
      </div>

      {/* 대체 가능 — 부족한 재료를 무엇으로 바꿀 수 있는지가 이 앱의 핵심 기능이라
          별도 줄로 분리하되 눈에 띄게 둔다. */}
      {pillInfo.substitutes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink-500)',
              flex: '0 0 auto',
            }}
          >
            대체 가능
          </span>
          {pillInfo.substitutes.map((sub) => (
            <span
              key={sub}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-900)',
                background: 'var(--surface-sub)',
                border: '1px solid var(--line-200)',
                borderRadius: 9999,
                padding: '2px 10px',
                flex: '0 0 auto',
              }}
            >
              {sub}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default IngredientPillGroup; 