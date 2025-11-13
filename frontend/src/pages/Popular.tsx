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
import RecipeCard from '../components/RecipeCard';
import youtubeTitleImg from '../assets/유튜브제목이미지.png';
import naverTitleImg from '../assets/네이버제목이미지.png';
import { addRecipeToLocalStorage, removeRecipeFromLocalStorage, getRecipesFromLocalStorage, copyRecipeUrlToClipboard, getMyFridgeIngredients } from '../utils/recipeStorage';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import RecipeToast from '../components/RecipeToast';
import RecipeSortBar from '../components/RecipeSortBar';
import backIcon from '../assets/뒤로가기.png';
import VirtualizedHorizontalRecipeList from '../components/VirtualizedHorizontalRecipeList';
import { decodeRecipesText } from '../utils/textUtils';

// Add CSS for loader-toast with dots
const loaderStyle = `
  .loader-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .loader-dots {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loader-dots div {
    width: 12px;
    height: 12px;
    margin: 2px;
    border-radius: 50%;
    background-color: #FFD600;
    animation: dot-blink 1.2s infinite ease-in-out both;
  }

  .loader-dots div:nth-child(1) { animation-delay: -0.32s; }
  .loader-dots div:nth-child(2) { animation-delay: -0.16s; }

  @keyframes dot-blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }
`;

// Inject style into the document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = loaderStyle;
document.head.appendChild(styleSheet);

// 필터 상태 타입 및 초기값
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

// 기간 옵션 상수
const PERIOD_OPTIONS = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '최근 7일' },
  { value: 'month', label: '최근 30일' },
  { value: 'custom', label: '기간선택' },
];

// 날짜 계산 유틸리티 함수들
const DateUtils = {
  getDateRange: (period: string, customRange?: [Date, Date]) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    switch (period) {
      case 'today':
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        return { start: todayStart, end: today };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: today };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart, end: today };
      case 'custom':
        if (customRange && customRange[0] && customRange[1]) {
          const start = new Date(customRange[0]);
          const end = new Date(customRange[1]);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return { start: today, end: today };
      default:
        return { start: today, end: today };
    }
  },

  getPreviousDateRange: (currentRange: { start: Date, end: Date }) => {
    const duration = currentRange.end.getTime() - currentRange.start.getTime();
    const previousEnd = new Date(currentRange.start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    
    return { start: previousStart, end: previousEnd };
  },

  formatDate: (date: Date) => `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`,
};

// 레시피 필터링 유틸리티
const RecipeFilterUtils = {
  filterByDateRange: (recipes: Recipe[], dateRange: { start: Date, end: Date }) => {
    return recipes.filter(recipe => {
      if (!recipe.post_time) return false;
      const postDate = new Date(recipe.post_time);
      return postDate >= dateRange.start && postDate <= dateRange.end;
    });
  },

  calculateGrowthRate: (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  },
};

// 재료 순위 계산 함수
const calculateIngredientRankings = (recipes: Recipe[], dateRange: { start: Date, end: Date }, previousRange?: { start: Date, end: Date }) => {
  const currentRecipes = RecipeFilterUtils.filterByDateRange(recipes, dateRange);
  const currentIngredientCounts: { [key: string]: number } = {};
  
  currentRecipes.forEach(recipe => {
    if (recipe.used_ingredients) {
      let ingredients: string[] = [];
      if (typeof recipe.used_ingredients === 'string' && recipe.used_ingredients.trim()) {
        ingredients = recipe.used_ingredients.split(',').map((i: string) => i.trim()).filter(i => i);
      } else if (Array.isArray(recipe.used_ingredients)) {
        ingredients = recipe.used_ingredients.map((i: string) => i.trim()).filter(i => i);
      }
      ingredients.forEach((ingredient: string) => {
        currentIngredientCounts[ingredient] = (currentIngredientCounts[ingredient] || 0) + 1;
      });
    }
  });

  const previousIngredientCounts: { [key: string]: number } = {};
  if (previousRange) {
    const previousRecipes = RecipeFilterUtils.filterByDateRange(recipes, previousRange);
    previousRecipes.forEach(recipe => {
      if (recipe.used_ingredients) {
        let ingredients: string[] = [];
        if (typeof recipe.used_ingredients === 'string' && recipe.used_ingredients.trim()) {
          ingredients = recipe.used_ingredients.split(',').map((i: string) => i.trim()).filter(i => i);
        } else if (Array.isArray(recipe.used_ingredients)) {
          ingredients = recipe.used_ingredients.map((i: string) => i.trim()).filter(i => i);
        }
        ingredients.forEach((ingredient: string) => {
          previousIngredientCounts[ingredient] = (previousIngredientCounts[ingredient] || 0) + 1;
        });
      }
    });
  }

  // Correct growth rate calculation and filtering for ingredient rankings
  return Object.entries(currentIngredientCounts)
    .map(([name, count]) => {
      const previousCount = previousIngredientCounts[name] || 0;
      const rate = previousRange ? RecipeFilterUtils.calculateGrowthRate(count, previousCount) : 0;
      return { name, count, rate };
    })
    .filter(item => item.rate !== Infinity && item.rate !== 100) // Exclude items with infinite or exactly 100% growth rate
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)
    .map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      count: item.count,
      rate: item.rate,
      thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
    }));
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

