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
 * - getDDay: 재료 유통기한 D-day 계산
 * - filterRecipes: 전체 레시피 필터링 및 정렬
 * - getDictCategoryKey: 카테고리명 트리 key 변환
 *
 * 사용법:
 * <RecipeSortBar
 *   recipes={recipes}
 *   myIngredients={myIngredients}
 *   ...기타 필터/정렬 상태 props
 * />
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import RecipeCard from './RecipeCard';
import FilterModal from './FilterModal';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Recipe } from '../types/recipe';
import { filterRecipes } from '../utils/recipeFilters';
import { getDictCategoryKey, getDDay, FilterKeywordTree, FilterKeywordNode } from '../utils/recipeUtils';
import { FilterState } from './FilterModal';

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
 * RecipeSortBar 컴포넌트 Props 타입
 */
interface RecipeSortBarProps {
  recipes: Recipe[];
  myIngredients: string[];
  onFilteredRecipesChange: (filtered: Recipe[]) => void;
  onLoadMoreDataForFiltering?: () => Promise<void>;
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
  selectedChannel: string[];
  setSelectedChannel: (channels: string[]) => void;
  includeKeyword: string;
  setIncludeKeyword: (v: string) => void;
  includeIngredients: string[];
  setIncludeIngredients: (v: string[]) => void;
  excludeIngredients: string[];
  setExcludeIngredients: (v: string[]) => void;
  selectedCategoryKeywords: FilterState;
  setSelectedCategoryKeywords: (v: FilterState) => void;
  includeInput: string;
  setIncludeInput: (v: string) => void;
  excludeInput: string;
  setExcludeInput: (v: string) => void;
  onToast?: (msg: string) => void;
}

// 스타일 상수
const STYLES = {
  container: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 18,
    width: '100%',
    marginTop: 24,
    flexWrap: 'nowrap' as const
  },
  buttonGroup: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 6
  },
  button: {
    height: 28,
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    fontSize: 12,
    padding: '0 8px',
    fontWeight: 600,
    background: '#fff',
    color: '#222',
    minWidth: 70,
    marginRight: 0,
    whiteSpace: 'nowrap' as const,
    lineHeight: '28px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer'
  },
  selectContainer: {
    position: 'relative' as const,
    minWidth: 80
  },
  select: {
    height: 28,
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    fontSize: 12,
    padding: '0 22px 0 8px',
    fontWeight: 600,
    background: '#fff',
    color: '#222',
    minWidth: 80,
    marginRight: 0,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const
  },
  selectArrow: {
    position: 'absolute' as const,
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none' as const,
    fontSize: 13,
    color: '#888'
  },
  filterButton: {
    height: 28,
    border: '1px solid #D1D5DB',
    borderRadius: 999,
    fontSize: 12,
    padding: '0 12px',
    fontWeight: 600,
    background: '#fff',
    color: '#222',
    minWidth: 50,
    whiteSpace: 'nowrap' as const,
    lineHeight: '28px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    marginLeft: 'auto',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  modal: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 50
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    padding: 24,
    width: 340,
    maxWidth: '95vw',
    position: 'relative' as const
  },
  closeButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    color: '#9CA3AF',
    fontSize: 20,
    cursor: 'pointer',
    border: 'none',
    background: 'none'
  },
  modalTitle: {
    textAlign: 'center' as const,
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 16
  },
  inputGroup: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    justifyContent: 'center' as const
  },
  numberInput: {
    width: 64,
    height: 40,
    border: '1px solid #D1D5DB',
    borderRadius: 4,
    textAlign: 'center' as const,
    fontSize: 18
  },
  sliderContainer: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: '0 8px'
  },
  radioGroup: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
    fontSize: 12,
    justifyContent: 'center' as const
  },
  radioLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 4,
    cursor: 'pointer'
  },
  applyButton: {
    width: '100%',
    backgroundColor: '#3c3c3c',
    color: '#fff',
    fontWeight: 700,
    padding: '12px',
    borderRadius: 8,
    marginTop: 8,
    fontSize: 16,
    border: 'none',
    cursor: 'pointer'
  },
  tabButton: {
    flex: 1,
    padding: '8px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid #D1D5DB',
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: '#E5E7EB',
    border: '2px solid #222'
  },
  tabButtonInactive: {
    backgroundColor: '#fff',
    border: '1px solid #D1D5DB'
  },
  modeGroup: {
    display: 'flex' as const,
    gap: 12,
    alignItems: 'center' as const,
    marginBottom: 8,
    justifyContent: 'center' as const
  },
  modeLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 4,
    fontSize: 13
  },
  ingredientPills: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 8,
    justifyContent: 'center' as const,
    minHeight: 28
  },
  ingredientPill: {
    padding: '2px 8px',
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #F59E0B',
    display: 'flex' as const,
    alignItems: 'center' as const,
    lineHeight: 1.2,
    height: 'auto'
  },
  removeButton: {
    marginLeft: 4,
    color: '#B45309',
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
    width: 18,
    height: 18,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    border: 'none',
    background: 'none',
    cursor: 'pointer'
  },
  ingredientList: {
    maxHeight: 320,
    overflowY: 'auto' as const
  },
  ingredientItem: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    padding: 8,
    cursor: 'pointer',
    borderRadius: 4
  },
  ingredientItemSelected: {
    backgroundColor: '#E5E7EB'
  },
  ingredientName: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    fontSize: 14
  },
  checkmark: {
    marginRight: 8,
    color: '#059669',
    fontWeight: 700
  },
  ingredientDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 'auto',
    minWidth: 60,
    textAlign: 'right' as const
  }
};

