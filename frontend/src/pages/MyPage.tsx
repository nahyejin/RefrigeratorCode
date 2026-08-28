import React, { useState, useEffect, useMemo } from 'react';
import CloseButton from '../components/ui/CloseButton';
import Toast from '../components/Toast';
import IngredientLegend from '../components/IngredientLegend';
import SectionHeader from '../components/SectionHeader';
import SectionIcon from '../components/ui/SectionIcon';
import SectionBand from '../components/ui/SectionBand';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import BottomNavBar from '../components/BottomNavBar';
import HouseholdSection from '../components/HouseholdSection';
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
import writeIcon from '../assets/write.svg';
import doneIcon from '../assets/done.svg';
import { useNavigate, useLocation } from 'react-router-dom';
import RecipeCard from '../components/RecipeCard';
import VirtualizedHorizontalRecipeList from '../components/VirtualizedHorizontalRecipeList';
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
} from '../utils/recipeStorage';
import { useAuth } from '../context/AuthContext';
import RegisterPromptModal from '../components/RegisterPromptModal';
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
    const response = await fetch(CSV_SUBSTITUTE_URL);
    const csv = await response.text();
    
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

  // DB에 레시피 추가
  const addRecipeToDB = async (type: 'write' | 'done' | 'favorite', recipeId: number) => {
    if (!isLoggedIn || !authUser?.id) return;
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) return;
      
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const endpoint = type === 'write'
        ? `${apiUrl}/api/users/${authUser.id}/recorded-recipes`
        : type === 'done'
          ? `${apiUrl}/api/users/${authUser.id}/completed-recipes`
          : `${apiUrl}/api/users/${authUser.id}/favorite-recipes`;
      
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recipe_id: recipeId }),
      });
    } catch (error) {
      console.error(`[MyPage] DB에 레시피 추가 실패 (${type}):`, error);
    }
  };

  // DB에서 레시피 삭제
  const removeRecipeFromDB = async (type: 'write' | 'done' | 'favorite', recipeId: number) => {
    if (!isLoggedIn || !authUser?.id) return;
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) return;
      
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const endpoint = type === 'write'
        ? `${apiUrl}/api/users/${authUser.id}/recorded-recipes/${recipeId}`
        : type === 'done'
          ? `${apiUrl}/api/users/${authUser.id}/completed-recipes/${recipeId}`
          : `${apiUrl}/api/users/${authUser.id}/favorite-recipes/${recipeId}`;
      
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error(`[MyPage] DB에서 레시피 삭제 실패 (${type}):`, error);
    }
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
  const [recordedRecipes, setRecordedRecipes] = useState<any[]>([]);
  const [completedRecipes, setCompletedRecipes] = useState<any[]>([]);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<any>(null);
  const [myIngredients, setMyIngredients] = React.useState<string[]>(getMyIngredientsSafe());
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: { ingredient_b: string; similarity_score?: number }[] }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameCheckResult, setNicknameCheckResult] = useState<{ available: boolean; message: string } | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerModalMessage, setRegisterModalMessage] = useState('');
  const [pendingRegisterRecipe, setPendingRegisterRecipe] = useState<{ id: number; type: 'done' | 'write'; recipe: any } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

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
    } else {
      // 로그아웃 시 레시피 상태 초기화 및 localStorage에서 로드
      setFavoriteRecipes([]);
      setRecordedRecipes([]);
      setCompletedRecipes([]);
      const localFavorite = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITE) || '[]');
      const localRecorded = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDED) || '[]');
      const localCompleted = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED) || '[]');
      setFavoriteRecipes(sortRecipesByUserSavedAtDesc(localFavorite));
      setRecordedRecipes(sortRecipesByUserSavedAtDesc(localRecorded));
      setCompletedRecipes(sortRecipesByUserSavedAtDesc(localCompleted));
    }
  }, [authUser?.id]); // authUser.id가 변경될 때만 실행 (사용자 변경 감지)

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
    const allRecipes = [...favoriteRecipes, ...recordedRecipes, ...completedRecipes];
    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(recipe => [normalizeRecipeId(recipe.id), recipe])).values()
    );
    return buildRecipeActionStatesForRecipes(uniqueRecipes);
  }, [favoriteRecipes, recordedRecipes, completedRecipes]);
  
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
    setTimeout(() => setToast(''), TOAST_DURATION);
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
        const currentCount = getRecipesFromLocalStorage('done').length;
        const totalCount = currentCount + 1;
        
        // 완료한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
        if (totalCount >= 5 && !isLoggedIn) {
          // 레시피 저장 전에 모달 표시
          setPendingRegisterRecipe({ id, type: 'done', recipe });
          setRegisterModalMessage('더 많은 레시피를 완료하려면');
          setShowRegisterModal(true);
          return;
        }
        
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
        const currentCount = getRecipesFromLocalStorage('write').length;
        const totalCount = currentCount + 1;
        
        // 기록한 레시피 5개 이상 시 회원가입 유도 (비회원일 때만)
        if (totalCount >= 5 && !isLoggedIn) {
          // 레시피 저장 전에 모달 표시
          setPendingRegisterRecipe({ id, type: 'write', recipe });
          setRegisterModalMessage('더 많은 레시피를 기록하려면');
          setShowRegisterModal(true);
          return;
        }
        
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
    <div className="bg-white min-h-screen max-w-[400px] mx-auto pb-24 relative" style={{ boxSizing: 'border-box' }}>
      {/* 상단 GNB 는 AppRouter 의 TopNavBar 하나만 쓴다.
          예전에는 마이페이지가 똑같은 헤더를 하나 더 그리고 있어 두 개가 겹쳐 있었고,
          복제본은 폭이 400px 로 제한돼 있어 넓은 화면에서 정렬도 달라 보였다. */}

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
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface-sub)',
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
            padding: '18px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface-sub)',
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

      {isLoggedIn && (
        <div style={{ margin: '12px 14px 0' }}>
          <HouseholdSection />
        </div>
      )}

      {/* 이 화면이 무엇을 담고 있는지 한눈에 알려주는 요약 줄.
          예전에는 스크롤을 내려 봐야 각 목록에 뭐가 몇 개 있는지 알 수 있었다. */}
      <nav
        style={{
          display: 'flex',
          margin: '12px 14px 0',
          border: '1px solid var(--line-200)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {[
          { label: '즐겨찾기', count: favoriteRecipes.length, to: '/mypage/favorite' },
          { label: '기록', count: recordedRecipes.length, to: '/mypage/recorded' },
          { label: '완료', count: completedRecipes.length, to: '/mypage/completed' },
        ].map(({ label, count, to }, i) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(to)}
            style={{
              flex: 1,
              height: 62,
              padding: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'var(--surface)',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--line-200)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.2 }}>{count}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{label}</span>
          </button>
        ))}
      </nav>
      
      {/* 레시피 그룹 - 비회원도 localStorage로 관리하므로 항상 표시 */}
      <div style={{ marginTop: 0 }}>
        {/* 내가 즐겨찾는 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14 }}>
          <SectionBand bleed={14} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <SectionHeader icon={<SectionIcon kind="favorite" />} title="내가 즐겨찾는 레시피" />
            {/* 예전엔 전체보기가 `☰` 글자 하나였다. 햄버거는 '메뉴' 를 뜻하는 기호라
                '이 목록 전부 보기' 와 뜻이 맞지 않고, 무엇보다 무슨 버튼인지 알 수 없었다. */}
            <button
              type="button"
              aria-label="내가 즐겨찾는 레시피 전체보기"
              onClick={() => navigate('/mypage/favorite')}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 4px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-500)',
              }}
            >
              전체보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <IngredientLegend total={favoriteRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />

          <VirtualizedHorizontalRecipeList
            recipes={favoriteRecipes}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            recipeActionStates={recipeActionStates}
            onRecipeAction={handleRecipeAction}
            cardWidth={300}
            cardHeight={280}
            gap={16}
            compactSectionGap
            // 내가 즐겨찾고·기록하고·완료한 목록은 사용자가 직접 모아 둔 것이다.
            // 그 사이에 광고 카드를 끼우면 목록의 성격이 흐려지므로 여기서는 끈다.
            // (부족 재료를 눌렀을 때 뜨는 구매 안내는 그대로 동작한다)
            showAds={false}
            emptyMessage={
              <>
                <div>즐겨찾는 레시피가 없습니다.</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  레시피 카드의
                  <FavoriteButtonHint />
                  버튼을 눌러 추가해주세요.
                </div>
              </>
            }
          />
        </div>

        {/* 내가 기록한 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14 }}>
          <SectionBand bleed={14} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <SectionHeader icon={<SectionIcon kind="recorded" />} title="내가 기록한 레시피" />
            {/* 예전엔 전체보기가 `☰` 글자 하나였다. 햄버거는 '메뉴' 를 뜻하는 기호라
                '이 목록 전부 보기' 와 뜻이 맞지 않고, 무엇보다 무슨 버튼인지 알 수 없었다. */}
            <button
              type="button"
              aria-label="내가 기록한 레시피 전체보기"
              onClick={() => navigate('/mypage/recorded')}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 4px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-500)',
              }}
            >
              전체보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* 범례 */}
          <IngredientLegend total={recordedRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
          
          <VirtualizedHorizontalRecipeList
            recipes={recordedRecipes}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            recipeActionStates={recipeActionStates}
            onRecipeAction={handleRecipeAction}
            cardWidth={300}
            cardHeight={280}
            gap={16}
            compactSectionGap
            // 내가 즐겨찾고·기록하고·완료한 목록은 사용자가 직접 모아 둔 것이다.
            // 그 사이에 광고 카드를 끼우면 목록의 성격이 흐려지므로 여기서는 끈다.
            // (부족 재료를 눌렀을 때 뜨는 구매 안내는 그대로 동작한다)
            showAds={false}
            emptyMessage={
              <>
                <div>기록된 레시피가 없습니다.</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  레시피 카드의
                  <EmptyStateIconHint>
                    <img src={기록하기버튼} alt="기록" width={14} height={14} />
                  </EmptyStateIconHint>
                  버튼을 눌러 추가해주세요.
                </div>
              </>
            }
          />
        </div>
        
        {/* 내가 완료한 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14 }}>
          <SectionBand bleed={14} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <SectionHeader icon={<SectionIcon kind="completed" />} title="내가 완료한 레시피" />
            {/* 예전엔 전체보기가 `☰` 글자 하나였다. 햄버거는 '메뉴' 를 뜻하는 기호라
                '이 목록 전부 보기' 와 뜻이 맞지 않고, 무엇보다 무슨 버튼인지 알 수 없었다. */}
            <button
              type="button"
              aria-label="내가 완료한 레시피 전체보기"
              onClick={() => navigate('/mypage/completed')}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 4px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-500)',
              }}
            >
              전체보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* 범례 */}
          <IngredientLegend total={completedRecipes.length} style={{ marginBottom: 6, marginTop: 8 }} />
          
          <VirtualizedHorizontalRecipeList
            recipes={completedRecipes}
            myIngredients={myIngredients}
            substituteTable={substituteTable}
            recipeActionStates={recipeActionStates}
            onRecipeAction={handleRecipeAction}
            cardWidth={300}
            cardHeight={280}
            gap={16}
            compactSectionGap
            // 내가 즐겨찾고·기록하고·완료한 목록은 사용자가 직접 모아 둔 것이다.
            // 그 사이에 광고 카드를 끼우면 목록의 성격이 흐려지므로 여기서는 끈다.
            // (부족 재료를 눌렀을 때 뜨는 구매 안내는 그대로 동작한다)
            showAds={false}
            emptyMessage={
              <>
                <div>완료된 레시피가 없습니다.</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  레시피 카드의
                  <EmptyStateIconHint>
                    <img src={완료하기버튼} alt="완료" width={14} height={14} />
                  </EmptyStateIconHint>
                  버튼을 눌러 추가해주세요.
                </div>
              </>
            }
          />
        </div>
        {/* 쿠팡 광고 - 페이지 맨 끝에 도달했을 때만 표시 */}
        <BottomCoupangAd showCondition={true} />
      </div>
      
      <BottomNavBar activeTab="mypage" />
      
      {/* 내 정보 수정 모달 */}
      {editOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 'var(--z-modal)' }}>
          <div 
            className="bg-white rounded-xl shadow-lg w-[370px] max-w-[95vw] relative max-h-[90vh] overflow-y-auto scrollbar-none" 
            style={{scrollbarWidth:'none'}} 
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 rounded-t-xl w-full" style={{minHeight: 56, paddingTop: 18, paddingBottom: 8}}>
              <CloseButton onClick={handleCancel} style={{ top: 8, right: 8, zIndex: 20 }} />
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, color: 'var(--ink-900)' }}>내 정보 수정</div>
            </div>
            <div className="p-6 pt-2">
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
                        {showPassword ? '👁️' : '👁️‍🗨️'}
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
                        {showPassword2 ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              {/* 취소/적용 버튼 */}
              <div className="flex gap-2 mt-4">
                <button 
                  className="flex-1 h-11 bg-white text-[#1A1A1E] border border-gray-300 rounded-lg text-[16px] font-bold"
                  onClick={handleCancel}
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

              {/* 회원탈퇴 버튼 */}
              <div className="mt-6 pt-4 text-center">
                <button
                  className="text-[13px] text-red-600 underline cursor-pointer hover:text-red-700 transition"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ outline: 'none', background: 'none', border: 'none', padding: 0 }}
                >
                  회원탈퇴
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
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
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
            whiteSpace: 'nowrap',
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
      
      {/* 회원가입 유도 모달 */}
      <RegisterPromptModal
        visible={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          setPendingRegisterRecipe(null);
        }}
        onConfirm={() => {
          // 회원가입하기를 누르면 레시피 저장 진행
          if (pendingRegisterRecipe) {
            if (pendingRegisterRecipe.type === 'done') {
              const savedRecipe = withUserSavedAt(pendingRegisterRecipe.recipe);
              addRecipeToLocalStorage('done', savedRecipe);
              addRecipeToDB('done', pendingRegisterRecipe.id);
              const updatedCompleted = sortRecipesByUserSavedAtDesc([savedRecipe, ...completedRecipes]);
              setCompletedRecipes(updatedCompleted);
            } else if (pendingRegisterRecipe.type === 'write') {
              const savedRecipe = withUserSavedAt(pendingRegisterRecipe.recipe);
              addRecipeToLocalStorage('write', savedRecipe);
              addRecipeToDB('write', pendingRegisterRecipe.id);
              const updatedRecorded = sortRecipesByUserSavedAtDesc([savedRecipe, ...recordedRecipes]);
              setRecordedRecipes(updatedRecorded);
            }
            setPendingRegisterRecipe(null);
          }
        }}
        message={registerModalMessage || '더 많은 기능을 사용하려면'}
      />
      
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
    </div>
  );
};

export default MyPage; 