const periodOptions = PERIOD_OPTIONS;

// 기간별 날짜 계산 함수들
const getDateRange = (period: string, customRange?: [Date, Date]) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // 오늘의 끝
  
  switch (period) {
    case 'today':
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      return { start: todayStart, end: today };
          case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6); // 7일 전(6일 전)
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: today };
    case 'month':
      const monthStart = new Date(today);
      monthStart.setDate(today.getDate() - 30); // 최근 30일
      monthStart.setHours(0, 0, 0, 0);
      return { start: monthStart, end: today };
    case 'custom':
      if (customRange && customRange[0] && customRange[1]) {
        const start = new Date(customRange[0]);
        const end = new Date(customRange[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      return { start: today, end: today };
    default:
      return { start: today, end: today };
  }
};

// 이전 기간 날짜 계산
const getPreviousDateRange = (period: string, currentRange: { start: Date, end: Date }) => {
  const duration = currentRange.end.getTime() - currentRange.start.getTime();
  const previousEnd = new Date(currentRange.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  
  return { start: previousStart, end: previousEnd };
};

// 날짜 기반 레시피 필터링
const filterRecipesByDateRange = (recipes: Recipe[], dateRange: { start: Date, end: Date }) => {
  return recipes.filter(recipe => {
    if (!recipe.post_time) return false;
    
    const postDate = new Date(recipe.post_time);
    return postDate >= dateRange.start && postDate <= dateRange.end;
  });
};

// 상승률 계산 함수
const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// 테마 TOP 10 계산 함수 (날짜 필터링 적용)
const calculateThemeRankings = async (recipes: Recipe[], dateRange: { start: Date, end: Date }, previousRange?: { start: Date, end: Date }) => {
  console.log('calculateThemeRankings 호출됨');
  console.log('테마 랭킹 계산용 레시피 수:', recipes.length);
  
  const currentRecipes = filterRecipesByDateRange(recipes, dateRange);
  console.log('테마 랭킹 날짜 필터링 후 레시피 수:', currentRecipes.length);
  
  const themeCounts: { [key: string]: number } = {};
  
  try {
    // 테마 랭킹 계산 시작
    
    // Filter_Keywords.csv에서 키워드 목록 가져오기
    console.log('Filter_Keywords.csv 파일 로드 시작');
    const response = await fetch('/Filter_Keywords.csv');
    if (!response.ok) {
      throw new Error('Filter_Keywords.csv 파일을 불러올 수 없습니다');
    }
    const csv = await response.text();
    console.log('Filter_Keywords.csv 파일 로드 완료, 크기:', csv.length);
    
    const lines = csv.split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    
    const keywordIdx = header.indexOf('키워드');
    const synonymIdx = header.indexOf('동의어');
    
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

    // 현재 기간 테마 카운트
    currentRecipes.forEach(recipe => {
      const text = `${recipe.title} ${recipe.content}`.toLowerCase();
      
      keywordMap.forEach((synonyms, keyword) => {
        let count = 0;
        synonyms.forEach(synonym => {
          const regex = new RegExp(synonym.toLowerCase(), 'g');
          const matches = text.match(regex);
          if (matches && matches.length >= 2) {
            count += matches.length;
          }
        });
        
        if (count > 0) {
          themeCounts[keyword] = (themeCounts[keyword] || 0) + count;
        }
      });
    });

    // 이전 기간 테마 카운트 (상승률 계산용)
    const previousThemeCounts: { [key: string]: number } = {};
    if (previousRange) {
      const previousRecipes = filterRecipesByDateRange(recipes, previousRange);
      previousRecipes.forEach(recipe => {
        const text = `${recipe.title} ${recipe.content}`.toLowerCase();
        
        keywordMap.forEach((synonyms, keyword) => {
          let count = 0;
          synonyms.forEach(synonym => {
            const regex = new RegExp(synonym.toLowerCase(), 'g');
            const matches = text.match(regex);
            if (matches && matches.length >= 2) {
              count += matches.length;
            }
          });
          
          if (count > 0) {
            previousThemeCounts[keyword] = (previousThemeCounts[keyword] || 0) + count;
          }
        });
      });
    }

    // Correct growth rate calculation and filtering for theme rankings
    const result = Object.entries(themeCounts)
      .map(([name, count]) => {
        const previousCount = previousThemeCounts[name] || 0;
        const rate = previousRange ? calculateGrowthRate(count, previousCount) : 0;
        return { name, count, rate };
      })
      .filter(item => item.rate !== Infinity && item.rate !== 100) // Exclude items with infinite or exactly 100% growth rate
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)
      .map((item, index) => ({
        id: index + 1,
        rank: index + 1,
        name: item.name,
        count: item.count,
        rate: item.rate,
        thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
      }));
    
    console.log('계산된 테마 랭킹:', result);
    return result;

  } catch (error) {
    console.error('Error calculating theme rankings:', error);
    return [];
  }
};

const getPlatformLogo = (platform: string | undefined) => {
  if (!platform) return null;
  const lower = platform.toLowerCase();
  if (lower.includes('naver') || platform.includes('네이버')) return naverLogo;
  if (lower.includes('youtube') || platform.includes('유튜브')) return youtubeLogo;
  return null;
};

// Update helper function to use correct localStorage keys
function getRecipeActionState(recipeId: number) {
  const completedRecipes = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
  const recordedRecipes = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
  return {
    done: completedRecipes.some((r: any) => r.id === recipeId),
    write: recordedRecipes.some((r: any) => r.id === recipeId),
    share: false,
  };
}

// CSV에서 '대분류'가 '요리이름'인 'keyword'와 'synonyms' 추출
function extractDishKeywordsFromCSV(csv: string): { keyword: string; synonyms: string[] }[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const keywordIdx = header.indexOf('keyword');
  const categoryIdx = header.indexOf('대분류');
  const synonymsIdx = header.indexOf('synonyms');
  
  if (keywordIdx === -1 || categoryIdx === -1) return [];
  
  return lines.slice(1)
    .map(line => line.split(','))
    .filter(cols => cols[categoryIdx] && cols[categoryIdx].trim() === '요리이름')
    .map(cols => {
      const keyword = cols[keywordIdx]?.trim();
      const synonymsStr = cols[synonymsIdx]?.trim() || '';
      
      // synonyms 컬럼에서 동의어들을 파싱 (쉼표로 구분)
      const synonyms = synonymsStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '');
      
      return { keyword, synonyms };
    })
    .filter(item => item.keyword);
}

