import React from 'react';
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

  console.log('[IngredientPillGroup]', { needIngredients, myIngredients, substituteTable, pillInfo });

  return (
    <div style={style}>
      {/* 재료 pill */}
      <div className="custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, marginBottom: 4, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'auto', alignItems: 'center', paddingBottom: 4 }}>
        {pillInfo.pills.map((ing) => {
          if (mySet.has(normalize(ing))) {
            return (
              <span key={ing} className="bg-customYellow text-[#444] rounded-full px-3 py-0.5 font-medium" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center' }}>{ing}</span>
            );
          } else if (pillInfo.notMineSub.map(normalize).includes(normalize(ing))) {
            return (
              <span key={ing} className="bg-customDarkGray text-white rounded-full px-3 py-0.5 font-medium" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center' }}>{ing}</span>
            );
          } else {
            return (
              <span key={ing} className="bg-customGray text-white rounded-full px-3 py-0.5 font-medium" style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center' }}>{ing}</span>
            );
          }
        })}
      </div>
      {/* 대체 가능 태그 */}
      <div className="mt-1 custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, overflowX: 'auto', maxWidth: '100%', alignItems: 'center', paddingBottom: 4 }}>
        <span className="bg-[#FFE066] text-[#444] rounded px-3 py-1 font-bold" style={{ fontSize: '12px', flex: '0 0 auto' }}>대체 가능 :</span>
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