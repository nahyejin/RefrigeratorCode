import { shareSubstituteTable } from '../utils/substituteStore';
import React, { useState, useEffect, useMemo } from 'react';
import { setPageContext } from '../utils/pageContext';
import { fetchCsvOnce } from '../utils/csvOnce';
import { takePrefetchedPopular } from '../utils/recipePrefetch';
import SectionIcon from '../components/ui/SectionIcon';
import SegmentedToggle from '../components/ui/SegmentedToggle';
import Chip from '../components/ui/Chip';
import MenuSelect from '../components/ui/MenuSelect';
import RecipeRow from '../components/RecipeRow';
import LoadingIndicator from '../components/LoadingIndicator';
import Toast from '../components/Toast';
import BottomNavBar from '../components/BottomNavBar';
import FilterModal from '../components/FilterModal';
import IngredientDateModal from '../components/IngredientDateModal';
import CustomCalendar from '../components/CustomCalendar';
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';
import { useNavigate } from 'react-router-dom';
import { getUniversalIngredientPillInfo } from '../utils/ingredientPillUtils';
import IngredientPillGroup from '../components/IngredientPillGroup';
import axios from 'axios';
import { Recipe } from '../types/recipe';
import { getProxiedImageUrl, filterRecipesWithValidThumbnails } from '../utils/imageUtils';
import { calculateMatchRate } from '../utils/recipeUtils';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';
import youtubeTitleImg from '../assets/유튜브제목이미지.png';
import naverTitleImg from '../assets/네이버제목이미지.png';
import { addRecipeToLocalStorage, removeRecipeFromLocalStorage, getRecipesFromLocalStorage, copyRecipeUrlToClipboard, getMyFridgeIngredients, buildRecipeActionStatesForRecipes, getRecipeActionState, lookupRecipeActionState, guardGuestSave } from '../utils/recipeStorage';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import RecipeToast from '../components/RecipeToast';
import RecipeSortBar from '../components/RecipeSortBar';
import { decodeRecipesText } from '../utils/textUtils';
import { useAuth } from '../context/AuthContext';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';
import CoupangProductAd from '../components/CoupangProductAd';
import CoupangDynamicBanner from '../components/CoupangDynamicBanner';
import { DEFAULT_MATCH_MIN } from '../utils/recipePrefetch';

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
type PopularView = 'popular' | 'special' | 'rising' | 'naver' | 'youtube';
const VIEW_CHIPS: { value: PopularView; label: string }[] = [
  { value: 'popular', label: '인기 레시피' },
  { value: 'special', label: '특별한 날' },
  { value: 'rising', label: '급상승' },
  { value: 'naver', label: '네이버' },
  { value: 'youtube', label: '유튜브' },
];
const PAGE_SIZE = 20;

