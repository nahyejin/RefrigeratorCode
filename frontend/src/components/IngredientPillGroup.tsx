import React, { useRef, useEffect, useState } from 'react';
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';

interface IngredientPillGroupProps {
  needIngredients: string[];
  myIngredients: string[];
  substituteTable: { [key: string]: { ingredient_b: string } };
  style?: React.CSSProperties;
}

const IngredientPillGroup: React.FC<IngredientPillGroupProps> = ({ needIngredients, myIngredients, substituteTable, style }) => {
  const pillInfo = getUniversalIngredientPillInfo({ needIngredients, myIngredients, substituteTable });
  const normalize = (s: string) => (s || '').trim().toLowerCase();
  const mySet = new Set(myIngredients.map(normalize));
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
            if (mySet.has(normalize(ing))) {
              return (
                <span key={ing} className="bg-customYellow text-[#444] rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{ing}</span>
              );
            } else if (pillInfo.notMineSub.map(normalize).includes(normalize(ing))) {
              return (
                <span key={ing} className="bg-customDarkGray text-white rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{ing}</span>
              );
            } else {
              return (
                <span key={ing} className="bg-customGray text-white rounded-full px-3 py-0.5 font-normal" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center', textShadow: 'none', border: 'none' }}>{ing}</span>
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
                fontSize: '18px',
                color: 'rgba(102, 102, 102, 0.6)',
                fontWeight: 300,
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