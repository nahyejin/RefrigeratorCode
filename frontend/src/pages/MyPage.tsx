import React, { useState, useEffect, useMemo } from 'react';
import Toast from '../components/Toast';
import IngredientLegend from '../components/IngredientLegend';
import BottomNavBar from '../components/BottomNavBar';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import myProfileImg from '../assets/profile_default.png'; // 기본 프로필 이미지(없으면 대체)
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';
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
      {/* 상단 네비 - 고정 */}
      <header 
        className="w-full h-[56px] flex items-center justify-between px-5 bg-white"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 'var(--z-nav)',
          maxWidth: '400px',
          margin: '0 auto'
        }}
      >
        <img 
          src={logoImg} 
          alt="냉털이 로고" 
          className="h-4 w-auto cursor-pointer" 
          style={{ minWidth: 16 }}
          onClick={() => navigate('/my-fridge')}
        />
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="font-normal text-gray-700 hover:text-gray-900" style={{ fontSize: '13px' }}>{authUser?.nickname}</span>
              <button
                onClick={logout}
                className="font-normal text-gray-700 hover:text-gray-900"
                style={{ 
                  outline: 'none', 
                  border: 'none', 
                  background: 'none', 
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="font-normal text-gray-700 hover:text-gray-900"
              style={{ 
                outline: 'none', 
                border: 'none', 
                background: 'none', 
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              로그인/회원가입
            </button>
          )}
        </div>
      </header>
      
      {/* 프로필 영역 */}
      {isLoggedIn ? (
        <section className="flex flex-col items-center justify-center mb-[70px]" style={{ marginTop: '130px' }}>
          <div className="flex flex-col items-center">
            <div className="text-[18px] font-bold text-gray-700 mb-1">{user.nickname}</div>
            <div className="text-[16px] text-gray-500 mb-2">{user.email}</div>
          </div>
          <button
            className="px-3 h-7 bg-[#FFD600] text-[#1A1A1E] rounded-full text-[15px] font-bold flex items-center gap-1 border-none shadow hover:bg-yellow-300 transition"
            style={{ 
              minWidth: 0, 
              height: 28, 
              paddingLeft: 20, 
              paddingRight: 20, 
              fontFamily: 'inherit' 
            }}
            onClick={() => setEditOpen(true)}
          >
            내 정보 수정
          </button>
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center mb-[70px]" style={{ marginTop: '130px' }}>
          <div className="flex flex-col items-center max-w-[280px]">
            <div className="text-center leading-relaxed mb-4">
              <div className="text-[15px] text-gray-600 mb-1">
                기록 및 완료 내역을 안전히 관리하려면
              </div>
              <div className="text-[16px] font-bold text-gray-900">
                로그인이 필요합니다
              </div>
            </div>
            <button
              className="px-5 h-9 bg-[#FFD600] text-[#1A1A1E] rounded-full text-[15px] font-bold flex items-center justify-center gap-1 border-none shadow-sm hover:bg-yellow-400 hover:shadow-md transition-all duration-200"
              style={{ 
                fontFamily: 'inherit',
                minWidth: '140px'
              }}
              onClick={() => navigate('/login')}
            >
              로그인/회원가입
            </button>
          </div>
        </section>
      )}
      
      {/* 레시피 그룹 - 비회원도 localStorage로 관리하므로 항상 표시 */}
      <div style={{ marginTop: 56 }}>
        {/* 내가 즐겨찾는 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14, marginTop: 0, marginBottom: 6 }}>
          <div className="flex items-center justify-between mb-0">
            <h2 className="text-[16px] font-bold text-[#1A1A1E] flex items-center gap-1">
              <svg width="21" height="21" viewBox="0 0 24 24" style={{ marginRight: 4, marginBottom: 2 }}>
                <path
                  d="M12 2.75l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.62 6.56 19.48l1.04-6.05-4.4-4.29 6.08-.88L12 2.75z"
                  fill="none"
                  stroke="#1A1A1E"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              내가 즐겨찾는 레시피
            </h2>
            <button
              className="text-[#9A9AA2] text-[22px] font-bold px-2 py-0 bg-transparent border-none outline-none cursor-pointer"
              aria-label="내가 즐겨찾는 레시피 전체보기"
              onClick={() => navigate('/mypage/favorite')}
            >
              ☰
            </button>
          </div>
          <div style={{ height: 1, width: '100%', background: 'var(--line-200)', marginBottom: 14 }} />

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
            emptyMessage={
              <>
                <div>즐겨찾는 레시피가 없습니다.</div>
                <div>별 아이콘을 눌러 추가해주세요.</div>
              </>
            }
          />
        </div>

        {/* 내가 기록한 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14, marginTop: 0, marginBottom: 6 }}>
          <div className="flex items-center justify-between mb-0">
            <h2 className="text-[16px] font-bold text-[#1A1A1E] flex items-center gap-1">
              <img 
                src={writeIcon} 
                alt="기록 아이콘" 
                className="inline-block align-middle" 
                style={{
                  width: 18, 
                  height: 18, 
                  marginRight: 4, 
                  marginBottom: 2
                }} 
              />
              내가 기록한 레시피
            </h2>
            <button
              className="text-[#9A9AA2] text-[22px] font-bold px-2 py-0 bg-transparent border-none outline-none cursor-pointer"
              aria-label="내가 기록한 레시피 전체보기"
              onClick={() => navigate('/mypage/recorded')}
            >
              ☰
            </button>
          </div>
          <div style={{ height: 1, width: '100%', background: 'var(--line-200)', marginBottom: 14 }} />
          
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
            emptyMessage={
              <>
                <div>기록된 레시피가 없습니다.</div>
                <div>레시피를 기록해주세요.</div>
              </>
            }
          />
        </div>
        
        {/* 내가 완료한 레시피 */}
        <div style={{ paddingLeft: 14, paddingRight: 14, marginTop: 4 }}>
          <div className="flex items-center justify-between mb-0">
            <h2 className="text-[16px] font-bold text-[#1A1A1E] flex items-center gap-1">
              <img 
                src={doneIcon} 
                alt="완료 아이콘" 
                className="inline-block align-middle" 
                style={{
                  width: 18, 
                  height: 18, 
                  marginRight: 4, 
                  marginBottom: 2
                }} 
              />
              내가 완료한 레시피
            </h2>
            <button
              className="text-[#9A9AA2] text-[22px] font-bold px-2 py-0 bg-transparent border-none outline-none cursor-pointer"
              aria-label="내가 완료한 레시피 전체보기"
              onClick={() => navigate('/mypage/completed')}
            >
              ☰
            </button>
          </div>
          <div style={{ height: 1, width: '100%', background: 'var(--line-200)', marginBottom: 14 }} />
          
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
            emptyMessage={
              <>
                <div>완료된 레시피가 없습니다.</div>
                <div>레시피를 완료해주세요.</div>
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
              <span 
                className="absolute top-3 right-3 w-6 h-6 text-gray-400 text-xl cursor-pointer select-none" 
                onClick={handleCancel} 
                role="button" 
                aria-label="닫기" 
                style={{zIndex: 20}}
              >
                ×
              </span>
              <div className="text-center font-bold text-[18px]">내 정보 수정</div>
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
      
      {/* 회원탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[calc(var(--z-modal) + 1)]">
          <div className="bg-white rounded-xl shadow-lg w-[320px] max-w-[90vw] p-6">
            <div className="text-center mb-4">
              <div className="text-[18px] font-bold text-[#1A1A1E] mb-3">회원탈퇴</div>
              <div className="text-[15px] text-gray-600 leading-relaxed">
                정말 회원탈퇴를 하시겠습니까?<br />
                모든 데이터가 삭제되며 복구 불가 합니다.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 h-11 bg-white text-[#1A1A1E] border border-gray-300 rounded-lg text-[16px] font-semibold"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
              >
                취소
              </button>
              <button
                className="flex-1 h-11 bg-red-500 text-white rounded-lg text-[16px] font-semibold disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage; 