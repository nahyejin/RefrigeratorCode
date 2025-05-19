import React, { useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import FilterModal from './FilterModal';
import { getDDay } from '../utils/recipeUtils';

interface RecipeTopBarProps {
  sortType: string;
  onSortChange: (value: string) => void;
  sortOptions: { value: string; label: string }[];
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  selectedFilter: any;
  setSelectedFilter: (f: any) => void;
  includeInput: string;
  setIncludeInput: (v: string) => void;
  excludeInput: string;
  setExcludeInput: (v: string) => void;
  allIngredients: string[];
  includeKeyword: string;
  setIncludeKeyword: (v: string) => void;
  matchRange: [number, number];
  setMatchRange: (r: [number, number]) => void;
  maxLack: number | 'unlimited';
  setMaxLack: (v: number | 'unlimited') => void;
  expirySortType: 'expiry' | 'purchase';
  setExpirySortType: (v: 'expiry' | 'purchase') => void;
  sortedExpiryList: any[];
  selectedExpiryIngredients: string[];
  setSelectedExpiryIngredients: (v: string[]) => void;
  appliedExpiryIngredients: string[];
  setAppliedExpiryIngredients: (v: string[]) => void;
}

const RecipeTopBar: React.FC<RecipeTopBarProps> = ({
  sortType,
  onSortChange,
  sortOptions,
  filterOpen,
  setFilterOpen,
  selectedFilter,
  setSelectedFilter,
  includeInput,
  setIncludeInput,
  excludeInput,
  setExcludeInput,
  allIngredients,
  includeKeyword,
  setIncludeKeyword,
  matchRange,
  setMatchRange,
  maxLack,
  setMaxLack,
  expirySortType,
  setExpirySortType,
  sortedExpiryList,
  selectedExpiryIngredients,
  setSelectedExpiryIngredients,
  appliedExpiryIngredients,
  setAppliedExpiryIngredients,
}) => {
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, width: '100%', marginTop: 24, flexWrap: 'wrap' }}>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }}
          onClick={() => setMatchRateModalOpen(true)}
        >
          재료 매칭도 설정
        </button>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }}
          onClick={() => setExpiryModalOpen(true)}
        >
          임박 재료 설정
        </button>
        <div style={{ position: 'relative', minWidth: 80 }}>
          <select
            aria-label="정렬 기준 선택"
            value={sortType}
            onChange={e => onSortChange(e.target.value)}
            style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 22px 0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 80, marginRight: 0, appearance: 'none' as any, WebkitAppearance: 'none', MozAppearance: 'none', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              fontSize: 13,
              color: '#888',
            }}
          >▼</span>
        </div>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 999, fontSize: 12, padding: '0 12px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 50, whiteSpace: 'nowrap', boxSizing: 'border-box', cursor: 'pointer' }}
          onClick={() => setFilterOpen(true)}
        >
          <span style={{ fontWeight: 600 }}>필터</span>
        </button>
      </div>
      {/* 매칭률 설정 모달 */}
      {matchRateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => setMatchRateModalOpen(false)}>×</span>
            <div className="text-center font-bold text-[14px] mb-4">재료 매칭도 설정</div>
            <div className="flex flex-col gap-4">
              {/* 매칭률 범위 슬라이더 + 숫자 입력 */}
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="number"
                  min={0}
                  max={matchRange[1]}
                  value={matchRange[0]}
                  onChange={e => setMatchRange([Math.min(Number(e.target.value), matchRange[1]), matchRange[1]])}
                  className="w-12 border rounded px-1 text-xs text-center"
                />
                <span className="text-xs">%</span>
                <span className="mx-1 text-xs">~</span>
                <input
                  type="number"
                  min={matchRange[0]}
                  max={100}
                  value={matchRange[1]}
                  onChange={e => setMatchRange([matchRange[0], Math.max(Number(e.target.value), matchRange[0])])}
                  className="w-12 border rounded px-1 text-xs text-center"
                />
                <span className="text-xs">%</span>
              </div>
              {/* 범위 슬라이더 */}
              <div className="flex items-center gap-2 px-2">
                {React.createElement(Slider as unknown as React.FC<any>, {
                  range: true,
                  min: 0,
                  max: 100,
                  value: matchRange,
                  onChange: (val: number | number[]) => Array.isArray(val) && setMatchRange([val[0], val[1]]),
                  allowCross: false,
                  trackStyle: [{ backgroundColor: '#3c3c3c' }],
                  handleStyle: [
                    { borderColor: '#3c3c3c', backgroundColor: '#fff' },
                    { borderColor: '#3c3c3c', backgroundColor: '#fff' }
                  ],
                  railStyle: { backgroundColor: '#eee' },
                  style: { width: '100%' }
                })}
              </div>
              {/* 최대 n개 부족 라디오 */}
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {[1,2,3,4].map(n => (
                  <label key={n} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="maxLack"
                      checked={maxLack === n}
                      onChange={() => setMaxLack(n)}
                    />
                    최대 {n}개 부족
                  </label>
                ))}
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="maxLack"
                    checked={maxLack === 5}
                    onChange={() => setMaxLack(5)}
                  />
                  5개 이상 부족
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="maxLack"
                    checked={maxLack === 'unlimited' || maxLack === null}
                    onChange={() => setMaxLack('unlimited')}
                  />
                  제한 없음
                </label>
              </div>
              <button className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg mt-2" onClick={() => {
                if (maxLack === null) setMaxLack('unlimited');
                setMatchRateModalOpen(false);
              }}>적용</button>
            </div>
          </div>
        </div>
      )}
      {/* 임박 재료 설정 모달 */}
      {expiryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => setExpiryModalOpen(false)}>×</span>
            <div className="text-center font-bold text-[14px] mb-4">임박 재료 설정</div>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 mb-2">
                <button
                  className={`flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg ${expirySortType==='expiry' ? 'bg-gray-200' : 'bg-white'}`}
                  onClick={() => setExpirySortType('expiry')}
                >유통기한 임박순</button>
                <button
                  className={`flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg ${expirySortType==='purchase' ? 'bg-gray-200' : 'bg-white'}`}
                  onClick={() => setExpirySortType('purchase')}
                >구매일 오래된순</button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {sortedExpiryList.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-6">해당 정보가 입력된 재료가 없습니다.</div>
                )}
                {sortedExpiryList.map((item, idx) => (
                  <label key={item.id || idx} className="flex items-center gap-2 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={selectedExpiryIngredients.includes(item.name)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedExpiryIngredients([...selectedExpiryIngredients, item.name]);
                        } else {
                          setSelectedExpiryIngredients(selectedExpiryIngredients.filter((n: string) => n !== item.name));
                        }
                      }}
                    />
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {expirySortType==='expiry' && item.expiry ? getDDay(item.expiry) : expirySortType==='purchase' && item.purchase ? item.purchase : ''}
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg mt-2"
                onClick={() => {
                  setAppliedExpiryIngredients(selectedExpiryIngredients);
                  setExpiryModalOpen(false);
                }}
              >
                선택 재료 포함 레시피만 보기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 필터 모달 */}
      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filterState={selectedFilter}
          setFilterState={setSelectedFilter}
          includeInput={includeInput}
          setIncludeInput={setIncludeInput}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          allIngredients={allIngredients}
          includeKeyword={includeKeyword}
          setIncludeKeyword={setIncludeKeyword}
        />
      )}
    </>
  );
};

export default RecipeTopBar; 