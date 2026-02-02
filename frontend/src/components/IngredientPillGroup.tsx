import React, { useRef, useEffect, useState } from 'react';
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';
import { convertSynonymToKeywordSync, preloadIngredientSynonymDict, loadIngredientSynonymDict } from '../utils/recipeUtils';

interface IngredientPillGroupProps {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  style?: React.CSSProperties;
}

// 전역 동의어 사전 캐시 (모든 IngredientPillGroup 인스턴스가 공유)
let globalSynonymDict: { [key: string]: string } | null = null;
let globalSynonymDictLoading = false;
let globalSynonymDictPromise: Promise<{ [key: string]: string }> | null = null;

const IngredientPillGroup: React.FC<IngredientPillGroupProps> = ({ needIngredients, myIngredients, substituteTable, style }) => {
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

  return (
    <div style={style}>
      {/* 재료 pill */}
      <div style={{ position: 'relative' }}>
        <div 
          ref={scrollContainerRef}
          className="custom-scrollbar pr-1" 
          style={{ 
            display: 'flex', 
            flexWrap: 'nowrap', 
            gap: 4, 
            marginBottom: 4, 
            overflowX: 'auto', 
            maxWidth: '100%', 
            scrollbarWidth: 'auto', 
            alignItems: 'center', 
            paddingBottom: 4 
          }}
        >
          {pillInfo.pills.map((ing) => {
            // 변환된 재료명을 원본 재료명으로 변환 (표시용)
            const displayName = originalToConverted.get(ing) || ing;
            
            if (mySet.has(normalize(ing))) {
              return (
                <span key={ing} className="bg-customYellow text-[#444] rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{displayName}</span>
              );
            } else if (pillInfo.notMineSub.map(normalize).includes(normalize(ing))) {
              return (
                <span key={ing} className="bg-customDarkGray text-white rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{displayName}</span>
              );
            } else {
              return (
                <span key={ing} className="bg-customGray text-white rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{displayName}</span>
              );
            }
          })}
        </div>
        {/* Fade-out 그라데이션 + 화살표 텍스트 */}
        {showScrollIndicator && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 4,
              width: '50px',
              background: 'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.6) 40%, rgba(255, 255, 255, 0.95) 100%)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '8px'
            }}
          >
            <span
              style={{
                fontSize: '22px',
                color: 'rgba(102, 102, 102, 0.85)',
                fontWeight: 400,
                lineHeight: 1,
                pointerEvents: 'none'
              }}
            >
              ›
            </span>
          </div>
        )}
      </div>
      {/* 대체 가능 태그 */}
      <div className="mt-1 custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, overflowX: 'auto', maxWidth: '100%', alignItems: 'center', paddingBottom: 4 }}>
        <span className="bg-[#555] text-white rounded px-2 py-0.5 font-normal" style={{ fontSize: '12px', flex: '0 0 auto', textShadow: 'none', border: 'none' }}>대체 가능 :</span>
        {pillInfo.substitutes.length > 0 ? (
          pillInfo.substitutes.map((sub, idx) => (
            <span key={sub} className="ml-2 font-semibold text-[#444]" style={{ fontSize: '12px', flex: '0 0 auto' }}>{sub}</span>
          ))
        ) : (
          <span className="ml-2 text-[12px] text-[#B0B0B0] font-normal" style={{ flex: '0 0 auto' }}>(내 냉장고에 대체 가능한 재료가 없습니다)</span>
        )}
      </div>
    </div>
  );
};

export default IngredientPillGroup; 