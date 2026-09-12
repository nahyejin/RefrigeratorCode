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
import { useNavigate } from 'react-router-dom';
import { fetchCsvOnce } from '../utils/csvOnce';
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
  /**
   * 안내 토스트. 두 번째 인자로 **토스트에서 바로 누를 행동**을 줄 수 있다.
   * "설정이 없어서 못 한다" 고 알리기만 하면 사용자가 그 설정을 스스로
   * 찾아가야 하므로, 알림과 해결을 한 자리에 둔다.
   */
  onToast?: (msg: string, action?: { label: string; onClick: () => void }) => void;
}

// 스타일 상수
const STYLES = {
  container: {
    display: 'flex' as const,
    // 왼쪽 묶음이 두 줄이 되면 「필터」가 두 줄 **사이**에 붕 떠 보였다.
    // 위로 붙여 첫 줄과 나란히 놓는다 — 필터의 자리는 늘 오른쪽 위다.
    alignItems: 'flex-start' as const,
    gap: 6,
    marginBottom: 18,
    width: '100%',
    marginTop: 24,
    // 「필터」는 늘 오른쪽 위 제자리에 있어야 찾을 수 있다. 줄바꿈은 왼쪽
    // 묶음 안에서만 일어나게 두고(아래 `buttonGroup`), 이 줄 자체는 안 접는다.
    flexWrap: 'nowrap' as const,
  },
  /**
   * 세 버튼(매칭도·임박 재료·정렬)은 조건이 붙으면 배지만큼 넓어진다.
   * 매칭도에 구간과 「부족 N개」가 둘 다 걸리면 한 줄에 다 못 들어가서,
   * **줄 자체가 둘로 접혔다** — 정렬 드롭다운이 다음 줄로 밀려 내려가고,
   * 필터를 걸 때마다 화면이 위아래로 출렁였다("버튼이 줄바꿈 되어버린다"
   * 는 실사용 보고, 2026-09-12).
   *
   * 그래서 **줄바꿈 자체를 없앤다**(`nowrap`). 대신 매칭도·임박 재료는
   * 배지가 붙어도 항상 제 내용만큼의 너비를 그대로 갖고(`flexShrink: 0`),
   * 남는 자리를 정렬 드롭다운이 갖되 모자라면 **정렬 쪽만 줄어들며 말줄임표로
   * 접는다**(아래 `selectContainer`/`select`). 필터는 이 묶음 밖에서
   * `marginLeft: auto` 로 늘 오른쪽 위 제자리에 있다.
   */
  buttonGroup: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 5,
    flexWrap: 'nowrap' as const,
    flex: '1 1 auto' as const,
    minWidth: 0,
  },
  button: {
    // height 가 아니라 minHeight — 안드로이드 글자 크기를 키운 사용자는
    // 여기 fontSize 13 보다 실제 글자가 커진다. 고정 height 면 잘린다.
    // `whiteSpace: nowrap` 은 그대로 둔다 — 바로 아래 주석대로, 글자가
    // 커지면 줄바꿈 대신 버튼이 옆으로 넓어지게 하려는 의도된 선택이다
    // (`minWidth` 만 있고 `width` 고정은 없어서 넓어질 수 있다). 부모
    // `buttonGroup` 이 `flexWrap: wrap` 이라 한 줄이 다 차면 행 자체가
    // 다음 줄로 넘어간다.
    //
    // 패딩은 **가로만** 준다(세로 없음). 매칭도 버튼은 배지(부족 개수 등)가
    // 붙으면 라벨 밑에 한 줄이 더 생기는데, 세로 패딩을 더했더니 그 버튼만
    // 40px 를 넘어 커져서 임박 재료·정렬·필터 버튼과 높이가 달라져 줄이
    // 들쭉날쭉해 보였다("버튼들이 다 따로 논다" — 실사용 보고). 라벨만 있을
    // 때도 배지가 있을 때도 세로 방향 여유(32~34px)가 이미 minHeight(40px)
    // 안에 들어오므로, 세로 패딩 없이 `alignItems: center` 만으로 가운데
    // 정렬하면 항상 정확히 40px 로 맞는다.
    minHeight: 40,
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
    lineHeight: 1.3,
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
    // 매칭도·임박 재료는 배지가 붙어도 제 너비를 그대로 지키므로(`flexShrink: 0`),
    // 한 줄에 다 넣으려면(2026-09-12, 위 `buttonGroup` 설명 참고) 정렬 칸이
    // 남는 자리만큼만 갖고 모자라면 줄어들어야 한다 — `flex: 1` 로 남는 공간을
    // 갖되, `minWidth` 를 낮게 둬 진짜 좁을 때는 이 칸부터 양보한다.
    flex: '1 1 auto' as const,
    minWidth: 56,
    // `visible` 이어야 한다 — 펼친 목록(아래 `isSortDropdownOpen` 블록)이
    // 이 칸을 기준으로 `top:100%` 절대 위치로 붙는데, 여기를 `hidden` 으로
    // 두면 목록이 이 칸의 세로 경계 밖으로 나가는 순간 그대로 잘려 안 보인다
    // (버튼 클릭은 되는데 목록이 안 뜨는 것처럼 보였다 — 실사용 보고).
    // 말줄임표 처리는 `select`/`selectLabel` 쪽 `overflow: hidden` 만으로 충분하다.
    overflow: 'visible' as const,
    zIndex: 10
  },
  select: {
    // `button` 과 같은 이유로 세로 패딩은 안 준다 — 매칭도/임박 재료와
    // 같은 줄에서 높이가 달라 보이지 않게.
    minHeight: 40,
    border: '1px solid #D2D2D8',
    borderRadius: 6,
    fontSize: 13,
    padding: '0 20px 0 8px',
    fontWeight: 600,
    background: '#FFFFFF',
    color: '#1A1A1E',
    width: '100%',
    minWidth: 0,
    marginRight: 0,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    display: 'flex' as const,
    alignItems: 'center' as const
  },
  /** 정렬 라벨 — 칸이 좁아지면 줄바꿈 대신 말줄임표로 접는다. */
  selectLabel: {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    minWidth: 0,
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
  /**
   * 버튼 밑에 붙는 조건 요약.
   *
   * 처음엔 회색 잔글씨였는데, 「매칭도 / 20~80%」 처럼 라벨 밑에 글씨가
   * 한 줄 더 있으니 **그것도 버튼 이름의 일부**로 읽혔다. 설정해 둔 값인지
   * 원래 그렇게 쓰여 있는 건지 구분이 안 된다.
   *
   * 필터 버튼은 이미 노란 배지 안에 숫자를 넣어 「내가 걸어 둔 것」 임을
   * 말하고 있었다. 같은 말을 두 가지 방식으로 할 이유가 없어, 여기도 같은
   * 배지로 통일한다. 자리는 그대로 버튼 안 하단.
   */
  buttonNote: {
    display: 'inline-block',
    height: 15,
    padding: '0 6px',
    borderRadius: 9999,
    background: '#FFD600',
    color: '#1A1A1E',
    fontSize: 10,
    fontWeight: 800 as const,
    lineHeight: '15px',
    letterSpacing: '-0.2px',
    marginTop: 2,
    whiteSpace: 'nowrap' as const,
  },
  filterButton: {
    flexShrink: 0 as const,
    // 세로 패딩 없음 — 매칭도/임박 재료/정렬과 같은 높이(40px)로 맞추려는
    // 이유는 위 `button` 항목 설명과 같다.
    minHeight: 40,
    border: 'none',
    borderRadius: 999,
    fontSize: 13,
    padding: '0 14px',
    fontWeight: 700,
    background: '#1A1A1E',
    color: '#FFFFFF',
    minWidth: 50,
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.3,
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
    minHeight: 40,
    padding: '8px 4px',
    boxSizing: 'border-box' as const,
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
    minHeight: 48,
    padding: '14px 20px',
    boxSizing: 'border-box' as const,
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
      const csv = await fetchCsvOnce('/ingredient_profile_dict_with_substitutes.csv');
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

/**
 * 「임박재료활용순」을 고를 때 아무것도 안 골라 뒀으면 기한이 가까운 것부터
 * 이만큼을 알아서 쓴다.
 *
 * 전부 쓰면 안 된다. 이 정렬은 "레시피가 임박 재료를 몇 개나 쓰나" 로 줄을
 * 세우는데, 냉장고에 든 것을 통째로 넣으면 그 값이 사실상 매칭률과 같아져
 * **임박순이라는 말이 무의미해진다.** 반대로 너무 적으면 그 재료가 든 레시피
 * 몇 개만 위로 올라오고 나머지는 순서가 없다.
 */
const AUTO_EXPIRY_COUNT = 5;

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
  // 기한을 넣어 둔 재료가 하나도 없을 때 내냉장고로 보내 주려고 쓴다.
  const navigate = useNavigate();
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
  /**
   * **팝업을 열지 않아도 지금 뭐가 걸려 있는지 보이게** 한다.
   *
   * 세 버튼(매칭도·임박 재료·필터)은 눌러서 팝업을 띄워야만 현재 조건을 알 수
   * 있었다. 목록이 왜 이만큼만 나오는지 모른 채 "결과가 없네" 하고 넘어가게 된다.
   *
   * 숫자로 셀 수 있는 것은 개수를, 매칭도처럼 범위인 것은 값 자체를 버튼 밑에
   * 작게 적는다. 걸린 게 없으면 아무것도 안 적는다 — 늘 뭔가 쓰여 있으면
   * 그게 다시 배경이 된다.
   */
  const matchSummaryParts = useMemo(() => {
    const parts: string[] = [];
    const [lo, hi] = matchRange || [0, 100];
    if (lo > 0 || hi < 100) parts.push(hi >= 100 ? `${lo}%↑` : `${lo}~${hi}%`);
    if (maxLack !== 'unlimited') parts.push(`부족 ${maxLack}개`);
    return parts;
  }, [matchRange, maxLack]);

  /** 읽어 주는 기계용(aria) — 화면에는 위 배열을 배지로 그린다. */
  const matchSummary = useMemo(() => matchSummaryParts.join(' · '), [matchSummaryParts]);

  /** 필터 팝업이 잡고 있는 조건이 몇 개나 켜져 있나. */
  const filterCount = useMemo(() => {
    let n = 0;
    if ((includeKeyword || '').trim()) n += 1;
    n += (includeIngredients || []).length;
    n += (excludeIngredients || []).length;
    // 채널은 여러 개를 고를 수 있다. 하나라도 골랐으면 조건 하나로 센다 —
    // "네이버·유튜브 둘 다" 를 조건 두 개로 세면 실제보다 부풀어 보인다.
    if ((selectedChannel || []).length) n += 1;
    Object.values(selectedCategoryKeywords || {}).forEach(v => {
      if (Array.isArray(v)) n += v.length;
    });
    return n;
  }, [includeKeyword, includeIngredients, excludeIngredients, selectedChannel,
      selectedCategoryKeywords]);

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
            aria-label={`재료 매칭도 설정 모달 열기${matchSummary ? ` (지금: ${matchSummary})` : ''}`}
            data-guide-target="match-rate-button"
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                           lineHeight: 1.05 }}>
              <span>
                <span aria-hidden="true" style={{ marginRight: 4 }}>%</span>
                매칭도
              </span>
              {matchSummaryParts.length > 0 && (
                <span style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {matchSummaryParts.map(part => (
                    <span key={part} style={{ ...STYLES.buttonNote, marginTop: 0 }}>{part}</span>
                  ))}
                </span>
              )}
            </span>
          </button>
          <button
            style={STYLES.button}
            onClick={() => {
              setSelectedExpiryIngredients(appliedExpiryIngredients);
              setExpiryModalOpen(true);
            }}
            aria-label={`임박 재료 설정 모달 열기${
              appliedExpiryIngredients.length ? ` (지금 ${appliedExpiryIngredients.length}개)` : ''}`}
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
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                           lineHeight: 1.05 }}>
              <span>임박 재료</span>
              {appliedExpiryIngredients.length > 0 && (
                <span style={STYLES.buttonNote}>{appliedExpiryIngredients.length}개</span>
              )}
            </span>
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
              {/* "재료매칭률순"은 너무 길어서 "재료매칭순"으로 줄임(실사용
                  지적) — 매칭도 버튼에 배지가 둘 다 붙으면(범위 + 부족 개수)
                  이 칸이 가장 먼저 좁아지는데(`selectContainer` 참고), 짧아진
                  지금도 그 극단적인 경우엔 말줄임표로 더 접힐 수 있다. */}
              <span style={STYLES.selectLabel}>{sortType === 'latest' ? '최신순' :
               sortType === 'like' ? '좋아요순' :
               sortType === 'comment' ? '댓글순' :
               sortType === 'hits' ? '조회순' :
               sortType === 'match' ? '재료매칭순' :
               sortType === 'expiry' ? '임박순' : '재료매칭순'}</span>
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
                  { value: 'match', label: '재료매칭순' },
                  // 「임박재료활용순」은 버튼 안에서 두 줄로 감겨 정렬 칸만
                  // 혼자 높아졌다. 옆의 「임박 재료」 버튼이 무엇을 뜻하는지
                  // 이미 말해 주므로 짧은 쪽으로 충분하다.
                  { value: 'expiry', label: '임박순' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (option.value === 'expiry' && appliedExpiryIngredients.length === 0) {
                        // **고르지 않았어도 정렬은 된다.**
                        //
                        // 예전에는 여기서 막고 "임박 재료 설정 버튼에서 골라
                        // 오세요" 라고 했다. 그런데 **그건 원래 안 해도 되는
                        // 일이다** — 기한을 넣어 뒀다면 무엇이 임박했는지는
                        // 이미 안다(`expirySortedIngredientList` 가 기한순이다).
                        // 그 팝업이 진짜로 하는 일은 "임박한 것 중 이번엔 이것만
                        // 볼래" 라고 **좁히는** 것이라, 매칭도 슬라이더와 같은
                        // 선택 사항이지 관문이 아니다.
                        //
                        // 정말로 사용자가 뭘 해 줘야 하는 경우는 하나뿐이다 —
                        // 기한을 넣은 재료가 아예 없을 때.
                        if (expirySortedIngredientList.length === 0) {
                          // 왜 안 되는지만 말한다. **무엇을 해야 하는지는
                          // 버튼이 말한다** — 토스트에 두 문장을 넣었더니
                          // 네 줄이 됐다.
                          if (typeof onToast === 'function') {
                            onToast('유통기한·구매일을 넣은 재료가 없어요.', {
                              label: '기한 넣기',
                              onClick: () => navigate('/my-fridge'),
                            });
                          }
                          setIsSortDropdownOpen(false);
                          return;
                        }

                        // 기한이 가까운 것부터 몇 개만 쓴다.
                        //
                        // 전부 쓰면 안 된다. 이 정렬은 "레시피가 임박 재료를 몇
                        // 개나 쓰나" 로 줄을 세우는데, 냉장고에 든 것을 통째로
                        // 넣으면 그 값이 사실상 매칭률과 같아져 **임박순이라는
                        // 말이 무의미해진다.**
                        const auto = expirySortedIngredientList
                          .slice(0, AUTO_EXPIRY_COUNT)
                          .map(i => i.name);
                        setAppliedExpiryIngredients(auto);
                        setSelectedExpiryIngredients(auto);
                        setSortType('expiry');
                        setIsSortDropdownOpen(false);
                        // **무엇으로 정렬했는지 밝힌다.** 알아서 골라 주는 것과
                        // 몰래 골라 주는 것은 다르다. 다르게 보고 싶으면 그
                        // 자리에서 바로 좁힐 수 있다.
                        if (typeof onToast === 'function') {
                          onToast(`기한이 가까운 재료 ${auto.length}개로 정렬했어요.`, {
                            label: '바꾸기',
                            onClick: () => setExpiryModalOpen(true),
                          });
                        }
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
          aria-label={`필터 모달 열기${filterCount ? ` (조건 ${filterCount}개)` : ''}`}
          data-guide-target="filter-button"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18M6 12h12M10 19h4" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          필터
          {/* 어두운 알약이라 밑에 작은 글씨를 붙이면 안 읽힌다. 숫자를 옆에
              배지로 붙인다 — 몇 개가 걸려 있는지만 알면 된다. */}
          {filterCount > 0 && (
            <span
              style={{
                minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9999,
                background: '#FFD600', color: '#1A1A1E',
                fontSize: 10.5, fontWeight: 800, lineHeight: '17px',
                textAlign: 'center', boxSizing: 'border-box',
              }}
            >
              {filterCount}
            </span>
          )}
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
                      minHeight: 38,
                      padding: '9px 14px',
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
                      minHeight: 38,
                      padding: '9px 14px',
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
