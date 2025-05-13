import React, { useState, useEffect } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';
import FilterModal from '../components/FilterModal';
import IngredientDateModal from '../components/IngredientDateModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';
import { useNavigate } from 'react-router-dom';

// 더미 데이터 예시
const dummyRecipes = [
  {
    id: 1,
    rank: 1,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
    title: "요즘 핫한 감자전 레시피",
    like: 110,
    comment: 13,
    mainIngredients: [
      "감자", "양파", "전분", "소금", "후추", "식용유", "당근", "파프리카", "베이컨", "치즈"
    ],
    needToBuy: ["전분"],
    substitutes: ["고구마→감자", "전분→감자"],
  },
  {
    id: 2,
    rank: 2,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
    title: "다이어트 김밥 만들기",
    like: 90,
    comment: 10,
    mainIngredients: [
      "오이", "김", "밥", "당근", "계란", "참치", "마요네즈", "시금치", "단무지", "햄"
    ],
    needToBuy: ["밥"],
    substitutes: ["당근→오이", "밥→곤약밥"],
  },
  {
    id: 3,
    rank: 3,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
    title: "황태해장국",
    like: 80,
    comment: 9,
    mainIngredients: [
      "황태", "무", "대파", "달걀", "마늘", "국간장", "참기름", "후추", "청양고추", "두부"
    ],
    needToBuy: ["대파"],
    substitutes: ["두부→황태", "청양고추→고추"],
  },
];

const dummyIngredients = [
  {
    id: 1,
    rank: 1,
    name: "두릅",
    count: 200,
    rate: 20,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 2,
    rank: 2,
    name: "머위나물",
    count: 150,
    rate: 16,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 3,
    rank: 3,
    name: "도다리",
    count: 44,
    rate: 8,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
];

const dummyThemes = [
  {
    id: 1,
    rank: 1,
    name: "저소노화",
    count: 403,
    rate: 21,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 2,
    rank: 2,
    name: "어버이날",
    count: 205,
    rate: 15,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 3,
    rank: 3,
    name: "기관지",
    count: 654,
    rate: 7,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  },
];

// 필터 상태 타입 및 초기값 (RecipeList.tsx와 동일)
type FilterState = {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
};
const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

const periodOptions = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번주' },
  { value: 'month', label: '이번달' },
  { value: 'custom', label: '기간선택' },
];

