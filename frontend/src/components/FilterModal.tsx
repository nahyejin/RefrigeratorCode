import React, { useState, useEffect } from 'react';
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
    setFocus: (focus: boolean) => void
  ) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const valueToAdd = candidates.length > 0 ? candidates[0] : inputValue.trim();
        if (valueToAdd) {
          // 동의어를 keyword로 변환 (MyFridge와 동일한 로직)
          const keyword = ingredientDict[valueToAdd] || valueToAdd;
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
    fontSize: 14,
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
    fontSize: 15,
    zIndex: 9999,
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
  const [tempIncludeInput, setTempIncludeInput] = useState<string>(includeInput);
  const [tempExcludeInput, setTempExcludeInput] = useState<string>(excludeInput);
  const [tempIncludeKeyword, setTempIncludeKeyword] = useState<string>(includeKeyword);
  const [tempSelectedChannel, setTempSelectedChannel] = useState<string[]>(selectedChannel);
  
  // 모달이 열릴 때 초기 상태 저장
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

  const includeCandidates = AutoCompleteUtils.getFilteredCandidates(tempIncludeInput, tempIncludeIngredients, ingredientDict);
  const excludeCandidates = AutoCompleteUtils.getFilteredCandidates(tempExcludeInput, tempExcludeIngredients, ingredientDict);

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
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" style={{ zIndex: 1001 }}>
      <div 
        className="bg-white rounded-xl shadow-lg w-[340px] max-w-[95vw] relative" 
        style={{
          ...STYLES.modal,
          maxHeight: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 60px)', // 모달 높이 더 줄임
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="sticky top-0 z-10 bg-white" style={STYLES.header}>
          <span className="absolute top-2 right-2 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" onClick={handleClose} role="button" aria-label="닫기" style={STYLES.closeButton}>×</span>
          <div className="text-center font-bold text-[12.8px] mb-2 pt-1">필터를 설정해 주세요</div>
          <div className="border-b border-gray-200"></div>
        </div>
        <div className="p-3 mb-1" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 8, paddingBottom: 8 }}>
          {/* 채널 선택: 맨 위로 이동 */}
          <div className="mb-2">
            <div className="font-bold text-[11.2px] mb-1">■ 채널선택</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="channel"
                  value="youtube"
                  checked={(tempSelectedChannel || []).includes('youtube')}
                  onChange={e => handleChannelChange('youtube', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-[11.2px]">유튜브</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="channel"
                  value="naver"
                  checked={(tempSelectedChannel || []).includes('naver')}
                  onChange={e => handleChannelChange('naver', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-[11.2px]">네이버</span>
              </label>
            </div>
          </div>
          {/* 고정: 재료 입력 */}
          <div>
            <div className="mt-1 border-t border-gray-200"></div>
            <div className="mt-1">
              <div className="font-bold text-[11.2px] mb-1">■ 꼭 포함할 재료</div>
              <div className="relative mb-2">
                <input
                  className="w-full border rounded px-3 py-1.5 text-[10px]"
                  placeholder="포함할 재료 입력"
                  value={tempIncludeInput || ''}
                  onChange={e => setTempIncludeInput(e.target.value)}
                  onFocus={() => setIncludeFocus(true)}
                  onBlur={() => setTimeout(() => setIncludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(tempIncludeInput, includeCandidates, ingredientDict, setTempIncludeIngredients, tempIncludeIngredients, setTempIncludeInput, setIncludeFocus)}
                />
                {includeFocus && includeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-30 max-h-32 overflow-y-auto custom-scrollbar">
                    {includeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
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
              <div className="font-bold text-[11.2px] mt-2 mb-1">■ 꼭 제외할 재료</div>
              <div className="relative">
                <input
                  className="w-full border rounded px-3 py-1.5 text-[10px]"
                  placeholder="제외할 재료 입력"
                  value={tempExcludeInput || ''}
                  onChange={e => setTempExcludeInput(e.target.value)}
                  onFocus={() => setExcludeFocus(true)}
                  onBlur={() => setTimeout(() => setExcludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(tempExcludeInput, excludeCandidates, ingredientDict, setTempExcludeIngredients, tempExcludeIngredients, setTempExcludeInput, setExcludeFocus)}
                />
                {excludeFocus && excludeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-30 max-h-32 overflow-y-auto custom-scrollbar">
                    {excludeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
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
          </div>
          {/* 테마 선택: 채널 선택, 꼭 포함할 키워드 등과 같은 레벨로 이동 */}
          <div className="mt-2 border-t border-gray-200 pt-2">
            <div className="font-bold text-[11.2px] mb-2">■ 테마 선택</div>
            {/* 고정: 선택된 키워드 pill (sticky) */}
            <div
              className="flex flex-wrap gap-2 mb-2 justify-center"
              style={{ minHeight: 24 }}
            >
              {selectedKeywordPills.length === 0 ? (
                <span className="text-gray-400 text-[13px]">테마를 선택해 주세요</span>
              ) : (
                selectedKeywordPills.map(({ main, keyword }) => (
                  <span
                    key={main + '-' + keyword}
                    className="px-2 py-[2px] bg-yellow-100 text-yellow-800 rounded-full text-[13px] font-medium border border-yellow-300 flex items-center"
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
                maxHeight: isMobile ? '100px' : '150px', // 테마 선택란 높이
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
                          <div className="font-bold text-[11.2px] mb-1">■ {main}</div>
                          {subTree && typeof subTree === 'object'
                            ? Object.entries(subTree).map(([sub, keywordsArr]) => (
                                <div key={sub} className="mb-0.5">
                                  {sub && <div className="text-[10px] font-semibold text-[#3A3A42] mb-0.5 ml-1">- {sub}</div>}
                                  <div className="flex flex-wrap gap-1 mb-0.5">
                                    {Array.isArray(keywordsArr)
                                      ? keywordsArr.map(({ keyword }) => (
                                          <button
                                            key={keyword}
                                            className={`rounded-full px-2.5 py-0.5 font-medium text-[10.4px] mb-0.5 transition-colors ${
                                              ((tempFilterState || {})[main] || []).includes(keyword) ? 'bg-[#6A6A73] text-white' : 'bg-white text-[#6A6A73] shadow-sm'
                                            }`}
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
        </div>
        <div className="sticky bottom-0 left-0 w-full bg-white p-2 flex justify-center z-20 border-t border-gray-200">
          <button
            className="w-full bg-[#3A3A42] text-white font-bold py-1.5 rounded-lg text-sm"
            style={STYLES.applyButton}
            onClick={handleApplyFilters}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal; 