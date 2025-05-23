/*
 * RecipeSortBar Component
 *
 * 레시피 리스트의 필터링과 정렬을 담당하는 컴포넌트입니다.
 * - 재료 매칭률 기반 필터링
 * - 임박 재료 기반 필터링
 * - 카테고리/키워드 기반 필터링
 * - 정렬 기능
 *
 * 모든 필터/정렬 상태는 localStorage에 저장되어 페이지 이동 후에도 복원됩니다.
 *
 * 주요 타입 및 인터페이스:
 * - SubstituteInfo: 재료 대체 정보
 * - FilterKeywordNode, FilterKeywordTree: 필터 키워드 트리 구조
 * - RecipeSortBarProps: 컴포넌트 Props
 *
 * 주요 유틸 함수:
 * - calculateMatchRate: 재료 매칭률 계산
 * - filterUtils: 각종 필터링 함수 모음
 * - filterRecipes: 전체 레시피 필터링 및 정렬
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import RecipeCard from './RecipeCard';
import FilterModal from './FilterModal';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Recipe } from '../types/recipe';
import { filterRecipes } from '../utils/recipeFilters';
import { getDictCategoryKey, getDDay } from '../utils/recipeUtils';

/**
 * 재료 대체 정보 타입
 */
interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

/**
 * 필터 키워드 트리 타입
 */
interface FilterKeywordNode {
  keyword: string;
  synonyms: string[];
}

interface FilterKeywordSubTree {
  [subCategory: string]: FilterKeywordNode[];
}

interface FilterKeywordTree {
  [mainCategory: string]: FilterKeywordSubTree;
}

/**
 * RecipeSortBar 컴포넌트 Props 타입
 */
interface RecipeSortBarProps {
  recipes: Recipe[];
  myIngredients: string[];
  onFilteredRecipesChange: (filtered: Recipe[]) => void;
  sortType: string;
  setSortType: (v: string) => void;
  matchRange: [number, number];
  setMatchRange: (v: [number, number]) => void;
  maxLack: number | 'unlimited';
  setMaxLack: (v: number | 'unlimited') => void;
  appliedExpiryIngredients: string[];
  setAppliedExpiryIngredients: (v: string[]) => void;
  expirySortType: 'expiry' | 'purchase';
  setExpirySortType: (v: 'expiry' | 'purchase') => void;
  onToast?: (msg: string) => void;
}