const Popular = () => {
  const [search, setSearch] = useState('');
  const nickname = "닉네임"; // 실제 닉네임 연동 필요
  const navigate = useNavigate();

  // 필터 관련 상태 (RecipeList.tsx와 동일)
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [period, setPeriod] = useState('today');
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[Date|null, Date|null]>([null, null]);
  const [dateInputStart, setDateInputStart] = useState('');
  const [dateInputEnd, setDateInputEnd] = useState('');
  const [toast, setToast] = useState('');

  // 각 레시피별 완료/기록 상태 관리
  const [buttonStates, setButtonStates] = useState<{ [id: number]: { done: boolean; write: boolean } }>({});

  // 내 냉장고 재료 불러오기 (RecipeList.tsx와 동일)
  function getMyIngredients() {
    try {
      const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
      if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
        return [...data.frozen, ...data.fridge, ...data.room].map(i => (typeof i === 'string' ? i : i.name));
      }
    } catch {}
    return [];
  }
  const myIngredients = getMyIngredients();

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
      });
  }, []);

  // 기간 드롭다운 핸들러
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeriod(val);
    if (val === 'custom') setDateModalOpen(true);
  };

  // 날짜 입력 핸들러 (각각)
  const handleDateInputChange = (which: 'start' | 'end') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    // 20250505 → 2025.05.05
    value = value.replace(/(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3');
    if (which === 'start') setDateInputStart(value);
    else setDateInputEnd(value);
    // 자동으로 dateRange에 반영
    const m = value.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
      if (which === 'start') setDateRange([d, dateRange[1]]);
      else setDateRange([dateRange[0], d]);
    }
  };

  // 기간 라벨 표시
  let periodLabel = periodOptions.find(o => o.value === period)?.label || '';
  if (period === 'custom' && dateRange[0] && dateRange[1]) {
    periodLabel = `${dateRange[0].getFullYear()}.${String(dateRange[0].getMonth()+1).padStart(2,'0')}.${String(dateRange[0].getDate()).padStart(2,'0')}~${dateRange[1].getFullYear()}.${String(dateRange[1].getMonth()+1).padStart(2,'0')}.${String(dateRange[1].getDate()).padStart(2,'0')}`;
  }

  const handleDoneClick = (recipeId: number) => {
    setButtonStates(prev => {
      const prevState = prev[recipeId] || { done: false, write: false };
      const isActive = !!prevState.done;
      const newState = { ...prevState, done: !isActive };
      setToast(isActive ? '레시피 완료를 취소했습니다!' : '레시피를 완료했습니다!');
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [recipeId]: newState };
    });
  };

  const handleRecordClick = (recipeId: number) => {
    setButtonStates(prev => {
      const prevState = prev[recipeId] || { done: false, write: false };
      const isActive = !!prevState.write;
      const newState = { ...prevState, write: !isActive };
      setToast(isActive ? '레시피 기록을 취소했습니다!' : '레시피를 기록했습니다!');
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [recipeId]: newState };
    });
  };

  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.href);
    setToast('URL이 복사되었습니다!');
    setTimeout(() => setToast(''), 1500);
  };

  // 기간 워딩 함수
  const getPeriodText = (period: string) => {
    if (period === 'today') return '전일대비 게시글량';
    if (period === 'week') return '전주대비 게시글량';
    if (period === 'month') return '전달대비 게시글량';
    return '기간대비 게시글량';
  };

  return (
    <>
      <TopNavBar />
      <div className="popular-page" style={{padding: '32px 32px 80px 32px', maxWidth: 900, margin: '0 auto'}}>
        {/* 상단 타이틀 */}
        <header style={{marginBottom: 32}}>
          <h2 className="text-lg font-bold mb-4 text-center" style={{marginBottom: 32}}>
            인기 요리·재료부터 테마 추천까지
          </h2>
        </header>

        {/* 정렬/필터 바 */}
        <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24}}>
          <select
            style={{height: 28, border: '1px solid #ccc', borderRadius: 6, fontSize: 14, padding: '0 10px', fontWeight: 700, background: '#fff', color: '#404040', minWidth: 100}}
            value={period}
            onChange={handlePeriodChange}
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 16px', borderRadius: 999, border: '1px solid #ccc', background: '#fff', color: '#444', fontWeight: 600, fontSize: 14, height: 28, cursor: 'pointer'}}
            onClick={() => setFilterOpen(true)}
          >
            <span style={{fontWeight: 700}}>필터</span>
          </button>
        </div>

        {/* 기간선택 모달 */}
        {dateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={() => setDateModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative" onClick={e => e.stopPropagation()}>
              <span className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" onClick={() => setDateModalOpen(false)} role="button" aria-label="닫기">×</span>
              <div className="text-center font-bold text-[14px] mb-4">기간을 입력하세요</div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[14px]"
                  placeholder="2025.05.05"
                  maxLength={10}
                  value={dateInputStart}
                  onChange={handleDateInputChange('start')}
                />
                <span className="mx-1 text-gray-500">~</span>
                <input
                  type="text"
                  className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[14px]"
                  placeholder="2025.05.13"
                  maxLength={10}
                  value={dateInputEnd}
                  onChange={handleDateInputChange('end')}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <DatePicker
                  selectsRange
                  startDate={dateRange[0]}
                  endDate={dateRange[1]}
                  onChange={(update: [Date|null, Date|null]) => {
                    setDateRange(update);
                    if (update[0]) {
                      const f = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                      setDateInputStart(f(update[0]));
                    }
                    if (update[1]) {
                      const f = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                      setDateInputEnd(f(update[1]));
                    }
                  }}
                  inline
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                />
              </div>
              <div className="flex mt-4">
                <button
                  className="flex-1 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center mx-auto"
                  style={{ maxWidth: '100%' }}
                  onClick={() => {
                    setDateModalOpen(false);
                    if (dateRange[0] && dateRange[1]) setPeriod('custom');
                  }}
                  disabled={!(dateRange[0] && dateRange[1])}
                >확인</button>
              </div>
            </div>
          </div>
        )}

        {/* 필터 팝업 */}
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
          />
        )}

        {/* ⓑ 전체 인기 레시피 섹션 (가로 스크롤) */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8}}>
            <h2 className="text-[16px] font-bold text-[#111] mb-2">전체 인기 레시피</h2>
            <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          </div>
          <div style={{display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8}}>
            {dummyRecipes.map((recipe, idx) => (
              <div key={recipe.id} style={{minWidth: 240, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative'}}>
                <div style={{position: 'relative', width: '100%', height: 140}}>
                  <img src={recipe.thumbnail} alt="썸네일" style={{width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 8}} />
                  {/* 순위 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-90 text-white font-bold rounded px-1.5 py-0 flex items-center shadow" style={{position: 'absolute', top: 0, left: 0, fontSize: 12, zIndex: 2}}>
                    {recipe.rank}위
                  </div>
                  {/* 재료매칭률 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-90 text-white font-bold rounded px-1.5 py-0 flex items-center gap-1 shadow" style={{position: 'absolute', top: 24, left: 0, fontSize: 11, zIndex: 2}}>
                    재료 매칭률 <span className="text-[#FFD600] font-extrabold ml-1">80%</span>
                  </div>
                  {/* 완료/공유/기록 버튼 */}
                  <div style={{position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', zIndex: 2}}>
                    <span style={{position: 'relative', zIndex: 2}}>
                      <span style={{position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1}}></span>
                      <button title="완료" tabIndex={0} style={{width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2}} onClick={() => handleDoneClick(recipe.id)}>
                        <img src={완료하기버튼} alt="완료" width={19} height={19} style={{display: 'block', position: 'relative', zIndex: 2}} />
                      </button>
                    </span>
                    <span style={{position: 'relative', zIndex: 2}}>
                      <span style={{position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1}}></span>
                      <button title="공유" tabIndex={0} style={{width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2}} onClick={handleShareClick}>
                        <img src={공유하기버튼} alt="공유" width={19} height={19} style={{display: 'block', position: 'relative', zIndex: 2}} />
                      </button>
                    </span>
                    <span style={{position: 'relative', zIndex: 2}}>
                      <span style={{position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1}}></span>
                      <button title="기록" tabIndex={0} style={{width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 2}} onClick={() => handleRecordClick(recipe.id)}>
                        <img src={기록하기버튼} alt="기록" width={19} height={19} style={{display: 'block', position: 'relative', zIndex: 2}} />
                      </button>
                    </span>
                  </div>
                </div>
                <div style={{padding: '16px 16px 12px 16px'}}>
                  <div style={{fontWeight: 700, fontSize: 16, marginBottom: 4}}>{recipe.title}</div>
                  <div style={{fontSize: 13, color: '#888', marginBottom: 4}}>좋아요 {recipe.like} · 댓글 {recipe.comment}</div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'nowrap',
                      gap: 4,
                      marginBottom: 4,
                      overflowX: 'auto',
                      maxWidth: '100%',
                      scrollbarWidth: 'auto',
                      alignItems: 'center',
                      paddingBottom: 4,
                    }}
                    className="custom-scrollbar pr-1"
                  >
                    {(() => {
                      const recipeSet = new Set(recipe.mainIngredients);
                      const mySet = new Set(myIngredients);
                      const needIngredients = recipe.mainIngredients.filter(i => !mySet.has(i));
                      const haveIngredients = recipe.mainIngredients.filter(i => mySet.has(i));
                      return [
                        ...needIngredients.map(i => (
                          <span
                            key={i}
                            className="bg-[#D1D1D1] text-white rounded-full px-3 py-0.5 font-medium"
                            style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center' }}
                          >
                            {i}
                          </span>
                        )),
                        ...haveIngredients.map(i => (
                          <span
                            key={i}
                            className="bg-[#555] text-white rounded-full px-3 py-0.5 font-medium"
                            style={{ fontSize: '10.4px', lineHeight: 1.3, whiteSpace: 'nowrap', height: 22, display: 'inline-flex', alignItems: 'center' }}
                          >
                            {i}
                          </span>
                        ))
                      ];
                    })()}
                  </div>
                  {/* 대체재 */}
                  {recipe.substitutes && recipe.substitutes.length > 0 && (
                    <div
                      className="mt-1 custom-scrollbar pr-1"
                      style={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: 4,
                        overflowX: 'auto',
                        maxWidth: '100%',
                        alignItems: 'center',
                        paddingBottom: 4,
                      }}
                    >
                      <span className="bg-[#FFE066] text-[#444] rounded px-3 py-1 font-bold" style={{ fontSize: '12px', flex: '0 0 auto' }}>대체 가능 :</span>
                      {recipe.substitutes.map((sub, idx) => (
                        <span key={sub} className="ml-2 font-semibold text-[#444]" style={{ fontSize: '12px', flex: '0 0 auto' }}>{sub}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ⓒ 인기 재료 */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8}}>
            <h2 className="text-[16px] font-bold text-[#111] mb-2">인기 재료</h2>
            <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          </div>
          <div style={{display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8}}>
            {dummyIngredients.map((i) => (
              <div
                key={i.id}
                onClick={() => navigate(`/ingredient/${encodeURIComponent(i.name)}`)}
                style={{
                  cursor: 'pointer',
                  minWidth: 240,
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 2px 8px #eee',
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{position: 'relative', width: '100%', height: 140}}>
                  <img src={i.thumbnail} alt={i.name} style={{width: '100%', height: 140, objectFit: 'cover'}} />
                  {/* 순위 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-90 text-white font-bold rounded px-1.5 py-0 flex items-center shadow" style={{position: 'absolute', top: 0, left: 0, fontSize: 12, zIndex: 2}}>
                    {i.rank}위
                  </div>
                </div>
                <div style={{padding: '16px 16px 12px 16px'}}>
                  <div style={{fontWeight: 700, fontSize: 16, marginBottom: 4}}>{i.name}</div>
                  <div style={{fontSize: 13, color: '#888', marginBottom: 4}}>
                    관련 레시피 <b style={{fontWeight:700}}>총 {i.count}건</b>
                  </div>
                  <div style={{fontSize: 13, color: '#888'}}>
                    {getPeriodText(period)} <b style={{fontWeight:700}}>{i.rate}% 상승</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ⓓ 인기 테마 */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8}}>
            <h2 className="text-[16px] font-bold text-[#111] mb-2">인기 테마</h2>
            <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          </div>
          <div style={{display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8}}>
            {dummyThemes.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/ingredient/${encodeURIComponent(t.name)}`)}
                style={{
                  cursor: 'pointer',
                  minWidth: 240,
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 2px 8px #eee',
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{position: 'relative', width: '100%', height: 140}}>
                  <img src={t.thumbnail} alt={t.name} style={{width: '100%', height: 140, objectFit: 'cover'}} />
                  {/* 순위 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-90 text-white font-bold rounded px-1.5 py-0 flex items-center shadow" style={{position: 'absolute', top: 0, left: 0, fontSize: 12, zIndex: 2}}>
                    {t.rank}위
                  </div>
                </div>
                <div style={{padding: '16px 16px 12px 16px'}}>
                  <div style={{fontWeight: 700, fontSize: 16, marginBottom: 4}}>{t.name}</div>
                  <div style={{fontSize: 13, color: '#888', marginBottom: 4}}>
                    관련 레시피 <b style={{fontWeight:700}}>총 {t.count}건</b>
                  </div>
                  <div style={{fontSize: 13, color: '#888'}}>
                    {getPeriodText(period)} <b style={{fontWeight:700}}>{t.rate}% 상승</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ⓔ 키워드 검색 */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8}}>
            <h2 className="text-[16px] font-bold text-[#111] mb-2">특정 재료·키워드 기반으로 인기 레시피 찾아보기</h2>
            <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          </div>
          <input
            className="search-input"
            style={{
              width: '100%',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 12,
              marginBottom: 8,
            }}
            placeholder="관심있는 재료·테마 키워드 등을 자유롭게 입력하세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // 검색결과 페이지로 이동
              }
            }}
          />
        </section>
      </div>
      <BottomNavBar activeTab="popularity" />

      {/* Toast Popup */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34,34,34,0.9)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 12,
          fontWeight: 400,
          fontSize: 15,
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          maxWidth: 260,
          width: 'max-content',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}>
          {toast}
        </div>
      )}
    </>
  );
};

export default Popular;