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

// 카테고리별 키워드(RecipeList.tsx에서 복사)
const FILTER_KEYWORDS = {
  효능: [
    { title: '다이어트/체중조절/식이조절', keywords: ['저지방', '저칼로리', '저당', '무설탕', '무염', '고단백', '다이어트', '포만감', '칼로리', '글레스테롤', '저염', '무가당'] },
    { title: '소화·배변·영양 흡수', keywords: ['소화', '변비', '식이섬유'] },
    { title: '노화·피부·세포 관련', keywords: ['노화', '저속노화', '주름개선', '항산화', '세포벽'] },
    { title: '면역·활력·에너지 회복', keywords: ['면역력', '에너지', '신진대사', '컨디션', '피로'] },
    { title: '해독·순환·디톡스', keywords: ['디톡스', '숙취해소', '혈액순환', '독소'] },
    { title: '질환·염증·호흡기', keywords: ['염증완화', '질환', '기관지', '호흡기', '세균'] },
    { title: '성분 특성/영양제어', keywords: ['단백질', '글루텐', '무설탕', '비정제원당'] },
    { title: '건강식·한방·보양식', keywords: ['건강', '보양', '보양음식', '약재', '한방'] },
    { title: '식이제한/특수식단', keywords: ['채식', '당뇨', '글루텐'] },
    { title: '수면·신경 안정', keywords: ['불면증'] },
  ],
  영양분: [
    { title: '', keywords: ['단백질', '아미노산', '오메가', '타우린', '카페인', '비타민', '비타민C', '비타민B', '비타민D', '미네랄', '무기질', '칼슘', '칼륨', '아연', '식이섬유', '그래놀라', '탄수화물'] },
  ],
  대상: [
    { title: '', keywords: ['부모님', '남편', '와이프', '아이', '가족', '어르신', '직장인', '환자'] },
  ],
  TPO: [
    { title: '용도', keywords: ['반찬', '술안주', '와인', '소풍'] },
    { title: '시간대', keywords: ['주말', '아침', '브런치', '간식', '점심', '저녁', '야식'] },
    { title: '상황/장소', keywords: ['운동전', '운동후', '캠핑', '명절', '생일', '추억', '소풍', '잔치상', '여행'] },
    { title: '난이도', keywords: ['초간단', '심플한', '난이도하', '초보', '즉석', '귀차니즘'] },
    { title: '계절·시기', keywords: ['봄', '여름', '가을', '겨울', '환절기', '초복', '중복', '말복', '동지'] },
  ],
  스타일: [
    { title: '', keywords: ['이국', '프랑스', '이탈리안', '스페인', '멕시코', '지중해', '중화', '베트남', '그리스', '서양', '태국', '동남아', '일본', '전통', '강원도', '경양식', '궁중', '경상도', '전라도', '황해도', '키토', '가니쉬', '오마카세'] },
  ],
};

export type FilterState = {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
  [key: string]: string[]; // string index signature 추가
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
  onApply: () => void;
  filterKeywordTree: any;
  setFilterKeywordTree: (tree: any) => void;
}

