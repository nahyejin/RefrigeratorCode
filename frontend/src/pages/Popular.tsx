import React, { useState, useEffect, useMemo } from 'react';
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
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';
import IngredientPillGroup from '../components/IngredientPillGroup';
import axios from 'axios';
import { Recipe } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { calculateMatchRate } from '../utils/recipeUtils';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

// 더미 데이터 예시
const dummyRecipes = [
  {
    id: 1,
    rank: 1,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
    title: "요즘 핫한 감자전 레시피",
    like: 110,
    comment: 13,
    used_ingredients: [
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
    used_ingredients: [
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
    used_ingredients: [
      "황태", "무", "대파", "달걀", "마늘", "국간장", "참기름", "후추", "청양고추", "두부"
    ],
    needToBuy: ["대파"],
    substitutes: ["두부→황태", "청양고추→고추"],
  },
];

const dummyIngredients = [
  { id: 1, rank: 1, name: "두릅", count: 200, rate: 20, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 2, rank: 2, name: "머위나물", count: 150, rate: 16, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 3, rank: 3, name: "도다리", count: 44, rate: 8, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 4, rank: 4, name: "삼겹살", count: 420, rate: 12, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 5, rank: 5, name: "대파", count: 380, rate: 7, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 6, rank: 6, name: "계란", count: 350, rate: 5, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 7, rank: 7, name: "양파", count: 320, rate: 3, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 8, rank: 8, name: "두부", count: 300, rate: 2, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 9, rank: 9, name: "닭가슴살", count: 280, rate: -1, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 10, rank: 10, name: "감자", count: 260, rate: -3, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
];

const dummyThemes = [
  { id: 1, rank: 1, name: "저소노화", count: 403, rate: 21, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 2, rank: 2, name: "어버이날", count: 205, rate: 15, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 3, rank: 3, name: "기관지", count: 654, rate: 7, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 4, rank: 4, name: "다이어트", count: 600, rate: 18, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 5, rank: 5, name: "비건", count: 580, rate: 12, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 6, rank: 6, name: "여름별미", count: 540, rate: 10, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 7, rank: 7, name: "한식", count: 500, rate: 8, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 8, rank: 8, name: "집밥", count: 480, rate: 5, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 9, rank: 9, name: "간편식", count: 470, rate: 2, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
  { id: 10, rank: 10, name: "브런치", count: 450, rate: -2, thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80" },
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

// 재료 TOP 10 계산 함수
const calculateIngredientRankings = (recipes: Recipe[]) => {
  const ingredientCounts: { [key: string]: number } = {};
  
  recipes.forEach(recipe => {
    if (recipe.used_ingredients) {
      const ingredients = recipe.used_ingredients.split(',').map(i => i.trim());
      ingredients.forEach(ingredient => {
        ingredientCounts[ingredient] = (ingredientCounts[ingredient] || 0) + 1;
      });
    }
  });

  return Object.entries(ingredientCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      count: item.count,
      rate: 0, // 현재는 증가율 계산하지 않음
      thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
    }));
};

// 테마 TOP 10 계산 함수
const calculateThemeRankings = async (recipes: Recipe[]) => {
  const themeCounts: { [key: string]: number } = {};
  
  try {
    console.log('Starting theme ranking calculation with', recipes.length, 'recipes');
    
    // Filter_Keywords.csv에서 키워드 목록 가져오기
    const response = await fetch('/Filter_Keywords.csv');
    if (!response.ok) {
      throw new Error('Filter_Keywords.csv 파일을 불러올 수 없습니다');
    }
    const csv = await response.text();
    
    const lines = csv.split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    
    const keywordIdx = header.indexOf('키워드');
    const synonymIdx = header.indexOf('동의어');
    const categoryIdx = header.indexOf('대분류');
    
    if (keywordIdx === -1) {
      throw new Error('키워드 컬럼을 찾을 수 없습니다');
    }
    
    // 키워드와 동의어를 매핑하는 객체 생성
    const keywordMap = new Map<string, Set<string>>();
    
    lines.slice(1).forEach(line => {
      const columns = line.split(',').map(col => col.trim());
      const keyword = columns[keywordIdx];
      const synonyms = columns[synonymIdx] ? columns[synonymIdx].split('|').filter(Boolean) : [];
      
      if (keyword) {
        const keywordSet = new Set([keyword, ...synonyms]);
        keywordMap.set(keyword, keywordSet);
      }
    });

    // 통과한 레시피 ID를 저장할 배열
    const passedRecipeIds: number[] = [];

    recipes.forEach(recipe => {
      keywordMap.forEach((synonyms, keyword) => {
        const allKeywords = [keyword, ...Array.from(synonyms)];
        const text = (recipe.title || '') + ' ' + (recipe.content || '');
        let totalMatches = 0;
        
        // 각 키워드별로 독립적으로 매칭 횟수 체크
        const hasEnoughMatches = allKeywords.some(k => {
          if (!k) return false;
          const regex = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = text.match(regex);
          return matches && matches.length >= 2;
        });

        if (hasEnoughMatches) {
          themeCounts[keyword] = (themeCounts[keyword] || 0) + 1;
          if (keyword === '주말') {
            passedRecipeIds.push(recipe.id);
          }
        }
      });
    });

    // "주말" 키워드의 최종 결과만 간단히 출력
    if (themeCounts['주말']) {
      console.log('\n[주말 키워드 최종 결과]');
      console.log(`매칭된 레시피 수: ${themeCounts['주말']}개`);
      console.log('통과한 레시피 ID:', passedRecipeIds.join(', '));
    }

    const rankings = Object.entries(themeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({
        id: index + 1,
        rank: index + 1,
        name: item.name,
        count: item.count,
        rate: 0,
        thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
      }));
    
    return rankings;
  } catch (error) {
    console.error('테마 랭킹 계산 오류:', error);
    return [];
  }
};

const getPlatformLogo = (platform: string | undefined) => {
  if (platform === 'naver(인플루언서핫토픽)' || platform === 'naver(주제별보기)') return naverLogo;
  if (platform === '유튜브(인플루언서)') return youtubeLogo;
  return null;
};

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
  const [includeKeyword, setIncludeKeyword] = useState('');

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

  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [ingredientRankings, setIngredientRankings] = useState<typeof dummyIngredients>([]);
  const [themeRankings, setThemeRankings] = useState<typeof dummyThemes>([]);

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

  // Fetch recipes and calculate popularity scores (ignore date filter, show up to 30)
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/recipes')
      .then((res) => {
        const recipesWithScores = res.data.map((recipe: Recipe) => ({
          ...recipe,
          score: (recipe.likes || 0) + ((recipe.comments || 0) * 2)
        }));
        // Sort by popularity score
        const sortedRecipes = recipesWithScores.sort((a: Recipe & {score: number}, b: Recipe & {score: number}) => b.score - a.score);
        // Take all recipes (remove slice)
        setRecipes(sortedRecipes);
      })
      .catch((err) => {
        console.error('Failed to fetch recipes:', err);
        setRecipes([]); // fallback: 빈 배열
      });
  }, []);

  // 레시피 데이터 로드 시 랭킹 계산
  useEffect(() => {
    const calculateRankings = async () => {
      if (recipes.length > 0) {
        try {
          // 재료 랭킹 계산
          const ingredientRanks = calculateIngredientRankings(recipes);
          setIngredientRankings(ingredientRanks);

          // 테마 랭킹 계산
          const themeRanks = await calculateThemeRankings(recipes);
          setThemeRankings(themeRanks);
        } catch (error) {
          console.error('테마 랭킹 계산 오류');
        }
      }
    };

    calculateRankings();
  }, [recipes]);

  // 더미 데이터 대신 실제 데이터 사용
  const sortedIngredients = ingredientRankings;
  const sortedThemes = themeRankings;

  const [sortType, setSortType] = useState('match');
  const [matchRange, setMatchRange] = useState<[number, number]>([30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');

  // Restore sort/filter state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('recipe_sortbar_state_popular');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.sortType) setSortType(state.sortType);
        if (state.matchRange) setMatchRange(state.matchRange);
        if (state.maxLack !== undefined) setMaxLack(state.maxLack);
        if (state.appliedExpiryIngredients) setAppliedExpiryIngredients(state.appliedExpiryIngredients);
        if (state.expirySortType) setExpirySortType(state.expirySortType);
      } catch {}
    }
  }, []);

  // Save sort/filter state to localStorage on change
  useEffect(() => {
    localStorage.setItem('recipe_sortbar_state_popular', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

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
                  onChange={e => setDateInputStart(e.target.value)}
                />
                <span className="mx-1 text-gray-500">~</span>
                <input
                  type="text"
                  className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[14px]"
                  placeholder="2025.05.13"
                  maxLength={10}
                  value={dateInputEnd}
                  onChange={e => setDateInputEnd(e.target.value)}
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

        {/* ⓑ 전체 인기 레시피 섹션 (가로 스크롤) */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8}}>
            <h2 className="text-[16px] font-bold text-[#111] mb-2"><span className="mr-1">🏆</span>전체 인기 레시피</h2>
            <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          </div>
          {/* 범례: 가로형 레시피 카드 위, 왼쪽 정렬 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 0, justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>부족 재료</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>대체 가능</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>보유 재료</span>
            </div>
          </div>
          <div style={{display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8}}>
            {recipes.map((recipe: Recipe, idx: number) => {
              // substitutes 배열을 substituteTable 객체로 변환
              const substituteTable: { [key: string]: { ingredient_b: string } } = {};
              if (Array.isArray(recipe.substitutes)) {
                recipe.substitutes.forEach((sub: string) => {
                  const [from, to] = sub.split('→').map((s: string) => s.trim());
                  if (from && to) substituteTable[from] = { ingredient_b: to };
                });
              }
              const ingredientList = typeof recipe.used_ingredients === 'string' ? recipe.used_ingredients.split(',').map(i => i.trim()).filter(Boolean) : [];
              const mySet = new Set(myIngredients.map((i: string) => i.trim()));
              let substituteTargets: string[] = [];
              let substitutes: string[] = [];
              ingredientList.forEach((needRaw: string) => {
                const need = needRaw.trim();
                const substituteInfo = substituteTable[need];
                if (substituteInfo && mySet.has(substituteInfo.ingredient_b)) {
                  substituteTargets.push(need);
                  substitutes.push(`${needRaw}→${substituteInfo.ingredient_b}`);
                }
              });
              const notMineNotSub = ingredientList.filter((i: string) => !mySet.has(i) && !substituteTargets.includes(i));
              const notMineSub = substituteTargets.filter((i: string) => ingredientList.includes(i));
              const mine = ingredientList.filter((i: string) => mySet.has(i));
              const pills = [...notMineNotSub, ...notMineSub, ...mine];
              const pillInfo = getUniversalIngredientPillInfo({
                needIngredients: ingredientList,
                myIngredients,
                substituteTable,
              });
              const match = calculateMatchRate(myIngredients, Array.isArray(recipe.used_ingredients) ? recipe.used_ingredients.join(',') : recipe.used_ingredients || '');
              const logo = getPlatformLogo(recipe.platform);
              return (
                <a
                  key={recipe.id}
                  href={recipe.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minWidth: 320,
                    maxWidth: 340,
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    position: 'relative',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                <div style={{position: 'relative', width: '100%', height: 140}}>
                    <img
                      src={getProxiedImageUrl(recipe.thumbnail)}
                      alt="썸네일"
                      onError={e => { e.currentTarget.src = '/default-thumbnail.png'; }}
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 12,
                        marginBottom: 8,
                      }}
                    />
                    {/* 플랫폼별 로고 오버레이 */}
                    {logo && (
                      <img
                        src={logo}
                        alt="플랫폼 로고"
                        style={{
                          position: 'absolute',
                          right: 4,
                          top: 4,
                          width: 24,
                          height: 24,
                          zIndex: 2
                        }}
                      />
                    )}
                  {/* 순위 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center" style={{ position: 'absolute', top: 0, left: 0, fontSize: 12, zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                      {idx + 1}위
                  </div>
                  {/* 재료매칭률 뱃지 */}
                  <div className="absolute bg-[#444] bg-opacity-80 text-white font-medium rounded px-2 py-0.5 flex items-center gap-1" style={{ position: 'absolute', top: 24, left: 0, fontSize: 11, zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                    재료 매칭률 <span className="text-[#FFD600] font-bold ml-1" style={{ textShadow: 'none', letterSpacing: '0.5px' }}>{match.rate}%</span>
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
                    <div style={{fontWeight: 700, fontSize: 15, marginBottom: 4}}>{recipe.title}</div>
                    <div style={{fontSize: 13, color: '#888', marginBottom: 4}}>좋아요 {recipe.likes} · 댓글 {recipe.comments}</div>
                    {/* 재료 pill */}
                    <IngredientPillGroup
                      needIngredients={ingredientList}
                      myIngredients={myIngredients}
                      substituteTable={substituteTable}
                    />
                  </div>
                </a>
                      );
            })}
          </div>
        </section>

        {/* 인기 급상승 재료/테마 키워드 리스트 (TOP10, No. 열, 동적 상승률 라벨) */}
        <section style={{marginBottom: 48}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
            {/* 인기 급상승 재료 */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111] mb-2 text-left"><span className="mr-1">📈</span>인기 급상승 재료 TOP 10</h2>
              <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
              <div className="mt-4">
                <table className="w-full max-w-[280px] mx-auto border-collapse text-[13px] font-sans" style={{background: '#fff'}}>
                  <thead>
                    <tr style={{borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', background: '#F7F7F9'}}>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">순위</th>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">재료명</th>
                      <th className="py-1.5 px-2 text-right font-medium text-[#222] whitespace-nowrap">레시피 수</th>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">{period === 'today' ? '전일' : period === 'week' ? '전주' : period === 'month' ? '전달' : '기간'}대비 상승률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIngredients.slice(0, 10).map((ing, idx) => (
                      <tr key={ing.id}>
                        <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">{idx + 1}</td>
                        <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">
                          <span style={{ cursor: 'pointer', textDecoration: 'none' }} onClick={() => navigate(`/ingredient/${encodeURIComponent(ing.name)}`)}>
                            {ing.name}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-[#444] font-normal whitespace-nowrap">{ing.count.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-center font-normal whitespace-nowrap" style={{color: ing.rate >= 0 ? '#E85A4F' : '#3A6EA5'}}>{ing.rate >= 0 ? `+${ing.rate}%` : `${ing.rate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* 인기 급상승 테마 */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111] mb-2 text-left"><span className="mr-1">📈</span>인기 급상승 테마 TOP 10</h2>
              <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
              <div className="mt-4">
                {themeRankings.length === 0 ? (
                  <div className="text-center text-gray-500">데이터를 불러오는 중...</div>
                ) : (
                  <table className="w-full max-w-[280px] mx-auto border-collapse text-[13px] font-sans" style={{background: '#fff'}}>
                    <thead>
                      <tr style={{borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', background: '#F7F7F9'}}>
                        <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">순위</th>
                        <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">테마명</th>
                        <th className="py-1.5 px-2 text-right font-medium text-[#222] whitespace-nowrap">레시피 수</th>
                        <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">{period === 'today' ? '전일' : period === 'week' ? '전주' : period === 'month' ? '전달' : '기간'}대비 상승률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {themeRankings.map((theme, idx) => (
                        <tr key={theme.id}>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">{idx + 1}</td>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">
                            <span style={{ cursor: 'pointer', textDecoration: 'none' }} onClick={() => navigate(`/ingredient/${encodeURIComponent(theme.name)}`)}>
                              {theme.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-[#444] font-normal whitespace-nowrap">{theme.count.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-center font-normal whitespace-nowrap" style={{color: theme.rate >= 0 ? '#E85A4F' : '#3A6EA5'}}>{theme.rate >= 0 ? `+${theme.rate}%` : `${theme.rate}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 인기 레시피 직접 찾아보기 검색창 */}
        <section style={{marginBottom: 48}}>
          <h2 className="text-[16px] font-bold text-[#111] mb-2 text-left"><span className="mr-1">🔍️</span>특정 재료·테마 등 키워드로 찾아보기</h2>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              gap: 8,
            }}
          >
            <input
              type="text"
              placeholder="관심 키워드를 입력해주세요"
              className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{
                maxWidth: 250,
                minWidth: 0,
                flex: '0 1 auto',
                height: 40,
                fontFamily: 'Pretendard, sans-serif',
              }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) {
                  navigate(`/ingredient/${encodeURIComponent(search.trim())}`);
                }
              }}
            />
            <button
              className="bg-[#FFD600] text-[#222] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition"
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Pretendard, sans-serif',
              }}
              onClick={() => {
                if (search.trim()) {
                  navigate(`/ingredient/${encodeURIComponent(search.trim())}`);
                }
              }}
            >
              검색
            </button>
          </div>
        </section>
      </div>
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
      <BottomNavBar activeTab="popularity" />
    </>
  );
};
 
export default Popular; 