// 유틸리티 함수들
const Utils = {
  // 재료 목록 파싱
  parseMyFridgeIngredients: () => {
    try {
      const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
      if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
        return [...data.frozen, ...data.fridge, ...data.room];
      }
    } catch {}
    return [];
  },

  // 전체 재료 목록 fetch
  fetchAllIngredients: async (): Promise<string[]> => {
    try {
      const response = await fetch('/ingredient_profile_dict_with_substitutes.csv');
      const csv = await response.text();
      const lines = csv.split('\n');
      const header = lines[0].split(',');
      const nameIdx = header.indexOf('keyword');
      if (nameIdx === -1) return [];
      
      return lines.slice(1)
        .map(line => line.split(',')[nameIdx]?.trim())
        .filter(name => !!name && name !== 'keyword');
    } catch {
      return [];
    }
  },

  // 선택된 키워드와 filterKeywordTree를 조합해 동의어까지 포함된 categoryKeywords 생성
  buildCategoryKeywords: (selected: FilterState | null, tree: FilterKeywordTree | null) => {
    const result: Record<string, { keyword: string; synonyms: string[] }[]> = {};
    if (!tree || !selected) {
      return result;
    }
    for (const main of Object.keys(selected)) {
      if (!selected[main] || selected[main].length === 0) continue;
      result[main] = [];
      for (const kw of selected[main]) {
        let found: FilterKeywordNode | null = null;
        if (tree[main]) {
          for (const sub of Object.keys(tree[main])) {
            found = (tree[main][sub] || []).find((obj: FilterKeywordNode) => obj.keyword === kw) || null;
            if (found) break;
          }
        }
        if (found) {
          result[main].push({ keyword: found.keyword, synonyms: found.synonyms });
        } else {
          result[main].push({ keyword: kw, synonyms: [] });
        }
      }
    }
    return result;
  },

  // 채널 필터링
  filterByChannel: (recipes: Recipe[], selectedChannel: string[]) => {
    if (selectedChannel.length === 0) return recipes;
    
    return recipes.filter(recipe => {
      const platform = recipe.platform || '';
      return (
        (selectedChannel.includes('youtube') && platform === 'youtube(인플루언서)')
        ||
        (selectedChannel.includes('naver') && (
          platform === 'naver(인플루언서핫토픽)' || 
          platform === 'naver(주제별보기)'
        ))
      );
    });
  }
};

