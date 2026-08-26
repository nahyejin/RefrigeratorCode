import React, { useState, useEffect } from 'react';
import Sheet from './ui/Sheet';
import FilterGroup, { AndDivider } from './ui/FilterGroup';
import Button from './ui/Button';
import { getMyIngredients } from '../utils/recipeUtils';

/*
 * FilterModal Component
 *
 * 레시피 필터링을 위한 모달 컴포넌트입니다.
 * - 카테고리별 키워드/동의어 트리
 * - 포함/제외 재료, 키워드 입력
 * - 적용 버튼으로 필터 상태 반영
 *
 * 주요 props:
 * - filterState, setFilterState: 카테고리별 필터 상태
 * - includeIngredients, excludeIngredients: 포함/제외 재료
 * - includeInput, excludeInput: 입력값
 * - allIngredients: 전체 재료 목록
 * - includeKeyword: 포함 키워드
 * - onApply: 필터 적용 핸들러
 * - filterKeywordTree: 키워드 트리
 * - setFilterKeywordTree: 트리 상태 setter
 */

export type FilterState = {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
  [key: string]: string[];
};

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  filterState: FilterState;
  setFilterState: (f: FilterState) => void;
  includeIngredients: string[];
  setIncludeIngredients: (v: string[]) => void;
  excludeIngredients: string[];
  setExcludeIngredients: (v: string[]) => void;
  includeInput: string;
  setIncludeInput: (v: string) => void;
  excludeInput: string;
  setExcludeInput: (v: string) => void;
  allIngredients: string[];
  includeKeyword: string;
  setIncludeKeyword: (v: string) => void;
  onApply: (options?: any) => void;
  filterKeywordTree: Record<string, Record<string, { keyword: string, synonyms: string[] }[]>>;
  setFilterKeywordTree: (tree: Record<string, Record<string, { keyword: string, synonyms: string[] }[]>>) => void;
  selectedChannel: string[];
  setSelectedChannel: (channels: string[]) => void;
}

// CSV 라인 파싱 헬퍼 함수 (따옴표 안의 쉼표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current); // 마지막 컬럼
  
  return result;
}

