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

// CSV 파싱 및 트리 구조 변환 함수
function parseFilterKeywordsCSV(csv: string): Record<string, Record<string, { keyword: string, synonyms: string[] }[]>> {
  const lines = csv.split('\n').filter(Boolean);
  const header = lines[0].split(',');
  const idxMap = {
    대분류: header.indexOf('대분류'),
    중분류: header.indexOf('중분류'),
    키워드: header.indexOf('키워드'),
    동의어: header.indexOf('동의어'),
  };
  const tree: Record<string, Record<string, { keyword: string, synonyms: string[] }[]>> = {};
  
  for (let i = 1; i < lines.length; ++i) {
    const cols = lines[i].split(',');
    const main = cols[idxMap.대분류]?.trim();
    const sub = cols[idxMap.중분류]?.trim();
    const keyword = cols[idxMap.키워드]?.trim();
    const synonyms = cols[idxMap.동의어]?.split('/').map(s => s.trim()).filter(Boolean) || [];
    
    if (!main || !sub || !keyword) continue;
    
    if (!tree[main]) tree[main] = {};
    if (!tree[main][sub]) tree[main][sub] = [];
    tree[main][sub].push({ keyword, synonyms });
  }
  
  return tree;
}

// 자동완성 필터링 유틸리티
const AutoCompleteUtils = {
  getFilteredCandidates: (input: string, excludeList: string[], ingredientDict: string[]) => {
    if (!input) return [];
    
    // 입력값의 첫 글자
    const firstChar = input[0];
    
    return ingredientDict
      .filter(item => 
        item.includes(input) && 
        !excludeList.includes(item)
      )
      .sort((a, b) => {
        // 1순위: 정확한 매칭
        const aExact = a === input;
        const bExact = b === input;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 2순위: 첫 글자로 시작하는 단어들 (가OOO 형태)
        const aStartsWithFirstChar = a.startsWith(firstChar);
        const bStartsWithFirstChar = b.startsWith(firstChar);
        if (aStartsWithFirstChar && !bStartsWithFirstChar) return -1;
        if (!aStartsWithFirstChar && bStartsWithFirstChar) return 1;
        
        // 3순위: 입력값으로 시작하는 단어들
        const aStartsWithInput = a.startsWith(input);
        const bStartsWithInput = b.startsWith(input);
        if (aStartsWithInput && !bStartsWithInput) return -1;
        if (!aStartsWithInput && bStartsWithInput) return 1;
        
        // 4순위: 길이 순으로 정렬 (짧은 것 우선)
        return a.length - b.length;
      })
      .slice(0, 8);
  },

  // 자동완성 입력 핸들러 생성
  createInputHandler: (
    inputValue: string,
    candidates: string[],
    ingredientDict: string[],
    setIngredients: (ingredients: string[]) => void,
    setInput: (input: string) => void,
    setFocus: (focus: boolean) => void
  ) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (candidates.length > 0) {
          setIngredients([...candidates.slice(0, 1)]);
          setInput('');
          setFocus(false);
        } else if (inputValue.trim()) {
          const exactMatch = ingredientDict.find(item => item === inputValue.trim());
          if (exactMatch) {
            setIngredients([exactMatch]);
            setInput('');
            setFocus(false);
          } else {
            alert('사전에 등록되지 않은 재료입니다. 자동완성 목록에서 선택해주세요.');
          }
        }
      }
    };
  },

  // 자동완성 아이템 클릭 핸들러 생성
  createItemClickHandler: (
    item: string,
    setIngredients: (ingredients: string[]) => void,
    setInput: (input: string) => void,
    setFocus: (focus: boolean) => void
  ) => {
    return () => {
      setIngredients([item]);
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
    paddingTop: 16,
    backgroundColor: '#fff',
    opacity: 1,
    minHeight: 48
  },
  closeButton: {
    zIndex: 20
  },
  scrollContainer: {
    maxHeight: 320,
    overflowY: 'scroll' as const,
    borderBottom: '1px solid #eee',
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: 8,
    background: '#f5f5f5',
    position: 'relative' as const,
    boxShadow: '0px -8px 16px -8px rgba(0,0,0,0.08) inset',
    borderRadius: '8px',
    margin: '0 8px',
    // 스크롤바 항상 표시
    scrollbarWidth: 'thin' as const,
    scrollbarColor: '#bdbdbd #f3f4f6'
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
    justifyContent: 'center'
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
    color: '#fff',
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
  const [ingredientDict, setIngredientDict] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  
  // 모바일 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 430);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 재료 사전 로드
  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const categoryIdx = header.indexOf('대분류');
        if (nameIdx === -1 || categoryIdx === -1) return;
        
        const ingredients = lines.slice(1)
          .map(line => {
            const values = line.split(',');
            return {
              keyword: values[nameIdx]?.trim(),
              category: values[categoryIdx]?.trim()
            };
          })
          .filter(item => 
            item.keyword && 
            item.keyword !== 'keyword' && 
            item.category === '재료'
          )
          .map(item => item.keyword);
        
        setIngredientDict(ingredients);
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

  const includeCandidates = AutoCompleteUtils.getFilteredCandidates(includeInput, includeIngredients, ingredientDict);
  const excludeCandidates = AutoCompleteUtils.getFilteredCandidates(excludeInput, excludeIngredients, ingredientDict);

  // 선택된 키워드 pills 생성
  const selectedKeywordPills: { main: string; keyword: string }[] = [];
  Object.entries(filterState || {}).forEach(([main, arr]) => {
    (arr || []).forEach((keyword: string) => {
      selectedKeywordPills.push({ main, keyword });
    });
  });

  // 채널 선택 핸들러
  const handleChannelChange = (channel: string, checked: boolean) => {
    if (checked) {
      setSelectedChannel([...selectedChannel, channel]);
    } else {
      setSelectedChannel(selectedChannel.filter(c => c !== channel));
    }
  };

  // 키워드 선택/해제 핸들러
  const handleKeywordToggle = (main: string, keyword: string) => {
    setFilterState({
      ...filterState,
      [main]: [keyword] // Allow only single selection
    });
  };

  // 키워드 제거 핸들러
  const handleKeywordRemove = (main: string, keyword: string) => {
    setFilterState({
      ...filterState,
      [main]: (filterState[main] || []).filter(k => k !== keyword)
    });
  };

  if (!open) return null;

  console.log('Selected filter options:', {
    includeKeyword,
    includeIngredients,
    excludeIngredients,
    selectedKeywordPills,
    selectedChannel
  });

  const handleApplyFilters = () => {
    const options = {
      includeKeyword,
      includeIngredients,
      excludeIngredients,
      selectedCategoryKeywords: selectedKeywordPills,
      selectedChannel
    };
    console.log('Applying filters with options:', options);
    // Call the function to apply filters with the options
    onApply(options);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
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
          <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" onClick={onClose} role="button" aria-label="닫기" style={STYLES.closeButton}>×</span>
          <div className="text-center font-bold text-[12.8px] mb-4 pt-1">필터를 설정해 주세요</div>
          <div className="border-b border-gray-200"></div>
        </div>
        <div className="p-4 mb-2" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 16, paddingBottom: 16 }}>
          {/* 채널 선택: 맨 위로 이동 */}
          <div className="mb-3">
            <div className="font-bold text-[11.2px] mb-2">■ 채널선택</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="channel"
                  value="youtube"
                  checked={(selectedChannel || []).includes('youtube')}
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
                  checked={(selectedChannel || []).includes('naver')}
                  onChange={e => handleChannelChange('naver', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-[11.2px]">네이버</span>
              </label>
            </div>
          </div>
          {/* 고정: 키워드/재료 입력 */}
          <div>
            <div className="mt-2 border-t border-gray-200"></div>
            <div className="mb-3 mt-3">
              <label className="block font-bold text-[11.2px] mb-1">
                ■ 꼭 포함할 키워드 (게시글 제목 혹은 본문)
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-[10px]"
                placeholder="필수 키워드 입력"
                value={includeKeyword || ''}
                onChange={e => setIncludeKeyword(e.target.value)}
              />
            </div>
            <div className="mt-2">
              <div className="font-bold text-[11.2px] mb-1">■ 꼭 포함할 재료</div>
              <div className="relative mb-2">
                <input
                  className="w-full border rounded px-3 py-2 text-[10px]"
                  placeholder="포함할 재료 입력"
                  value={includeInput || ''}
                  onChange={e => setIncludeInput(e.target.value)}
                  onFocus={() => setIncludeFocus(true)}
                  onBlur={() => setTimeout(() => setIncludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(includeInput, includeCandidates, ingredientDict, setIncludeIngredients, setIncludeInput, setIncludeFocus)}
                />
                {includeFocus && includeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-10 max-h-32 overflow-y-auto custom-scrollbar">
                    {includeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
                        onMouseDown={AutoCompleteUtils.createItemClickHandler(item, setIncludeIngredients, setIncludeInput, setIncludeFocus)}
                      >{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              {/* chips for includeIngredients */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(includeIngredients || []).map(ing => (
                  <span key={ing} className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                    {ing}
                    <button
                      type="button"
                      className="ml-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
                      style={STYLES.chipButton}
                      onClick={() => setIncludeIngredients((includeIngredients || []).filter(i => i !== ing))}
                      aria-label="제거"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="font-bold text-[11.2px] mt-4 mb-1">■ 꼭 제외할 재료</div>
              <div className="relative">
                <input
                  className="w-full border rounded px-3 py-2 text-[10px]"
                  placeholder="제외할 재료 입력"
                  value={excludeInput || ''}
                  onChange={e => setExcludeInput(e.target.value)}
                  onFocus={() => setExcludeFocus(true)}
                  onBlur={() => setTimeout(() => setExcludeFocus(false), 150)}
                  onKeyDown={AutoCompleteUtils.createInputHandler(excludeInput, excludeCandidates, ingredientDict, setExcludeIngredients, setExcludeInput, setExcludeFocus)}
                />
                {excludeFocus && excludeCandidates.length > 0 && (
                  <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-10 max-h-32 overflow-y-auto custom-scrollbar">
                    {excludeCandidates.map(item => (
                      <li
                        key={item}
                        className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
                        onMouseDown={AutoCompleteUtils.createItemClickHandler(item, setExcludeIngredients, setExcludeInput, setExcludeFocus)}
                      >{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              {/* chips for excludeIngredients */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(excludeIngredients || []).map(ing => (
                  <span key={ing} className="bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                    {ing}
                    <button
                      type="button"
                      className="ml-1 text-gray-700 hover:text-gray-900 focus:outline-none"
                      style={STYLES.chipButton}
                      onClick={() => setExcludeIngredients((excludeIngredients || []).filter(i => i !== ing))}
                      aria-label="제거"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* 고정: 선택된 키워드 pill (sticky) */}
          <div className="mt-3 border-t border-gray-200 pt-2"></div>
          <div
            className="flex flex-wrap gap-2 mb-2 justify-center sticky top-0 z-10 bg-white"
            style={{ minHeight: 28 }}
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
          {/* 스크롤: 카테고리별 키워드~채널선택 */}
          <div
            className="custom-scrollbar"
            style={{
              ...STYLES.scrollContainer,
              maxHeight: isMobile ? '100px' : '150px', // 모바일에서 더 작게
              paddingTop: 12,
              paddingBottom: 16,
              marginBottom: 4,
              // 스크롤바 항상 표시
              scrollbarWidth: 'thin',
              scrollbarColor: '#bdbdbd #f3f4f6'
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
                          <div className="font-bold text-[11.2px] mb-2">■ {main}</div>
                          {subTree && typeof subTree === 'object'
                            ? Object.entries(subTree).map(([sub, keywordsArr]) => (
                                <div key={sub} className="mb-1">
                                  {sub && <div className="text-[10px] font-semibold text-[#444] mb-1 ml-1">- {sub}</div>}
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {Array.isArray(keywordsArr)
                                      ? keywordsArr.map(({ keyword }) => (
                                          <button
                                            key={keyword}
                                            className={`rounded-full px-3 py-0.5 font-medium text-[10.4px] mb-1 transition-colors ${
                                              ((filterState || {})[main] || []).includes(keyword) ? 'bg-[#555] text-white' : 'bg-white text-[#555] shadow-sm'
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
        <div className="sticky bottom-0 left-0 w-full bg-white p-3 flex justify-center z-20 border-t border-gray-200">
          <button
            className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg"
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