import React, { useEffect, useState } from 'react';
import RecipeCard from './RecipeCard';
import FilterModal from './FilterModal';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

interface Recipe {
  id: number;
  title: string;
  author: string;
  date: string;
  body: string;
  thumbnail: string;
  used_ingredients: string;
  link: string;
  likes?: number;
  comments?: number;
  substitutes?: string[];
  match_rate?: number;
  my_ingredients?: string[];
  need_ingredients?: string[];
}

interface RecipeSortBarProps {
  recipes: Recipe[];
  myIngredients?: string[];
  substituteTable?: { [key: string]: SubstituteInfo };
}

const RecipeSortBar = ({ recipes, myIngredients = [], substituteTable = {} }: RecipeSortBarProps) => {
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<any>({ 효능: [], 영양분: [], 대상: [], TPO: [], 스타일: [] });
  const [includeInput, setIncludeInput] = useState<string>('');
  const [excludeInput, setExcludeInput] = useState<string>('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [includeKeyword, setIncludeKeyword] = useState<string>('');
  const [matchRateModalOpen, setMatchRateModalOpen] = useState<boolean>(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState<boolean>(false);
  const [matchRange, setMatchRange] = useState<[number, number]>([0, 100]);
  const [maxLack, setMaxLack] = useState<'unlimited' | number>('unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [sortType, setSortType] = useState<string>('latest');

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

  // 내 냉장고 재료 모두 합치기
  function getMyIngredientObjects() {
    try {
      const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
      if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
        return [...data.frozen, ...data.fridge, ...data.room];
      }
    } catch {}
    return [];
  }
  const myIngredientObjects = getMyIngredientObjects();

  // 유통기한 임박순/구매일 오래된순 리스트
  const expiryList = myIngredientObjects
    .filter(i => i.expiry)
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  const purchaseList = myIngredientObjects
    .filter(i => i.purchase)
    .sort((a, b) => new Date(a.purchase).getTime() - new Date(b.purchase).getTime());

  // D-day 계산 함수
  function getDDay(expiry: string) {
    if (!expiry) return '';
    const today = new Date();
    const exp = new Date(expiry);
    if (isNaN(exp.getTime())) return expiry;
    const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / (1000*60*60*24));
    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return 'D-DAY';
    return `D+${Math.abs(diff)}`;
  }

  // 매칭률 계산
  function getMatchRate(myIngredients: string[], recipeIngredients: string) {
    const recipeSet = new Set(
      recipeIngredients.split(',').map((i: string) => i.trim()).filter(Boolean)
    );
    const mySet = new Set(myIngredients);
    const matched = [...recipeSet].filter((i: string) => mySet.has(i));
    return {
      rate: recipeSet.size === 0 ? 0 : Math.round((matched.length / recipeSet.size) * 100),
      my_ingredients: matched,
      need_ingredients: [...recipeSet].filter((i: string) => !mySet.has(i)),
    };
  }

  // 필터 적용
  let filteredRecipes = recipes
    .map(recipe => {
      const match = getMatchRate(myIngredients, recipe.used_ingredients || '');
      return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
    })
    .filter(recipe => {
      const matchRate = Number(recipe.match_rate ?? 0);
      const inMatchRange = matchRate >= matchRange[0] && matchRate <= matchRange[1];
      const lackCount = recipe.need_ingredients ? recipe.need_ingredients.length : 0;
      let lackOk = true;
      if (maxLack !== 'unlimited') {
        if (maxLack === 5) {
          lackOk = lackCount >= 5;
        } else {
          lackOk = lackCount <= maxLack;
        }
      }
      let expiryOk = true;
      if (appliedExpiryIngredients.length > 0) {
        expiryOk = appliedExpiryIngredients.every(ing => (recipe.used_ingredients || '').includes(ing));
      }
      return inMatchRange && lackOk && expiryOk;
    });

  // 정렬
  if (sortType === 'latest') filteredRecipes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  else if (sortType === 'comment') filteredRecipes.sort((a, b) => (b.comments || 0) - (a.comments || 0));
  else if (sortType === 'like') filteredRecipes.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else if (sortType === 'match') filteredRecipes.sort((a, b) => (b.match_rate || 0) - (a.match_rate || 0));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, width: '100%', marginTop: 24, flexWrap: 'wrap' }}>
        <button style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }} onClick={() => setMatchRateModalOpen(true)}>재료 매칭도 설정</button>
        <button style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 70, marginRight: 0, whiteSpace: 'nowrap', lineHeight: '28px', boxSizing: 'border-box', cursor: 'pointer' }} onClick={() => setExpiryModalOpen(true)}>임박 재료 설정</button>
        <div style={{ position: 'relative', minWidth: 80 }}>
          <select aria-label="정렬 기준 선택" value={sortType} onChange={e => setSortType(e.target.value)} style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, padding: '0 22px 0 8px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 80, marginRight: 0, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
            <option value="latest">최신순</option>
            <option value="like">좋아요순</option>
            <option value="comment">댓글순</option>
            <option value="match">재료매칭률순</option>
          </select>
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 13, color: '#888' }}>▼</span>
        </div>
        <button style={{ height: 28, border: '1px solid #D1D5DB', borderRadius: 999, fontSize: 12, padding: '0 12px', fontWeight: 600, background: '#fff', color: '#222', minWidth: 50, whiteSpace: 'nowrap', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto' }} onClick={() => setFilterOpen(true)}><span style={{ fontWeight: 600 }}>필터</span></button>
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
                <input type="number" min={0} max={matchRange[1]} value={matchRange[0]} onChange={e => setMatchRange([Math.min(Number(e.target.value), matchRange[1]), matchRange[1]])} className="w-12 border rounded px-1 text-xs text-center" />
                <span className="text-xs">%</span>
                <span className="mx-1 text-xs">~</span>
                <input type="number" min={matchRange[0]} max={100} value={matchRange[1]} onChange={e => setMatchRange([matchRange[0], Math.max(Number(e.target.value), matchRange[0])])} className="w-12 border rounded px-1 text-xs text-center" />
                <span className="text-xs">%</span>
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
              {/* 최대 n개 부족 라디오 */}
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {[1,2,3,4].map(n => (
                  <label key={n} className="flex items-center gap-1">
                    <input type="radio" name="maxLack" checked={maxLack === n} onChange={() => setMaxLack(n)} />
                    최대 {n}개 부족
                  </label>
                ))}
                <label className="flex items-center gap-1">
                  <input type="radio" name="maxLack" checked={maxLack === 5} onChange={() => setMaxLack(5)} />
                  5개 이상 부족
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="maxLack" checked={maxLack === 'unlimited' || maxLack === null} onChange={() => setMaxLack('unlimited')} />
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
                <button className={`flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg ${expirySortType==='expiry' ? 'bg-gray-200' : 'bg-white'}`} onClick={() => setExpirySortType('expiry')}>유통기한 임박순</button>
                <button className={`flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg ${expirySortType==='purchase' ? 'bg-gray-200' : 'bg-white'}`} onClick={() => setExpirySortType('purchase')}>구매일 오래된순</button>
              </div>
              {/* 재료 리스트 스크롤 영역 */}
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {(expirySortType === 'expiry' ? expiryList : purchaseList).length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-6">해당 정보가 입력된 재료가 없습니다.</div>
                )}
                {(expirySortType === 'expiry' ? expiryList : purchaseList).map(item => (
                  <div key={item.name} className="flex items-center justify-between p-2">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-gray-400 ml-auto" style={{ minWidth: 60, textAlign: 'right' }}>
                      {expirySortType === 'expiry' ? getDDay(item.expiry) : (item.purchase || '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button className="w-full bg-[#3c3c3c] text-white font-bold py-2 rounded-lg mt-2" onClick={() => setExpiryModalOpen(false)}>선택 재료 포함 레시피만 보기</button>
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
      {/* 레시피 리스트 */}
      <div className="flex flex-col gap-2">
        {filteredRecipes.map((recipe, idx) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            index={idx}
            onAction={() => {}}
            isLast={false}
            actionState={undefined}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
          />
        ))}
      </div>
    </>
  );
};

export default RecipeSortBar; 