// CSV 파싱 및 트리 구조 변환 함수
function parseFilterKeywordsCSV(csv: string): Record<string, Record<string, { keyword: string, synonyms: string[] }[]>> {
  const lines = csv.split('\n').filter(Boolean);
  const header = parseCSVLine(lines[0]);
  const idxMap = {
    대분류: header.indexOf('대분류'),
    중분류: header.indexOf('중분류'),
    키워드: header.indexOf('키워드'),
    동의어: header.indexOf('동의어'),
  };
  const tree: Record<string, Record<string, { keyword: string, synonyms: string[] }[]>> = {};
  
  for (let i = 1; i < lines.length; ++i) {
    // CSV 파싱: 따옴표 안의 쉼표를 고려하여 파싱
    const cols = parseCSVLine(lines[i]);
    const main = cols[idxMap.대분류]?.trim();
    const sub = cols[idxMap.중분류]?.trim();
    const keyword = cols[idxMap.키워드]?.trim();
    
    // 동의어 파싱: 쉼표, 슬래시, 파이프 모두 지원
    let synonymText = cols[idxMap.동의어]?.trim() || '';
    // 따옴표 제거
    synonymText = synonymText.replace(/^["']|["']$/g, '');
    // 쉼표, 슬래시, 파이프로 분리
    const synonyms = synonymText
      .split(/[,/|]/)
      .map(s => s.trim())
      .filter(Boolean);
    
    if (!main || !sub || !keyword) continue;
    
    if (!tree[main]) tree[main] = {};
    if (!tree[main][sub]) tree[main][sub] = [];
    tree[main][sub].push({ keyword, synonyms });
  }
  
  return tree;
}

// 자동완성 필터링 유틸리티
const AutoCompleteUtils = {
  // 동의어를 고려한 필터링 (MyFridge와 동일한 로직)
  // ingredientDict 구조: { '동의어': 'keyword', 'keyword': 'keyword' }
  // 예: { '계란': '달걀', '깐대파': '파', '파': '파' }
  getFilteredCandidates: (input: string, excludeList: string[], ingredientDict: { [key: string]: string }) => {
    if (!input) return [];
    
    const inputLower = input.toLowerCase();
    const firstChar = input[0];
    
    // Object.entries를 사용하여 동의어(key)나 keyword(value)에 입력값이 포함되어 있으면 표시
    const filtered = Object.entries(ingredientDict)
      .filter(([key, value]) => {
        const keyLower = key.toLowerCase();
        const valueLower = value.toLowerCase();
        // 동의어(key)나 keyword(value)에 입력값이 포함되어 있으면 표시
        const matches = keyLower.includes(inputLower) || valueLower.includes(inputLower);
        // 이미 선택된 재료는 제외
        return matches && !excludeList.includes(value);
      })
      .map(([key, value]) => value) // keyword만 반환
      .filter((value, index, self) => self.indexOf(value) === index) // 중복 제거
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // 1순위: 정확한 매칭 (대소문자 무시)
        const aExact = aLower === inputLower;
        const bExact = bLower === inputLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 2순위: 첫 글자로 시작하는 단어들
        const aStartsWithFirstChar = a.startsWith(firstChar);
        const bStartsWithFirstChar = b.startsWith(firstChar);
        if (aStartsWithFirstChar && !bStartsWithFirstChar) return -1;
        if (!aStartsWithFirstChar && bStartsWithFirstChar) return 1;
        
        // 3순위: 입력값으로 시작하는 단어들
        const aStartsWithInput = aLower.startsWith(inputLower);
        const bStartsWithInput = bLower.startsWith(inputLower);
        if (aStartsWithInput && !bStartsWithInput) return -1;
        if (!aStartsWithInput && bStartsWithInput) return 1;
        
        // 4순위: 길이 순으로 정렬 (짧은 것 우선)
        return a.length - b.length;
      })
      .slice(0, 8);
    
    return filtered;
  },

  // 자동완성 입력 핸들러 생성 (복수 선택 지원)
  createInputHandler: (
    inputValue: string,
    candidates: string[],
    ingredientDict: { [key: string]: string },
    setIngredients: (ingredients: string[] | ((prev: string[]) => string[])) => void,
    currentIngredients: string[],
    setInput: (input: string) => void,
    setFocus: (focus: boolean) => void,
    /** 반대쪽(포함↔제외)에 이미 고른 재료 — 여기에 있으면 추가하지 않는다 */
    blockedIngredients: string[] = [],
    onBlocked?: (name: string) => void
  ) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const valueToAdd = candidates.length > 0 ? candidates[0] : inputValue.trim();
        if (valueToAdd) {
          // 동의어를 keyword로 변환 (MyFridge와 동일한 로직)
          const keyword = ingredientDict[valueToAdd] || valueToAdd;
          // 드롭다운에서는 이미 걸러 두지만, 자동완성 후보가 없을 때 입력값이 그대로
          // 들어오는 경로가 남아 있어 여기서 한 번 더 막는다.
          // (포함과 제외에 같은 재료가 들어가면 결과가 항상 0건이 된다)
          if (blockedIngredients.includes(keyword)) {
            onBlocked?.(keyword);
            setInput('');
            setFocus(false);
            return;
          }
          setIngredients((prev: string[]) => {
            if (!prev.includes(keyword)) {
              return [...prev, keyword];
            }
            return prev;
          });
          setInput('');
          setFocus(false);
        } else {
          alert('사전에 등록되지 않은 재료입니다. 자동완성 목록에서 선택해주세요.');
        }
      }
    };
  },

  // 자동완성 아이템 클릭 핸들러 생성 (복수 선택 지원)
  createItemClickHandler: (
    item: string,
    ingredientDict: { [key: string]: string },
    setIngredients: (ingredients: string[]) => void,
    currentIngredients: string[],
    setInput: (input: string) => void,
    setFocus: (focus: boolean) => void
  ) => {
    return () => {
      // 동의어를 keyword로 변환 (MyFridge와 동일한 로직)
      const keyword = ingredientDict[item] || item;
      // 이미 선택된 재료가 아니면 추가
      if (!currentIngredients.includes(keyword)) {
        setIngredients([...currentIngredients, keyword]);
      }
      setInput('');
      setFocus(false);
    };
  }
};