// CSV 파싱 및 트리 구조 변환 함수
function parseFilterKeywordsCSV(csv: string) {
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

const FilterModal: React.FC<FilterModalProps> = ({ open, onClose, filterState, setFilterState, includeIngredients, setIncludeIngredients, excludeIngredients, setExcludeIngredients, includeInput, setIncludeInput, excludeInput, setExcludeInput, allIngredients, includeKeyword, setIncludeKeyword, onApply, filterKeywordTree, setFilterKeywordTree }) => {
  const [includeFocus, setIncludeFocus] = useState(false);
  const [excludeFocus, setExcludeFocus] = useState(false);
  const myIngredients = getMyIngredients();
  const combinedIngredients = [...new Set([...allIngredients, ...myIngredients])];
  const includeCandidates = combinedIngredients.filter(i => i && i.includes(includeInput) && includeInput && i !== includeInput && !includeIngredients.includes(i));
  const excludeCandidates = combinedIngredients.filter(i => i && i.includes(excludeInput) && excludeInput && i !== excludeInput && !excludeIngredients.includes(i));

  useEffect(() => {
    fetch('/Filter_Keywords.csv')
      .then(res => res.text())
      .then(csv => {
        setFilterKeywordTree(parseFilterKeywordsCSV(csv));
      });
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[340px] max-w-[95vw] relative mt-12 mb-24" style={{maxHeight: 'calc(100vh - 144px)', overflowY: 'auto'}}>
        <div className="sticky top-0 z-10 bg-white" style={{paddingTop: 24, backgroundColor: '#fff', opacity: 1, minHeight: 64}}>
          <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" onClick={onClose} role="button" aria-label="닫기" style={{zIndex: 20}}>×</span>
          <div className="text-center font-bold text-[12.8px] mb-2 pt-2">필터를 설정해 주세요</div>
        </div>
        <div className="p-6 mb-2">
          <div className="mb-2">
            <label className="block font-bold text-[11.2px] mb-1">
              ■ 꼭 포함할 키워드 (게시글 제목 혹은 본문)
            </label>
            <input
              className="w-full border rounded px-3 py-2 text-[10px]"
              placeholder="필수 키워드 입력"
              value={includeKeyword}
              onChange={e => setIncludeKeyword(e.target.value)}
            />
          </div>
          <div className="mt-2">
            <div className="font-bold text-[11.2px] mb-1">■ 꼭 포함할 재료</div>
            <div className="relative mb-2">
              <input
                className="w-full border rounded px-3 py-2 text-[10px]"
                placeholder="포함할 재료 입력"
                value={includeInput}
                onChange={e => setIncludeInput(e.target.value)}
                onFocus={() => setIncludeFocus(true)}
                onBlur={() => setTimeout(() => setIncludeFocus(false), 150)}
              />
              {includeFocus && includeCandidates.length > 0 && (
                <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-10 max-h-32 overflow-y-auto">
                  {includeCandidates.map(item => (
                    <li
                      key={item}
                      className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
                      onMouseDown={() => {
                        setIncludeIngredients([...includeIngredients, item]);
                        setIncludeInput('');
                        setIncludeFocus(false);
                      }}
                    >{item}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* chips for includeIngredients */}
            <div className="flex flex-wrap gap-1 mb-2">
              {includeIngredients.map(ing => (
                <span key={ing} className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                  {ing}
                  <button
                    type="button"
                    className="ml-1 text-yellow-700 hover:text-yellow-900 focus:outline-none"
                    style={{ fontSize: 14, lineHeight: 1, padding: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setIncludeIngredients(includeIngredients.filter(i => i !== ing))}
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
                value={excludeInput}
                onChange={e => setExcludeInput(e.target.value)}
                onFocus={() => setExcludeFocus(true)}
                onBlur={() => setTimeout(() => setExcludeFocus(false), 150)}
              />
              {excludeFocus && excludeCandidates.length > 0 && (
                <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-10 max-h-32 overflow-y-auto">
                  {excludeCandidates.map(item => (
                    <li
                      key={item}
                      className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer text-[12px]"
                      onMouseDown={() => {
                        setExcludeIngredients([...excludeIngredients, item]);
                        setExcludeInput('');
                        setExcludeFocus(false);
                      }}
                    >{item}</li>
                  ))}
                </ul>
              )}
            </div>
            {/* chips for excludeIngredients */}
            <div className="flex flex-wrap gap-1 mb-2">
              {excludeIngredients.map(ing => (
                <span key={ing} className="bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                  {ing}
                  <button
                    type="button"
                    className="ml-1 text-gray-700 hover:text-gray-900 focus:outline-none"
                    style={{ fontSize: 14, lineHeight: 1, padding: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setExcludeIngredients(excludeIngredients.filter(i => i !== ing))}
                    aria-label="제거"
                  >×</button>
                </span>
              ))}
            </div>
          </div>
          {/* 카테고리별 태그 */}
          <div className="mt-4">
            {/* 동적 카테고리 렌더링 */}
            {filterKeywordTree && Object.entries(filterKeywordTree).map(([main, subTree]) => (
              <div key={main}>
                <div className="font-bold text-[11.2px] mt-4 mb-2">■ {main}</div>
                {Object.entries(subTree).map(([sub, keywordsArr]) => (
                  <div key={sub} className="mb-1">
                    {sub && <div className="text-[10px] font-semibold text-[#444] mb-1 ml-1">- {sub}</div>}
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(keywordsArr as { keyword: string, synonyms: string[] }[]).map(({ keyword }) => (
                        <button
                          key={keyword}
                          className={`rounded-full px-3 py-0.5 font-medium text-[10.4px] mb-1 transition-colors ${
                            (filterState[main] || []).includes(keyword) ? 'bg-[#555] text-white' : 'bg-[#F8F8F8] text-[#555]'
                          }`}
                          onClick={() => {
                            const arr = filterState[main] || [];
                            setFilterState({
                              ...filterState,
                              [main]: arr.includes(keyword)
                                ? arr.filter((x: string) => x !== keyword)
                                : [...arr, keyword]
                            });
                          }}
                        >{keyword}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 left-0 w-full bg-white p-4 flex justify-center z-20">
          <button
            className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg"
            style={{maxWidth: 320}}
            onClick={onApply}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal; 