const PERIOD_OPTIONS = [
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
      const ingredients = parseUsedIngredientsForPills(recipe.used_ingredients);
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
        const ingredients = parseUsedIngredientsForPills(recipe.used_ingredients);
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

// 상승률 계산 함수 (배수와 퍼센트 정보 반환)
const calculateGrowthRate = (current: number, previous: number): { rate: number; isNew: boolean; multiplier?: number } => {
  // 이전 기간에 데이터가 없고 현재 기간에 데이터가 있으면 신규로 처리
  if (previous === 0) {
    return { rate: 0, isNew: true };
  }
  const rate = Math.round(((current - previous) / previous) * 100);
  // 모든 경우에 배수 계산 (소수점 첫째 자리까지)
  const multiplier = Math.round((current / previous) * 10) / 10;
  return { rate, isNew: false, multiplier };
};

// 상승률 표시 포맷 함수
const formatGrowthRate = (rate: number, isNew: boolean, current: number, multiplier?: number): string => {
  if (isNew) {
    return `${current}건 신규`;
  }
  if (multiplier && multiplier >= 2) {
    return `${multiplier}배`;
  }
  return rate >= 0 ? `+${rate}%` : `${rate}%`;
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
    const csv = await fetchCsvOnce('/Filter_Keywords.csv');
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
    
    // CSV 라인 파싱 헬퍼 함수 (따옴표 안의 쉼표 처리)
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
      result.push(current); // 마지막 컬럼
      
      return result;
    };
    
    lines.slice(1).forEach(line => {
      const columns = parseCSVLine(line).map(col => col.trim());
      const keyword = columns[keywordIdx];
      
      // 동의어 파싱: 쉼표, 슬래시, 파이프 모두 지원
      let synonymText = columns[synonymIdx]?.trim() || '';
      // 따옴표 제거
      synonymText = synonymText.replace(/^["']|["']$/g, '');
      // 쉼표, 슬래시, 파이프로 분리
      const synonyms = synonymText
        .split(/[,/|]/)
        .map(s => s.trim())
        .filter(Boolean);
      
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
          if (matches && matches.length >= 1) {
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
            if (matches && matches.length >= 1) {
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
    const results = Object.entries(themeCounts)
      .filter(([name, count]) => count > 0) // 레시피 수가 0인 항목 제외
      .map(([name, count]) => {
        const previousCount = previousThemeCounts[name] || 0;
        const growthInfo = previousRange ? calculateGrowthRate(count, previousCount) : { rate: 0, isNew: false, multiplier: 1 };
        // 정렬을 위한 값: 신규는 현재 카운트를 우선순위로, 그 외는 상승률
        // 신규 항목도 레시피 수가 많을수록 높은 순위
        const sortValue = growthInfo.isNew ? count : growthInfo.rate;
        return { name, count, previousCount, ...growthInfo, sortValue };
      });
    
    console.log('테마 랭킹 계산 결과 (상위 5개):', results.slice(0, 5).map(r => ({
      name: r.name,
      count: r.count,
      previousCount: r.previousCount,
      isNew: r.isNew,
      rate: r.rate,
      multiplier: r.multiplier
    })));
    
    const risingOnly = results
      .filter(item => {
        // 신규이거나 상승한 것만 필터링 (rate > 0 또는 multiplier > 1)
        // multiplier가 1이면 변화 없음이므로 제외
        return item.isNew || (item.rate > 0) || (item.multiplier !== undefined && item.multiplier > 1);
      })
      .sort((a, b) => {
        // 먼저 신규 여부로 정렬 (신규가 뒤로)
        if (a.isNew !== b.isNew) {
          return a.isNew ? 1 : -1;
        }
        // 같은 타입이면 sortValue로 정렬
        return b.sortValue - a.sortValue;
      })
      .slice(0, 10)
      .map((item, index) => ({
        id: index + 1,
        rank: index + 1,
        name: item.name,
        count: item.count,
        rate: item.rate,
        isNew: item.isNew,
        multiplier: item.multiplier,
        thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
      }));

    // 상승/신규가 아예 없으면 빈 화면 대신 "현재 레시피 수 상위"로 fallback
    if (risingOnly.length > 0) {
      console.log('계산된 테마 랭킹(상승/신규 기준):', risingOnly);
      return risingOnly;
    }

    const fallbackByCount = results
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({
        id: index + 1,
        rank: index + 1,
        name: item.name,
        count: item.count,
        rate: item.rate,
        isNew: item.isNew,
        multiplier: item.multiplier,
        thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
      }));

    console.log('계산된 테마 랭킹(fallback: count 기준):', fallbackByCount);
    return fallbackByCount;

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
// 이 함수는 컴포넌트 내부에서 사용자별로 관리되므로 여기서는 제거됨

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
    console.log('이전 기간 레시피 수:', previousRecipes.length, '기간:', previousRange.start, '~', previousRange.end);
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

  const results = Object.entries(currentCounts)
    .filter(([name, count]) => count > 0) // 레시피 수가 0인 항목 제외
    .map(([name, count]) => {
      const previousCount = previousCounts[name] || 0;
      const growthInfo = previousRange ? calculateGrowthRate(count, previousCount) : { rate: 0, isNew: false };
      // 정렬을 위한 값: 신규는 현재 카운트를 우선순위로, 그 외는 상승률
      // 신규 항목도 레시피 수가 많을수록 높은 순위
      const sortValue = growthInfo.isNew ? count : growthInfo.rate;
      return { name, count, previousCount, ...growthInfo, sortValue };
    });
  
  console.log('요리 랭킹 계산 결과 (상위 5개):', results.slice(0, 5).map(r => ({
    name: r.name,
    count: r.count,
    previousCount: r.previousCount,
    isNew: r.isNew,
    rate: r.rate,
    multiplier: r.multiplier
  })));
  
  const risingOnly = results
    .filter(item => {
      // 신규이거나 상승한 것만 필터링 (rate > 0 또는 multiplier > 1)
      // multiplier가 1이면 변화 없음이므로 제외
      return item.isNew || (item.rate > 0) || (item.multiplier !== undefined && item.multiplier > 1);
    })
    .sort((a, b) => {
      // 먼저 신규 여부로 정렬 (신규가 뒤로)
      if (a.isNew !== b.isNew) {
        return a.isNew ? 1 : -1;
      }
      // 같은 타입이면 sortValue로 정렬
      return b.sortValue - a.sortValue;
    })
    .slice(0, 10)
    .map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      count: item.count,
      rate: item.rate,
      isNew: item.isNew,
      multiplier: item.multiplier,
      thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
    }));

  if (risingOnly.length > 0) {
    return risingOnly;
  }

  // 상승/신규가 없을 때는 현재 기간 레시피 수 상위로 fallback
  return results
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      count: item.count,
      rate: item.rate,
      isNew: item.isNew,
      multiplier: item.multiplier,
      thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
    }));
}