// 스타일 상수
const STYLES = {
  modal: {
    maxHeight: 'calc(100vh - 200px)', // 모바일 기준으로 높이 조정 (상단/하단 여유 공간 확보)
    overflowY: 'auto' as const,
    // 모바일에서 더 작은 높이 적용
    '@media (max-width: 430px)': {
      maxHeight: 'calc(100vh - 240px)' // 모바일에서는 더 작게
    }
  },
  header: {
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    opacity: 1,
    minHeight: 36
  },
  closeButton: {
    zIndex: 20
  },
  scrollContainer: {
    maxHeight: 320,
    overflowY: 'scroll' as const,
    borderBottom: '1px solid #E6E6EA',
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: 8,
    background: '#F5F5F7',
    position: 'relative' as const,
    boxShadow: '0px -8px 16px -8px rgba(0,0,0,0.08) inset',
    borderRadius: '8px',
    margin: '0 8px',
    // 스크롤바 항상 표시
    scrollbarWidth: 'thin' as const,
    scrollbarColor: '#9A9AA2 #E6E6EA' // 모바일에서 더 잘 보이도록 진한 색상
  },
  applyButton: {
    maxWidth: 320
  },
  chipButton: {
    fontSize: 15,
    lineHeight: 1,
    padding: 0,
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer'
  },
  keywordPill: {
    lineHeight: 1.2,
    height: 'auto'
  },
  toast: {
    position: 'fixed' as const,
    bottom: 100,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(34,34,34,0.9)',
    color: '#FFFFFF',
    padding: '12px 24px',
    borderRadius: 12,
    fontSize: 16,
    zIndex: 'var(--z-toast)',
    maxWidth: 260,
    width: 'max-content',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center' as const
  }
};

