import React, { useState, useEffect, useMemo } from 'react';
import { CONTACT } from '../components/ContactBox';
import { MenuGroup, MenuRow, MenuIcons } from '../components/MenuList';
import { mergeLocalDone, toDateKey, formatWonShort, ESTIMATED_SAVINGS_PER_MEAL_DEFAULT } from './CookingCalendar';
import { getRecentRecipes, RECENT_CHANGED_EVENT } from '../utils/recentRecipes';
import GroupTitle from '../components/ui/GroupTitle';
import SegmentedToggle from '../components/ui/SegmentedToggle';
import CloseButton from '../components/ui/CloseButton';
import Toast from '../components/Toast';
import IngredientLegend from '../components/IngredientLegend';
import SectionHeader from '../components/SectionHeader';
import SectionIcon from '../components/ui/SectionIcon';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import BottomNavBar from '../components/BottomNavBar';
import HouseholdSection from '../components/HouseholdSection';
import NotificationSettings from '../components/NotificationSettings';
import PullToRefresh from '../components/PullToRefresh';
import UsageGauge, { useIsAdmin, useUsage } from '../components/UsageMeter';
import GuideOverlay from '../components/GuideOverlay';
import { markUsageGuideFinished, requestUsageGuideReplay, usageGuideTotalSteps, USAGE_GUIDE_STEPS } from '../utils/onboardingPrompts';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import myProfileImg from '../assets/profile_default.png'; // 기본 프로필 이미지(없으면 대체)
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';

// 마이페이지 빈 목록 안내에서 "레시피 카드의 이 버튼을 누르라"는 걸 글자가 아니라
// 실제 버튼 모양(카드 썸네일 위 어두운 원 + 흰 아이콘)으로 보여주기 위한 미니 사본.
// 즐겨찾기·기록·완료 세 아이콘이 원래는 카드 위 배경이 서로 달라(즐겨찾기만 어두운 원 배지),
// 여기 안내에서까지 그대로 두면 셋 중 하나만 배지가 있어 통일감이 없어 보인다.
// → 안내에서는 셋 다 같은 어두운 원 배지로 감싸 "이 버튼을 누르라"는 신호를 동일하게 준다.
const EmptyStateIconHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'rgba(34,34,34,0.7)',
      verticalAlign: 'middle',
      margin: '0 3px',
    }}
  >
    {children}
  </span>
);

const FavoriteButtonHint: React.FC = () => (
  <EmptyStateIconHint>
    <svg width={14} height={14} viewBox="0 0 24 24">
      <path
        d="M12 2.75l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.62 6.56 19.48l1.04-6.05-4.4-4.29 6.08-.88L12 2.75z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  </EmptyStateIconHint>
);
// 비밀번호 보이기/숨기기 버튼. 전엔 👁️/👁️‍🗨️ 이모지를 썼는데, 이모지는
// 기기·OS마다 그림체가 달라(게다가 "숨김" 상태를 나타내는 데 말풍선-눈
// 조합은 뜻이 잘 안 읽히기도 했다) 앱의 다른 검정 선 아이콘과 통일감이
// 없다는 지적을 받아 SVG로 바꿨다.
const EyeIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.6 16.6 0 0 1-3.2 4.1M6.5 6.9C3.7 8.8 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 3.9-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

import writeIcon from '../assets/write.svg';
import doneIcon from '../assets/done.svg';
import { useNavigate, useLocation } from 'react-router-dom';
import RecipeCard from '../components/RecipeCard';
import VirtualizedHorizontalRecipeList from '../components/VirtualizedHorizontalRecipeList';
import { fetchCsvOnce } from '../utils/csvOnce';
import { getIngredientPillInfo } from '../utils/recipeUtils';
import IngredientPillGroup from '../components/IngredientPillGroup';
import { getProxiedImageUrl } from '../utils/imageUtils';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';
import {
  addRecipeToLocalStorage,
  removeRecipeFromLocalStorage,
  getRecipesFromLocalStorage,
  copyRecipeUrlToClipboard,
  sortRecipesByUserSavedAtDesc,
  withUserSavedAt,
  buildRecipeActionStatesForRecipes,
  getRecipeActionState,
  normalizeRecipeId,
  addRecipeActionToDB,
  removeRecipeActionFromDB,
  guardGuestSave,
} from '../utils/recipeStorage';
import { useAuth } from '../context/AuthContext';
import BottomCoupangAd from '../components/BottomCoupangAd';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';

// =====================
// 상수
// =====================

const TOAST_DURATION = 1500;
const CSV_SUBSTITUTE_URL = '/ingredient_substitute_table.csv';
const STORAGE_KEY_MYFRIDGE = 'myfridge_ingredients';
const STORAGE_KEY_RECORDED = 'my_recorded_recipes';
const STORAGE_KEY_COMPLETED = 'my_completed_recipes';
const STORAGE_KEY_FAVORITE = 'my_favorite_recipes';

/** DB 행과 로컬(풀 객체)을 id 기준으로 합침. 같은 id면 로컬 필드가 덮어써서 카드 표시용 필드 유지 */
function mergeRecipeListsFromDbAndLocal(dbList: any[], localList: any[]): any[] {
  const map = new Map<string, any>();
  for (const r of dbList || []) {
    if (r?.id != null) {
      map.set(String(r.id), { ...r });
    }
  }
  for (const r of localList || []) {
    if (r?.id == null) continue;
    const id = String(r.id);
    const fromDb = map.get(id);
    map.set(id, fromDb ? { ...fromDb, ...r, user_saved_at: fromDb.user_saved_at || r.user_saved_at } : { ...r });
  }
  return sortRecipesByUserSavedAtDesc(Array.from(map.values()));
}

// =====================
// 타입 정의
// =====================

interface RecipeCardData {
  id: number;
  thumbnail: string;
  title: string;
  match: number;
}

interface User {
  nickname: string;
  email: string;
  phone: string;
}

interface EditForm {
  nickname: string;
  userid: string;
  password: string;
  password2: string;
  phone1: string;
  phone2: string;
  phone3: string;
  zipcode: string;
  address1: string;
  address2: string;
}

interface ErrorState {
  password: string;
  phone: string;
}

interface PendingRemove {
  type: 'done' | 'write' | 'favorite';
  id: number;
}

// =====================
// 스타일 상수
// =====================

const CARD_STYLE = {
  borderRadius: 20,
  background: '#FFFFFF',
  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  marginBottom: 4,
  minHeight: 144,
  position: 'relative' as 'relative',
  padding: 16,
  border: 'none',
};

// =====================
// 더미 데이터
// =====================

const dummyUser: User = {
  nickname: '홍길동',
  email: 'honggildong123@example.com',
  phone: '010-1234-5678',
};

// =====================
// 유틸리티 함수
// =====================

/**
 * 재료 배열을 파싱한다
 */
function parseIngredients(recipe: any): string[] {
  if (Array.isArray(recipe.mainIngredients)) return recipe.mainIngredients;
  if (typeof recipe.used_ingredients === 'string') {
    return parseUsedIngredientsForPills(recipe.used_ingredients);
  }
  if (Array.isArray(recipe.used_ingredients)) {
    return parseUsedIngredientsForPills(recipe.used_ingredients);
  }
  if (Array.isArray(recipe.need_ingredients)) return recipe.need_ingredients;
  if (typeof recipe.need_ingredients === 'string') {
    return recipe.need_ingredients.split(',').map((i: string) => i.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 대체재료 배열을 파싱한다
 */
function parseSubstitutes(recipe: any): string[] {
  if (Array.isArray(recipe.substitutes)) return recipe.substitutes;
  if (typeof recipe.substitutes === 'string') {
    return recipe.substitutes.split(',').map((i: string) => i.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 내 냉장고 재료 목록을 안전하게 가져온다
 */
function getMyIngredientsSafe(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_MYFRIDGE) || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room].map((i: any) => 
        typeof i === 'string' ? i : i.name
      );
    }
  } catch (error) {
    console.warn('[MyPage] 내 냉장고 재료 로드 실패:', error);
  }
  return [];
}

/**
 * 플랫폼에 따른 로고를 반환한다
 */
function getPlatformLogo(platform: string | undefined): string {
  if (!platform) return naverLogo;
  const lower = platform.toLowerCase();
  if (lower.includes('naver') || lower.includes('네이버')) return naverLogo;
  if (lower.includes('youtube') || lower.includes('유튜브')) return youtubeLogo;
  return naverLogo;
}

/**
 * 대체재료 테이블을 로드한다
 */
async function loadSubstituteTable(): Promise<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }> {
  try {
    // 12MB 짜리다. 여러 화면이 동시에 부르면 그만큼 두 번 받는다.
    const csv = await fetchCsvOnce(CSV_SUBSTITUTE_URL);
    
    const lines = csv.split('\n').filter(line => line.trim()); // 빈 행 제거
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const aIdx = header.indexOf('ingredient_a');
    const bIdx = header.indexOf('ingredient_b');
    const scoreIdx = header.indexOf('similarity_score');
    
    if (aIdx === -1 || bIdx === -1) return {};
    
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
    
    return table;
  } catch (error) {
    console.warn('[MyPage] 대체재료 테이블 로드 실패:', error);
    return {};
  }
}

// =====================
// 컴포넌트
// =====================

/**
 * 액션 버튼 컴포넌트
 */
const ActionButton: React.FC<{
  title: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}> = ({ title, icon, onClick, active = true }) => (
  <span style={{ position: 'relative', zIndex: 2 }}>
    <span style={{ 
      position: 'absolute', 
      left: 0, 
      top: 0, 
      width: 26, 
      height: 26, 
      borderRadius: '50%', 
      background: 'rgba(34,34,34,0.7)', 
      zIndex: 1 
    }}></span>
    <button
      title={title}
      tabIndex={0}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        zIndex: 2,
      }}
      onClick={onClick}
    >
      <img 
        src={icon} 
        alt={title} 
        width={19} 
        height={19} 
        style={{ 
          display: 'block', 
          position: 'relative', 
          zIndex: 2, 
          opacity: active ? 1 : 0.5 
        }} 
      />
    </button>
  </span>
);