// 요리이름 키워드 기반 랭킹 계산 (동의어 고려)
function calculateDishRankings(recipes: Recipe[], dishKeywords: { keyword: string; synonyms: string[] }[], dateRange: { start: Date, end: Date }, previousRange?: { start: Date, end: Date }) {
  console.log('calculateDishRankings 호출됨');
  console.log('전체 레시피 수:', recipes.length);
  console.log('키워드 수:', dishKeywords.length);
  
  // 현재 기간 카운트
  const currentRecipes = filterRecipesByDateRange(recipes, dateRange);
  console.log('날짜 필터링 후 레시피 수:', currentRecipes.length);
  
  const currentCounts: { [key: string]: number } = {};
  const recipeMatchMap: { [recipeId: number]: Set<string> } = {}; // 레시피별 매칭된 키워드 추적
  
  // 초기화
  dishKeywords.forEach(({ keyword }) => {
    currentCounts[keyword] = 0;
  });
  
  // 각 레시피에 대해 키워드와 동의어 매칭
  currentRecipes.forEach(recipe => {
    const text = `${recipe.title} ${recipe.content}`;
    const matchedKeywords = new Set<string>();
    
    dishKeywords.forEach(({ keyword, synonyms }) => {
      // 메인 키워드와 모든 동의어를 포함한 검색어 목록
      const searchTerms = [keyword, ...synonyms];
      
      // 검색어 중 하나라도 매칭되면 해당 키워드로 카운트
      const isMatched = searchTerms.some(term => text.includes(term));
      if (isMatched) {
        matchedKeywords.add(keyword);
      }
    });
    
    // 매칭된 키워드들을 카운트에 추가
    matchedKeywords.forEach(keyword => {
      currentCounts[keyword]++;
    });
    
    // 레시피별 매칭 정보 저장 (중복 제거용)
    recipeMatchMap[recipe.id] = matchedKeywords;
  });

  // 이전 기간 카운트 (상승률 계산용)
  const previousCounts: { [key: string]: number } = {};
  if (previousRange) {
    const previousRecipes = filterRecipesByDateRange(recipes, previousRange);
    const previousRecipeMatchMap: { [recipeId: number]: Set<string> } = {};
    
    // 초기화
    dishKeywords.forEach(({ keyword }) => {
      previousCounts[keyword] = 0;
    });
    
    // 이전 기간도 동일한 로직으로 카운트
    previousRecipes.forEach(recipe => {
      const text = `${recipe.title} ${recipe.content}`;
      const matchedKeywords = new Set<string>();
      
      dishKeywords.forEach(({ keyword, synonyms }) => {
        const searchTerms = [keyword, ...synonyms];
        const isMatched = searchTerms.some(term => text.includes(term));
        if (isMatched) {
          matchedKeywords.add(keyword);
        }
      });
      
      matchedKeywords.forEach(keyword => {
        previousCounts[keyword]++;
      });
      
      previousRecipeMatchMap[recipe.id] = matchedKeywords;
    });
  }

  return Object.entries(currentCounts)
    .map(([name, count]) => {
      const previousCount = previousCounts[name] || 0;
      const rate = previousRange ? calculateGrowthRate(count, previousCount) : 0;
      return { name, count, rate };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)
    .map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      count: item.count,
      rate: item.rate,
      thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
    }));
}

