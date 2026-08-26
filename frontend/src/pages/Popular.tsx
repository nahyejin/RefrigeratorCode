import React, { useState, useEffect, useMemo } from 'react';
import SectionIcon from '../components/ui/SectionIcon';
import CoupangDisclaimer from '../components/CoupangDisclaimer';
import LoadingIndicator from '../components/LoadingIndicator';
import SectionHeader from '../components/SectionHeader';
import SectionBand from '../components/ui/SectionBand';
import Toast from '../components/Toast';
import IngredientLegend from '../components/IngredientLegend';
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
import RecipeCard from '../components/RecipeCard';
import youtubeTitleImg from '../assets/유튜브제목이미지.png';
import naverTitleImg from '../assets/네이버제목이미지.png';
import { addRecipeToLocalStorage, removeRecipeFromLocalStorage, getRecipesFromLocalStorage, copyRecipeUrlToClipboard, getMyFridgeIngredients, buildRecipeActionStatesForRecipes, getRecipeActionState } from '../utils/recipeStorage';
import VirtualizedRecipeList from '../components/VirtualizedRecipeList';
import RecipeToast from '../components/RecipeToast';
import RecipeSortBar from '../components/RecipeSortBar';
import VirtualizedHorizontalRecipeList from '../components/VirtualizedHorizontalRecipeList';
import { decodeRecipesText } from '../utils/textUtils';
import { useAuth } from '../context/AuthContext';
import RegisterPromptModal from '../components/RegisterPromptModal';
import {
  hasPremiumIngredient,
  getPremiumTierRank,
} from '../utils/premiumIngredients';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';
import CoupangProductAd from '../components/CoupangProductAd';
import BottomCoupangAd from '../components/BottomCoupangAd';

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
  const [search, setSearch] = useState('');
  const nickname = "닉네임"; // 실제 닉네임 연동 필요
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { isLoggedIn, user: authUser } = useAuth();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerModalMessage, setRegisterModalMessage] = useState('');
  const [pendingRecipe, setPendingRecipe] = useState<{ id: number; type: 'done' | 'write'; recipe: any } | null>(null);
  
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
  const [naverRecipes, setNaverRecipes] = useState<any[]>([]);
  // 썸네일 로드 실패한 레시피 ID 추적 (404 등)
  const [failedThumbnailIds, setFailedThumbnailIds] = useState<Set<number>>(new Set());
  // 프리미엄 요리 섹션 스크롤 상태
  const premiumScrollRef = React.useRef<HTMLDivElement>(null);
  const [showPremiumLeftButton, setShowPremiumLeftButton] = useState(false);
  const [showPremiumRightButton, setShowPremiumRightButton] = useState(true);

  // 프리미엄 요리 섹션 스크롤 상태 체크
  useEffect(() => {
    const checkScroll = () => {
      if (premiumScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = premiumScrollRef.current;
        setShowPremiumLeftButton(scrollLeft > 0);
        setShowPremiumRightButton(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    const container = premiumScrollRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [youtubeRecipes, naverRecipes]);

  // 프리미엄 요리 섹션 스크롤 상태 체크
  useEffect(() => {
    const checkScroll = () => {
      if (premiumScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = premiumScrollRef.current;
        setShowPremiumLeftButton(scrollLeft > 0);
        setShowPremiumRightButton(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    const container = premiumScrollRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [youtubeRecipes, naverRecipes]);

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
        setDishKeywords(extractDishKeywordsFromCSV(csv));
      });
  }, []);

  // 대체재료 테이블 로드
  useEffect(() => {
    const loadSubstituteTable = async () => {
      const CACHE_KEY = 'substitute_table_cache';
      const CACHE_VERSION = '2.3'; // 대체재 양방향(단맛 조미) 테이블 반영
      
      try {
        // 캐시 확인
        if (typeof window !== 'undefined' && window.localStorage) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            try {
              const parsedCache = JSON.parse(cached);
              if (parsedCache.version === CACHE_VERSION && parsedCache.data) {
                console.log('[Popular] 캐시된 대체재료 테이블 사용', Object.keys(parsedCache.data).length, '개 재료');
                setSubstituteTable(parsedCache.data);
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
        const response = await fetch('/ingredient_substitute_table.csv');
        const csv = await response.text();
        
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
              data: table
            }));
            console.log('[Popular] 대체재료 테이블 캐시 저장 완료');
          } catch (e) {
            console.warn('[Popular] 캐시 저장 실패:', e);
          }
        }
        
        setSubstituteTable(table);
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

  // Update handleRecipeAction to use correct localStorage keys and sync properly
  const handleRecipeAction = async (id: number, action: { action: 'done' | 'write' | 'share' | 'favorite' }) => {
    const prevState = buttonStates[id] || getRecipeActionState(id);

      if (action.action === 'favorite') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (prevState.favorite) {
          removeRecipeFromLocalStorage('favorite', id);
          setUserFavoriteRecipes(prev => prev.filter(rid => rid !== id));

          if (isLoggedIn && authUser?.id) {
            try {
              const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
              if (token) {
                const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                await fetch(`${apiUrl}/api/users/${authUser.id}/favorite-recipes/${id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
                });
              }
            } catch (error) {
              console.error('[Popular] 즐겨찾기 레시피 삭제 실패:', error);
            }
          }

          setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
          setToast('레시피 즐겨찾기를 취소했습니다!');
        } else if (recipe && !getRecipesFromLocalStorage('favorite').some((r: any) => r.id === id)) {
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
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (prevState.done) {
          // 완료 취소
          removeRecipeFromLocalStorage('done', id);
          setUserCompletedRecipes(prev => prev.filter(rid => rid !== id));
          
          // 로그인한 경우 DB에서도 삭제
          if (isLoggedIn && authUser?.id) {
            try {
              const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
              if (token) {
                const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                await fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes/${id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
                });
              }
            } catch (error) {
              console.error('[Popular] 완료 레시피 삭제 실패:', error);
            }
          }
          
        setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
          setToast('레시피 완료를 취소했습니다!');
        } else {
        // 완료 추가 전에 5개 조건 체크
          if (recipe && !getRecipesFromLocalStorage('done').some((r: any) => r.id === id)) {
          const currentCount = getRecipesFromLocalStorage('done').length;
          const totalCount = currentCount + 1;
          
          // 완료한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
          if (totalCount >= 5 && !isLoggedIn) {
            // 레시피 저장 전에 모달 표시
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
            setPendingRecipe({ id, type: 'done', recipe: normalized });
            setRegisterModalMessage('더 많은 레시피를 완료하려면');
            setShowRegisterModal(true);
            return;
          }
          
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
          }
        }
      }
      if (action.action === 'write') {
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
        if (prevState.write) {
          // 기록 취소
          removeRecipeFromLocalStorage('write', id);
          setUserRecordedRecipes(prev => prev.filter(rid => rid !== id));
          
          // 로그인한 경우 DB에서도 삭제
          if (isLoggedIn && authUser?.id) {
            try {
              const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
              if (token) {
                const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
                await fetch(`${apiUrl}/api/users/${authUser.id}/recorded-recipes/${id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
                });
              }
            } catch (error) {
              console.error('[Popular] 기록 레시피 삭제 실패:', error);
            }
          }
          
        setButtonStates(prev => ({ ...prev, [id]: getRecipeActionState(id) }));
          setToast('레시피 기록을 취소했습니다!');
        } else {
        // 기록 추가 전에 5개 조건 체크
          if (recipe && !getRecipesFromLocalStorage('write').some((r: any) => r.id === id)) {
          const currentCount = getRecipesFromLocalStorage('write').length;
          const totalCount = currentCount + 1;
          
          // 기록한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
          if (totalCount >= 5 && !isLoggedIn) {
            // 레시피 저장 전에 모달 표시
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
            setPendingRecipe({ id, type: 'write', recipe: normalized });
            setRegisterModalMessage('더 많은 레시피를 기록하려면');
            setShowRegisterModal(true);
            return;
          }
          
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
        const recipe = youtubeRecipes.find(r => r.id === id) || naverRecipes.find(r => r.id === id);
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

  return (
    <>
      <div className="popular-page" style={{padding: '76px 20px 80px 20px', maxWidth: 400, margin: '0 auto', boxSizing: 'border-box'}}>
        {/* 상단 타이틀 */}
        <header style={{marginBottom: 20}}>
          {/* header 와 h2 가 각각 marginBottom 32 를 걸고 있어 64px 이 비어 있었음 */}
          <h2 className="text-lg font-bold text-center" style={{marginBottom: 0}}>
            인기 요리·재료부터 테마 추천까지
          </h2>
        </header>

        {/* 정렬/필터 바 */}
        <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, justifyContent: 'flex-end'}}>
          {periodOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value === 'custom') {
                  // 모달 열 때 현재 dateRange 값을 tempDateRange에 반영
                  if (dateRange[0] && dateRange[1]) {
                    setTempDateRange([dateRange[0], dateRange[1]]);
                  } else {
                    setTempDateRange([null, null]);
                  }
                  setDateModalOpen(true);
                } else {
                  // 다른 기간 선택 시
                  setPeriod(opt.value);
                  setDateRange([null, null]);
                  setTempDateRange([null, null]);
                }
              }}
              style={{
                height: 28,
                border: period === opt.value ? '1px solid #6A6A73' : '1px solid #D2D2D8',
                borderRadius: 6,
                fontSize: 13,
                padding: '0 8px',
                fontWeight: 600,
                background: period === opt.value ? '#6A6A73' : '#FFFFFF',
                color: period === opt.value ? '#FFFFFF' : '#1A1A1E',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                lineHeight: '28px',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                if (period !== opt.value) {
                  e.currentTarget.style.background = '#F5F5F7';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== opt.value) {
                  e.currentTarget.style.background = '#FFFFFF';
                }
              }}
            >
              {opt.label}
            </button>
          ))}
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

        {/* 특별한 날 특별한 음식 섹션 */}
        {(() => {
          // 프리미엄 재료 포함 레시피 — 비싼 재료 우선 정렬(premiumIngredients.ts 순서).
          // 유튜브/네이버 인기 상단과 겹치는 항목은 뒤로 밀어 같은 카드가 연달아 보이는 느낌 완화.
          const allRecipes = [...youtubeRecipes, ...naverRecipes];
          const popularHeadIds = new Set([
            ...youtubeRecipes.slice(0, 15).map((r: { id: number }) => r.id),
            ...naverRecipes.slice(0, 15).map((r: { id: number }) => r.id),
          ]);

          const getIngs = (recipe: Recipe) => {
            if (!recipe.used_ingredients) return [] as string[];
            return parseUsedIngredientsForPills(recipe.used_ingredients);
          };

          const premiumCandidates = allRecipes.filter((recipe: Recipe) => {
            const ingredients = getIngs(recipe);
            return ingredients.length > 0 && hasPremiumIngredient(ingredients);
          });

          const byTier = (a: Recipe, b: Recipe) => {
            const ra = getPremiumTierRank(getIngs(a));
            const rb = getPremiumTierRank(getIngs(b));
            if (ra !== rb) return ra - rb;
            return (a.id ?? 0) - (b.id ?? 0);
          };

          const sorted = [...premiumCandidates].sort(byTier);
          const notInPopularHead = sorted.filter(r => !popularHeadIds.has(r.id));
          const inPopularHead = sorted.filter(r => popularHeadIds.has(r.id));
          const premiumRecipes = [...notInPopularHead, ...inPopularHead].slice(0, 20);

          if (premiumRecipes.length === 0) return null;

          return (
            <section style={{ marginBottom: 0 }}>
              <SectionBand bleed={20} />
              {/* 문구 변천:
                  ① "값비싼 재료가 들어간 레시피를 모았어요" — 비싼 재료를 사게 하려는
                     의도가 그대로 드러나 보였음
                  ② "기념일이나 손님상에 어울리는 레시피예요" — 기념일/손님상으로 못박으니
                     "그런 날" 이 아닌 사람에게는 남의 이야기가 됨. 실제로는 아이에게 잘
                     먹이고 싶은 날처럼 아무 날에도 보게 되는 목록임
                  → 상황을 한정하지 말고 재료의 성격만 말한다 */}
              <SectionHeader
                icon={<SectionIcon kind="special" />}
                title="특별한 날 특별한 음식"
                description="평소엔 잘 안 쓰는 재료로 만드는 요리예요"
              />
              {/* 범례 + 총 건수 (유튜브/네이버 섹션과 동일한 형식) */}
              <IngredientLegend total={premiumRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
              
              {/* 가로 스크롤 컨테이너 (버튼 포함) */}
              <div style={{ position: 'relative' }}>
                <div
                  ref={premiumScrollRef}
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    gap: '16px',
                    paddingBottom: '8px',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#D2D2D8 transparent',
                    scrollBehavior: 'smooth'
                  }}
                  className="custom-scrollbar"
                >
                  {premiumRecipes
                    .filter(recipe => !failedThumbnailIds.has(recipe.id))
                    .map((recipe, index) => {
                      return (
                        <div
                          key={recipe.id}
                          style={{
                            flex: '0 0 280px',
                            minWidth: '280px',
                            maxWidth: '280px',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                              <RecipeCard
                                recipe={recipe}
                                index={index}
                                recipeActionState={buttonStates[recipe.id]}
                                onRecipeAction={(recipeWithAction) => handleRecipeAction(recipe.id, { action: recipeWithAction.action })}
                                isLast={true}
                                myIngredients={myIngredients}
                            substituteTable={substituteTable}
                                showRank={false}
                                isHorizontal={true}
                                onThumbnailError={(recipeId) => {
                                  setFailedThumbnailIds(prev => new Set([...prev, recipeId]));
                                }}
                              />
                        </div>
                      );
                    })}
                </div>

                {/* 왼쪽 스크롤 버튼 */}
                {showPremiumLeftButton && (
                  <div
                    onClick={() => {
                      if (premiumScrollRef.current) {
                        premiumScrollRef.current.scrollBy({ left: -296, behavior: 'smooth' });
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '26px',
                          color: '#6A6A73',
                          fontWeight: 400,
                          lineHeight: 1,
                          pointerEvents: 'none'
                        }}
                      >
                        ‹
                      </span>
                    </div>
                  </div>
                )}

                {/* 오른쪽 스크롤 버튼 */}
                {showPremiumRightButton && (
                  <div
                    onClick={() => {
                      if (premiumScrollRef.current) {
                        premiumScrollRef.current.scrollBy({ left: 296, behavior: 'smooth' });
                      }
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '26px',
                          color: '#6A6A73',
                          fontWeight: 400,
                          lineHeight: 1,
                          pointerEvents: 'none'
                        }}
                      >
                        ›
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* ⓑ 유튜브 인기 레시피 섹션 (데이터 있을 때만 노출) */}
        {youtubeRecipes.length > 0 && (
        <section style={{ marginBottom: 0 }}>
          <SectionBand bleed={20} />
          <SectionHeader title="유튜브 인기 레시피" iconUrl={youtubeTitleImg} />
          {/* 범례: 가로형 레시피 카드 위, 왼쪽 정렬 */}
          <IngredientLegend total={youtubeRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
           <VirtualizedHorizontalRecipeList
             recipes={youtubeRecipes.filter(recipe => !failedThumbnailIds.has(recipe.id))}
             myIngredients={myIngredients}
             substituteTable={substituteTable}
             recipeActionStates={buttonStates}
             onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' | 'favorite' })}
             cardWidth={300}
             cardHeight={280}
             gap={16}
             showRank={true}
             compactSectionGap
             onThumbnailError={(recipeId) => {
               setFailedThumbnailIds(prev => new Set([...prev, recipeId]));
             }}
           />
        </section>
        )}

        {/* ⓒ 네이버 인기 레시피 섹션 (데이터 있을 때만 노출) */}
        {naverRecipes.length > 0 && (
        <section style={{ marginBottom: 0 }}>
          <SectionBand bleed={20} />
          <SectionHeader title="네이버 인기 레시피" iconUrl={naverTitleImg} />
          {/* 범례: 가로형 레시피 카드 위, 왼쪽 정렬 */}
          <IngredientLegend total={naverRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
           <VirtualizedHorizontalRecipeList
             recipes={naverRecipes.filter(recipe => !failedThumbnailIds.has(recipe.id))}
             myIngredients={myIngredients}
             substituteTable={substituteTable}
             recipeActionStates={buttonStates}
             onRecipeAction={(recipe, action) => handleRecipeAction(recipe.id, { action: action as 'done' | 'write' | 'share' | 'favorite' })}
             cardWidth={300}
             cardHeight={280}
             gap={16}
             showRank={true}
             compactSectionGap
             onThumbnailError={(recipeId) => {
               setFailedThumbnailIds(prev => new Set([...prev, recipeId]));
             }}
           />
        </section>
        )}


        {/* 인기 급상승 TOP10: 데이터가 있을 때만 노출 */}
        {dishRankings.length > 0 && (
        <section style={{ marginBottom: 0 }}>
          <SectionBand bleed={20} />
          <div>
            {/* 인기 급상승 요리 */}
            <div>
              <SectionHeader icon={<SectionIcon kind="trending" />} title="인기 급상승 요리 TOP 10" />
              <div>
                <table className="w-full max-w-[280px] mx-auto border-collapse text-[15px] font-sans" style={{background: '#FFFFFF'}}>
                  <thead>
                    <tr style={{borderTop: '1px solid #E6E6EA', borderBottom: '1px solid #E6E6EA', background: '#F5F5F7'}}>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">순위</th>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">요리명</th>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">레시피 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishRankings.map((dish, idx) => (
                        <tr key={dish.name}>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">{idx + 1}</td>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">
                            <span
                              style={{ cursor: 'pointer', textDecoration: 'none' }}
                              onClick={() => navigate(`/ingredient/${encodeURIComponent(dish.name)}?minCount=2`)}
                              title="해당 키워드 상세 보기"
                            >
                              {dish.name}
                            </span>
                          </td>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', position: 'relative', paddingRight: '8px'}}>
                              <span style={{flex: 1, textAlign: 'center', paddingRight: '20px'}}>{dish.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>
                              {dish.isNew || (dish.rate > 0) || (dish.multiplier !== undefined && dish.multiplier > 1) ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: (dish.isNew || dish.rate >= 0) ? '#FFF5F5' : '#EFF6FF',
                                    color: (dish.isNew || dish.rate >= 0) ? '#E85A4F' : '#3A6EA5',
                                    whiteSpace: 'nowrap',
                                    position: 'absolute',
                                    right: 0
                                  }}
                                >
                                  {dish.isNew ? '✦신규' : dish.multiplier && dish.multiplier > 1 ? `▴${dish.multiplier}배` : dish.rate > 0 ? `▴${dish.rate}%` : ''}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        )}

        {themeRankings.length > 0 && (
        <section style={{ marginBottom: 0 }}>
          <SectionBand bleed={20} />
          <div>
            {/* 인기 급상승 테마 */}
            <div>
              <SectionHeader icon={<SectionIcon kind="trending" />} title="인기 급상승 테마 TOP 10" />
              <div>
                <table className="w-full max-w-[280px] mx-auto border-collapse text-[15px] font-sans" style={{background: '#FFFFFF'}}>
                  <thead>
                    <tr style={{borderTop: '1px solid #E6E6EA', borderBottom: '1px solid #E6E6EA', background: '#F5F5F7'}}>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">순위</th>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">테마명</th>
                      <th className="py-1 px-2 text-center font-medium text-[#1A1A1E] whitespace-nowrap">레시피 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {themeRankings.map((theme, idx) => (
                        <tr key={theme.id}>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">{idx + 1}</td>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">
                            <span style={{ cursor: 'pointer', textDecoration: 'none' }} onClick={() => navigate(`/ingredient/${encodeURIComponent(theme.name)}`)}>
                              {theme.name}
                            </span>
                          </td>
                          <td className="py-1 px-2 text-center text-[#3A3A42] font-normal whitespace-nowrap">
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', position: 'relative', paddingRight: '8px'}}>
                              <span style={{flex: 1, textAlign: 'center', paddingRight: '20px'}}>{theme.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>
                              {theme.isNew || (theme.rate > 0) || (theme.multiplier !== undefined && theme.multiplier > 1) ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: (theme.isNew || theme.rate >= 0) ? '#FFF5F5' : '#EFF6FF',
                                    color: (theme.isNew || theme.rate >= 0) ? '#E85A4F' : '#3A6EA5',
                                    whiteSpace: 'nowrap',
                                    position: 'absolute',
                                    right: 0
                                  }}
                                >
                                  {theme.isNew ? '✦신규' : theme.multiplier && theme.multiplier > 1 ? `▴${theme.multiplier}배` : theme.rate > 0 ? `▴${theme.rate}%` : ''}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* 인기 레시피 직접 찾아보기 검색창 */}
        <section style={{ marginBottom: 0 }}>
          <SectionBand bleed={20} />
          <SectionHeader icon={<SectionIcon kind="search" />} title="특정 재료·테마 등 키워드로 찾아보기" />
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
              className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none"
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
              className="bg-[#FFD600] text-[#1A1A1E] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition"
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
        
        {/* 쿠팡 광고 - 페이지 맨 끝에 도달했을 때만 표시 */}
        <BottomCoupangAd showCondition={true} />
      </div>
      {toast && (
        <Toast message={toast} />
      )}
      {/* Loading animation */}
      {loading && (
        <div className="loader-toast">
          <LoadingIndicator />
        </div>
      )}
      
      {/* 회원가입 유도 모달 */}
      <RegisterPromptModal
        visible={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          setPendingRecipe(null);
        }}
        onConfirm={() => {
          // 회원가입하기를 누르면 레시피 저장 진행
          if (pendingRecipe) {
            if (pendingRecipe.type === 'done') {
              addRecipeToLocalStorage('done', pendingRecipe.recipe);
              setButtonStates(prev => ({ ...prev, [pendingRecipe.id]: getRecipeActionState(pendingRecipe.id) }));
            } else if (pendingRecipe.type === 'write') {
              addRecipeToLocalStorage('write', pendingRecipe.recipe);
              setButtonStates(prev => ({ ...prev, [pendingRecipe.id]: getRecipeActionState(pendingRecipe.id) }));
            }
            setPendingRecipe(null);
          }
        }}
        message={registerModalMessage || '더 많은 기능을 사용하려면'}
      />
      {!loading && <CoupangDisclaimer />}
      <BottomNavBar activeTab="popularity" />
    </>
  );
};

export default Popular;