const RecipeSortBar = ({ 
  recipes,
  myIngredients,
  onFilteredRecipesChange,
  sortType, 
  setSortType, 
  matchRange, 
  setMatchRange, 
  maxLack, 
  setMaxLack, 
  appliedExpiryIngredients, 
  setAppliedExpiryIngredients, 
  expirySortType, 
  setExpirySortType,
  onToast
}: RecipeSortBarProps) => {
  const [isFilterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [selectedCategoryKeywords, setSelectedCategoryKeywords] = useState<any>({ 효능: [], 영양분: [], 대상: [], TPO: [], 스타일: [] });
  const [includeInput, setIncludeInput] = useState<string>('');
  const [excludeInput, setExcludeInput] = useState<string>('');
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [includeKeyword, setIncludeKeyword] = useState<string>('');
  const [isMatchRateModalOpen, setMatchRateModalOpen] = useState<boolean>(false);
  const [isExpiryModalOpen, setExpiryModalOpen] = useState<boolean>(false);
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [tempMatchRangeMin, setTempMatchRangeMin] = useState<string | null>(null);
  const [tempMatchRangeMax, setTempMatchRangeMax] = useState<string | null>(null);
  const [expiryIngredientMode, setExpiryIngredientMode] = useState<'and'|'or'>(() => {
    const saved = localStorage.getItem('recipe_sortbar_state_fridge');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        return state.expiryIngredientMode || 'or';
      } catch {}
    }
    return 'or';
  });
  const [categoryKeywordTree, setCategoryKeywordTree] = useState<FilterKeywordTree | null>(null);

  const myFridgeIngredientList = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
      if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
        return [...data.frozen, ...data.fridge, ...data.room];
      }
    } catch {}
    return [];
  }, []);

  const expirySortedIngredientList = useMemo(() =>
    myFridgeIngredientList
      .filter(i => i.expiry)
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()),
    [myFridgeIngredientList]
  );

  const purchaseSortedIngredientList = useMemo(() =>
    myFridgeIngredientList
      .filter(i => i.purchase)
      .sort((a, b) => new Date(a.purchase).getTime() - new Date(b.purchase).getTime()),
    [myFridgeIngredientList]
  );

  // 초기 렌더링과 필터 상태 변경 시 필터링 적용
  useEffect(() => {
    const filtered = filterRecipes(recipes, {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      myIngredients,
      expiryIngredientMode,
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      categoryKeywords: selectedCategoryKeywords
    });
    onFilteredRecipesChange(filtered);
  }, [
    recipes,
    sortType,
    matchRange,
    maxLack,
    appliedExpiryIngredients,
    myIngredients,
    expiryIngredientMode,
    includeKeyword,
    includeIngredients,
    excludeIngredients,
    selectedCategoryKeywords
  ]);

  // 필터 적용 함수
  const applyFilter = useCallback(() => {
    const categoryKeywords = buildCategoryKeywords(selectedCategoryKeywords, categoryKeywordTree);
    const filtered = filterRecipes(recipes, {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      myIngredients,
      expiryIngredientMode,
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      categoryKeywords
    });
    onFilteredRecipesChange(filtered);
    setFilterModalOpen(false);
  }, [selectedCategoryKeywords, categoryKeywordTree, recipes, sortType, matchRange, maxLack, appliedExpiryIngredients, myIngredients, expiryIngredientMode, includeKeyword, includeIngredients, excludeIngredients, onFilteredRecipesChange]);

  // 전체 재료 목록 fetch
  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('ingredient_name');
        if (nameIdx === -1) return;
        setAllIngredients(
          lines.slice(1)
            .map(line => line.split(',')[nameIdx]?.trim())
            .filter(name => !!name && name !== 'ingredient_name')
        );
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('recipe_sortbar_state_fridge', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType, expiryIngredientMode
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType, expiryIngredientMode]);

  // 선택된 키워드와 filterKeywordTree를 조합해 동의어까지 포함된 categoryKeywords 생성
  const buildCategoryKeywords = useCallback((selected: any, tree: any) => {
    const result: any = {};
    if (!tree) {
      return result;
    }
    for (const main of Object.keys(selected)) {
      if (!selected[main] || selected[main].length === 0) continue;
      result[main] = [];
      for (const kw of selected[main]) {
        let found = null;
        for (const sub of Object.keys(tree[main] || {})) {
          found = (tree[main][sub] || []).find((obj: any) => obj.keyword === kw);
          if (found) break;
        }
        if (found) {
          result[main].push({ keyword: found.keyword, synonyms: found.synonyms });
        } else {
          result[main].push({ keyword: kw, synonyms: [] });
        }
      }
    }
    return result;
  }, []);

  useEffect(() => {
    const filtered = filterRecipes(recipes, {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      myIngredients,
      expiryIngredientMode,
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      categoryKeywords: buildCategoryKeywords(selectedCategoryKeywords, categoryKeywordTree)
    });
    onFilteredRecipesChange(filtered);
  }, [
    recipes,
    sortType,
    matchRange,
    maxLack,
    appliedExpiryIngredients,
    myIngredients,
    expiryIngredientMode,
    includeKeyword,
    includeIngredients,
    excludeIngredients,
    selectedCategoryKeywords,
    categoryKeywordTree
  ]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, width: '100%', marginTop: 24, flexWrap: 'wrap' }}>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }}
          onClick={() => setMatchRateModalOpen(true)}
          aria-label="재료 매칭도 설정 모달 열기"
        >
          재료 매칭도 설정
        </button>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }}
          onClick={() => {
            setSelectedExpiryIngredients(appliedExpiryIngredients);
            setExpiryModalOpen(true);
          }}
          aria-label="임박 재료 설정 모달 열기"
        >
          임박 재료 설정
        </button>
        <div style={{ position: 'relative', minWidth: 80 }}>
          <select aria-label="정렬 기준 선택" value={sortType} onChange={e => {
            if (e.target.value === 'expiry' && appliedExpiryIngredients.length === 0) {
              if (typeof onToast === 'function') {
                onToast('선택한 임박 재료가 없습니다.\n임박 재료 설정 버튼에서\n임박재료를 설정해주세요.');
              }
              return;
            }
            setSortType(e.target.value);
          }} style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 22px 0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 80, marginRight: 0, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
            <option value="latest">최신순</option>
            <option value="like">좋아요순</option>
            <option value="comment">댓글순</option>
            <option value="match">재료매칭률순</option>
            <option value="expiry">임박재료활용순</option>
          </select>
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 13, color: '#888' }}>▼</span>
        </div>
        <button
          style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 999, fontSize: 12, padding: '0 12px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 50, whiteSpace: 'nowrap', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto' }}
          onClick={() => setFilterModalOpen(true)}
          aria-label="필터 모달 열기"
        >
          <span style={{ fontWeight: 600 }}>필터</span>
        </button>
      </div>
      {/* 매칭률 설정 모달 */}
      {isMatchRateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => setMatchRateModalOpen(false)} aria-label="매칭률 모달 닫기" role="button">×</span>
            <div className="text-center font-bold text-[14px] mb-4">재료 매칭도 설정</div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="number"
                  min={0}
                  max={matchRange[1]}
                  value={tempMatchRangeMin !== null ? tempMatchRangeMin : matchRange[0]}
                  onFocus={e => setTempMatchRangeMin('')}
                  onChange={e => setTempMatchRangeMin(e.target.value)}
                  onBlur={e => {
                    if (e.target.value === '' || isNaN(Number(e.target.value))) {
                      setTempMatchRangeMin(null);
                    } else {
                      let val = Math.min(Math.max(0, Number(e.target.value)), matchRange[1]);
                      setMatchRange([val, matchRange[1]]);
                      setTempMatchRangeMin(null);
                    }
                  }}
                  className="w-16 h-10 border rounded text-center text-lg"
                />
                <span className="text-sm">%</span>
                <span className="mx-2 text-sm">~</span>
                <input
                  type="number"
                  min={matchRange[0]}
                  max={100}
                  value={tempMatchRangeMax !== null ? tempMatchRangeMax : matchRange[1]}
                  onFocus={e => setTempMatchRangeMax('')}
                  onChange={e => setTempMatchRangeMax(e.target.value)}
                  onBlur={e => {
                    if (e.target.value === '' || isNaN(Number(e.target.value))) {
                      setTempMatchRangeMax(null);
                    } else {
                      let val = Math.max(Math.min(100, Number(e.target.value)), matchRange[0]);
                      setMatchRange([matchRange[0], val]);
                      setTempMatchRangeMax(null);
                    }
                  }}
                  className="w-16 h-10 border rounded text-center text-lg"
                />
                <span className="text-sm">%</span>
              </div>
              {/* 범위 슬라이더 */}
              <div className="flex items-center gap-2 px-2">
                {React.createElement(Slider as unknown as React.FC<any>, {
                  range: true,
                  min: 0,
                  max: 100,
                  value: matchRange,
                  onChange: (val: any) => Array.isArray(val) && setMatchRange([val[0], val[1]]),
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
              {/* 재료 부족 갯수 라디오 버튼 */}
              <div className="flex flex-wrap gap-2 mt-2 text-xs justify-center">
                {[1,2,3,4].map(n => (
                  <label key={n} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="maxLack" checked={maxLack === n} onChange={() => setMaxLack(n)} />
                    최대 {n}개 부족
                  </label>
                ))}
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="maxLack" checked={maxLack === 5} onChange={() => setMaxLack(5)} />
                  5개 이상 부족
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="maxLack" checked={maxLack === 'unlimited'} onChange={() => setMaxLack('unlimited')} />
                  제한 없음
                </label>
              </div>
              <button
                className="w-full bg-[#3c3c3c] text-white font-bold py-3 rounded-lg mt-2 text-base"
                onClick={() => {
                  if (matchRange[0] > matchRange[1]) {
                    if (typeof onToast === 'function') {
                      onToast('올바른 범위를 입력해주세요');
                    }
                    return;
                  }
                  setMatchRateModalOpen(false);
                }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 임박 재료 설정 모달 */}
      {isExpiryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
            <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer" onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(false);
            }} aria-label="임박 재료 모달 닫기" role="button">×</span>
            <div className="text-center font-bold text-[14px] mb-4">임박 재료 설정</div>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 mb-2">
                <button
                  className={`flex-1 py-2 text-sm font-medium border rounded-lg ${
                    expirySortType === 'expiry'
                      ? 'bg-gray-200 border-2 border-[#222]'
                      : 'bg-white border border-gray-300'
                  }`}
                  style={expirySortType === 'expiry' ? { borderWidth: 2, borderColor: '#222' } : {}}
                  onClick={() => setExpirySortType('expiry')}
                >
                  유통기한 임박순
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium border rounded-lg ${
                    expirySortType === 'purchase'
                      ? 'bg-gray-200 border-2 border-[#222]'
                      : 'bg-white border border-gray-300'
                  }`}
                  style={expirySortType === 'purchase' ? { borderWidth: 2, borderColor: '#222' } : {}}
                  onClick={() => setExpirySortType('purchase')}
                >
                  구매일 오래된순
                </button>
              </div>
              {/* AND/OR 선택 */}
              <div className="flex gap-3 items-center mb-2 justify-center">
                <label className="flex items-center gap-1 text-[13px]">
                  <input type="radio" name="expiryIngredientMode" value="and" checked={expiryIngredientMode==='and'} onChange={()=>setExpiryIngredientMode('and')} />
                  모두 포함(AND)
                </label>
                <label className="flex items-center gap-1 text-[13px]">
                  <input type="radio" name="expiryIngredientMode" value="or" checked={expiryIngredientMode==='or'} onChange={()=>setExpiryIngredientMode('or')} />
                  하나라도 포함(OR)
                </label>
              </div>
              {/* 선택된 재료 pill 나열 - 항상 보이게, 중앙정렬 */}
              <div className="flex flex-wrap gap-2 mb-2 justify-center" style={{minHeight: 28}}>
                {selectedExpiryIngredients.length > 0 ? selectedExpiryIngredients.map(name => (
                  <span
                    key={name}
                    className="px-2 py-[2px] bg-yellow-100 text-yellow-800 rounded-full text-[13px] font-medium border border-yellow-300 flex items-center"
                    style={{ lineHeight: '1.2', height: 'auto' }}
                  >
                    {name}
                    <button
                      type="button"
                      className="ml-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
                      style={{ fontSize: 14, lineHeight: 1, padding: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedExpiryIngredients(prev => prev.filter(n => n !== name));
                      }}
                      aria-label="선택 해제"
                    >
                      ×
                    </button>
                  </span>
                )) : <span className="text-gray-400 text-[13px]">재료를 선택해 주세요</span>}
              </div>
              {/* 재료 리스트 스크롤 영역 */}
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {(expirySortType === 'expiry' ? expirySortedIngredientList : purchaseSortedIngredientList).length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-6">해당 정보가 입력된 재료가 없습니다.</div>
                )}
                {(expirySortType === 'expiry' ? expirySortedIngredientList : purchaseSortedIngredientList).map(item => (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between p-2 cursor-pointer rounded ${selectedExpiryIngredients.includes(item.name) ? 'bg-gray-200' : ''}`}
                    onClick={() => {
                      setSelectedExpiryIngredients(prev =>
                        prev.includes(item.name)
                          ? prev.filter(n => n !== item.name)
                          : [...prev, item.name]
                      );
                    }}
                  >
                    <span className="flex items-center text-sm">
                      {selectedExpiryIngredients.includes(item.name) && (
                        <span className="mr-2 text-green-600 font-bold">✔</span>
                      )}
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto" style={{ minWidth: 60, textAlign: 'right' }}>
                      {expirySortType === 'expiry' ? getDDay(item.expiry) : (item.purchase || '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg mt-2"
              onClick={() => {
                setAppliedExpiryIngredients(selectedExpiryIngredients);
                setExpiryModalOpen(false);
              }}
            >
              적용
            </button>
          </div>
        </div>
      )}
      {/* 필터 모달 */}
      {isFilterModalOpen && (
        <FilterModal
          open={isFilterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          filterState={selectedCategoryKeywords}
          setFilterState={setSelectedCategoryKeywords}
          includeIngredients={includeIngredients}
          setIncludeIngredients={setIncludeIngredients}
          excludeIngredients={excludeIngredients}
          setExcludeIngredients={setExcludeIngredients}
          includeInput={includeInput}
          setIncludeInput={setIncludeInput}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          allIngredients={allIngredients}
          includeKeyword={includeKeyword}
          setIncludeKeyword={setIncludeKeyword}
          onApply={applyFilter}
          filterKeywordTree={categoryKeywordTree}
          setFilterKeywordTree={setCategoryKeywordTree}
        />
      )}
    </>
  );
};

export default RecipeSortBar; 