// =====================
// 메인 컴포넌트
// =====================

const MyPage: React.FC = () => {
  // =====================
  // 상태 관리
  // =====================
  
  const { isLoggedIn, user: authUser, logout, updateUser } = useAuth();
  
  // 소셜 로그인 여부 확인
  const isSocialLogin = Boolean(authUser?.provider && ['google', 'kakao', 'naver'].includes(authUser.provider));

  // DB에서 레시피 로드
  const loadRecipesFromDB = async () => {
    const localRecorded = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDED) || '[]');
    const localCompleted = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED) || '[]');
    const localFavorite = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITE) || '[]');

    if (!isLoggedIn || !authUser?.id) {
      setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
      return;
    }

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) {
      setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
      return;
    }

    const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';

    try {
      // 즐겨찾는 레시피
      const favoriteResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/favorite-recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (favoriteResponse.ok) {
        const favoriteData = await favoriteResponse.json();
        const fromDb = favoriteData.recipes || [];
        const merged = mergeRecipeListsFromDbAndLocal(fromDb, localFavorite);
        setFavoriteRecipes(merged);
        localStorage.setItem(STORAGE_KEY_FAVORITE, JSON.stringify(merged));
      } else {
        setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      }

      // 기록한 레시피
      const recordedResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/recorded-recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (recordedResponse.ok) {
        const recordedData = await recordedResponse.json();
        const fromDb = recordedData.recipes || [];
        const merged = mergeRecipeListsFromDbAndLocal(fromDb, localRecorded);
        setRecordedRecipes(merged);
        localStorage.setItem(STORAGE_KEY_RECORDED, JSON.stringify(merged));
      } else {
        setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      }

      // 완료한 레시피
      const completedResponse = await fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        const fromDb = completedData.recipes || [];
        const merged = mergeRecipeListsFromDbAndLocal(fromDb, localCompleted);
        setCompletedRecipes(merged);
        localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(merged));
      } else {
        setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
      }
    } catch (error) {
      console.error('[MyPage] DB에서 레시피 로드 실패:', error);
      setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
    }
  };

  // 가족 그룹에 속해 있으면, "내가 즐겨찾는/기록한/완료한" 영역에 그룹원
  // 전체(+나)의 항목을 합쳐서 보여준다. 그룹이 없으면 목록을 비우고
  // isInHousehold를 꺼서, 아래 렌더링에서 자동으로 개인 목록(favoriteRecipes 등)을
  // 쓰게 한다.
  const loadHouseholdRecipeFeeds = async () => {
    if (!isLoggedIn || !authUser?.id) {
      setIsInHousehold(false);
      setHouseholdFavoriteRecipes([]);
      setHouseholdRecordedRecipes([]);
      setHouseholdCompletedRecipes([]);
      return;
    }
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const meRes = await fetch(`${apiUrl}/api/households/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = meRes.ok ? await meRes.json() : null;
      const inHousehold = !!me?.in_household;
      setIsInHousehold(inHousehold);
      if (!inHousehold) {
        setHouseholdFavoriteRecipes([]);
        setHouseholdRecordedRecipes([]);
        setHouseholdCompletedRecipes([]);
        return;
      }

      const [favRes, recRes, doneRes] = await Promise.all([
        fetch(`${apiUrl}/api/households/me/favorite-recipes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/households/me/recorded-recipes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/households/me/completed-recipes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setHouseholdFavoriteRecipes(favRes.ok ? (await favRes.json()).recipes || [] : []);
      setHouseholdRecordedRecipes(recRes.ok ? (await recRes.json()).recipes || [] : []);
      setHouseholdCompletedRecipes(doneRes.ok ? (await doneRes.json()).recipes || [] : []);
    } catch (error) {
      console.warn('[MyPage] 그룹 레시피 목록 조회 실패:', error);
    }
  };

  // 당겨서 새로고침용 — 다른 그룹원이 방금 즐겨찾기·완료·기록했을 수 있으니
  // 그룹 활동 피드와(내 로컬 목록도 혹시 다른 기기에서 바뀌었을 수 있어 함께)
  // 둘 다 다시 불러온다.
  const refreshMyPage = async () => {
    await Promise.all([loadRecipesFromDB(), loadHouseholdRecipeFeeds()]);
  };

  // 레시피 카드에 붙일 배지 — 이 항목을 한 사람의 닉네임.
  // 전에는 "OO님도 즐겨찾기함"처럼 문장으로 붙였는데, 세 영역(즐겨찾기/기록/
  // 완료)마다 반복되면 카드가 문장으로 뒤덮여 오히려 안 읽혔다. 이 카드가 어느
  // 영역에 있는지는 섹션 제목이 이미 말해주므로, 배지는 누가 했는지(닉네임)만
  // 짧게 보여주면 충분하다. 나만 한 경우엔 굳이 내 이름을 또 띄울 필요가
  // 없어서 생략한다.
  const buildAttributionLabel = (_action: 'favorite' | 'completed' | 'recorded') => (recipe: any) => {
    const names: string[] = recipe?.acted_by || [];
    const others = Array.from(new Set(names.filter((n) => n && n !== authUser?.nickname)));
    if (!others.length) return undefined;
    return others.join('·');
  };

  // DB 추가/삭제 — 실제 호출은 `utils/recipeStorage.ts`의
  // addRecipeActionToDB/removeRecipeActionFromDB **한 곳**에서만 한다.
  // 예전엔 이 페이지가 직접 fetch 를 구현했는데, 완료/기록 목록의 전체보기
  // 화면(CompletedRecipeListPage 등)은 이 구현을 안 베껴서 로컬만 지우고
  // DB는 그대로 남는 사고가 났다(2026-09-13). 같은 함수를 셋이 같이 쓰면
  // 이제 그런 식으로 갈라질 수 없다.
  const addRecipeToDB = async (type: 'write' | 'done' | 'favorite', recipeId: number) => {
    if (!isLoggedIn || !authUser?.id) return;
    await addRecipeActionToDB(type, Number(authUser.id), recipeId);
  };

  const removeRecipeFromDB = async (type: 'write' | 'done' | 'favorite', recipeId: number) => {
    if (!isLoggedIn || !authUser?.id) return;
    await removeRecipeActionFromDB(type, Number(authUser.id), recipeId);
  };
  
  // 디버깅용 (개발 환경에서만)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MyPage] 소셜 로그인 여부:', {
        isSocialLogin,
        provider: authUser?.provider,
        authUser
      });
    }
  }, [isSocialLogin, authUser]);

  // 다른 탭(내냉장고/냉장고요리/요즘인기)에 있다가 하단 네비로 넘어오면,
  // 브라우저가 이 경로의 예전 스크롤 위치(맨 아래 등)를 되살릴 때가 있어 매번 최상단으로 고정한다.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [editOpen, setEditOpen] = useState(false);
  /**
   * '내 정보 수정' 모달의 높이 상한을 **CSS 단위가 아니라 JS 로 잰 값**으로 둔다.
   *
   * `dvh`(그리고 대비값 `vh`)로 뒀었는데, 아이폰 크롬에서 "더 필요해요" 를 눌러
   * 크레딧 카드 안 내용이 늘어나면 모달 아래쪽이 화면 밖으로 잘려 보였다
   * (실사용 보고). 모달의 바깥 껍데기는 `position: fixed; inset: 0` 이라
   * **실제 보이는 화면**을 정확히 따르는데, `dvh` 값이 iOS WebKit 에서 그
   * 크기와 항상 같이 움직이지는 않아 max-height 계산이 어긋난 것으로 보인다.
   * `window.innerHeight` 는 리사이즈/방향전환 이벤트로 실제 보이는 높이를
   * 직접 재므로 더 믿을 수 있다.
   */
  const [viewportH, setViewportH] = useState<number>(
    () => (typeof window !== 'undefined' ? window.innerHeight : 800)
  );
  useEffect(() => {
    if (!editOpen) return;
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [editOpen]);
  const [user, setUser] = useState<User>(() => {
    // 로그인한 사용자가 있으면 실제 정보 사용, 없으면 더미 데이터
    if (authUser) {
      return {
        nickname: authUser.nickname,
        email: authUser.email,
        phone: authUser.phone || '',
      };
    }
    return dummyUser;
  });
  const [edit, setEdit] = useState<EditForm>({
    nickname: user.nickname,
    userid: user.email, // userid 필드에 email 값 저장 (표시용)
    password: '',
    password2: '',
    phone1: '010',
    phone2: '',
    phone3: '',
    zipcode: '',
    address1: '',
    address2: '',
  });
  // 원본 데이터 저장 (변경 사항 추적용)
  const [originalEdit, setOriginalEdit] = useState<EditForm>(edit);
  const [error, setError] = useState<ErrorState>({ password: '', phone: '' });
  const [toast, setToast] = useState('');
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  // 초기 상태는 빈 배열로 시작 (사용자별로 useEffect에서 로드)
  const [favoriteRecipes, setFavoriteRecipes] = useState<any[]>([]);
  /** 「최근 본」 목록 시트(2026-11-05) */
  // 최근 본 개수(배지용) — 다른 칸(즐겨찾기·기록·완료)과 같게 숫자를 단다. 이 기기에만 저장된 값이다.
  const [recentCount, setRecentCount] = useState(() => getRecentRecipes().length);
  useEffect(() => {
    const load = () => setRecentCount(getRecentRecipes().length);
    load();
    window.addEventListener(RECENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(RECENT_CHANGED_EVENT, load);
  }, []);

  // 이번 달 요리 요약(2026-11-06) — 「내 요리 프로필」 카드. 마이캘린더 목표 카드와 같은 재료로 센다:
  // 목표 = 그룹이면 그룹 목표(없으면 20), 혼자면 내 목표 · 절약액 = 횟수 × 1인 한 끼 × 식구 수.
  const [monthSummary, setMonthSummary] = useState<{
    total: number; goal: number; savings: number; perMeal: number; familySize: number;
  } | null>(null);
  useEffect(() => {
    if (!isLoggedIn || !authUser?.id) { setMonthSummary(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const start = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const params = new URLSearchParams({ start, end });
        const [res, doneRes] = await Promise.all([
          fetch(`${apiUrl}/api/households/me/completed-calendar?${params.toString()}`, auth),
          // 내 완료 전체(레시피 id) — 기기 사본을 합칠 때 서버가 이미 아는 것을 거른다(캘린더와 같은 방식).
          fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes`, auth).catch(() => null),
        ]);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        let serverDoneIds: Set<number> | undefined;
        if (doneRes && doneRes.ok) {
          const d = await doneRes.json().catch(() => null);
          if (d && Array.isArray(d.recipes)) serverDoneIds = new Set(d.recipes.map((r: any) => Number(r.id)));
        }
        const entries = mergeLocalDone(data.entries || [], Number(authUser.id), authUser.nickname || '', serverDoneIds)
          .filter(e => e.day >= start && e.day <= end);
        const goal = typeof data.group_goal === 'number' ? data.group_goal
          : typeof data.my_personal_goal === 'number' ? data.my_personal_goal : 20;
        const familySize = typeof data.family_size === 'number' ? data.family_size : 1;
        const perMeal = typeof data.savings_per_meal === 'number' ? data.savings_per_meal : ESTIMATED_SAVINGS_PER_MEAL_DEFAULT;
        if (!cancelled) setMonthSummary({ total: entries.length, goal, savings: entries.length * perMeal * familySize, perMeal, familySize });
      } catch (e) {
        console.warn('[MyPage] 이번 달 요약 조회 실패:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, authUser?.id]);
  const [recordedRecipes, setRecordedRecipes] = useState<any[]>([]);
  const [completedRecipes, setCompletedRecipes] = useState<any[]>([]);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);

  // 해제 확인창이 뜨면 직전 토스트(「추가했습니다」)는 닫는다 — 같은 자리에 두 개가 겹쳐 떠 있었다(2026-10-14).
  React.useEffect(() => { if (pendingRemove) { setToast(''); } }, [pendingRemove]);
  // 토스트는 **마지막 것 기준으로** 정해진 시간 뒤에 사라진다. 예전엔 토스트마다 타이머를
  // 따로 걸고 지우지 않아서, 앞 타이머가 새 토스트를 일찍 지우거나(목록 화면) 아예
  // 안 사라졌다(요즘인기).
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(''); }, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [toast]);
  const [pendingRecipe, setPendingRecipe] = useState<any>(null);
  const [myIngredients, setMyIngredients] = React.useState<string[]>(getMyIngredientsSafe());
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameCheckResult, setNicknameCheckResult] = useState<{ available: boolean; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // 가족 그룹에 속해 있으면, "내가 즐겨찾는/기록한/완료한" 영역을 그룹원
  // 전체(+나) 걸 합친 목록으로 보여준다. 각 레시피에 누가 했는지(acted_by)가
  // 같이 오므로 카드에 "OO님도 즐겨찾기함" 배지를 붙일 수 있다.
  // 즐겨찾기 등 자체는 계정별 개인 기록 그대로이고(합쳐지지 않음), 여기 쓰이는
  // favoriteRecipes 등(내 것만 있는 배열)은 그대로 두고 액션 상태(내가 눌렀는지)
  // 판단에 계속 쓴다 — 이 목록만 화면 표시용으로 별도로 둔다.
  const [isInHousehold, setIsInHousehold] = useState(false);
  // 그룹에 속해 있을 때 "우리 식구 모두 보기" / "나의 것만 보기" 중 어느 쪽으로
  // 즐겨찾기·기록·완료 세 영역을 볼지. 기본은 **나의 것만** — 마이페이지는 내
  // 기록을 보러 오는 곳이라 식구 것이 섞여 먼저 보이면 헷갈린다(2026-09-15 요청).
  const [householdViewMode, setHouseholdViewMode] = useState<'all' | 'mine'>('mine');
  const [householdFavoriteRecipes, setHouseholdFavoriteRecipes] = useState<any[]>([]);
  const [householdRecordedRecipes, setHouseholdRecordedRecipes] = useState<any[]>([]);
  const [householdCompletedRecipes, setHouseholdCompletedRecipes] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  /** 관리자에게만 어드민 입구를 보여준다 (실제 권한 검사는 서버가 한다) */
  const isAdmin = useIsAdmin();
  /** 크레딧 묶음 제목을 그릴지 판단하는 용도 — 값 자체는 `UsageGauge` 가 쓴다. */
  const usageNow = useUsage();
  // ── 사용 가이드 16~18단계(마지막) ─────────────────────────────
  // 요리 캘린더 가이드 끝에서 `?fromGuide=true` 로 넘어온다. 셋 다 로그인해야
  // 있는 칸이라 로그인 상태에서만 시작한다.
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const guideStartedRef = React.useRef(false);
  const myPageGuideSteps = [
    {
      targetSelector: '[data-guide-target="usage-card"]',
      message: 'AI 기능을 더 쓰고 싶다면\n「더 필요해요」를 눌러\n사용 한도를 늘릴 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="household-section"]',
      message: '가족을 초대해 그룹을 만들면\n요리 목표와 완료·기록을\n함께 나누고 관리할 수 있어요.',
      position: 'bottom' as const,
    },
    {
      targetSelector: '[data-guide-target="notification-settings"]',
      message: '알림을 켜 두면\n유통기한이 다가온 재료를\n미리 알려 드려요.',
      position: 'bottom' as const,
    },
  ];

  useEffect(() => {
    if (!isLoggedIn || guideStartedRef.current) return;
    if (new URLSearchParams(location.search).get('fromGuide') !== 'true') return;
    guideStartedRef.current = true;
    window.history.replaceState({}, '', '/my-page');
    // 요리 캘린더와 같은 이유로 타이머를 정리에서 취소하지 않는다(ref 로 한 번만 시작).
    setTimeout(() => { setGuideStep(0); setShowGuide(true); }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const finishMyPageGuide = () => {
    setShowGuide(false);
    markUsageGuideFinished();
  };

  // GNB에서 닉네임을 눌러 /my-page?openEdit=true 로 들어온 경우 자동으로 수정 모달 열기
  useEffect(() => {
    if (new URLSearchParams(location.search).get('openEdit') === 'true') {
      setEditOpen(true);
      navigate('/my-page', { replace: true });
    }
  }, [location.search, navigate]);

  // 로그인한 사용자 정보가 변경되면 user 상태 업데이트 및 레시피 로드
  useEffect(() => {
    if (authUser) {
      setUser({
        nickname: authUser.nickname,
        email: authUser.email,
        phone: authUser.phone || '',
      });
      const newEdit = {
        nickname: authUser.nickname,
        userid: authUser.email,
        password: '',
        password2: '',
        phone1: '010',
        phone2: '',
        phone3: '',
        zipcode: '',
        address1: '',
        address2: '',
      };
      setEdit(newEdit);
      setOriginalEdit(newEdit); // 원본 데이터도 업데이트
      
      // 사용자가 변경되면 레시피 상태를 먼저 초기화 (이전 사용자 데이터 제거)
      setFavoriteRecipes([]);
      setRecordedRecipes([]);
      setCompletedRecipes([]);
      
      // DB에서 레시피 로드
      loadRecipesFromDB();
      loadHouseholdRecipeFeeds();
    } else {
      // 로그아웃 시 레시피 상태 초기화 및 localStorage에서 로드
      setFavoriteRecipes([]);
      setRecordedRecipes([]);
      setCompletedRecipes([]);
      setIsInHousehold(false);
      setHouseholdFavoriteRecipes([]);
      setHouseholdRecordedRecipes([]);
      setHouseholdCompletedRecipes([]);
      const localFavorite = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITE) || '[]');
      const localRecorded = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDED) || '[]');
      const localCompleted = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED) || '[]');
      setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
    }
  }, [authUser?.id]); // authUser.id가 변경될 때만 실행 (사용자 변경 감지)

  // 다른 그룹원의 공유 요청 팝업(ShareRequestPopup, 앱 전역에 하나만 마운트)이
  // 지금 이 화면 위에서 수락되면, 이 화면의 그룹 활동 피드도 즉시 새로
  // 불러온다. HouseholdSection도 같은 이벤트를 들어서 자기 멤버 목록을
  // 새로고침한다 — 서로 다른 컴포넌트라 prop으로 알려줄 방법이 없어 이벤트로
  // 연결했다.
  // loadHouseholdRecipeFeeds는 useCallback으로 감싸지 않은 일반 함수라 매
  // 렌더마다 새로 만들어진다 — 의존성 배열을 []로 두면 "마운트 시점의"
  // isLoggedIn/authUser를 가둔 첫 렌더의 함수가 계속 쓰이는 stale closure
  // 버그가 생긴다(실제로 겪음: 인증이 아직 안 잡힌 첫 렌더의 함수가 붙잡혀서,
  // 나중에 이벤트가 와도 매번 "로그인 안 됨" 분기로 빠져 isInHousehold를
  // false로 초기화해 버렸다). 실제 의존값(isLoggedIn, authUser?.id)을 넣어
  // 그 값이 바뀔 때마다 최신 함수로 다시 구독한다.
  useEffect(() => {
    const handleShareUpdated = () => loadHouseholdRecipeFeeds();
    window.addEventListener('household-share-updated', handleShareUpdated);
    return () => window.removeEventListener('household-share-updated', handleShareUpdated);
  }, [isLoggedIn, authUser?.id]);

  // 조리 시트(CookModeSheet)에서 즐겨찾기·완료·기록을 켜거나 끄면 바로 반영한다.
  // 그룹 소속이면 이 화면은 **서버에서 받은 그룹 목록**(household*Recipes)을
  // 그리는데, 아래 localStorageChange 는 개인 목록만 다시 읽어서 시트에서
  // 해제해도 나갔다 들어와야 빠졌다(실사용 지적, 2026-09-15). 시트는 서버
  // 반영이 끝난 뒤 이 이벤트를 보내므로 여기서 다시 받으면 최신 값이다.
  // (의존성은 위 공유 요청 효과와 같은 이유로 isLoggedIn/authUser?.id)
  useEffect(() => {
    const handleSynced = () => {
      loadRecipesFromDB();
      loadHouseholdRecipeFeeds();
    };
    window.addEventListener('recipe-action-synced', handleSynced);
    return () => window.removeEventListener('recipe-action-synced', handleSynced);
  }, [isLoggedIn, authUser?.id]);

  const reloadLocalRecipeLists = () => {
    setFavoriteRecipes(sortRecipesByUserSavedAtDesc(getRecipesFromLocalStorage('favorite')));
    setRecordedRecipes(sortRecipesByUserSavedAtDesc(getRecipesFromLocalStorage('write')));
    setCompletedRecipes(sortRecipesByUserSavedAtDesc(getRecipesFromLocalStorage('done')));
  };

  useEffect(() => {
    const handleRecipeStorageChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (
        key === STORAGE_KEY_RECORDED ||
        key === STORAGE_KEY_COMPLETED ||
        key === STORAGE_KEY_FAVORITE
      ) {
        reloadLocalRecipeLists();
      }
    };

    window.addEventListener('localStorageChange', handleRecipeStorageChange);
    return () => window.removeEventListener('localStorageChange', handleRecipeStorageChange);
  }, [authUser?.id]);

  const recipeActionStates = useMemo(() => {
    // 그룹 목록에서 온 레시피(내가 아직 안 눌러본 것 포함)도 액션 상태 맵에
    // 포함시켜야, 카드 위 즐겨찾기/완료/기록 버튼을 눌렀을 때 정상 반영된다.
    // 실제 참/거짓 값은 buildRecipeActionStatesForRecipes 내부에서 항상 내
    // localStorage 기준으로만 계산되므로, 남이 한 행동이 내 상태로 잘못
    // 표시될 위험은 없다.
    const allRecipes = [
      ...favoriteRecipes,
      ...recordedRecipes,
      ...completedRecipes,
      ...householdFavoriteRecipes,
      ...householdRecordedRecipes,
      ...householdCompletedRecipes,
    ];
    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(recipe => [normalizeRecipeId(recipe.id), recipe])).values()
    );
    return buildRecipeActionStatesForRecipes(uniqueRecipes);
  }, [
    favoriteRecipes,
    recordedRecipes,
    completedRecipes,
    householdFavoriteRecipes,
    householdRecordedRecipes,
    householdCompletedRecipes,
  ]);

  // 그룹에 속해 있으면 기본으로 그룹 전체(+나) 목록을 보여주되, "나의 것만
  // 보기"로 바꾸면 원래의 개인 목록으로 되돌아간다.
  const showAllHousehold = isInHousehold && householdViewMode === 'all';
  /**
   * `우리 식구 모두` 에서 **내 것을 빼고** 볼지.
   *
   * "모두" 는 나 + 식구다. 그래서 식구가 아무것도 안 했으면 `모두` 와
   * `나의 것만` 이 같은 목록이 되는데, 그걸 화면에서는 알 수가 없다.
   * 이걸 켜면 남는 게 진짜 식구 몫이다 — 0 이면 0 이라고 보인다.
   * (기록은 레시피 한 장에 여러 사람이 묶여 오므로 `acted_by` 로 가른다)
   */
  const [hideMine, setHideMine] = useState(false);
  const myNick = authUser?.nickname || '';
  const dropMine = (list: any[]) =>
    list.filter(r => {
      const by: string[] = Array.isArray(r?.acted_by) ? r.acted_by : [];
      return by.some(n => n && n !== myNick);
    });
  const useHide = showAllHousehold && hideMine;
  const displayFavoriteRecipes = showAllHousehold
    ? (useHide ? dropMine(householdFavoriteRecipes) : householdFavoriteRecipes) : favoriteRecipes;
  const displayRecordedRecipes = showAllHousehold
    ? (useHide ? dropMine(householdRecordedRecipes) : householdRecordedRecipes) : recordedRecipes;
  const displayCompletedRecipes = showAllHousehold
    ? (useHide ? dropMine(householdCompletedRecipes) : householdCompletedRecipes) : completedRecipes;
  /** 식구들이 한 게 몇 건인가. 0 이면 이 버튼을 눌러도 빈 화면이 된다. */
  const othersTotal = React.useMemo(
    () => dropMine(householdFavoriteRecipes).length
        + dropMine(householdRecordedRecipes).length
        + dropMine(householdCompletedRecipes).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [householdFavoriteRecipes, householdRecordedRecipes, householdCompletedRecipes, myNick],
  );
  
  // 모달이 열릴 때 원본 데이터 저장 및 edit 상태 초기화
  useEffect(() => {
    if (editOpen && authUser) {
      // 모달이 열릴 때 사용자 정보로 edit 상태 초기화 (authUser 사용 - 최신 정보)
      const initialEdit = {
        nickname: authUser.nickname,
        userid: authUser.email,
        password: '',
        password2: '',
        phone1: '010',
        phone2: '',
        phone3: '',
        zipcode: '',
        address1: '',
        address2: '',
      };
      setEdit(initialEdit);
      // 원본 데이터로 저장 (변경 사항 추적용)
      setOriginalEdit(initialEdit);
      setNicknameCheckResult(null); // 닉네임 체크 결과 초기화
      setError({ password: '', phone: '' }); // 에러 상태 초기화
    }
  }, [editOpen, authUser]);
  
  // 변경 사항이 있는지 확인
  const hasChanges = () => {
    // 닉네임 변경 확인
    if (edit.nickname !== originalEdit.nickname) {
      return true;
    }
    
    // 비밀번호 변경 확인 (일반 로그인 사용자만)
    if (!isSocialLogin) {
      // 비밀번호가 실제로 입력되었는지 확인 (●●●●●●●는 변경 없음)
      const passwordChanged = edit.password !== '' && 
                              edit.password !== '●●●●●●●' && 
                              edit.password !== originalEdit.password;
      if (passwordChanged) {
        return true;
      }
    }
    
    return false;
  };

  // =====================
  // 이벤트 핸들러
  // =====================

  /**
   * 토스트 메시지를 표시한다
   */
  const showToast = (message: string) => {
    setToast(message);
  };

  /**
   * 닉네임 중복 체크
   */
  const handleCheckNickname = async () => {
    if (!edit.nickname || edit.nickname.trim() === '') {
      setNicknameCheckResult({ available: false, message: '닉네임을 입력해주세요.' });
      return;
    }

    // 현재 닉네임과 동일하면 체크하지 않음
    if (edit.nickname === user.nickname) {
      setNicknameCheckResult({ available: true, message: '현재 사용 중인 닉네임입니다.' });
      return;
    }

    setCheckingNickname(true);
    setNicknameCheckResult(null);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/check-nickname`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname: edit.nickname }),
      });

      const data = await response.json();
      setNicknameCheckResult(data);
    } catch (err) {
      console.error('Check nickname error:', err);
      setNicknameCheckResult({ available: false, message: '닉네임 확인 중 오류가 발생했습니다.' });
    } finally {
      setCheckingNickname(false);
    }
  };

  /**
   * 정보 수정 모달 취소
   */
  const handleCancel = () => {
    // 원본 데이터로 복원
    setEdit({ ...originalEdit });
    setNicknameCheckResult(null);
    setError({ password: '', phone: '' });
    setEditOpen(false);
  };

  /**
   * 정보 수정 모달 저장
   */
  const handleSave = async () => {
    let valid = true;
    const newError: ErrorState = { password: '', phone: '' };
    
    // 비밀번호가 입력된 경우에만 검증
    if (edit.password && edit.password !== '●●●●●●●' && edit.password.length < 4) {
      newError.password = '비밀번호는 최소 4자 이상이어야 합니다.';
      valid = false;
    }
    
    // 닉네임이 변경된 경우 중복 체크 확인
    if (edit.nickname !== user.nickname) {
      if (!nicknameCheckResult || !nicknameCheckResult.available) {
        showToast('닉네임 중복 체크를 완료해주세요.');
        valid = false;
      }
    }
    
    setError(newError);
    if (!valid) return;
    
    // 백엔드에 프로필 업데이트 요청
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) {
        showToast('로그인이 필요합니다.');
        return;
      }

      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const requestBody: any = {
        nickname: edit.nickname,
      };
      
      // 비밀번호가 입력된 경우에만 포함 (일반 로그인 사용자만)
      if (!isSocialLogin && edit.password && edit.password !== '●●●●●●●') {
        requestBody.password = edit.password;
      }

      const response = await fetch(`${apiUrl}/api/auth/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // 401 은 "닉네임이 잘못됐다" 가 아니라 **로그인 세션이 끝났다** 는 뜻이다.
        // 예전에는 백엔드 문구("유효하지 않은 토큰입니다")를 그대로 띄워서,
        // 사용자는 소셜 로그인이라 닉네임을 못 바꾸는 줄로 오해하게 됐다.
        if (response.status === 401) {
          showToast('로그인이 만료되었어요. 다시 로그인해 주세요.');
          setEditOpen(false);
          logout();
          navigate('/login');
          return;
        }
        showToast(data.error || '프로필 업데이트에 실패했습니다.');
        return;
      }

      // 성공 시 AuthContext의 사용자 정보 업데이트
      if (data.user) {
        updateUser({
          nickname: data.user.nickname,
        });
      }

      // 로컬 user 상태도 업데이트
      setUser({ ...user, nickname: edit.nickname });
      
      // 저장 후 originalEdit 업데이트 (다음 모달 열 때 변경 사항 추적을 위해)
      setOriginalEdit({ ...edit });
      
      showToast('프로필이 업데이트되었습니다.');
      
      // 모달 닫기
      setEditOpen(false);
    } catch (error) {
      console.error('Update profile error:', error);
      showToast('프로필 업데이트 중 오류가 발생했습니다.');
    }
  };

  /**
   * 회원탈퇴 처리
   */
  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) {
        showToast('로그인이 필요합니다.');
        setDeletingAccount(false);
        setShowDeleteConfirm(false);
        return;
      }

      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || '회원탈퇴에 실패했습니다.');
        setDeletingAccount(false);
        setShowDeleteConfirm(false);
        return;
      }

      // 로그아웃 처리
      logout();
      
      // 모달 닫기
      setEditOpen(false);
      setShowDeleteConfirm(false);
      
      // 홈으로 이동
      navigate('/');
      showToast('회원탈퇴가 완료되었습니다.');
    } catch (err) {
      console.error('Delete account error:', err);
      showToast('회원탈퇴 중 오류가 발생했습니다.');
      setShowDeleteConfirm(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  /**
   * 즐겨찾기 버튼 클릭 처리
   */
  const handleFavoriteClick = (id: number) => {
    const isAlreadyFavorite = getRecipesFromLocalStorage('favorite').some(r => r.id === id);

    if (isAlreadyFavorite) {
      setPendingRemove({ type: 'favorite', id });
      setPendingRecipe(favoriteRecipes.find(r => r.id === id));
      return;
    }

    const recipe =
      favoriteRecipes.find(r => r.id === id) ||
      recordedRecipes.find(r => r.id === id) ||
      completedRecipes.find(r => r.id === id);

    if (recipe) {
      if (!guardGuestSave('favorite', id)) return;   // 비회원 3개 한도(4번째부터 로그인 확인창)
      const savedRecipe = withUserSavedAt(recipe);
      addRecipeToLocalStorage('favorite', savedRecipe);
      addRecipeToDB('favorite', id);
      const updatedFavorite = sortRecipesByUserSavedAtDesc([savedRecipe, ...favoriteRecipes]);
      setFavoriteRecipes(updatedFavorite);
      showToast('레시피를 즐겨찾기에 추가했습니다!');
    }
  };

  /**
   * 완료 버튼 클릭 처리
   */
  const handleDoneClick = (id: number) => {
    const isAlreadyDone = getRecipesFromLocalStorage('done').some(r => r.id === id);
    
    if (isAlreadyDone) {
      setPendingRemove({ type: 'done', id });
      setPendingRecipe(completedRecipes.find(r => r.id === id));
      return;
    }
    
    const isActive = getRecipeActionState(id).done;
    
    if (!isActive) {
      // 완료 추가 전에 5개 조건 체크
      const recipe = recordedRecipes.find(r => r.id === id) || completedRecipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('done').some(r => r.id === id)) {
        // 비회원은 완료 3개까지(4번째부터 로그인 확인창)
        if (!guardGuestSave('done', id)) return;
        
        // 조건 통과 시 레시피 저장
        const savedRecipe = withUserSavedAt(recipe);
        addRecipeToLocalStorage('done', savedRecipe);
        addRecipeToDB('done', id);
        const updatedCompleted = sortRecipesByUserSavedAtDesc([savedRecipe, ...completedRecipes]);
        setCompletedRecipes(updatedCompleted);
        showToast('레시피를 완료했습니다!');
      }
    } else {
      setPendingRemove({ type: 'done', id });
      setPendingRecipe(completedRecipes.find(r => r.id === id));
    }
  };

  /**
   * 기록 버튼 클릭 처리
   */
  const handleWriteClick = (id: number) => {
    const isAlreadyWritten = getRecipesFromLocalStorage('write').some(r => r.id === id);
    
    if (isAlreadyWritten) {
      setPendingRemove({ type: 'write', id });
      setPendingRecipe(recordedRecipes.find(r => r.id === id));
      return;
    }
    
    const isActive = getRecipeActionState(id).write;
    
    if (!isActive) {
      // 기록 추가 전에 5개 조건 체크
      const recipe = completedRecipes.find(r => r.id === id) || recordedRecipes.find(r => r.id === id);
      if (recipe && !getRecipesFromLocalStorage('write').some(r => r.id === id)) {
        // 비회원은 기록 3개까지(4번째부터 로그인 확인창)
        if (!guardGuestSave('write', id)) return;
        
        // 조건 통과 시 레시피 저장
        const savedRecipe = withUserSavedAt(recipe);
        addRecipeToLocalStorage('write', savedRecipe);
        addRecipeToDB('write', id);
        const updatedRecorded = sortRecipesByUserSavedAtDesc([savedRecipe, ...recordedRecipes]);
        setRecordedRecipes(updatedRecorded);
        showToast('레시피를 기록했습니다!');
      }
    } else {
      setPendingRemove({ type: 'write', id });
      setPendingRecipe(recordedRecipes.find(r => r.id === id));
    }
  };

  /**
   * 삭제 확인 처리
   */
  const handleRemoveConfirm = () => {
    if (!pendingRemove) return;
    
    if (pendingRemove.type === 'done') {
      removeRecipeFromLocalStorage('done', pendingRemove.id);
      removeRecipeFromDB('done', pendingRemove.id);
      const updated = completedRecipes.filter((r: any) => String(r.id) !== String(pendingRemove.id));
      setCompletedRecipes(updated);
    } else if (pendingRemove.type === 'write') {
      removeRecipeFromLocalStorage('write', pendingRemove.id);
      removeRecipeFromDB('write', pendingRemove.id);
      const updated = recordedRecipes.filter((r: any) => String(r.id) !== String(pendingRemove.id));
      setRecordedRecipes(updated);
    } else if (pendingRemove.type === 'favorite') {
      removeRecipeFromLocalStorage('favorite', pendingRemove.id);
      removeRecipeFromDB('favorite', pendingRemove.id);
      const updated = favoriteRecipes.filter((r: any) => String(r.id) !== String(pendingRemove.id));
      setFavoriteRecipes(updated);
    }
    
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  /**
   * 삭제 취소 처리
   */
  const handleRemoveUndo = () => {
    setPendingRemove(null);
    setPendingRecipe(null);
  };

  /**
   * 공유 버튼 클릭 처리
   */
  const handleShareClick = (recipe: any) => {
    try {
      copyRecipeUrlToClipboard(recipe);
      showToast('레시피 URL이 복사되었습니다!');
    } catch {
      showToast('URL 복사에 실패했습니다.');
    }
  };

  /**
   * 레시피 액션 처리
   */
  const handleRecipeAction = (recipe: any, action: string) => {
    switch (action) {
      case 'favorite':
        handleFavoriteClick(recipe.id);
        break;
      case 'done':
        handleDoneClick(recipe.id);
        break;
      case 'share':
        handleShareClick(recipe);
        break;
      case 'write':
        handleWriteClick(recipe.id);
        break;
    }
  };

  // =====================
  // 사이드 이펙트
  // =====================

  // 대체재료 테이블 로드
  useEffect(() => {
    loadSubstituteTable().then(setSubstituteTable);
  }, []);

  // 내 냉장고 재료 업데이트 (페이지 포커스, visibility 변경, 경로 변경 시)
  useEffect(() => {
    const updateMyIngredients = () => {
      setMyIngredients(getMyIngredientsSafe());
    };

    // 초기 로드 및 경로 변경 시 업데이트
    updateMyIngredients();

    // 페이지 포커스 시 업데이트
    const handleFocus = () => {
      updateMyIngredients();
    };
    window.addEventListener('focus', handleFocus);

    // 페이지 visibility 변경 시 업데이트 (탭 전환 시)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateMyIngredients();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]); // 경로 변경 시에도 업데이트

  // =====================
  // 렌더링
  // =====================

  return (
    <div className="min-h-screen max-w-[400px] mx-auto relative" style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: 'var(--surface-sub)' }}>
      {/* 상단 GNB 는 AppRouter 의 TopNavBar 하나만 쓴다.
          예전에는 마이페이지가 똑같은 헤더를 하나 더 그리고 있어 두 개가 겹쳐 있었고,
          복제본은 폭이 400px 로 제한돼 있어 넓은 화면에서 정렬도 달라 보였다. */}
      {/* 다른 그룹원이 즐겨찾기·완료·기록을 방금 했을 수 있는데, 예전엔
          이 화면을 나갔다 다시 들어와야만 반영됐다 — 당겨서 새로고침으로
          그 자리에서 바로 다시 불러올 수 있게 한다. */}
      {/* 세로로 쌓아 남는 높이를 채운다 — 맨 아래 회색 「불편한 점이 있으셨나요」 칸이 화면 끝까지 이어지게(아래 참고) */}
      <PullToRefresh onRefresh={refreshMyPage} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

      {/* 프로필 영역.
          예전에는 위 130px + 아래 70px 을 비우고 가운데에 닉네임·이메일·노란 버튼만
          세로로 쌓아 둬서, 화면을 열면 200px 짜리 빈 구역이 먼저 보였다.
          게다가 이 화면의 목적은 "내가 저장한 레시피 보기" 인데 노란색(브랜드 강조색)이
          '내 정보 수정' 에만 칠해져 있어, 가장 눈에 띄는 것이 가장 덜 중요한 기능이었다.
          → 프로필은 한 줄로 접고, 강조색은 로그인처럼 실제로 유도할 행동에만 남긴다. */}
      {isLoggedIn ? (
        <section
          style={{
            margin: '72px 14px 0',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface)',
            border: '1px solid var(--line-200)',
            borderRadius: 14,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {user.nickname}
            </div>
            <div
              style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {user.email}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            정보 수정
          </Button>
        </section>
      ) : (
        <section
          style={{
            margin: '72px 14px 0',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface)',
            border: '1px solid var(--line-200)',
            borderRadius: 14,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>로그인이 필요합니다</div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.45 }}>
              기록·완료 내역을 안전하게 보관하려면
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
            로그인
          </Button>
        </section>
      )}

      {/* 내 레시피 — 프로필 바로 아래(2026-11-06, 당근마켓 「나의 당근」 참고).
          이 화면에서 제일 자주 쓰는 것은 「내가 모아 둔 레시피로 가는 문」이라 크레딧·그룹
          카드보다 위로 올렸다. 입구 네 칸은 모두 **아이콘 + 글자**로 같은 모양이고, 숫자는
          아이콘 오른쪽 위의 작은 노란 배지다(전에는 숫자 세 칸 + 시계 한 칸이 섞여 있었다).
          토글(나의 것만 / 우리 식구 모두)은 이 카드 제목 줄 오른쪽에 둔다 — 아래 배지 숫자를
          바꾸는 스위치라 숫자 바로 위에 붙어야 「이 기준으로 센 숫자」로 읽힌다. */}
      <section style={{
        margin: '12px 14px 0', background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* 제목 위, 고르개 아래 **두 줄**(2026-11-06 지적: 고르개가 3칸이 되면서 폭이 길어져 오른쪽에 놓으면 「내 레시피」 제목이 줄바꿈됐다).
            고르개는 카드 폭을 3등분해 꽉 채운다 — 손가락으로 누르기도 더 쉽다. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '14px 14px 4px' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', whiteSpace: 'nowrap' }}>
            {/* 고르개 상태에 맞춰 제목을 바꾼다 — 식구 것이 섞이면 「내 레시피」가 아니다(2026-11-07) */}
            {!isInHousehold || householdViewMode === 'mine' ? '내 레시피' : hideMine ? '식구 레시피' : '우리 식구 레시피'}
          </h2>
          {isInHousehold && (
            <SegmentedToggle
              style={{ width: '100%' }}
              // 「내 것은 빼고 보기」 체크박스를 셋째 칸으로(2026-11-06 요청: 마이캘린더에 반영한 「식구 것만」을 여기도).
              // 안에서는 그대로 `householdViewMode` + `hideMine` 두 값이다 — 식구 것만 = 식구 모두 + 내 것 빼기.
              value={householdViewMode === 'mine' ? 'mine' : hideMine ? 'others' : 'all'}
              onChange={(key) => {
                setHouseholdViewMode(key === 'mine' ? 'mine' : 'all');
                setHideMine(key === 'others');
              }}
              options={[
                // 기본값(나의 것만)이 앞에 온다.
                { value: 'mine' as const, label: '나의 것만' },
                { value: 'all' as const, label: '우리 식구 모두' },
                { value: 'others' as const, label: '식구 것만' },
              ]}
            />
          )}
        </div>
        {/* 「최근 본」은 **이 기기에서 연 레시피**라 사람별로 나눌 수 없다 → 식구 것이 섞인 보기(우리 식구 모두·식구 것만)에서는 빼고
            즐겨찾기·기록·완료 세 칸만 둔다(2026-11-07 「식구 쪽에는 최근 본까지 필요한가」). */}
        <nav style={{ display: 'grid', gridTemplateColumns: `repeat(${showAllHousehold ? 3 : 4}, minmax(0, 1fr))`, padding: '10px 6px 14px' }}>
          {[
            // 목록을 보러 가는 입구. 전용 목록 화면은 그대로 두되(여기서 온 것을 그대로 그린다).
            { label: '즐겨찾기', count: displayFavoriteRecipes.length, to: '/mypage/favorite', recipes: displayFavoriteRecipes,
              icon: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /> },
            { label: '기록', count: displayRecordedRecipes.length, to: '/mypage/recorded', recipes: displayRecordedRecipes,
              icon: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></> },
            { label: '완료', count: displayCompletedRecipes.length, to: '/mypage/completed', recipes: displayCompletedRecipes,
              icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></> },
            // 최근 본(2026-11-05) — 이 기기에서 2개월 안에 연 레시피. 다른 칸처럼 화면(`/mypage/recent`)으로 가고 숫자 배지도 단다(2026-11-06 지적).
            { label: '최근 본', count: recentCount, to: '/mypage/recent', recipes: [] as any[],
              icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
          ].filter(it => !(showAllHousehold && it.label === '최근 본')).map(({ label, count, to, recipes, icon }) => (
            <button
              key={label}
              type="button"
              aria-label={count > 0 ? `${label} ${count}개` : label}
              onClick={() => navigate(to, { state: { recipes, isHouseholdView: showAllHousehold } })}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
                // 전역 `button { border-radius: 8px }` 무력화(2026-10-08 지적과 같은 이유).
                borderRadius: 0, fontSize: 12.5, color: 'var(--ink-700)',
              }}
            >
              <span style={{
                position: 'relative', width: 48, height: 48, borderRadius: '50%',
                background: 'var(--surface-sub)', color: 'var(--ink-900)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icon}</svg>
                {count > 0 && (
                  <span aria-hidden style={{
                    position: 'absolute', top: -4, right: -9, minWidth: 20, height: 18, padding: '0 5px',
                    boxSizing: 'border-box', borderRadius: 9, background: 'var(--brand)', color: 'var(--ink-900)',
                    fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
                  }}>{count}</span>
                )}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </section>

      {/* 내 요리 프로필(2026-11-06) — 이번 달 요리 요약. 마이캘린더의 이번 달 목표 카드와 **같은 재료**로 센다
          (우리 식구 전체 · 완료 + 직접 기록 · 기기에만 있는 완료까지) — 두 화면의 숫자가 달라 보이면 안 된다.
          연속 요리·배지·크레딧 보상은 두지 않는다: 날짜를 골라 직접 기록할 수 있어 몰아 채울 수 있고,
          보상으로 줄 크레딧도 매력이 없다(2026-11-06 사용자 판단). 비회원에게는 잠근 모양으로 보여 준다. */}
      <section style={{
        margin: '12px 14px 0', padding: '14px 14px 14px', background: 'var(--surface)',
        border: '1px solid var(--line-200)', borderRadius: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>내 요리 프로필</h2>
          {isLoggedIn ? (
            <button type="button" onClick={() => navigate('/cooking-calendar')}
                    style={{ background: 'none', border: 'none', borderRadius: 0, padding: 0, cursor: 'pointer',
                             fontSize: 12.5, color: 'var(--ink-500)' }}>
              {new Date().getMonth() + 1}월 달력 ›
            </button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ink-500)' }}>
              {MenuIcons.admin}가입하면 열려요
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 14 }}>
          {[
            { label: '이번 달 요리', value: monthSummary ? `${monthSummary.total}회` : '–' },
            { label: '목표 달성', value: monthSummary ? `${monthSummary.goal > 0 ? Math.min(100, Math.round(monthSummary.total / monthSummary.goal * 100)) : 0}%` : '–' },
            { label: '아낀 금액(추정)', value: monthSummary ? `약 ${formatWonShort(monthSummary.savings)}` : '–' },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--line-200)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{label}</span>
              {isLoggedIn ? (
                <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              ) : (
                <span aria-hidden style={{ display: 'block', width: 44, height: 20, borderRadius: 6, background: 'var(--line-200)' }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-500)', wordBreak: 'keep-all' }}>
          {isLoggedIn
            ? (monthSummary
                ? `이번 달 목표 ${monthSummary.goal}회 · 1인 한 끼 ${monthSummary.perMeal.toLocaleString('ko-KR')}원 × 식구 ${monthSummary.familySize}명 기준 추정이에요.`
                : '이번 달 기록을 불러오는 중이에요.')
            : '요리 횟수·목표 달성·아낀 금액이 매달 쌓여요.'}
        </div>
      </section>


      {/* AI 사용량. 로그인 여부와 무관하게 보여준다 — 비회원도 한도가 있고,
          그 값을 보여줘야 "가입하면 더 쓸 수 있다"고 말할 수 있다.
          "더 필요해요" 버튼은 요청 폼(4단계)이 생기면 onRequestMore 로 붙인다.
          지금 붙이면 눌러도 아무 일도 안 일어나는 버튼이 된다. */}
      {/* 제목은 **게이지가 실제로 그려질 때만.** `UsageGauge` 는 사용량을 아직
          못 받았으면 아무것도 안 그리는데(서버가 안 뜬 경우 등), 그때 제목만
          남으면 빈 제목 한 줄이 떠 있게 된다 — 실제로 그렇게 보였다. */}
      {!!usageNow && <GroupTitle>크레딧 사용 현황</GroupTitle>}
      <div style={{ margin: '0 14px' }}>
        <UsageGauge />
      </div>

      {isLoggedIn && <GroupTitle>그룹 설정 현황</GroupTitle>}
      {isLoggedIn && (
        <div style={{ margin: '0 14px' }} data-guide-target="household-section">
          {/* 가이드가 이 칸(17단계)을 가리키면 펼친다 — 접힌 채면 제목 한 줄뿐이다. */}
          <HouseholdSection onChange={loadHouseholdRecipeFeeds} guideExpand={showGuide && guideStep === 1} />
        </div>
      )}

      {/* 제목을 밖에서 달지 않는다 — 알림을 지원하지 않는 기기에서는 이 카드가
          아무것도 그리지 않아서 **제목만 남았다**(2026-10-08 지적). 제목을
          컴포넌트 안으로 넣어 같은 조건을 타게 했다. */}
      {isLoggedIn && (
        <div style={{ margin: '0 14px' }} data-guide-target="notification-settings">
          <NotificationSettings title="알림 설정" />
        </div>
      )}

      {/* 한때 여기 `즐겨찾기로 요리 고르기` · `만든 요리 돌아보기` 두 버튼이 있었다.
          **뺐다**(2026-10-08 요청). 바로 위 요약 숫자 세 칸이 이미 같은 곳으로 가는
          입구인데, 그 아래에 비슷한 말을 하는 버튼이 또 있으니 "둘이 뭐가 다른가" 를
          매번 따져 읽게 됐다. 입구는 하나면 된다. */}

      {/* 즐겨찾기·기록·완료 **목록**은 여기 두지 않는다.
          위 요약 숫자가 각각의 자리로 보내는 입구다.

          왜 옮겼나: 셋은 성격이 다르다.
            - 완료·기록은 **지나간 사실**이다 → 요리 캘린더가 이미 하는 일
              (달력 옆 `목록` 보기)
            - 즐겨찾기는 **앞으로 할 것**이다 → 요리를 고르는 자리에 있어야
              쓸모가 있다 (냉장고요리의 `즐겨찾기만` 보기)
          여기 다 펼쳐 두니 마이페이지가 계속 길어졌고, 정작 필요한 순간에는
          그 목록이 다른 화면에 있었다. */}
      {/* 메뉴 묶음(2026-11-06, 당근마켓 「나의 당근」 참고).
          예전에는 사용 가이드·문의·방침·약관이 회색 칸 속에 모양이 다른 버튼·작은 링크로
          흩어져 있었고, 내 정보 수정·회원 탈퇴는 위쪽 버튼/수정 팝업 안쪽에 숨어 있었다.
          「눌러서 어딘가로 가는 줄」은 한 모양(아이콘 · 글자 · ›)으로 모으고 성격별로 제목을 붙인다.
          내 정보 수정은 맨 위 프로필 카드에 이미 있고, 회원 탈퇴는 그 팝업 안에 있다(2026-11-06 사용자 판단: 메뉴에 또 둘 필요 없다).
          그래서 메뉴는 「도움말 · 고객지원」 하나로 합쳤고, 방침·약관도 한 줄에 둔다. */}
      <MenuGroup title="도움말 · 고객지원">
        <MenuRow icon={MenuIcons.guide} label="사용 가이드 다시 보기"
                 onClick={() => { requestUsageGuideReplay(); navigate('/my-fridge'); }} />
        <MenuRow icon={MenuIcons.instagram} label="인스타그램으로 문의하기" href={`https://ig.me/m/${CONTACT.instagram}`} />
        {/* 방침·약관은 **한 줄**(2026-11-06 요청: 위 두 줄과 같은 모양으로, 둘은 합쳐서). 약관 화면 위쪽 탭으로 방침과 오갈 수 있다. */}
        <MenuRow icon={MenuIcons.file} label="이용약관 · 개인정보처리방침" to="/terms" />
      </MenuGroup>

      {/* 어드민 입구 — 보안 장치가 아니다(서버가 /api/admin/* 마다 is_admin 을 확인한다). 관리자 한 명만
          보는 줄이라 맨 아래에 둔다. */}
      {isAdmin && (
        <MenuGroup title="관리">
          <MenuRow icon={MenuIcons.admin} label="어드민 (사용자 · 요청 · 대시보드)" to="/admin" />
        </MenuGroup>
      )}

      {/* 쿠팡 광고 - 페이지 맨 끝에 도달했을 때만 표시(광고 단위 ID 가 없으면 아무것도 안 그린다).
          아래 여백 116px = 하단 메뉴(65) + 요리 AI 버튼(바닥에서 80~136px) — 맨 끝까지 내렸을 때 가리지 않게. */}
      <div style={{ padding: '24px 14px calc(116px + env(safe-area-inset-bottom, 0px))' }}>
        <BottomCoupangAd showCondition={true} />
      </div>
      </PullToRefresh>

      <BottomNavBar activeTab="mypage" />
      {/* 공유 요청 팝업은 AppRouter에 전역으로 마운트된 <ShareRequestPopup/>이
          담당한다 — 마이페이지에 들어와야만 뜨던 걸 앱 어느 탭에서든 뜨게
          하려고 이 화면 밖으로 옮겼다. */}

      {/* 내 정보 수정 모달 */}
      {editOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center"
          style={{
            zIndex: 'var(--z-modal)',
            // 모달이 화면 가장자리에 붙지 않게. 아래는 안전영역(홈 인디케이터)까지 비운다.
            padding: '16px 12px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/*
            머리(제목)·꼬리(취소·변경적용·회원탈퇴)는 고정하고, **가운데 폼
            영역만** 스크롤한다 — 셋을 하나로 묶어 모달 전체를 스크롤하면서
            머리만 sticky 로 붙이는 식으로 짰더니, 꼬리 쪽 내용이 늘어날 때
            (예: "더 필요해요") 모달 자체 높이가 화면을 넘어 하단이 잘렸다.
            모달을 위(머리)/가운데(스크롤)/아래(꼬리) 세 칸짜리 flex 세로
            배치로 두면, 바깥 두 칸은 내용만큼만 차지하고 **가운데 칸만
            남은 공간을 스스로 스크롤**하므로 꼬리가 항상 화면 안에 보인다.
            `overflow: hidden` 은 세 칸을 모달의 둥근 테두리 밖으로 새지
            않게 자른다.
          */}
          <div
            className="bg-white rounded-xl shadow-lg w-[370px] max-w-[95vw] relative max-h-[90vh]"
            style={{
              maxHeight: Math.round(viewportH * 0.9),
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative z-20 bg-white border-b border-gray-200 rounded-t-xl w-full" style={{minHeight: 56, paddingTop: 18, paddingBottom: 8, flexShrink: 0}}>
              <CloseButton onClick={handleCancel} style={{ top: 8, right: 8, zIndex: 20 }} />
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, color: 'var(--ink-900)' }}>내 정보 수정</div>
            </div>
            {/* 가운데 칸 — 이 화면에서 스크롤이 생기는 건 오직 여기뿐이다.
                `minHeight: 0` 이 없으면 flex 자식은 내용만큼 늘어나려 해서
                overflow: auto 가 있어도 스크롤 대신 부모를 밀어 버린다. */}
            <div
              className="p-6 pt-2 scrollbar-none"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}
            >
              {/* 닉네임 + 중복체크 */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1">
                    <label className="block text-[16px] font-semibold mb-1">닉네임</label>
                    <input 
                      className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[16px]" 
                      value={edit.nickname} 
                      onChange={e => {
                        setEdit({ ...edit, nickname: e.target.value });
                        setNicknameCheckResult(null); // 입력 변경 시 결과 초기화
                      }}
                    />
                  </div>
                  {/* 모든 사용자에게 중복 체크 버튼 표시 */}
                  <button 
                    className={`h-10 px-3 rounded-lg text-[15px] font-semibold whitespace-nowrap mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      edit.nickname !== originalEdit.nickname && edit.nickname.trim() !== ''
                        ? 'bg-[#FFD600] text-[#1A1A1E]'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    onClick={handleCheckNickname}
                    disabled={checkingNickname || !edit.nickname || edit.nickname.trim() === '' || edit.nickname === originalEdit.nickname}
                    style={{ 
                      outline: 'none', 
                      border: 'none',
                      opacity: checkingNickname ? 0.7 : (edit.nickname === originalEdit.nickname ? 0.5 : 1),
                      minWidth: '100px'
                    }}
                  >
                    중복 체크
                    {checkingNickname && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 44 44"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-label="로딩 중"
                      >
                        <g fill="none" fillRule="evenodd" strokeWidth="4">
                          <circle cx="22" cy="22" r="20" stroke="#E6E6EA" />
                          <path d="M42 22c0-11.046-8.954-20-20-20" stroke="#9A9AA2">
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0 22 22"
                              to="360 22 22"
                              dur="0.8s"
                              repeatCount="indefinite"
                            />
                          </path>
                        </g>
                      </svg>
                    )}
                  </button>
                </div>
                {/* 중복 체크 결과 메시지 (모든 사용자에게 표시) */}
                {nicknameCheckResult && (
                  <div 
                    className={`text-[15px] mt-1 px-2 py-1 rounded ${
                      nicknameCheckResult.available 
                        ? 'text-green-600 bg-green-50' 
                        : 'text-red-600 bg-red-50'
                    }`}
                  >
                    {nicknameCheckResult.message}
                  </div>
                )}
              </div>
              
              {/* 아이디 (회색, 읽기전용) */}
              <div className="mb-3">
                <label className="block text-[16px] font-semibold mb-1">이메일</label>
                <input 
                  className="w-full h-10 border border-gray-200 rounded-lg px-4 text-[16px] bg-gray-50 text-gray-400 cursor-not-allowed" 
                  value={edit.userid} 
                  readOnly 
                  disabled
                  style={{
                    backgroundColor: '#F5F5F7',
                    borderColor: '#E6E6EA',
                    color: '#9A9AA2',
                    opacity: 0.7
                  }}
                />
              </div>
              
              {/* 비밀번호 변경 (일반 로그인 사용자만 표시) */}
              {!isSocialLogin && (
                <>
                  <div className="mb-3">
                    <label className="block text-[16px] font-semibold mb-1">비밀번호 변경</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="w-full h-10 border border-gray-300 rounded-lg px-4 pr-10 text-[16px]" 
                        value={edit.password === '' ? '●●●●●●●' : edit.password} 
                        onChange={e => {
                          const newValue = e.target.value;
                          if (newValue !== '●●●●●●●') {
                            setEdit({ ...edit, password: newValue });
                          }
                        }}
                        onFocus={e => {
                          if (e.target.value === '●●●●●●●') {
                            setEdit({ ...edit, password: '' });
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '18px' }}
                      >
                        {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                  
                  {/* 비밀번호 변경 확인 */}
                  <div className="mb-3">
                    <label className="block text-[16px] font-semibold mb-1">비밀번호 변경 확인</label>
                    <div className="relative">
                      <input 
                        type={showPassword2 ? "text" : "password"} 
                        className="w-full h-10 border border-gray-300 rounded-lg px-4 pr-10 text-[16px]" 
                        value={edit.password2 === '' ? '●●●●●●●' : edit.password2} 
                        onChange={e => {
                          const newValue = e.target.value;
                          if (newValue !== '●●●●●●●') {
                            setEdit({ ...edit, password2: newValue });
                          }
                        }}
                        onFocus={e => {
                          if (e.target.value === '●●●●●●●') {
                            setEdit({ ...edit, password2: '' });
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword2(!showPassword2)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '18px' }}
                      >
                        {showPassword2 ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              {/* 계정 정보를 다 고친 다음에 플랜을 둔다.
                  위쪽은 **고치러 온 칸**(닉네임·비밀번호)이고, 크레딧은 고치는
                  것이 아니라 **지금 상태를 보는 것**이라 입력란 사이에 끼어
                  들면 폼이 끊긴다. 마이페이지 본문의 크레딧 카드와 **같은
                  부품**을 그대로 쓴다 — 두 자리 문구가 따로 놀면 나중에
                  한쪽만 고쳐 어긋난다. */}
              <div className="mt-5 pt-4 border-t border-gray-200">
                <UsageGauge />
              </div>
              {/* 회원탈퇴 — 취소/변경적용 버튼과는 다른 칸(꼬리가 아니라 이
                  스크롤되는 콘텐츠 영역)에 둔다. "닉네임·이메일·비밀번호·
                  크레딧이 있는 이 영역의 맨 아래, 취소/적용보다는 위" 라는
                  요청 — 자주 쓰는 저장 동작과 같은 줄에 있을 이유가 없고,
                  왼쪽 아래에 작게 있으면 충분하다. */}
              <div className="mt-5 pt-4 border-t border-gray-200 text-left">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-[11px] text-gray-400 underline hover:text-red-600 transition"
                  style={{ outline: 'none', background: 'none', border: 'none', padding: 0 }}
                >
                  회원탈퇴
                </button>
              </div>
            </div>
            {/* 아래 칸(꼬리) — 스크롤과 상관없이 늘 화면에 보인다.
                구분선을 넣어 "여기부터는 고정" 이라는 경계를 눈으로도 알 수 있게. */}
            <div className="px-6 pt-3 border-t border-gray-200" style={{
              flexShrink: 0,
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            }}>
              <div className="flex gap-2">
                {/* 브라우저 기본 포커스 테두리(파란 선)를 끈다. 옆의 `변경 적용`
                    과 회원탈퇴 버튼은 이미 끄고 있어서, 취소만 눌렀을 때 파랗게
                    변해 이 앱 색이 아닌 것이 튀어나왔다. 대신 눌린 동안에는
                    테두리를 한 단계 진하게 해서 "지금 이거" 가 보이게 한다. */}
                <button
                  className="flex-1 h-11 bg-white text-[#1A1A1E] border rounded-lg text-[16px] font-bold"
                  onClick={handleCancel}
                  style={{ outline: 'none', borderColor: 'var(--line-300)' }}
                  onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
                  onMouseDown={(e) => { e.currentTarget.style.borderColor = 'var(--ink-500)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.borderColor = 'var(--line-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line-300)'; }}
                >
                  취소
                </button>
                <button
                  className={`flex-1 h-11 rounded-lg text-[16px] font-bold ${
                    hasChanges()
                      ? 'bg-[#FFD600] text-[#1A1A1E] cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleSave}
                  disabled={!hasChanges()}
                  style={{ outline: 'none', border: 'none' }}
                  onMouseEnter={(e) => {
                    if (hasChanges()) {
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.border = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.border = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  변경 적용
                </button>
              </div>
            </div>
          </div>
          <style>{`
            .scrollbar-none::-webkit-scrollbar { display: none; }
            .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
        </div>
      )}
      
      {/* Toast Popup */}
      {toast && (
        <Toast message={toast} />
      )}
      
      {/* 삭제 확인 토스트 */}
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
          }}>
            {pendingRemove.type === 'done'
              ? '레시피 완료를 취소하시겠어요?'
              : pendingRemove.type === 'write'
                ? '레시피 기록을 취소하시겠어요?'
                : '레시피 즐겨찾기를 취소하시겠어요?'}
          </span>
          <div style={{display:'flex',flexDirection:'row',gap:12,justifyContent:'center',width:'100%'}}>
            <button 
              className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap" 
              style={{marginRight:4}} 
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
      
      
      {/* 회원탈퇴 확인 모달.
          예전에는 `z-[calc(var(--z-modal) + 1)]` 이라고 적혀 있었는데,
          Tailwind 의 임의값([])은 **공백을 포함할 수 없다**. 그래서 이 클래스는
          아예 만들어지지 않았고, 결과적으로 z-index 가 `auto` 였다.
          부모인 '내 정보 수정' 모달은 z-index 600 이라, 확인 팝업이 그 뒤에 숨어
          보이지도 눌리지도 않았다. (실측: 화면 가운데를 찍으면 정보수정 모달의 입력칸이 잡힘)
          → 공용 Dialog + nested 로 교체해 규격과 층위를 동시에 맞춘다. */}
      <Dialog
        open={showDeleteConfirm}
        nested
        onClose={() => { if (!deletingAccount) setShowDeleteConfirm(false); }}
        title="회원탈퇴"
        actions={[
          { label: '취소', onClick: () => setShowDeleteConfirm(false), variant: 'outline' },
          { label: deletingAccount ? '처리 중...' : '탈퇴하기', onClick: handleDeleteAccount, variant: 'danger' },
        ]}
      >
        정말 회원탈퇴를 하시겠습니까?
        <br />
        모든 데이터가 삭제되며 복구할 수 없습니다.
      </Dialog>

      <GuideOverlay
        visible={showGuide}
        currentStep={guideStep}
        onPrevious={() => setGuideStep((s) => Math.max(0, s - 1))}
        onNext={() => {
          if (guideStep < myPageGuideSteps.length - 1) setGuideStep(guideStep + 1);
          else finishMyPageGuide();
        }}
        onClose={finishMyPageGuide}
        steps={myPageGuideSteps}
        isLastStepConfirm={true}
        totalSteps={usageGuideTotalSteps(true)}
        startStepOffset={USAGE_GUIDE_STEPS.myFridge + USAGE_GUIDE_STEPS.recipeList + USAGE_GUIDE_STEPS.calendar}
      />
    </div>
  );
};

export default MyPage; 