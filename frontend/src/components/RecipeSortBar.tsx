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

import React, { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from 'react';
import CloseButton from './ui/CloseButton';
import Portal from './Portal';
import RecipeCard from './RecipeCard';
import FilterModal from './FilterModal';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Recipe } from '../types/recipe';
import { filterRecipes } from '../utils/recipeFilters';
import { getDictCategoryKey, getDDay, FilterKeywordTree, FilterKeywordNode, calculateMatchRate } from '../utils/recipeUtils';
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
    height: 40,
    border: '1px solid #D2D2D8',
    borderRadius: 6,
    fontSize: 13,
    padding: '0 8px',
    fontWeight: 600,
    background: '#FFFFFF',
    color: '#1A1A1E',
    minWidth: 70,
    marginRight: 0,
    whiteSpace: 'nowrap' as const,
    lineHeight: '28px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    // 아이콘(inline svg)과 글자가 그냥 인라인으로 흐르면, 좁은 화면·큰 글꼴
    // 설정에서 줄바꿈 여지가 생겨 버튼이 두 줄로 부풀어 보이는 문제가 있었다.
    // flex 로 한 줄에 고정한다.
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0
  },
  selectContainer: {
    position: 'relative' as const,
    minWidth: 100,
    overflow: 'visible' as const,
    zIndex: 10
  },
  select: {
    height: 40,
    border: '1px solid #D2D2D8',
    borderRadius: 6,
    fontSize: 13,
    padding: '0 22px 0 8px',
    fontWeight: 600,
    background: '#FFFFFF',
    color: '#1A1A1E',
    minWidth: 80,
    marginRight: 0,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    overflow: 'visible' as const
  },
  selectArrow: {
    position: 'absolute' as const,
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none' as const,
    fontSize: 15,
    color: '#9A9AA2',
    marginLeft: 'auto'
  },
  filterButton: {
    height: 40,
    border: 'none',
    borderRadius: 999,
    fontSize: 13,
    padding: '0 14px',
    fontWeight: 700,
    background: '#1A1A1E',
    color: '#FFFFFF',
    minWidth: 50,
    whiteSpace: 'nowrap' as const,
    lineHeight: '28px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    marginLeft: 'auto',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4
  },
  modal: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 'var(--z-modal)'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    color: '#9A9AA2',
    fontSize: 22,
    cursor: 'pointer',
    border: 'none',
    background: 'none'
  },
  modalTitle: {
    // 팝업 제목은 공통 규격 17px (다른 팝업과 크기가 달라 보이던 문제)
    textAlign: 'center' as const,
    fontWeight: 700,
    fontSize: 17,
    color: 'var(--ink-900)',
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
    border: '1px solid #D2D2D8',
    borderRadius: 4,
    textAlign: 'center' as const,
    fontSize: 18
  },
  sliderContainer: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: '0 8px',
    marginTop: 14
  },
  /** 팝업 상단 도움말 상자 (매칭도 팝업과 같은 규격) */
  helpBox: {
    display: 'flex' as const,
    gap: 8,
    padding: '12px 14px',
    marginBottom: 16,
    borderRadius: 10,
    background: 'var(--surface-sub)',
    fontSize: 13,
    lineHeight: 1.55,
    color: 'var(--ink-700)',
    textAlign: 'left' as const,
    wordBreak: 'keep-all' as const
  },
  /** 무엇을 정하는 칸인지 밝히는 소제목 */
  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink-700)',
    marginBottom: 10,
    textAlign: 'left' as const
  },
  /** 설정 묶음 사이의 숨 쉴 틈 */
  fieldDivider: {
    height: 1,
    background: 'var(--line-200)',
    margin: '22px 0'
  },
  chipGroup: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'flex-start' as const
  },
  radioGroup: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
    fontSize: 13,
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
    backgroundColor: 'var(--ink-900)',
    color: '#FFFFFF',
    fontWeight: 700,
    height: 48,
    borderRadius: 10,
    // 바로 위 선택지와 8px 밖에 안 떨어져 있어 붙어 보였음
    marginTop: 24,
    fontSize: 16,
    border: 'none',
    cursor: 'pointer'
  },
  modeLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 4,
    fontSize: 15
  },
  ingredientPills: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 8,
    justifyContent: 'center' as const,
    minHeight: 40
  },
  ingredientPill: {
    padding: '2px 8px',
    backgroundColor: '#FFF6C2',
    color: '#92400E',
    borderRadius: 999,
    fontSize: 15,
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
    fontSize: 15,
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
    backgroundColor: '#E6E6EA'
  },
  ingredientName: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    fontSize: 15
  },
  checkmark: {
    marginRight: 8,
    color: '#059669',
    fontWeight: 700
  },
  ingredientDate: {
    fontSize: 13,
    color: '#9A9AA2',
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
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState<boolean>(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [tempMatchRange, setTempMatchRange] = useState<[number, number]>(matchRange); // 임시 매칭도 범위
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

  // 구매일로 짐작한 기한(estimatedExpiry)도 임박 재료로 함께 본다.
  // 유통기한을 직접 넣는 사용자가 드물어서, 직접 넣은 것만 세면
  // 임박 재료 목록이 거의 항상 비어 이 기능 자체가 동작하지 않았다.
  //
  // 예전엔 이 목록과 별개로 "구매일 오래된순"(purchaseSortedIngredientList) 탭이
  // 따로 있었다. 그런데 구매일을 넣으면 그 자리에서 바로 estimatedExpiry 를 함께
  // 계산해 저장하므로(MyFridge.tsx), 구매일이 있는 재료는 결국 이 목록에도 다
  // 들어온다 — 사실상 같은 걸 두 가지 기준으로 보여주기만 했다. 탭을 없애고
  // 이 하나로 통합한다.
  const expirySortedIngredientList = useMemo(() =>
    myFridgeIngredientList
      .filter(i => i.expiry || i.estimatedExpiry)
      .sort((a, b) =>
        new Date(a.expiry || a.estimatedExpiry).getTime() -
        new Date(b.expiry || b.estimatedExpiry).getTime()),
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
      sortType, matchRange, maxLack, appliedExpiryIngredients, expiryIngredientMode
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expiryIngredientMode]);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  // recipes는 이미 maxLack 필터가 적용된 상태이므로 그대로 전달
  // (maxLack 필터는 RecipeList에서 cachedFilteredRecipes에 적용됨)
  // useLayoutEffect: 부모가 recipes를 갱신한 직후 동일 프레임에 filteredRecipes를 맞춤 (옛 목록 잔상 방지)
  useLayoutEffect(() => {
    if (!recipes || recipes.length === 0) {
      onFilteredRecipesChange([]);
      return;
    }

    onFilteredRecipesChange([...recipes]);
  }, [recipes, onFilteredRecipesChange]);

  return (
    <>
      <div style={STYLES.container}>
        <div style={STYLES.buttonGroup}>
          <button
            style={STYLES.button}
            onClick={() => {
              setTempMatchRange(matchRange); // 모달 열 때 현재 값을 임시 상태로 복사
              setMatchRateModalOpen(true);
            }}
            aria-label="재료 매칭도 설정 모달 열기"
            data-guide-target="match-rate-button"
          >
            <span aria-hidden="true" style={{ marginRight: 4 }}>%</span>
            매칭도
          </button>
          <button
            style={STYLES.button}
            onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(true);
            }}
            aria-label="임박 재료 설정 모달 열기"
            data-guide-target="expiry-button"
          >
            {/* 이모지(⏱)는 알록달록해서 검정 테두리로 통일된 다른 아이콘들 사이에서
                혼자 튀어 보였다. 같은 톤의 선 아이콘(시계)으로 교체 */}
            <svg
              aria-hidden="true"
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginRight: 4, verticalAlign: -2 }}
            >
              <circle cx="12" cy="13" r="8" stroke="#1A1A1E" strokeWidth="1.8" />
              <path d="M12 9v4l3 2" stroke="#1A1A1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 2h6" stroke="#1A1A1E" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            임박 재료
          </button>
          <div style={{
            ...STYLES.selectContainer,
            zIndex: (isExpiryModalOpen || isMatchRateModalOpen || isFilterModalOpen) ? 1 : 10
          }} ref={sortDropdownRef}>
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              style={{ ...STYLES.select, position: 'relative', textAlign: 'left' }}
              data-guide-target="sort-dropdown"
            >
              <span>{sortType === 'latest' ? '최신순' :
               sortType === 'like' ? '좋아요순' :
               sortType === 'comment' ? '댓글순' :
               sortType === 'hits' ? '조회수순' :
               sortType === 'match' ? '재료매칭률순' :
               sortType === 'expiry' ? '임박재료활용순' : '재료매칭률순'}</span>
              <span style={STYLES.selectArrow}>∨</span>
            </button>
            {isSortDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D2D2D8',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: (isExpiryModalOpen || isMatchRateModalOpen || isFilterModalOpen) ? 1 : 20,
                overflow: 'visible',
                minWidth: '130px'
              }}>
                {[
                  { value: 'latest', label: '최신순' },
                  { value: 'like', label: '좋아요순' },
                  { value: 'comment', label: '댓글순' },
                  { value: 'hits', label: '조회수순' },
                  { value: 'match', label: '재료매칭률순' },
                  { value: 'expiry', label: '임박재료활용순' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (option.value === 'expiry' && appliedExpiryIngredients.length === 0) {
                        if (typeof onToast === 'function') {
                          onToast('선택한 임박 재료가 없습니다.\n임박 재료 설정 버튼에서\n임박재료를 설정해주세요.');
                        }
                        setIsSortDropdownOpen(false);
                        return;
                      }
                      setSortType(option.value);
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: sortType === option.value ? '#2563EB' : '#1A1A1E',
                      backgroundColor: sortType === option.value ? '#EFF6FF' : '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      borderTop: option.value !== 'latest' ? '1px solid #F5F5F7' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    onMouseEnter={(e) => {
                      if (sortType !== option.value) {
                        e.currentTarget.style.backgroundColor = '#F5F5F7';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (sortType !== option.value) {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          style={STYLES.filterButton}
          onClick={() => setFilterModalOpen(true)}
          aria-label="필터 모달 열기"
          data-guide-target="filter-button"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18M6 12h12M10 19h4" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          필터
        </button>
      </div>
      {/* 매칭률 설정 모달 */}
      {isMatchRateModalOpen && (
        <Portal>
        <div style={STYLES.modal}>
          <div style={STYLES.modalContent}>
            <CloseButton onClick={() => {
              // 모달 닫을 때 임시 상태를 원래 값으로 되돌림
              setTempMatchRange(matchRange);
              setTempMatchRangeMin(null);
              setTempMatchRangeMax(null);
              setMatchRateModalOpen(false);
            }} />
            <div style={STYLES.modalTitle}>재료 매칭도 설정</div>

            {/* 매칭률이 어떻게 나온 숫자인지 밝힌다.
                이 값은 앱의 핵심 지표인데 "어떻게 계산했는지" 를 어디에서도 말하지 않고 있었다.
                스플래시나 첫 방문 안내에 넣으면 정작 궁금해질 때는 이미 지나가 버리므로,
                사용자가 이 숫자를 만지러 오는 바로 이 자리에 둔다. */}
            <div style={STYLES.helpBox}>
              <span aria-hidden style={{ flexShrink: 0, fontWeight: 700, color: 'var(--ink-500)' }}>i</span>
              <span>
                <b style={{ fontWeight: 700 }}>본문에서 뽑아낸 재료</b>와 내 냉장고를 비교한 값이에요.
                글쓴이가 안 적은 재료는 빠져요.
              </span>
            </div>
            {/* 예전에는 라벨이 하나도 없어서 "30 % ~ 100 %" 두 칸이 무엇을 정하는 건지,
                아래 라디오가 무엇을 고르는 건지 알 수 없었다.
                게다가 두 묶음이 간격 0~8px 로 붙어 있어 하나의 덩어리처럼 보였다. */}
            <div style={STYLES.fieldLabel}>매칭률 범위</div>
            <div style={STYLES.inputGroup}>
              <input
                type="number"
                min={0}
                max={tempMatchRange[1]}
                value={tempMatchRangeMin !== null ? tempMatchRangeMin : tempMatchRange[0]}
                onFocus={e => setTempMatchRangeMin('')}
                onChange={e => {
                  setTempMatchRangeMin(e.target.value);
                  if (e.target.value !== '' && !isNaN(Number(e.target.value))) {
                    let val = Math.min(Math.max(0, Number(e.target.value)), tempMatchRange[1]);
                    setTempMatchRange([val, tempMatchRange[1]]);
                  }
                }}
                onBlur={e => {
                  if (e.target.value === '' || isNaN(Number(e.target.value))) {
                    setTempMatchRangeMin(null);
                  } else {
                    let val = Math.min(Math.max(0, Number(e.target.value)), tempMatchRange[1]);
                    setTempMatchRange([val, tempMatchRange[1]]);
                    setTempMatchRangeMin(null);
                  }
                }}
                style={STYLES.numberInput}
              />
              <span className="text-sm">%</span>
              <span className="mx-2 text-sm">~</span>
              <input
                type="number"
                min={tempMatchRange[0]}
                max={100}
                value={tempMatchRangeMax !== null ? tempMatchRangeMax : tempMatchRange[1]}
                onFocus={e => setTempMatchRangeMax('')}
                onChange={e => {
                  setTempMatchRangeMax(e.target.value);
                  if (e.target.value !== '' && !isNaN(Number(e.target.value))) {
                    let val = Math.max(Math.min(100, Number(e.target.value)), tempMatchRange[0]);
                    setTempMatchRange([tempMatchRange[0], val]);
                  }
                }}
                onBlur={e => {
                  if (e.target.value === '' || isNaN(Number(e.target.value))) {
                    setTempMatchRangeMax(null);
                  } else {
                    let val = Math.max(Math.min(100, Number(e.target.value)), tempMatchRange[0]);
                    setTempMatchRange([tempMatchRange[0], val]);
                    setTempMatchRangeMax(null);
                  }
                }}
                style={STYLES.numberInput}
              />
              <span className="text-sm">%</span>
            </div>
            {/* 범위 슬라이더 */}
            <div style={STYLES.sliderContainer}>
              <Slider
                range
                min={0}
                max={100}
                value={tempMatchRange}
                onChange={(val: number | number[]) => {
                  if (Array.isArray(val)) {
                    setTempMatchRange([val[0], val[1]]);
                    setTempMatchRangeMin(null);
                    setTempMatchRangeMax(null);
                  }
                }}
                allowCross={false}
                trackStyle={[{ backgroundColor: '#3A3A42' }]}
                handleStyle={[
                  { borderColor: '#3A3A42', backgroundColor: '#FFFFFF' },
                  { borderColor: '#3A3A42', backgroundColor: '#FFFFFF' }
                ]}
                railStyle={{ backgroundColor: '#E6E6EA' }}
              />
            </div>
            <div style={STYLES.fieldDivider} />

            {/* 부족 재료 개수.
                기본 라디오 버튼은 지름이 13px 남짓이라 손가락으로 정확히 누르기 어렵고,
                브라우저 기본 파란색이라 앱의 다른 컨트롤과 색이 따로 놀았다.
                앱에서 이미 쓰는 칩 토글로 바꾼다. */}
            <div style={STYLES.fieldLabel}>부족해도 되는 재료</div>
            <div style={STYLES.chipGroup}>
              {([1, 2, 3, 4, 5, 'unlimited'] as const).map(n => {
                const on = maxLack === n;
                return (
                  <button
                    key={String(n)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMaxLack(n as any)}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      boxSizing: 'border-box',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: on ? 700 : 500,
                      cursor: 'pointer',
                      background: on ? 'var(--ink-900)' : 'var(--surface)',
                      color: on ? '#FFFFFF' : 'var(--ink-700)',
                      border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
                    }}
                  >
                    {n === 'unlimited' ? '제한 없음' : `${n}개까지`}
                  </button>
                );
              })}
            </div>
            <button
              style={STYLES.applyButton}
              onClick={() => {
                if (tempMatchRange[0] > tempMatchRange[1]) {
                  if (typeof onToast === 'function') {
                    onToast('올바른 범위를 입력해주세요');
                  }
                  return;
                }
                // '적용' 버튼을 눌렀을 때만 실제 matchRange 상태 업데이트
                setMatchRange(tempMatchRange);
                setMatchRateModalOpen(false);
                setTempMatchRangeMin(null);
                setTempMatchRangeMax(null);
              }}
            >
              적용
            </button>
          </div>
        </div>
        </Portal>
      )}
      {/* 임박 재료 설정 모달 */}
      {isExpiryModalOpen && (
        <Portal>
        <div style={STYLES.modal}>
          <div style={STYLES.modalContent}>
            <CloseButton onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(false);
            }} />
            <div style={STYLES.modalTitle}>임박 재료 설정</div>

            {/* 이 목록에 "직접 넣지도 않은 유통기한" 이 왜 떠 있는지 밝힌다.
                구매일만 넣어 둔 재료도 추정 기한으로 이 목록에 들어오기 때문에,
                설명이 없으면 "내가 언제 이걸 입력했지?" 가 된다. */}
            <div style={STYLES.helpBox}>
              <span aria-hidden style={{ flexShrink: 0, fontWeight: 700, color: 'var(--ink-500)' }}>i</span>
              <span>
                <b style={{ fontWeight: 700 }}>구매일만 넣은 재료</b>도 기한을 짐작해 함께 세요.
                짐작한 값은 <b style={{ fontWeight: 700 }}>약 D-00</b>.
              </span>
            </div>

            {/* 선택한 재료를 어떻게 묶을지.
                기본 라디오 버튼은 13px 남짓이라 누르기 어렵고 브라우저 기본 파란색이라
                앱의 다른 컨트롤과 색이 따로 놀았음 → 매칭도 팝업과 같은 칩 토글로 통일 */}
            <div style={STYLES.fieldLabel}>선택한 재료를</div>
            <div style={{ ...STYLES.chipGroup, marginBottom: 18 }}>
              {([
                { key: 'and', label: '모두 포함' },
                { key: 'or', label: '하나라도 포함' },
              ] as const).map(({ key, label }) => {
                const on = expiryIngredientMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setExpiryIngredientMode(key)}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      boxSizing: 'border-box',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: on ? 700 : 500,
                      cursor: 'pointer',
                      background: on ? 'var(--ink-900)' : 'var(--surface)',
                      color: on ? '#FFFFFF' : 'var(--ink-700)',
                      border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
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
              )) : <span style={{color: '#9A9AA2', fontSize: 15}}>재료를 선택해 주세요</span>}
            </div>
            {/* 재료 리스트 스크롤 영역 */}
            <div style={STYLES.ingredientList}>
              {expirySortedIngredientList.length === 0 && (
                <div style={{...STYLES.ingredientItem, color: '#9A9AA2', fontSize: 13, textAlign: 'center', padding: 24}}>해당 정보가 입력된 재료가 없습니다.</div>
              )}
              {expirySortedIngredientList.map(item => (
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
                    {(() => {
                      const raw = item.expiry || item.estimatedExpiry || '';
                      const dday = getDDay(raw);
                      const estimated = !item.expiry;
                      if (dday.startsWith('D+')) return estimated ? '약 지남' : '지남';
                      return estimated ? `약 ${dday}` : dday;
                    })()}
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
        </Portal>
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