const Popular = () => {
  const nickname = "닉네임"; // 실제 닉네임 연동 필요
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { isLoggedIn, user: authUser } = useAuth();
  // 즐겨찾기/완료/기록 취소 확인 (누르면 바로 지워지지 않고 한 번 더 확인한다 —
  // 마이페이지 전체보기 목록과 같은 규격)
  const [pendingRemove, setPendingRemove] = useState<{ type: 'done' | 'write' | 'favorite'; id: number } | null>(null);
  
  // 사용자별 레시피 상태 (DB 또는 localStorage)
  const [userCompletedRecipes, setUserCompletedRecipes] = useState<number[]>([]);
  const [userRecordedRecipes, setUserRecordedRecipes] = useState<number[]>([]);
  const [userFavoriteRecipes, setUserFavoriteRecipes] = useState<number[]>([]);

  // 필터 관련 상태 (RecipeList.tsx와 동일)
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [period, setPeriod] = useState('week');
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[Date|null, Date|null]>([null, null]);
  const [tempDateRange, setTempDateRange] = useState<[Date|null, Date|null]>([null, null]); // 모달 내 임시 상태
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = React.useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const [toast, setToast] = useState('');

  // 해제 확인창이 뜨면 직전 토스트(「추가했습니다」)는 닫는다 — 같은 자리에 두 개가 겹쳐 떠 있었다(2026-10-14).
  React.useEffect(() => { if (pendingRemove) { setToast(''); } }, [pendingRemove]);
  // 토스트는 **마지막 것 기준으로** 정해진 시간 뒤에 사라진다. 예전엔 토스트마다 타이머를
  // 따로 걸고 지우지 않아서, 앞 타이머가 새 토스트를 일찍 지우거나(목록 화면) 아예
  // 안 사라졌다(요즘인기).
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(''); }, 1500);
    return () => clearTimeout(t);
  }, [toast]);
  /** 인기 급상승에서 무엇을 보고 있나. 요리와 테마가 한 자리를 나눠 쓴다. */
  const [risingTab, setRisingTab] = useState<'dish' | 'theme'>('dish');
  /** 지금 보는 구역(칩). 인기 레시피 = 네이버·유튜브를 섞어서, 네이버/유튜브 칩은 한쪽만. */
  const [view, setView] = useState<PopularView>('popular');
  // 쿡 픽(밖의 추천 챗봇)이 지금 보고 있는 구역을 읽도록 알린다(utils/pageContext, 2026-11-06).
  useEffect(() => {
    const label = VIEW_CHIPS.find(c => c.value === view)?.label ?? view;
    const lines = [`보고 있는 구역: ${label}`];
    if (view === 'rising') lines.push(`급상승 기준: ${risingTab === 'dish' ? '요리' : '테마'}`);
    setPageContext({ page: 'popular', lines });
  }, [view, risingTab]);
  useEffect(() => () => setPageContext(null), []);
  /** 한 번에 그리는 행 수 — 100건이 넘는 목록의 행마다 재료 계산이 돌아서 끊어 그린다. */
  const [shown, setShown] = useState(PAGE_SIZE);
  const [includeKeyword, setIncludeKeyword] = useState('');

  // 버튼 상태 통일: {done, write, share, favorite}
  const [buttonStates, setButtonStates] = useState<{ [id: number]: { done: boolean; write: boolean; share: boolean; favorite: boolean } }>({});

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
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }>({});
  const [youtubeRecipes, setYoutubeRecipes] = useState<any[]>([]);
  // 「특별한 날 특별한 음식」 후보. **서버가 카탈로그 전체에서 골라 준다.**
  // (예전에는 아래 인기 목록 안에서만 골라서, 정리된 기준으로는 110건 중
  //  7건밖에 안 걸려 섹션이 거의 비어 보였다)
  const [premiumPool, setPremiumPool] = useState<any[]>([]);
  const [naverRecipes, setNaverRecipes] = useState<any[]>([]);
  // 썸네일 로드 실패한 레시피 ID 추적 (404 등)
  const [failedThumbnailIds, setFailedThumbnailIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    fetchCsvOnce('/ingredient_profile_dict_with_substitutes.csv')
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
        setDishKeywords(extractDishKeywordsFromCSV(csv));
      });
  }, []);

  // 대체재료 테이블 로드
  useEffect(() => {
    const loadSubstituteTable = async () => {
      const CACHE_KEY = 'substitute_table_cache';
      const CACHE_VERSION = '2.4'; // 수동 지정 대체 쌍(보리새우↔건새우, 2026-10-08) 반영 — RecipeList 와 같은 캐시라 같이 올린다
      // 버전만 보면 예전 값을 들고 있는 사람이 영원히 그대로다 — 대체재 표는
      // 사전이 바뀌든 말든 매일 재생성되므로(06:30 배치) 하루 지나면 다시 받는다.
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

      try {
        // 캐시 확인
        if (typeof window !== 'undefined' && window.localStorage) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            try {
              const parsedCache = JSON.parse(cached);
              const fresh = typeof parsedCache.savedAt === 'number'
                && Date.now() - parsedCache.savedAt < CACHE_TTL_MS;
              if (parsedCache.version === CACHE_VERSION && parsedCache.data && fresh) {
                console.log('[Popular] 캐시된 대체재료 테이블 사용', Object.keys(parsedCache.data).length, '개 재료');
                setSubstituteTable(parsedCache.data);
                shareSubstituteTable(parsedCache.data);
                return;
              } else {
                console.log('[Popular] 캐시 버전 불일치, 새로 로드합니다. (기존:', parsedCache.version, ', 새:', CACHE_VERSION, ')');
              }
            } catch (e) {
              console.warn('[Popular] 캐시 파싱 실패:', e);
            }
          }
        }
        
        // 캐시가 없으면 새로 로드
        // 12MB 짜리다. 여러 화면이 동시에 부르면 그만큼 두 번 받는다.
        const csv = await fetchCsvOnce('/ingredient_substitute_table.csv');
        
        const lines = csv.split('\n').filter(line => line.trim());
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const aIdx = header.indexOf('ingredient_a');
        const bIdx = header.indexOf('ingredient_b');
        const scoreIdx = header.indexOf('similarity_score');
        
        if (aIdx === -1 || bIdx === -1) {
          console.warn('[Popular] CSV 헤더에서 필요한 컬럼을 찾을 수 없습니다.');
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
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const table: { [key: string]: { ingredient_b: string; similarity_score?: number }[] } = {};
        lines.slice(1).forEach(line => {
          const cols = parseCSVLine(line);
          const a = cols[aIdx]?.trim();
          const b = cols[bIdx]?.trim();
          const scoreStr = scoreIdx >= 0 ? cols[scoreIdx]?.trim() : undefined;
          
          if (a && b) {
            const score = scoreStr ? parseFloat(scoreStr) : undefined;
            
            if (!table[a]) {
              table[a] = [];
            }
            table[a].push({
              ingredient_b: b,
              similarity_score: isNaN(score as number) ? undefined : score
            });
          }
        });
        
        // 각 재료별로 유사도 점수 순으로 정렬 (높은 순)
        Object.keys(table).forEach(key => {
          table[key].sort((a, b) => {
            const scoreA = a.similarity_score ?? 0;
            const scoreB = b.similarity_score ?? 0;
            return scoreB - scoreA;
          });
        });
        
        console.log('[Popular] 대체재료 테이블 로드 완료', Object.keys(table).length, '개 재료');
        // 샘플 데이터 확인
        const sampleKeys = Object.keys(table).slice(0, 3);
        sampleKeys.forEach(key => {
          console.log(`[Popular] 샘플: "${key}" → ${table[key].length}개 대체제`, table[key]);
        });
        
        // 캐시에 저장
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              version: CACHE_VERSION,
              data: table,
              savedAt: Date.now()
            }));
            console.log('[Popular] 대체재료 테이블 캐시 저장 완료');
          } catch (e) {
            console.warn('[Popular] 캐시 저장 실패:', e);
          }
        }
        
        setSubstituteTable(table);
        shareSubstituteTable(table);
      } catch (error) {
        console.error('[Popular] 대체재료 테이블 로드 실패:', error);
      }
    };
    
    loadSubstituteTable();
  }, []);

  // 기간 드롭다운 핸들러
  // 달력 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarOpen]);

  // 날짜 포맷팅 유틸리티
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatInputValue = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length > 8) {
      return digits.slice(0, 8);
    }
    if (digits.length === 8) {
      return digits.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    }
    return digits;
  };

  const isValidDateString = (dateString: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeriod(val);
    if (val === 'custom') {
      // 모달 열 때 현재 dateRange 값을 tempDateRange에 반영
      if (dateRange[0] && dateRange[1]) {
        setTempDateRange([dateRange[0], dateRange[1]]);
      } else {
        setTempDateRange([null, null]);
      }
      setDateModalOpen(true);
    } else {
      // 기간이 변경되면 랭킹을 다시 계산하도록 트리거
      setDateRange([null, null]);
      setTempDateRange([null, null]);
    }
  };

  // 모달이 열려있을 때 body 스크롤 막기
  React.useEffect(() => {
    if (dateModalOpen || calendarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [dateModalOpen, calendarOpen]);

  // 기간 라벨 표시
  let periodLabel = periodOptions.find(o => o.value === period)?.label || '';
  if (period === 'custom' && dateRange[0] && dateRange[1]) {
    periodLabel = `${dateRange[0].getFullYear()}.${String(dateRange[0].getMonth()+1).padStart(2,'0')}.${String(dateRange[0].getDate()).padStart(2,'0')}~${dateRange[1].getFullYear()}.${String(dateRange[1].getMonth()+1).padStart(2,'0')}.${String(dateRange[1].getDate()).padStart(2,'0')}`;
  }

  /**
   * 즐겨찾기/완료/기록 취소를 실제로 수행한다 (확인 팝업에서 "네"를 눌렀을 때).
   * 세 가지가 로컬스토리지 키·DB 엔드포인트·상태 setter만 다르고 나머지 흐름은
   * 같아서 하나로 묶었다.
   */
  const performRemoval = async (type: 'favorite' | 'done' | 'write', id: number) => {
    removeRecipeFromLocalStorage(type, id);
    if (type === 'favorite') setUserFavoriteRecipes(prev => prev.filter(rid => rid !== id));
    else if (type === 'done') setUserCompletedRecipes(prev => prev.filter(rid => rid !== id));
    else setUserRecordedRecipes(prev => prev.filter(rid => rid !== id));

    if (isLoggedIn && authUser?.id) {
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (token) {
          const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
          const endpoint = type === 'favorite' ? 'favorite-recipes' : type === 'done' ? 'completed-recipes' : 'recorded-recipes';
          await fetch(`${apiUrl}/api/users/${authUser.id}/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.error(`[Popular] ${type} 레시피 삭제 실패:`, error);
      }
    }

    setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
    setToast(
      type === 'done'
        ? '레시피 완료를 취소했습니다!'
        : type === 'write'
          ? '레시피 기록을 취소했습니다!'
          : '레시피 즐겨찾기를 취소했습니다!'
    );
  };

  const handleRemoveConfirm = () => {
    if (!pendingRemove) return;
    performRemoval(pendingRemove.type, pendingRemove.id);
    setPendingRemove(null);
  };

  const handleRemoveUndo = () => setPendingRemove(null);

  // Update handleRecipeAction to use correct localStorage keys and sync properly
  const handleRecipeAction = async (id: number, action: { action: 'done' | 'write' | 'share' | 'favorite' }) => {
    const prevState = buttonStates[id] || getRecipeActionState(id);

      if (action.action === 'favorite') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id) || premiumRecipes.find(r => r.id === id);
        if (prevState.favorite) {
          setPendingRemove({ type: 'favorite', id });
        } else if (recipe && !getRecipesFromLocalStorage('favorite').some((r: any) => r.id === id)) {
          // 비회원은 즐겨찾기 3개까지(4번째부터 로그인 확인창)
          if (!guardGuestSave('favorite', id)) return;
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
          addRecipeToLocalStorage('favorite', normalized);
          setUserFavoriteRecipes(prev => [...prev, id]);

          if (isLoggedIn && authUser?.id) {
            try {
              const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
              if (token) {
                const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                await fetch(`${apiUrl}/api/users/${authUser.id}/favorite-recipes`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ recipe_id: id }),
                });
              }
            } catch (error) {
              console.error('[Popular] 즐겨찾기 레시피 저장 실패:', error);
            }
          }

          setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
          setToast('레시피를 즐겨찾기에 추가했습니다!');
        }
      }
    
      if (action.action === 'done') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id) || premiumRecipes.find(r => r.id === id);
        if (prevState.done) {
          // 완료 취소
          setPendingRemove({ type: 'done', id });
        } else {
        // 완료 추가 전에 5개 조건 체크
          if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
          // 비회원은 완료 3개까지(4번째부터 로그인 확인창)
          if (!guardGuestSave('done', id)) return;
          
          // 조건 통과 시 레시피 저장
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
            setUserCompletedRecipes(prev => [...prev, id]);
            
            // 로그인한 경우 DB에도 저장
            if (isLoggedIn && authUser?.id) {
              try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                if (token) {
                  const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                  await fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ recipe_id: id }),
                  });
                }
              } catch (error) {
                console.error('[Popular] 완료 레시피 저장 실패:', error);
              }
            }
            
          setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
            setToast('레시피를 완료했습니다!');
        // 「냉장고에서 다 쓴 재료」는 전역 UsedUpHost 가 완료 기록을 듣고 묻는다(어느 화면에서 완료하든).
          }
        }
      }
      if (action.action === 'write') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id) || premiumRecipes.find(r => r.id === id);
        if (prevState.write) {
          // 기록 취소
          setPendingRemove({ type: 'write', id });
        } else {
        // 기록 추가 전에 5개 조건 체크
          if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
          // 비회원은 기록 3개까지(4번째부터 로그인 확인창)
          if (!guardGuestSave('write', id)) return;
          
          // 조건 통과 시 레시피 저장
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
            setUserRecordedRecipes(prev => [...prev, id]);
            
            // 로그인한 경우 DB에도 저장
            if (isLoggedIn && authUser?.id) {
              try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                if (token) {
                  const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                  await fetch(`${apiUrl}/api/users/${authUser.id}/recorded-recipes`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ recipe_id: id }),
                  });
                }
              } catch (error) {
                console.error('[Popular] 기록 레시피 저장 실패:', error);
              }
            }
            
          setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
            setToast('레시피를 기록했습니다!');
          }
        }
      }
      if (action.action === 'share') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id) || premiumRecipes.find(r => r.id === id);
        if (recipe) {
          copyRecipeUrlToClipboard(recipe);
          setToast('URL이 복사되었습니다!');
        setTimeout(() => setToast(''), 1500);
        }
      }
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

  /**
   * 「특별한 날 특별한 음식」 — 서버에서 받아 온다.
   *
   * 고르는 규칙(프리미엄 재료 목록·제외어·요리명 제외)은 `backend/premium_ingredients.py`
   * 한 곳에만 둔다. 두 곳에 두면 반드시 갈라진다.
   *
   * **기간은 인기 목록과 똑같이 넘긴다.** 화면 위 기간 바는 아래 모든 섹션에
   * 걸리는 조건이라, 이 섹션만 전 기간을 보면 고른 조건이 조용히 무시된다.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      let params = `period_type=${period}&size=20`;
      if (period === 'custom' && dateRange[0] && dateRange[1]) {
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        params += `&start_date=${fmt(dateRange[0])}&end_date=${fmt(dateRange[1])}`;
      }
      try {
        const res = await axios.get(`${apiUrl}/api/recipes/premium?${params}`);
        const list = Array.isArray(res.data?.recipes) ? res.data.recipes : [];
        if (!cancelled) setPremiumPool(filterRecipesWithValidThumbnails(list));
      } catch (err) {
        // 이 섹션만 못 받은 것이다. 나머지 화면은 그대로 보여 준다.
        console.error('Failed to fetch premium recipes:', err);
        if (!cancelled) setPremiumPool([]);
      }
    })();
    return () => { cancelled = true; };
  }, [period, dateRange]);

  // Fetch recipes and calculate popularity scores based on period filter
  useEffect(() => {
    (async () => {
      setLoading(true); // 로딩 시작
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const size = 100;
      
      try {
        // 기간별 API 파라미터 구성
        let apiParams = `period_type=${period}&size=${size}`;
        
        // custom 기간인 경우 시작/종료 날짜 추가
        if (period === 'custom' && dateRange[0] && dateRange[1]) {
          const formatDate = (date: Date) => date.toISOString().split('T')[0];
          apiParams += `&start_date=${formatDate(dateRange[0])}&end_date=${formatDate(dateRange[1])}`;
        }
        
        // 앱을 열 때 미리 받아 둔 것이 있으면 그걸 쓴다.
        // 기본 기간(직접 고른 구간이 아닐 때)만이다 — 그때만 같은 질문이다.
        let payload: any = null;
        if (period !== 'custom') {
          const early = takePrefetchedPopular(period);
          if (early) {
            payload = await early;
            if (payload) console.log('[Popular] 미리 받아 둔 것을 씀');
          }
        }
        if (!payload) {
          const res = await axios.get(`${apiUrl}/api/recipes/popular?${apiParams}`);
          payload = res.data;
        }
        console.log('Popular API 응답:', payload);

        // 응답 형태 방어적 파싱: 배열/객체 모두 안전 처리
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
        
        // 썸네일이 없는 레시피 필터링
        const filteredYoutubeData = Array.isArray(youtubeData) 
          ? filterRecipesWithValidThumbnails(youtubeData)
          : [];
        const filteredNaverData = Array.isArray(naverData)
          ? filterRecipesWithValidThumbnails(naverData)
          : [];
        
        // 필터링된 레시피 수 로깅
        if (Array.isArray(youtubeData) && youtubeData.length > 0) {
          const filteredCount = youtubeData.length - filteredYoutubeData.length;
          if (filteredCount > 0) {
            console.log(`⚠️ 썸네일 없는 YouTube 레시피 ${filteredCount}개 필터링됨`);
          }
        }
        if (Array.isArray(naverData) && naverData.length > 0) {
          const filteredCount = naverData.length - filteredNaverData.length;
          if (filteredCount > 0) {
            console.log(`⚠️ 썸네일 없는 Naver 레시피 ${filteredCount}개 필터링됨`);
          }
        }

        setYoutubeRecipes(filteredYoutubeData);
        setNaverRecipes(filteredNaverData);
        setLoading(false); // 로딩 완료
      } catch (err) {
        console.error('Failed to fetch popular recipes:', err);
        setYoutubeRecipes([]);
        setNaverRecipes([]);
        setLoading(false); // 에러 발생 시에도 로딩 종료
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
  const [matchRange, setMatchRange] = useState<[number, number]>([DEFAULT_MATCH_MIN, 100]); // 매칭도 기본 하한 30→10%(2026-10-08) — 냉장고요리와 같은 값
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);

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
      } catch {}
    }
  }, []);

  // Save sort/filter state to localStorage on change
  useEffect(() => {
    localStorage.setItem('recipe_sortbar_state_popular', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients]);

  // 사용자별 레시피 상태 로드 (로그인한 경우 DB에서, 비로그인은 localStorage에서)
  useEffect(() => {
    const loadUserRecipes = async () => {
      const localCompletedIds = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]').map((r: any) => r.id);
      const localRecordedIds = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]').map((r: any) => r.id);
      const localFavoriteIds = JSON.parse(localStorage.getItem('my_favorite_recipes') || '[]').map((r: any) => r.id);

      if (isLoggedIn && authUser?.id) {
        try {
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          if (!token) {
            setUserRecordedRecipes(localRecordedIds);
            setUserCompletedRecipes(localCompletedIds);
            setUserFavoriteRecipes(localFavoriteIds);
            return;
          }

          const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';

          const recordedResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/recorded-recipes`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (recordedResponse.ok) {
            const recordedData = await recordedResponse.json();
            const dbIds = (recordedData.recipes || []).map((r: any) => r.id);
            setUserRecordedRecipes([...new Set([...dbIds, ...localRecordedIds])]);
          } else {
            setUserRecordedRecipes(localRecordedIds);
          }

          const completedResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (completedResponse.ok) {
            const completedData = await completedResponse.json();
            const dbIds = (completedData.recipes || []).map((r: any) => r.id);
            setUserCompletedRecipes([...new Set([...dbIds, ...localCompletedIds])]);
          } else {
            setUserCompletedRecipes(localCompletedIds);
          }

          const favoriteResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/favorite-recipes`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (favoriteResponse.ok) {
            const favoriteData = await favoriteResponse.json();
            const dbIds = (favoriteData.recipes || []).map((r: any) => r.id);
            setUserFavoriteRecipes([...new Set([...dbIds, ...localFavoriteIds])]);
          } else {
            setUserFavoriteRecipes(localFavoriteIds);
          }
        } catch (error) {
          console.error('[Popular] 사용자 레시피 로드 실패:', error);
          setUserRecordedRecipes(localRecordedIds);
          setUserCompletedRecipes(localCompletedIds);
          setUserFavoriteRecipes(localFavoriteIds);
        }
      } else {
        // 비로그인인 경우 localStorage에서 로드
        const completedRecipes = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
        const recordedRecipes = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
        const favoriteRecipes = JSON.parse(localStorage.getItem('my_favorite_recipes') || '[]');
        setUserCompletedRecipes(completedRecipes.map((r: any) => r.id));
        setUserRecordedRecipes(recordedRecipes.map((r: any) => r.id));
        setUserFavoriteRecipes(favoriteRecipes.map((r: any) => r.id));
      }
    };
    
    loadUserRecipes();
  }, [isLoggedIn, authUser?.id]);

  // 레시피 액션 상태 동기화
  useEffect(() => {
    const syncButtonStates = () => {
      setButtonStates(buildRecipeActionStatesForRecipes([...youtubeRecipes, ...naverRecipes]));
    };

    syncButtonStates();

    const handleRecipeStorageChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (
        key === 'my_recorded_recipes' ||
        key === 'my_completed_recipes' ||
        key === 'my_favorite_recipes'
      ) {
        syncButtonStates();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === 'my_recorded_recipes' ||
        event.key === 'my_completed_recipes' ||
        event.key === 'my_favorite_recipes'
      ) {
        syncButtonStates();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncButtonStates();
      }
    };

    window.addEventListener('localStorageChange', handleRecipeStorageChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', syncButtonStates);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('localStorageChange', handleRecipeStorageChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', syncButtonStates);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [youtubeRecipes, naverRecipes]);

  /**
   * 특별한 날 특별한 음식 목록.
   *
   * 고르는 일은 **서버가 카탈로그 전체에서** 한다(`/api/recipes/premium`).
   * 여기서는 유튜브/네이버 인기 상단과 겹치는 항목만 뒤로 민다.
   *
   * 예전에는 이 계산이 JSX 안의 즉시실행 함수 안에 있어서 (a) 렌더마다 다시 돌고
   * (b) 바깥에서 "이 섹션이 그려지는지" 를 알 수 없었다. 첫 섹션 판정에 필요해 끌어올린다.
   */
  const premiumRecipes = React.useMemo(() => {
    const popularHeadIds = new Set([
      ...youtubeRecipes.slice(0, 15).map((r: { id: number }) => r.id),
      ...naverRecipes.slice(0, 15).map((r: { id: number }) => r.id),
    ]);
    // 서버가 이미 등급 순으로 세워 뒀다. 여기서는 인기 상단과 겹치는 것만
    // 뒤로 민다 — 같은 카드가 연달아 보이는 느낌을 줄이려는 것이다.
    const notInHead = premiumPool.filter(r => !popularHeadIds.has(r.id));
    const inHead = premiumPool.filter(r => popularHeadIds.has(r.id));
    return [...notInHead, ...inHead].slice(0, 20);
  }, [premiumPool, youtubeRecipes, naverRecipes]);

  /**
   * 「인기 레시피」 칩의 목록 — 네이버(100건)와 유튜브(22건 안팎)를 **비율대로 섞는다.**
   * 이어 붙이면 유튜브가 맨 끝에 묻히고, 한 줄씩 번갈아 놓으면 유튜브가 앞쪽에 몰린다.
   * 각 글의 「자기 목록 안 순서 ÷ 자기 목록 길이」로 줄을 세우면 둘 다 고르게 퍼진다.
   */
  const mixedRecipes = React.useMemo(() => {
    const tag = (list: any[]) => list.map((r, i) => ({ r, k: (i + 0.5) / list.length }));
    return [...tag(naverRecipes), ...tag(youtubeRecipes)].sort((a, b) => a.k - b.k).map(x => x.r);
  }, [naverRecipes, youtubeRecipes]);

  const viewRecipes = React.useMemo(() => {
    const list = view === 'naver' ? naverRecipes
      : view === 'youtube' ? youtubeRecipes
      : view === 'special' ? premiumRecipes
      : mixedRecipes;
    return list.filter((r: any) => !failedThumbnailIds.has(r.id));
  }, [view, naverRecipes, youtubeRecipes, premiumRecipes, mixedRecipes, failedThumbnailIds]);

  // 구역·기간이 바뀌면 다시 20건부터.
  useEffect(() => { setShown(PAGE_SIZE); }, [view, period, dateRange]);

  const risingRows = risingTab === 'dish' ? dishRankings : themeRankings;
  const countNote = view === 'rising'
    ? `인기 급상승 TOP ${risingRows.length}`
    : `총 ${viewRecipes.length.toLocaleString('ko-KR')}건`;

  // 직접 고른 기간은 고른 날짜를 그대로 보여 준다(`기간선택` 이라고만 적혀 있으면 무슨 기간인지 모른다).
  const periodSelectOptions = periodOptions.map(o => ({
    value: o.value,
    label: o.label,
    short: o.value === 'custom' && dateRange[0] && dateRange[1]
      ? `${String(dateRange[0].getMonth() + 1).padStart(2, '0')}.${String(dateRange[0].getDate()).padStart(2, '0')}~${String(dateRange[1].getMonth() + 1).padStart(2, '0')}.${String(dateRange[1].getDate()).padStart(2, '0')}`
      : undefined,
  }));

  return (
    <>
      <div className="popular-page" style={{padding: '76px 20px 80px 20px', maxWidth: 400, margin: '0 auto', boxSizing: 'border-box'}}>
        {/* 한때 `인기 요리·재료부터 테마 추천까지` 제목이 있었다. **뺐다**
            (2026-10-08). 아래 섹션 제목들(인기 요리 / 인기 재료 / 테마)이
            이미 같은 말을 하고 있어서, 제목은 그 목차를 한 번 더 읽어 주는
            줄이었다. 화면 이름은 하단 탭의 `요즘인기` 가 말한다. */}

        {/* 구역 칩 — 한 번에 하나. 모양은 앱 공용 `Chip`(알약, 고른 것만 검은 면). */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '0 0 2px', scrollbarWidth: 'none' }}>
          {VIEW_CHIPS.map(c => (
            <Chip
              key={c.value}
              size="sm"
              interactive
              selected={view === c.value}
              role="button"
              aria-pressed={view === c.value}
              onClick={() => setView(c.value)}
              style={{ flexShrink: 0, padding: '0 9px', fontSize: 12.5 }}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        {/* 건수(왼쪽) · 기간(오른쪽). 기간은 이 화면의 모든 구역에 걸리는 조건이다 —
            셋뿐이던 검은 알약 퀵버튼을 같은 줄의 작은 드롭다운으로 줄였다(마이캘린더 기간과 같은 부품). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 4px', minHeight: 28 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{countNote}</span>
          <MenuSelect<string>
            value={period}
            align="right"
            ariaLabel="기간"
            options={periodSelectOptions}
            onChange={(v) => {
              if (v === 'custom') {
                setTempDateRange(dateRange[0] && dateRange[1] ? [dateRange[0], dateRange[1]] : [null, null]);
                setDateModalOpen(true);
                return;
              }
              setPeriod(v);
              setDateRange([null, null]);
              setTempDateRange([null, null]);
            }}
          />
        </div>

        {/* 기간선택 모달 */}
        {dateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 'var(--z-modal)' }} onClick={() => {
            setDateModalOpen(false);
            // 모달을 닫을 때 임시 상태를 원래 상태로 복원
              setTempDateRange([dateRange[0], dateRange[1]]);
          }}>
            <div className="bg-white rounded-xl shadow-lg px-0 py-0 w-auto max-w-[95vw] relative" onClick={e => e.stopPropagation()}>
              {/* 단일 달력 - 기간 선택 가능 */}
              <div className="flex justify-center">
                <div ref={calendarRef}>
                        <CustomCalendar
                    selectedDate={tempDateRange[0]}
                    mode="range"
                    selectedStartDate={tempDateRange[0]}
                    selectedEndDate={tempDateRange[1]}
                          onDateSelect={(date) => {
                      // 단일 날짜 선택 시 시작일과 종료일을 동일하게 설정 (임시 상태만 업데이트)
                      const startDate = new Date(date);
                      startDate.setHours(0, 0, 0, 0);
                      const endDate = new Date(date);
                      endDate.setHours(23, 59, 59, 999);
                      setTempDateRange([startDate, endDate]);
                          }}
                    onRangeSelect={(startDate, endDate) => {
                      console.log('onRangeSelect called:', startDate, endDate);
                      if (startDate && endDate) {
                        // 기간 선택 완료 (임시 상태만 업데이트)
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        console.log('Setting range:', start, end);
                        setTempDateRange([start, end]);
                      } else if (startDate) {
                        // 시작일만 선택된 경우 (종료일은 null)
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        console.log('Setting start only:', start);
                        setTempDateRange([start, null]);
                      } else {
                        // 모두 초기화
                        setTempDateRange([null, null]);
                      }
                    }}
                    onClose={() => {
                      // 취소 버튼 클릭 시 모달 닫기 (변경사항 무시)
                      setDateModalOpen(false);
                      setTempDateRange([dateRange[0], dateRange[1]]);
                          }}
                    onSelect={() => {
                      // 선택 버튼 클릭 시 실제 적용
                      if (tempDateRange[0]) {
                        const finalEndDate = tempDateRange[1] || tempDateRange[0];
                        finalEndDate.setHours(23, 59, 59, 999);
                        setDateRange([tempDateRange[0], finalEndDate]);
                      setPeriod('custom');
                      setDateModalOpen(false);
                    }
                  }}
                    type="range"
                    minDate={new Date(1900, 0, 1)}
                    maxDate={today}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 본문 — **칩으로 한 번에 하나씩** 본다(2026-11-06 당근식 개편).
            전에는 「특별한 날」 가로 카드 → 「인기 레시피」 가로 카드 → 「급상승」 표가 위아래로 이어져
            한 화면에 카드 1.3장밖에 안 보였고, 구역마다 고르개(네이버/유튜브·요리/테마)가 따로 있었다.
            이제 칩 한 줄이 구역을 고르고, 레시피는 한 줄짜리 세로 행(`RecipeRow`)으로 5~6개씩 보인다. */}
        {!loading && view !== 'rising' && viewRecipes.length === 0 && (
          <p style={{ margin: '48px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-500)' }}>
            이 기간에는 보여 드릴 레시피가 없어요.
          </p>
        )}
        {view !== 'rising' && viewRecipes.slice(0, shown).map((recipe, index) => (
          <RecipeRow
            key={`${view}-${recipe.id}`}
            recipe={recipe}
            rank={view === 'special' ? undefined : index + 1}
            // 「특별한 날」 행은 상태 맵(buttonStates)을 만드는 목록(유튜브·네이버)에 없을 수 있다 — 맵에 없으면 기기 목록을 직접 본다.
            recipeActionState={lookupRecipeActionState(buttonStates, recipe.id) || getRecipeActionState(recipe.id)}
            onRecipeAction={(r) => handleRecipeAction(recipe.id, { action: r.action })}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            onThumbnailError={(recipeId) => {
              setFailedThumbnailIds(prev => (prev.has(recipeId) ? prev : new Set([...prev, recipeId])));
            }}
          />
        ))}
        {view !== 'rising' && viewRecipes.length > shown && (
          <button
            type="button"
            onClick={() => setShown(n => n + PAGE_SIZE)}
            style={{
              display: 'block', width: '100%', height: 44, margin: '14px 0 0', borderRadius: 12,
              border: '1px solid var(--line-300)', background: 'var(--surface)', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, color: 'var(--ink-700)', fontFamily: 'inherit',
            }}
          >
            더 보기 ({viewRecipes.length - shown}건 남음)
          </button>
        )}

        {/* 급상승 — 요리/테마 둘이 한 자리를 나눠 쓴다. 표 대신 순위 행. */}
        {view === 'rising' && (
          <>
            <div style={{ display: 'flex', margin: '6px 0 4px' }}>
              <SegmentedToggle
                value={risingTab}
                onChange={(v) => setRisingTab(v)}
                options={[
                  { value: 'dish' as const, label: '요리', disabled: dishRankings.length === 0 },
                  { value: 'theme' as const, label: '테마', disabled: themeRankings.length === 0 },
                ]}
              />
            </div>
            {risingRows.length === 0 && !loading && (
              <p style={{ margin: '48px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-500)' }}>
                이 기간에는 보여 드릴 순위가 없어요.
              </p>
            )}
            {risingRows.map((row: any, idx: number) => {
              const badge = row.isNew ? '신규'
                : row.multiplier && row.multiplier > 1 ? `▴${row.multiplier}배`
                : row.rate > 0 ? `▴${row.rate}%` : '';
              return (
                <div
                  key={row.id ?? row.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/ingredient/${encodeURIComponent(row.name)}` + (risingTab === 'dish' ? '?minCount=2' : ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/ingredient/${encodeURIComponent(row.name)}` + (risingTab === 'dish' ? '?minCount=2' : '')); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, height: 58, borderBottom: '1px solid var(--line-200)', cursor: 'pointer' }}
                >
                  <span style={{
                    flex: 'none', width: 24, textAlign: 'center', fontSize: 17, fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums', color: idx < 3 ? 'var(--ink-900)' : 'var(--ink-500)',
                  }}>{idx + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </span>
                  {badge && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px', background: '#FFF1A8', color: '#6B5200' }}>
                      {badge}
                    </span>
                  )}
                  <span style={{ width: 46, textAlign: 'right', fontSize: 13, color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}개
                  </span>
                </div>
              );
            })}
          </>
        )}

        {/* 한때 여기 `특정 재료·테마 등 키워드로 찾아보기` 검색창이 있었다.
            **뺐다**(2026-10-08 요청) — 냉장고요리 탭의 검색창과 **하는 일이 같다.**
            같은 기능이 두 화면에 있으면 어느 쪽이 무엇인지 매번 따져야 하고,
            이 화면은 "고른 것을 보여 주는" 자리라 찾는 일은 거기서 하면 된다.
            (재료 상세로 가는 길은 아래 인기 재료·급상승 표가 그대로 갖고 있다) */}

        {/* 쿠팡 다이내믹 배너 — 화면 맨 끝(2026-09-22). 전의 BottomCoupangAd 는 광고 단위 ID 환경변수가
            없어 실제로는 아무것도 안 그리고 있었다.
            바로 위가 키워드 검색창이라 24px 로 붙여 두니 검색 결과·콘텐츠처럼 보였다(2026-09-26 지적) → 크게 띄운다. */}
        <CoupangDynamicBanner height={50} style={{ marginTop: 64, marginBottom: 24 }} />
      </div>
      {toast && (
        <Toast message={toast} />
      )}
      {pendingRemove && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34, 34, 34, 0.9)',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 400,
          zIndex: 'var(--z-toast)',
          maxWidth: 320,
          width: 'max-content',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            color: '#FFFFFF',
            marginBottom: 6,
            letterSpacing: '0.04em',
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            textWrap: 'balance',
            display: 'inline-block',
            fontWeight: 400
          }}>
            {pendingRemove.type === 'done'
              ? '레시피 완료를 취소하시겠어요?'
              : pendingRemove.type === 'write'
                ? '레시피 기록을 취소하시겠어요?'
                : '레시피 즐겨찾기를 취소하시겠어요?'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, justifyContent: 'center', width: '100%' }}>
            <button
              className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap"
              style={{ marginRight: 4 }}
              onClick={handleRemoveUndo}
            >
              아니요
            </button>
            <button
              className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap"
              onClick={handleRemoveConfirm}
            >
              네
            </button>
          </div>
        </div>
      )}
      {/* Loading animation */}
      {loading && (
        <div className="loader-toast">
          <LoadingIndicator />
        </div>
      )}
      
      {/* 완료 직후 — 쓴 재료를 냉장고에서 뺄지 묻는다. */}

      <BottomNavBar activeTab="popularity" />
    </>
  );
};

export default Popular;