const FilterModal: React.FC<FilterModalProps> = ({ 
  open, 
  onClose, 
  filterState, 
  setFilterState, 
  includeIngredients = [], 
  setIncludeIngredients, 
  excludeIngredients = [], 
  setExcludeIngredients, 
  includeInput, 
  setIncludeInput, 
  excludeInput, 
  setExcludeInput, 
  allIngredients = [], 
  includeKeyword, 
  setIncludeKeyword, 
  onApply, 
  filterKeywordTree, 
  setFilterKeywordTree, 
  selectedChannel = [], 
  setSelectedChannel 
}) => {
  const [includeFocus, setIncludeFocus] = useState(false);
  const [excludeFocus, setExcludeFocus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ingredientDict, setIngredientDict] = useState<{ [key: string]: string }>({});
  const [isMobile, setIsMobile] = useState(false);
  
  // 모달 내부 임시 상태 (적용 버튼을 눌러야만 실제 상태에 반영)
  const [tempFilterState, setTempFilterState] = useState<FilterState>(filterState);
  const [tempIncludeIngredients, setTempIncludeIngredients] = useState<string[]>(includeIngredients);
  const [tempExcludeIngredients, setTempExcludeIngredients] = useState<string[]>(excludeIngredients);
  /** 포함↔제외에 같은 재료를 넣으려 했을 때 알려 주는 문구 (잠깐 떴다 사라짐) */
  const [blockedNotice, setBlockedNotice] = useState<string>('');
  const [tempIncludeInput, setTempIncludeInput] = useState<string>(includeInput);
  const [tempExcludeInput, setTempExcludeInput] = useState<string>(excludeInput);
  const [tempIncludeKeyword, setTempIncludeKeyword] = useState<string>(includeKeyword);
  const [tempSelectedChannel, setTempSelectedChannel] = useState<string[]>(selectedChannel);
  
  // 모달이 열릴 때 초기 상태 저장
  // 안내 문구는 잠깐 보이고 사라진다 (닫기 버튼까지 둘 만큼 중요한 알림은 아님)
  useEffect(() => {
    if (!blockedNotice) return;
    const t = setTimeout(() => setBlockedNotice(''), 3500);
    return () => clearTimeout(t);
  }, [blockedNotice]);

  useEffect(() => {
    if (open) {
      setTempFilterState(filterState);
      setTempIncludeIngredients(includeIngredients);
      setTempExcludeIngredients(excludeIngredients);
      setTempIncludeInput(includeInput);
      setTempExcludeInput(excludeInput);
      setTempIncludeKeyword(includeKeyword);
      setTempSelectedChannel(selectedChannel);
    }
  }, [open, filterState, includeIngredients, excludeIngredients, includeInput, excludeInput, includeKeyword, selectedChannel]);
  
  // 모바일 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 430);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 재료 사전 로드 (동의어 포함, MyFridge와 동일한 로직)
  useEffect(() => {
    const CSV_CACHE_KEY = 'ingredient_dict_cache';
    const CACHE_VERSION = '1.0';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간
    
    // 캐시 확인
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(CSV_CACHE_KEY);
        if (cached) {
          const { data, version, timestamp } = JSON.parse(cached);
          if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_EXPIRY) {
            console.log('[FilterModal] 재료 사전 캐시에서 로드');
            setIngredientDict(data);
            return;
          }
        }
      } catch (e) {
        console.warn('[FilterModal] 캐시 읽기 실패:', e);
      }
    }
    
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(Boolean);
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const synonymsIdx = header.indexOf('synonyms');
        const categoryIdx = header.indexOf('대분류');
        
        if (nameIdx === -1 || categoryIdx === -1) {
          console.warn('[FilterModal] CSV 헤더를 찾을 수 없습니다');
          return;
        }
        
        // CSV 파싱 함수 (따옴표로 감싸진 필드 처리)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          
          return result;
        };
        
        const ingredients: { [key: string]: string } = {};
        
        lines.slice(1).forEach(line => {
          if (!line.trim()) return; // 빈 줄 스킵
          
          const values = parseCSVLine(line);
          const keyword = values[nameIdx]?.trim();
          const synonymsStr = values[synonymsIdx]?.trim();
          const category = values[categoryIdx]?.trim();
          
          if (keyword && category === '재료') {
            // keyword를 keyword로 매핑
            ingredients[keyword] = keyword;
            
            // synonyms 파싱 (쉼표로 구분, 빈 값 제거)
            if (synonymsStr) {
              const synonyms = synonymsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
              synonyms.forEach(synonym => {
                if (synonym) {
                  ingredients[synonym] = keyword;
                }
              });
            }
          }
        });
        
        console.log('[FilterModal] CSV 파싱 완료, 재료 사전 크기:', Object.keys(ingredients).length);
        
        // 캐시에 저장
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(CSV_CACHE_KEY, JSON.stringify({
              data: ingredients,
              version: CACHE_VERSION,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('[FilterModal] 캐시 저장 실패:', e);
          }
        }
        
        setIngredientDict(ingredients);
      })
      .catch(error => {
        console.error('[FilterModal] CSV 파일 로드 실패:', error);
      });
  }, []);

  // 키워드 트리 로드
  useEffect(() => {
    setIsLoading(true);
    fetch('/Filter_Keywords.csv')
      .then(res => res.text())
      .then(csv => {
        setFilterKeywordTree(parseFilterKeywordsCSV(csv));
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load filter keywords:', error);
        setFilterKeywordTree({});
        setIsLoading(false);
      });
  }, [setFilterKeywordTree]);

  /**
   * 자동완성 후보에서 **반대쪽에 이미 고른 재료도 함께 제외**한다.
   *
   * 예전에는 각 입력창이 자기 쪽 선택 목록만 걸러서, `가지` 를 포함에 넣어 두고
   * 제외에도 `가지` 를 넣을 수 있었다. 그러면 SQL 이
   * `used_ingredients 에 가지가 있고 AND 없고` 가 되어 **결과가 항상 0건**이 된다.
   * 사용자는 왜 아무것도 안 나오는지 알 길이 없다.
   * → 고를 수 없게 막는 쪽이 맞다. 이미 고른 것은 목록에 아예 띄우지 않는다.
   */
  const includeCandidates = AutoCompleteUtils.getFilteredCandidates(
    tempIncludeInput,
    [...(tempIncludeIngredients || []), ...(tempExcludeIngredients || [])],
    ingredientDict
  );
  const excludeCandidates = AutoCompleteUtils.getFilteredCandidates(
    tempExcludeInput,
    [...(tempExcludeIngredients || []), ...(tempIncludeIngredients || [])],
    ingredientDict
  );

  // 선택된 키워드 pills 생성 (임시 상태 사용)
  const selectedKeywordPills: { main: string; keyword: string }[] = [];
  Object.entries(tempFilterState || {}).forEach(([main, arr]) => {
    (arr || []).forEach((keyword: string) => {
      selectedKeywordPills.push({ main, keyword });
    });
  });

  // 채널 선택 핸들러 (임시 상태 사용)
  const handleChannelChange = (channel: string, checked: boolean) => {
    if (checked) {
      setTempSelectedChannel([...tempSelectedChannel, channel]);
    } else {
      setTempSelectedChannel(tempSelectedChannel.filter(c => c !== channel));
    }
  };

  // 키워드 선택/해제 핸들러 (임시 상태 사용)
  const handleKeywordToggle = (main: string, keyword: string) => {
    setTempFilterState({
      ...tempFilterState,
      [main]: [keyword] // Allow only single selection
    });
  };

  // 키워드 제거 핸들러 (임시 상태 사용)
  const handleKeywordRemove = (main: string, keyword: string) => {
    setTempFilterState({
      ...tempFilterState,
      [main]: (tempFilterState[main] || []).filter(k => k !== keyword)
    });
  };
  
  // [x] 버튼 클릭 핸들러 - 변경사항 무시하고 모달만 닫기
  const handleClose = () => {
    // 임시 상태를 초기 상태로 복원 (변경사항 무시)
    setTempFilterState(filterState);
    setTempIncludeIngredients(includeIngredients);
    setTempExcludeIngredients(excludeIngredients);
    setTempIncludeInput(includeInput);
    setTempExcludeInput(excludeInput);
    setTempIncludeKeyword(includeKeyword);
    setTempSelectedChannel(selectedChannel);
    // 입력 필드도 초기화
    setIncludeInput(includeInput);
    setExcludeInput(excludeInput);
    onClose();
  };

  if (!open) return null;

  console.log('Selected filter options (temp):', {
    includeKeyword: tempIncludeKeyword,
    includeIngredients: tempIncludeIngredients,
    excludeIngredients: tempExcludeIngredients,
    selectedKeywordPills,
    selectedChannel: tempSelectedChannel
  });

  const handleApplyFilters = () => {
    // 임시 상태를 실제 상태에 반영
    setFilterState(tempFilterState);
    setIncludeIngredients(tempIncludeIngredients);
    setExcludeIngredients(tempExcludeIngredients);
    setIncludeInput(tempIncludeInput);
    setExcludeInput(tempExcludeInput);
    setIncludeKeyword(tempIncludeKeyword);
    setSelectedChannel(tempSelectedChannel);
    
    const options = {
      includeKeyword: tempIncludeKeyword,
      includeIngredients: tempIncludeIngredients,
      excludeIngredients: tempExcludeIngredients,
      selectedCategoryKeywords: selectedKeywordPills,
      selectedChannel: tempSelectedChannel
    };
    console.log('Applying filters with options:', options);
    
    // 모달을 먼저 닫기
    onClose();
    
    // 그 다음 필터 적용 (비동기로 실행하여 모달이 닫힌 후 실행되도록)
    setTimeout(() => {
      onApply(options);
    }, 0);
  };

  return (
    // 예전엔 화면 가운데 뜨는 모달이라 한 손으로 쓸 때 상단 항목에 엄지가 닿지 않았고,
    // 내용이 길어지면 위아래가 잘렸음 → 바텀시트로 전환해 액션을 엄지 근처로 내림
    <Sheet
      open
      onClose={handleClose}
      // 선택 항목이 많은 화면이라 기본부터 넉넉하게 열고, 위로 끌면 더 펼쳐진다
      maxHeight="82dvh"
      title="필터를 설정해 주세요"
      footer={
        // 하단에 나갈 수 있는 버튼(취소)을 항상 함께 둔다
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="lg" block onClick={handleClose}>
            취소
          </Button>
          <Button variant="secondary" size="lg" block onClick={handleApplyFilters}>
            적용
          </Button>
        </div>
      }
    >
        <div>
          {/* 지금 적용 중인 검색어.
              검색 입력창은 화면 상단(냉장고요리 검색창)에 이미 있고 같은 값을 조작하므로,
              시트 안에 또 만들면 한 값을 고치는 입력창이 두 곳이 된다.
              여기서는 **확인과 해제만** 할 수 있게 두고, 맨 위에 둬서
              "이 검색어에 더해서 조건을 좁힌다" 는 흐름이 먼저 읽히게 한다. */}
          {(tempIncludeKeyword || '').trim() && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 600 }}>지금 적용 중</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    padding: '0 6px 0 12px',
                    borderRadius: 9999,
                    background: 'var(--brand-soft)',
                    border: '1px solid var(--brand-strong)',
                    color: 'var(--brand-on-soft)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  검색어: {tempIncludeKeyword}
                  <button
                    type="button"
                    aria-label="검색어 해제"
                    onClick={() => setTempIncludeKeyword('')}
                    style={{
                      width: 20, height: 20, padding: 0, boxSizing: 'border-box',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--brand-on-soft)', fontSize: 14, lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
              <AndDivider />
            </>
          )}

          <FilterGroup index={1} title="채널" hint="고르지 않으면 전체">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'youtube', label: '유튜브' },
                { key: 'naver', label: '네이버' },
              ].map(({ key, label }) => {
                const on = (tempSelectedChannel || []).includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChannelChange(key, !on)}
                    aria-pressed={on}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      boxSizing: 'border-box',
                      borderRadius: 9999,
                      fontSize: 14,
                      fontWeight: on ? 700 : 500,
                      cursor: 'pointer',
                      background: on ? 'var(--ink-900)' : 'var(--surface)',
                      color: on ? '#FFFFFF' : 'var(--ink-700)',
                      border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <AndDivider />
          {/* 재료: 포함/제외를 한 묶음으로 (예전엔 각각 별도 섹션이라 관계가 안 보였음) */}
          <FilterGroup index={2} title="재료" hint="선택은 드롭다운에서">
            <div>
              {blockedNotice && (
                <div
                  role="status"
                  style={{
                    marginBottom: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: '#FFF3E0',
                    color: '#9A5B00',
                    fontSize: 13,
                    lineHeight: 1.45,
                    wordBreak: 'keep-all',
                  }}
                >
                  {blockedNotice} 한 재료를 포함과 제외에 함께 넣으면 결과가 하나도 나오지 않아요.
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
                꼭 포함할 재료
              </div>
              <div className="relative mb-2">
                <input
                  className="w-full"
                  // 12px 는 iOS 에서 포커스 시 화면이 확대되고, 높이도 30px 남짓이라 누르기 어려웠음
                  style={{ height: 44, padding: '0 14px', boxSizing: 'border-box', fontSize: 16, borderRadius: 10, border: '1px solid var(--line-300)', background: 'var(--surface)' }}
                  placeholder="포함할 재료 입력"
                  value={tempIncludeInput || ''}
                  onChange={e => setTempIncludeInput(e.target.value)}
                  onFocus={() => setIncludeFocus(true)}
                  onBlur={() => setTimeout(() => setIncludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(tempIncludeInput, includeCandidates, ingredientDict, setTempIncludeIngredients, tempIncludeIngredients, setTempIncludeInput, setIncludeFocus, tempExcludeIngredients || [], (name) => setBlockedNotice(`'${name}' 은(는) 제외 재료로 골라 뒀어요.`))}
                />
                {includeFocus && includeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-30 max-h-32 overflow-y-auto custom-scrollbar">
                    {includeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[13px]"
                        onMouseDown={AutoCompleteUtils.createItemClickHandler(item, ingredientDict, setTempIncludeIngredients, tempIncludeIngredients, setTempIncludeInput, setIncludeFocus)}
                      >{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              {/* chips for includeIngredients */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(tempIncludeIngredients || []).map(ing => (
                  <span key={ing} className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                    {ing}
                    <button
                      type="button"
                      className="ml-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
                      style={STYLES.chipButton}
                      onClick={() => setTempIncludeIngredients((tempIncludeIngredients || []).filter(i => i !== ing))}
                      aria-label="제거"
                    >×</button>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', margin: '14px 0 6px' }}>
                꼭 제외할 재료
              </div>
              {/* '꼭 포함할 재료' 입력창에는 mb-2 가 있는데 여기만 빠져 있어서,
                  선택한 재료 pill 이 입력창에 바짝 붙어 나왔다 */}
              <div className="relative mb-2">
                <input
                  className="w-full"
                  // 12px 는 iOS 에서 포커스 시 화면이 확대되고, 높이도 30px 남짓이라 누르기 어려웠음
                  style={{ height: 44, padding: '0 14px', boxSizing: 'border-box', fontSize: 16, borderRadius: 10, border: '1px solid var(--line-300)', background: 'var(--surface)' }}
                  placeholder="제외할 재료 입력"
                  value={tempExcludeInput || ''}
                  onChange={e => setTempExcludeInput(e.target.value)}
                  onFocus={() => setExcludeFocus(true)}
                  onBlur={() => setTimeout(() => setExcludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(tempExcludeInput, excludeCandidates, ingredientDict, setTempExcludeIngredients, tempExcludeIngredients, setTempExcludeInput, setExcludeFocus, tempIncludeIngredients || [], (name) => setBlockedNotice(`'${name}' 은(는) 포함 재료로 골라 뒀어요.`))}
                />
                {excludeFocus && excludeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-30 max-h-32 overflow-y-auto custom-scrollbar">
                    {excludeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[13px]"
                        onMouseDown={AutoCompleteUtils.createItemClickHandler(item, ingredientDict, setTempExcludeIngredients, tempExcludeIngredients, setTempExcludeInput, setExcludeFocus)}
                      >{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              {/* chips for excludeIngredients */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(tempExcludeIngredients || []).map(ing => (
                  <span key={ing} className="bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                    {ing}
                    <button
                      type="button"
                      className="ml-1 text-gray-700 hover:text-gray-900 focus:outline-none"
                      style={STYLES.chipButton}
                      onClick={() => setTempExcludeIngredients((tempExcludeIngredients || []).filter(i => i !== ing))}
                      aria-label="제거"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          </FilterGroup>

          <AndDivider />

          <FilterGroup index={3} title="테마" hint="여러 개 선택 가능">
            <div>
            {/* 고정: 선택된 키워드 pill (sticky) */}
            <div
              className="flex flex-wrap gap-2 mb-2 justify-center"
              style={{ minHeight: 24 }}
            >
              {selectedKeywordPills.length === 0 ? (
                <span className="text-gray-400 text-[15px]">테마를 선택해 주세요</span>
              ) : (
                selectedKeywordPills.map(({ main, keyword }) => (
                  <span
                    key={main + '-' + keyword}
                    className="px-2 py-[2px] bg-yellow-100 text-yellow-800 rounded-full text-[15px] font-medium border border-yellow-300 flex items-center"
                    style={STYLES.keywordPill}
                  >
                    {keyword}
                    <button
                      type="button"
                      className="ml-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
                      aria-label="선택 해제"
                      style={STYLES.chipButton}
                      onClick={() => handleKeywordRemove(main, keyword)}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            {/* 스크롤: 카테고리별 키워드 */}
            <div
              className="custom-scrollbar"
              style={{
                ...STYLES.scrollContainer,
                // 예전엔 모바일에서 100px 로 고정돼 있어 테마 선택지가 두 줄도 안 보였고,
                // 시트 안에서 또 스크롤해야 하는 이중 스크롤 구조였음.
                // 시트 자체가 스크롤되고 위로 끌어 펼칠 수도 있으므로 넉넉하게 둔다.
                maxHeight: isMobile ? '46dvh' : '150px',
                paddingTop: 8,
                paddingBottom: 10,
                marginBottom: 2,
                // 스크롤바 항상 표시 (모바일에서 더 잘 보이도록 진한 색상)
                scrollbarWidth: 'thin',
                scrollbarColor: '#9A9AA2 #E6E6EA'
              }}
            >
              {/* 기존 카테고리~채널선택 내용 */}
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <>
                  {/* 카테고리별 태그 */}
                  <div className="px-4">
                  {filterKeywordTree && typeof filterKeywordTree === 'object' && Object.keys(filterKeywordTree).length > 0
                    ? Object.entries(filterKeywordTree).map(([main, subTree]) => (
                        <div key={main}>
                          {/* ■ / - 같은 문자 표식 대신 굵기·색으로 층위를 구분한다 */}
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', margin: '10px 0 6px' }}>{main}</div>
                          {subTree && typeof subTree === 'object'
                            ? Object.entries(subTree).map(([sub, keywordsArr]) => (
                                <div key={sub} className="mb-0.5">
                                  {sub && <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-500)', marginBottom: 4 }}>{sub}</div>}
                                  <div className="flex flex-wrap gap-1 mb-0.5">
                                    {Array.isArray(keywordsArr)
                                      ? keywordsArr.map(({ keyword }) => (
                                          <button
                                            key={keyword}
                                            // 예전엔 py-0.5 라 높이가 20px 남짓이라 손가락으로 정확히 누르기 어려웠음
                                            className="rounded-full transition-colors"
                                            style={(() => {
                                              const on = ((tempFilterState || {})[main] || []).includes(keyword);
                                              return {
                                                height: 34,
                                                padding: '0 12px',
                                                boxSizing: 'border-box' as const,
                                                fontSize: 13,
                                                fontWeight: on ? 700 : 500,
                                                background: on ? 'var(--ink-900)' : 'var(--surface)',
                                                color: on ? '#FFFFFF' : 'var(--ink-700)',
                                                border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
                                              };
                                            })()}
                                            onClick={() => handleKeywordToggle(main, keyword)}
                                          >{keyword}</button>
                                        ))
                                      : null}
                                  </div>
                                </div>
                              ))
                            : null}
                        </div>
                      ))
                    : <div className="text-center text-gray-500 py-4">필터 키워드를 불러오는 중입니다...</div>}
                  </div>
                </>
              )}
            </div>
            </div>
          </FilterGroup>
        </div>
    </Sheet>
  );
};

export default FilterModal; 