const RecipeSortBar = ({ 
  recipes,
  myIngredients,
  onFilteredRecipesChange,
  onLoadMoreDataForFiltering,
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
  selectedChannel,
  setSelectedChannel,
  includeKeyword,
  setIncludeKeyword,
  includeIngredients,
  setIncludeIngredients,
  excludeIngredients,
  setExcludeIngredients,
  selectedCategoryKeywords,
  setSelectedCategoryKeywords,
  includeInput,
  setIncludeInput,
  excludeInput,
  setExcludeInput,
  onToast
}: RecipeSortBarProps) => {
  const [isFilterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
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

  const myFridgeIngredientList = useMemo(() => Utils.parseMyFridgeIngredients(), []);

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

  // 필터 적용 함수
  const applyFilter = useCallback(async (options?: any) => {
    if (options) {
      console.log('Applying filter options:', options);
      
      // 키워드 필터가 있으면 더 많은 데이터를 로드
      const hasKeywordFilter = options.selectedCategoryKeywords && 
                               options.selectedCategoryKeywords.length > 0;
      const hasOtherFilters = (options.includeKeyword && options.includeKeyword.trim()) ||
                              (options.includeIngredients && options.includeIngredients.length > 0) ||
                              (options.excludeIngredients && options.excludeIngredients.length > 0);
      
      if ((hasKeywordFilter || hasOtherFilters) && onLoadMoreDataForFiltering) {
        console.log('Loading more data for filtering...');
        await onLoadMoreDataForFiltering();
      }
      
      // 필터 옵션이 전달되면 상태 업데이트
      if (options.includeKeyword !== undefined) {
        setIncludeKeyword(options.includeKeyword);
      }
      if (options.includeIngredients !== undefined) {
        setIncludeIngredients(options.includeIngredients);
      }
      if (options.excludeIngredients !== undefined) {
        setExcludeIngredients(options.excludeIngredients);
      }
      if (options.selectedChannel !== undefined) {
        setSelectedChannel(options.selectedChannel);
      }
      if (options.selectedCategoryKeywords !== undefined) {
        console.log('[필터 적용] 카테고리 키워드 Pills:', options.selectedCategoryKeywords);
        
        // selectedCategoryKeywords를 올바른 형태로 변환
        const categoryKeywords: any = {};
        options.selectedCategoryKeywords.forEach((pill: any) => {
          console.log('[필터 적용] 개별 Pill:', pill);
          if (!categoryKeywords[pill.main]) {
            categoryKeywords[pill.main] = [];
          }
          categoryKeywords[pill.main].push(pill.keyword);
        });
        
        console.log('[필터 적용] 변환된 카테고리 키워드:', categoryKeywords);
        setSelectedCategoryKeywords(categoryKeywords as FilterState);
      }
    }
    
    setFilterModalOpen(false);
  }, [onLoadMoreDataForFiltering]);

  // 전체 재료 목록 fetch
  useEffect(() => {
    Utils.fetchAllIngredients().then(setAllIngredients);
  }, []);

  // localStorage 저장
  useEffect(() => {
    localStorage.setItem('recipe_sortbar_state_fridge', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType, expiryIngredientMode
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType, expiryIngredientMode]);

  // 필터링 및 정렬 적용
  useEffect(() => {
    if (!recipes) return;
    
    // 채널 필터링
    let filtered = Utils.filterByChannel(recipes, selectedChannel);
    
    // 기존 필터링 로직
    filtered = filterRecipes(filtered, {
      sortType,
      matchRange,
      maxLack,
      appliedExpiryIngredients,
      myIngredients,
      expiryIngredientMode,
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      categoryKeywords: Utils.buildCategoryKeywords(selectedCategoryKeywords || null, categoryKeywordTree)
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
    categoryKeywordTree,
    selectedChannel
  ]);

  return (
    <>
      <div style={STYLES.container}>
        <div style={STYLES.buttonGroup}>
          <button
            style={STYLES.button}
            onClick={() => setMatchRateModalOpen(true)}
            aria-label="재료 매칭도 설정 모달 열기"
          >
            재료 매칭도 설정
          </button>
          <button
            style={STYLES.button}
            onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(true);
            }}
            aria-label="임박 재료 설정 모달 열기"
          >
            임박 재료 설정
          </button>
          <div style={STYLES.selectContainer}>
            <select
              value={sortType}
              onChange={e => {
                if (e.target.value === 'expiry' && appliedExpiryIngredients.length === 0) {
                  if (typeof onToast === 'function') {
                    onToast('선택한 임박 재료가 없습니다.\n임박 재료 설정 버튼에서\n임박재료를 설정해주세요.');
                  }
                  return;
                }
                setSortType(e.target.value);
              }}
              style={STYLES.select}
            >
              <option value="latest">최신순</option>
              <option value="like">좋아요순</option>
              <option value="comment">댓글순</option>
              <option value="hits">조회수순</option>
              <option value="match">재료매칭률순</option>
              <option value="expiry">임박재료활용순</option>
            </select>
            <span style={STYLES.selectArrow}>▼</span>
          </div>
        </div>
        <button
          style={STYLES.filterButton}
          onClick={() => setFilterModalOpen(true)}
          aria-label="필터 모달 열기"
        >
          필터
        </button>
      </div>
      {/* 매칭률 설정 모달 */}
      {isMatchRateModalOpen && (
        <div style={STYLES.modal}>
          <div style={STYLES.modalContent}>
            <span style={STYLES.closeButton} onClick={() => setMatchRateModalOpen(false)} aria-label="매칭률 모달 닫기" role="button">×</span>
            <div style={STYLES.modalTitle}>재료 매칭도 설정</div>
            <div style={STYLES.inputGroup}>
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
                style={STYLES.numberInput}
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
                style={STYLES.numberInput}
              />
              <span className="text-sm">%</span>
            </div>
            {/* 범위 슬라이더 */}
            <div style={STYLES.sliderContainer}>
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
            <div style={STYLES.radioGroup}>
              {[1,2,3,4].map(n => (
                <label key={n} style={STYLES.radioLabel}>
                  <input type="radio" name="maxLack" checked={maxLack === n} onChange={() => setMaxLack(n)} />
                  최대 {n}개 부족
                </label>
              ))}
              <label style={STYLES.radioLabel}>
                <input type="radio" name="maxLack" checked={maxLack === 5} onChange={() => setMaxLack(5)} />
                5개 이상 부족
              </label>
              <label style={STYLES.radioLabel}>
                <input type="radio" name="maxLack" checked={maxLack === 'unlimited'} onChange={() => setMaxLack('unlimited')} />
                제한 없음
              </label>
            </div>
            <button
              style={STYLES.applyButton}
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
      )}
      {/* 임박 재료 설정 모달 */}
      {isExpiryModalOpen && (
        <div style={STYLES.modal}>
          <div style={STYLES.modalContent}>
            <span style={STYLES.closeButton} onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(false);
            }} aria-label="임박 재료 모달 닫기" role="button">×</span>
            <div style={STYLES.modalTitle}>임박 재료 설정</div>
            <div style={STYLES.modeGroup}>
              <button
                style={{
                  ...STYLES.tabButton,
                  ...(expirySortType === 'expiry' ? STYLES.tabButtonActive : STYLES.tabButtonInactive)
                }}
                onClick={() => setExpirySortType('expiry')}
              >
                유통기한 임박순
              </button>
              <button
                style={{
                  ...STYLES.tabButton,
                  ...(expirySortType === 'purchase' ? STYLES.tabButtonActive : STYLES.tabButtonInactive)
                }}
                onClick={() => setExpirySortType('purchase')}
              >
                구매일 오래된순
              </button>
            </div>
            {/* AND/OR 선택 */}
            <div style={STYLES.modeGroup}>
              <label style={STYLES.modeLabel}>
                <input type="radio" name="expiryIngredientMode" value="and" checked={expiryIngredientMode==='and'} onChange={()=>setExpiryIngredientMode('and')} />
                모두 포함(AND)
              </label>
              <label style={STYLES.modeLabel}>
                <input type="radio" name="expiryIngredientMode" value="or" checked={expiryIngredientMode==='or'} onChange={()=>setExpiryIngredientMode('or')} />
                하나라도 포함(OR)
              </label>
            </div>
            {/* 선택된 재료 pill 나열 - 항상 보이게, 중앙정렬 */}
            <div style={STYLES.ingredientPills}>
              {selectedExpiryIngredients.length > 0 ? selectedExpiryIngredients.map(name => (
                <span key={name} style={STYLES.ingredientPill}>
                  {name}
                  <button
                    type="button"
                    style={STYLES.removeButton}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedExpiryIngredients(prev => prev.filter(n => n !== name));
                    }}
                    aria-label="선택 해제"
                  >
                    ×
                  </button>
                </span>
              )) : <span style={{...STYLES.ingredientPill, color: '#9CA3AF'}}>재료를 선택해 주세요</span>}
            </div>
            {/* 재료 리스트 스크롤 영역 */}
            <div style={STYLES.ingredientList}>
              {(expirySortType === 'expiry' ? expirySortedIngredientList : purchaseSortedIngredientList).length === 0 && (
                <div style={{...STYLES.ingredientItem, color: '#9CA3AF', fontSize: 12, textAlign: 'center', padding: 24}}>해당 정보가 입력된 재료가 없습니다.</div>
              )}
              {(expirySortType === 'expiry' ? expirySortedIngredientList : purchaseSortedIngredientList).map(item => (
                <div
                  key={item.name}
                  style={{
                    ...STYLES.ingredientItem,
                    ...(selectedExpiryIngredients.includes(item.name) ? STYLES.ingredientItemSelected : {})
                  }}
                  onClick={() => {
                    setSelectedExpiryIngredients(prev =>
                      prev.includes(item.name)
                        ? prev.filter(n => n !== item.name)
                        : [...prev, item.name]
                    );
                  }}
                >
                  <span style={STYLES.ingredientName}>
                    {selectedExpiryIngredients.includes(item.name) && (
                      <span style={STYLES.checkmark}>✔</span>
                    )}
                    {item.name}
                  </span>
                  <span style={STYLES.ingredientDate}>
                    {expirySortType === 'expiry' ? getDDay(item.expiry) : (item.purchase || '')}
                  </span>
                </div>
              ))}
            </div>
            <button
              style={STYLES.applyButton}
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
          filterKeywordTree={categoryKeywordTree || {}}
          setFilterKeywordTree={setCategoryKeywordTree}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
        />
      )}
    </>
  );
};

export default RecipeSortBar; 