const Popular = () => {
  const [search, setSearch] = useState('');
  const nickname = "닉네임"; // 실제 닉네임 연동 필요
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // 필터 관련 상태 (RecipeList.tsx와 동일)
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [period, setPeriod] = useState('month');
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[Date|null, Date|null]>([null, null]);
  const [dateInputStart, setDateInputStart] = useState('');
  const [dateInputEnd, setDateInputEnd] = useState('');
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');

  // 버튼 상태 통일: {done, write, share}
  const [buttonStates, setButtonStates] = useState<{ [id: number]: { done: boolean; write: boolean; share: boolean } }>({});

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

  const [ingredientRankings, setIngredientRankings] = useState<any[]>([]);
  const [themeRankings, setThemeRankings] = useState<any[]>([]);
  const [dishKeywords, setDishKeywords] = useState<{ keyword: string; synonyms: string[] }[]>([]);
  const [dishRankings, setDishRankings] = useState<any[]>([]);
  const [youtubeRecipes, setYoutubeRecipes] = useState<any[]>([]);
  const [naverRecipes, setNaverRecipes] = useState<any[]>([]);

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
        setDishKeywords(extractDishKeywordsFromCSV(csv));
      });
  }, []);

  // 기간 드롭다운 핸들러
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeriod(val);
    if (val === 'custom') {
      setDateModalOpen(true);
    } else {
      // 기간이 변경되면 랭킹을 다시 계산하도록 트리거
      setDateRange([null, null]);
    }
  };

  // 기간 라벨 표시
  let periodLabel = periodOptions.find(o => o.value === period)?.label || '';
  if (period === 'custom' && dateRange[0] && dateRange[1]) {
    periodLabel = `${dateRange[0].getFullYear()}.${String(dateRange[0].getMonth()+1).padStart(2,'0')}.${String(dateRange[0].getDate()).padStart(2,'0')}~${dateRange[1].getFullYear()}.${String(dateRange[1].getMonth()+1).padStart(2,'0')}.${String(dateRange[1].getDate()).padStart(2,'0')}`;
  }

  // Update handleRecipeAction to use correct localStorage keys and sync properly
  const handleRecipeAction = (id: number, action: { action: 'done' | 'write' | 'share' }) => {
    setButtonStates(prev => {
      const prevState = prev[id] || getRecipeActionState(id);
      let newState = { ...prevState };
      if (action.action === 'done') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (prevState.done) {
          // 완료 취소
          removeRecipeFromLocalStorage('done', id);
          setToast('레시피 완료를 취소했습니다!');
        } else {
          // 완료 추가
          if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
            const normalized = {
              id: recipe.id,
              title: recipe.title,
              content: recipe.content || '',
              author: recipe.author || '',
              date: recipe.date || '',
              body: recipe.body || recipe.content || recipe.description || '',
              description: recipe.description || '',
              thumbnail: recipe.thumbnail || '',
              used_ingredients: recipe.used_ingredients || '',
              used_ingredients_block: recipe.used_ingredients_block || '',
              block_reason: recipe.block_reason || '',
              link: recipe.link || '',
              platform: recipe.platform || 'youtube',
              channel: recipe.channel || 'youtube',
              likes: recipe.likes || 0,
              comments: recipe.comments || 0,
              substitutes: recipe.substitutes || [],
              match_rate: recipe.match_rate || 0,
              my_ingredients: recipe.my_ingredients || [],
              need_ingredients: recipe.need_ingredients || [],
              created_at: recipe.created_at || '',
              updated_at: recipe.updated_at || '',
              like_count: recipe.like_count || 0,
              comment_count: recipe.comment_count || 0,
              post_time: recipe.post_time || '',
              collected_at: recipe.collected_at || '',
              hits: recipe.hits || 0,
              action: recipe.action,
            };
            addRecipeToLocalStorage('done', normalized);
            setToast('레시피를 완료했습니다!');
          }
        }
        newState.done = !prevState.done;
      }
      if (action.action === 'write') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (prevState.write) {
          // 기록 취소
          removeRecipeFromLocalStorage('write', id);
          setToast('레시피 기록을 취소했습니다!');
        } else {
          // 기록 추가
          if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
            const normalized = {
              id: recipe.id,
              title: recipe.title,
              content: recipe.content || '',
              author: recipe.author || '',
              date: recipe.date || '',
              body: recipe.body || recipe.content || recipe.description || '',
              description: recipe.description || '',
              thumbnail: recipe.thumbnail || '',
              used_ingredients: recipe.used_ingredients || '',
              used_ingredients_block: recipe.used_ingredients_block || '',
              block_reason: recipe.block_reason || '',
              link: recipe.link || '',
              platform: recipe.platform || 'youtube',
              channel: recipe.channel || 'youtube',
              likes: recipe.likes || 0,
              comments: recipe.comments || 0,
              substitutes: recipe.substitutes || [],
              match_rate: recipe.match_rate || 0,
              my_ingredients: recipe.my_ingredients || [],
              need_ingredients: recipe.need_ingredients || [],
              created_at: recipe.created_at || '',
              updated_at: recipe.updated_at || '',
              like_count: recipe.like_count || 0,
              comment_count: recipe.comment_count || 0,
              post_time: recipe.post_time || '',
              collected_at: recipe.collected_at || '',
              hits: recipe.hits || 0,
              action: recipe.action,
            };
            addRecipeToLocalStorage('write', normalized);
            setToast('레시피를 기록했습니다!');
          }
        }
        newState.write = !prevState.write;
      }
      if (action.action === 'share') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (recipe) {
          copyRecipeUrlToClipboard(recipe);
          setToast('URL이 복사되었습니다!');
        }
      }
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [id]: newState };
    });
  };

  // 기간 워딩 함수
  const getPeriodText = (period: string) => {
    if (period === 'today') return '전일대비 게시글량';
    if (period === 'week') return '전주대비 게시글량';
    if (period === 'month') return '전달대비 게시글량';
    return '기간대비 게시글량';
  };

  // 인기도 점수 계산 함수 수정
  const calculatePopularityScore = (recipe: Recipe) => {
    const likes = recipe.likes || 0;
    const comments = recipe.comments || 0;
    const hits = recipe.hits || 0;
    
    // YouTube와 Naver의 인기도 계산 방식 분리
    if (recipe.channel === 'youtube') {
      return 1.0 * likes + 2.0 * comments + 0.5 * hits;
    } else {
      return 1.0 * likes + 2.0 * comments;
    }
  };

  // 레시피 정렬 함수 수정
  const sortRecipesByPopularity = (recipes: Recipe[]) => {
    return [...recipes].sort((a, b) => {
      const scoreA = calculatePopularityScore(a);
      const scoreB = calculatePopularityScore(b);
      return scoreB - scoreA;
    });
  };

  // 유튜브와 네이버 레시피 분리 (날짜 기반 필터링 적용)
  const currentDateRange = getDateRange(period, dateRange[0] && dateRange[1] ? [dateRange[0], dateRange[1]] : undefined);
  const filteredRecipes = filterRecipesByDateRange(youtubeRecipes, currentDateRange);
  
  const sortedYoutubeRecipes = sortRecipesByPopularity(
    filteredRecipes.filter(recipe => {
      const isYoutube = recipe.platform && recipe.platform.toLowerCase().includes('youtube');
      // 모든 레시피의 플랫폼 정보 로깅 (처음 10개만)
      if (filteredRecipes.indexOf(recipe) < 10) {
        console.log(`레시피 ${recipe.id}: platform="${recipe.platform}", isYoutube=${isYoutube}`);
      }
      return isYoutube;
    })
  ).slice(0, 100);
  
  const sortedNaverRecipes = sortRecipesByPopularity(
    filteredRecipes.filter(recipe =>
      recipe.platform && recipe.platform.toLowerCase().includes('naver')
    )
  ).slice(0, 100);

  // Fetch recipes and calculate popularity scores based on period filter
  useEffect(() => {
    (async () => {
      const apiUrl = import.meta.env?.VITE_API_BASE_URL || 'https://refrigeratorcode-production.up.railway.app';
      const size = 100;
      
      try {
        // 기간별 API 파라미터 구성
        let apiParams = `period_type=${period}&size=${size}`;
        
        // custom 기간인 경우 시작/종료 날짜 추가
        if (period === 'custom' && dateRange[0] && dateRange[1]) {
          const formatDate = (date: Date) => date.toISOString().split('T')[0];
          apiParams += `&start_date=${formatDate(dateRange[0])}&end_date=${formatDate(dateRange[1])}`;
        }
        
        const res = await axios.get(`${apiUrl}/api/recipes/popular?${apiParams}`);
        console.log('Popular API 응답:', res.data);

        // 응답 형태 방어적 파싱: 배열/객체 모두 안전 처리
        const payload: any = res.data;
        let youtubeData: any[] = [];
        let naverData: any[] = [];

        if (Array.isArray(payload)) {
          // 과거: 배열만 내려오는 형태(단일 리스트) → 유튜브로 간주
          youtubeData = payload;
        } else if (payload && typeof payload === 'object') {
          if (Array.isArray(payload.youtube)) youtubeData = payload.youtube;
          else if (Array.isArray(payload.recipes)) youtubeData = payload.recipes; // 안전망
          if (Array.isArray(payload.naver)) naverData = payload.naver;
        }

        console.log('YouTube 레시피:', youtubeData);
        console.log('Naver 레시피:', naverData);

        setYoutubeRecipes(Array.isArray(youtubeData) ? youtubeData : []);
        setNaverRecipes(Array.isArray(naverData) ? naverData : []);
      } catch (err) {
        console.error('Failed to fetch popular recipes:', err);
        setYoutubeRecipes([]);
        setNaverRecipes([]);
      }
    })();
  }, [period, dateRange]); // period와 dateRange가 변경될 때마다 API 재호출

  // 레시피 데이터 로드 시 랭킹 계산
  useEffect(() => {
    const calculateRankings = async () => {
      if ((youtubeRecipes.length > 0 || naverRecipes.length > 0) && dishKeywords.length > 0) {
        try {
          // 날짜 범위 계산
          const currentDateRange = getDateRange(period, dateRange[0] && dateRange[1] ? [dateRange[0], dateRange[1]] : undefined);
          const previousDateRange = getPreviousDateRange(period, currentDateRange);
          
          // 모든 레시피를 합쳐서 요리 랭킹 계산
          const allRecipes = [...youtubeRecipes, ...naverRecipes];
          console.log('요리 랭킹 계산용 레시피 수:', allRecipes.length);
          console.log('요리 키워드 수:', dishKeywords.length);
          
          const dishRanks = calculateDishRankings(allRecipes, dishKeywords, currentDateRange, previousDateRange);
          console.log('계산된 요리 랭킹:', dishRanks);
          setDishRankings(dishRanks);
          
          // 기존 ingredient/theme 랭킹도 필요하면 유지
          const ingredientRanks = calculateIngredientRankings(youtubeRecipes, currentDateRange, previousDateRange);
          setIngredientRankings(ingredientRanks);
          const themeRanks = await calculateThemeRankings(youtubeRecipes, currentDateRange, previousDateRange);
          setThemeRankings(themeRanks);
        } catch (error) {
          console.error('랭킹 계산 중 오류:', error);
        }
      }
    };
    calculateRankings();
  }, [youtubeRecipes, naverRecipes, period, dateRange, dishKeywords]);

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

  // Add useEffect to initialize buttonStates from localStorage on mount
  useEffect(() => {
    const initialButtonStates: { [id: number]: { done: boolean; write: boolean; share: boolean } } = {};
    youtubeRecipes.forEach(recipe => {
      initialButtonStates[recipe.id] = getRecipeActionState(recipe.id);
    });
    setButtonStates(initialButtonStates);
  }, [youtubeRecipes]);

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
                <div>
                  {React.createElement(DatePicker as any, {
                    selectsRange: true,
                    startDate: dateRange[0],
                    endDate: dateRange[1],
                    onChange: (update: [Date|null, Date|null]) => {
                      setDateRange(update);
                      if (update[0]) {
                        const f = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                        setDateInputStart(f(update[0]));
                      }
                      if (update[1]) {
                        const f = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                        setDateInputEnd(f(update[1]));
                      }
                    },
                    inline: true,
                    dateFormat: "yyyy-MM-dd",
                    maxDate: new Date()
                  })}
                </div>
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

        {/* ⓑ 유튜브 인기 레시피 섹션 */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8, display: 'flex', alignItems: 'center'}}>
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 20,
                background: `url(${youtubeTitleImg}) no-repeat center/contain`,
                marginRight: 6,
                position: 'relative',
                top: 2,
              }}
            />
            <h2
              className="text-[16px] font-bold text-[#111] mb-2"
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                lineHeight: '1',
                fontSize: 16,
                position: 'relative',
                top: 6,
              }}
            >
              유튜브 인기 레시피
            </h2>
          </div>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          {/* 범례: 가로형 레시피 카드 위, 왼쪽 정렬 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>부족 재료</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>대체 가능</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>보유 재료</span>
              </div>
            </div>
            <span style={{ color: '#666', fontSize: '12px' }}>총 {youtubeRecipes.length}건</span>
          </div>
          <VirtualizedHorizontalRecipeList
            recipes={youtubeRecipes}
            myIngredients={myIngredients}
            substituteTable={{}}
            recipeActionStates={buttonStates}
            onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' })}
            cardWidth={320}
            cardHeight={320}
            gap={16}
            showRank={true}
          />
        </section>

        {/* ⓒ 네이버 인기 레시피 섹션 */}
        <section style={{marginBottom: 48}}>
          <div style={{marginBottom: 8, display: 'flex', alignItems: 'center'}}>
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 20,
                background: `url(${naverTitleImg}) no-repeat center/contain`,
                marginRight: 6,
                position: 'relative',
                top: 2,
              }}
            />
            <h2
              className="text-[16px] font-bold text-[#111] mb-2"
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                lineHeight: '1',
                fontSize: 16,
                position: 'relative',
                top: 6,
              }}
            >
              네이버 인기 레시피
            </h2>
          </div>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          {/* 범례: 가로형 레시피 카드 위, 왼쪽 정렬 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>부족 재료</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>대체 가능</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
                <span style={{ color: '#222', fontSize: '12px', minWidth: 30 }}>보유 재료</span>
              </div>
            </div>
            <span style={{ color: '#666', fontSize: '12px' }}>총 {naverRecipes.length}건</span>
          </div>
          <VirtualizedHorizontalRecipeList
            recipes={naverRecipes}
            myIngredients={myIngredients}
            substituteTable={{}}
            recipeActionStates={buttonStates}
            onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' })}
            cardWidth={320}
            cardHeight={320}
            gap={16}
            showRank={true}
          />
        </section>

        {/* 인기 급상승 요리 TOP 10 섹션 */}
        <section style={{marginBottom: 48}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
            {/* 인기 급상승 요리 */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111] mb-2 text-left"><span className="mr-1">📈</span>인기 급상승 요리 TOP 10</h2>
              <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
              <div className="mt-4">
                <table className="w-full max-w-[280px] mx-auto border-collapse text-[13px] font-sans" style={{background: '#fff'}}>
                  <thead>
                    <tr style={{borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', background: '#F7F7F9'}}>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">순위</th>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">요리명</th>
                      <th className="py-1.5 px-2 text-right font-medium text-[#222] whitespace-nowrap">레시피 수</th>
                      <th className="py-1.5 px-2 text-center font-medium text-[#222] whitespace-nowrap">{period === 'today' ? '전일' : period === 'week' ? '전주' : period === 'month' ? '전달' : '기간'}대비 상승률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishRankings.length > 0 ? (
                      dishRankings.map((dish, idx) => (
                        <tr key={dish.name}>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">{idx + 1}</td>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">
                            <span
                              style={{ cursor: 'pointer', textDecoration: 'none' }}
                              onClick={() => navigate(`/ingredient/${encodeURIComponent(dish.name)}?minCount=2`)}
                              title="해당 키워드 상세 보기"
                            >
                              {dish.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-[#444] font-normal whitespace-nowrap">{dish.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
                          <td className="py-1.5 px-2 text-center font-normal whitespace-nowrap" style={{color: dish.rate >= 0 ? '#E85A4F' : '#3A6EA5'}}>{dish.rate >= 0 ? `+${dish.rate}%` : `${dish.rate}%`}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center" style={{height: 320, color: 'rgb(187, 187, 187)', fontSize: '13px', whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center'}}>데이터가 없습니다</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* 인기 급상승 테마 */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111] mb-2 text-left"><span className="mr-1">📈</span>인기 급상승 테마 TOP 10</h2>
              <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
              <div className="mt-4">
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
                    {themeRankings.length > 0 ? (
                      themeRankings.map((theme, idx) => (
                        <tr key={theme.id}>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">{idx + 1}</td>
                          <td className="py-1.5 px-2 text-center text-[#444] font-normal whitespace-nowrap">
                            <span style={{ cursor: 'pointer', textDecoration: 'none' }} onClick={() => navigate(`/ingredient/${encodeURIComponent(theme.name)}`)}>
                              {theme.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-[#444] font-normal whitespace-nowrap">{theme.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
                          <td className="py-1.5 px-2 text-center font-normal whitespace-nowrap" style={{color: theme.rate >= 0 ? '#E85A4F' : '#3A6EA5'}}>{theme.rate >= 0 ? `+${theme.rate}%` : `${theme.rate}%`}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center"
                          style={{
                            height: 320,
                            color: 'rgb(187, 187, 187)',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}
                        >
                          데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                whiteSpace: 'nowrap',
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
          fontSize: 15,
          zIndex: 9999,
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