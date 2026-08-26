import * as React from 'react';
import SectionIcon from '../components/ui/SectionIcon';
import LoadingIndicator from '../components/LoadingIndicator';
import BottomNavBar from '../components/BottomNavBar';
import TagPill from '../components/TagPill';
import IngredientDetailModal from '../components/IngredientDetailModal';
import SortDropdown, { SortType } from '../components/SortDropdown';
import saveIcon from '../assets/saveicon.png';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RegisterPromptModal from '../components/RegisterPromptModal';
import WelcomeModal from '../components/WelcomeModal';
import GuideOverlay from '../components/GuideOverlay';
import BottomCoupangAd from '../components/BottomCoupangAd';
import { loadIngredientCategoryMap, estimateExpiry, type CategoryMap } from '../utils/shelfLife';
import {
  isUsageGuideDueThisVisit,
  markUsageGuideFinished,
  markUsageGuideOpened,
  ONBOARDING_KEYS,
} from '../utils/onboardingPrompts';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'myfridge_ingredients';
const TOAST_DURATION = 10000;

// 가이드 단계 정의 (기본 - 비회원용)
const baseGuideSteps = [
  {
    targetSelector: '[data-guide-target="storage-areas"]',
    message:
      '재료는 냉동·냉장·실온 세 칸으로 나뉘어 있어요.\n처음엔 자주 쓰는 재료를 예시로 넣어 두었으니,\n내 냉장고 상황에 맞게 삭제·수정해서 쓰시면 돼요.\n사진으로 한번에 파악하기 기능은 추후 추가 계획입니다.',
    position: 'top' as const,
  },
  {
    targetSelector: 'input[placeholder="추가할 재료명을 입력하세요"]',
    message: '재료명을 입력해서 내냉장고에 추가할 수 있어요.',
    position: 'bottom' as const,
  },
  {
    targetSelector: '[data-guide-target="settings-icon"]',
    message: '재료 옆의 설정 아이콘 (⚙️)을 누르면\n보관공간, 유통기한, 구매기한을 변경할 수 있어요.',
    position: 'left' as const,
  },
];

// (저장 버튼을 없애고 자동 저장으로 바꾸면서 관련 가이드 단계도 제거)

// =====================
// 타입 정의
// =====================

export interface Ingredient {
  id: string;
  name: string;
  expiry?: string;
  purchase?: string;
  /** 구매일 + 재료 카테고리로 짐작한 유통기한. 사용자가 직접 넣은 expiry 와 구분해서 보관한다 */
  estimatedExpiry?: string;
}

export type StorageBox = 'frozen' | 'fridge' | 'room';

export interface DeletedInfo {
  type: 'single' | 'all';
  box: StorageBox;
  tags: string[];
  ingredients?: Ingredient[]; // 삭제된 재료의 전체 정보 저장
}

export interface ToastState {
  visible: boolean;
  message: string;
  deleted: DeletedInfo | null;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * localStorage에서 재료 데이터를 로드한다
 */
function loadIngredients() {
  try {
    // 모바일 환경에서 localStorage 접근이 실패할 수 있으므로 안전하게 처리
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[Storage] localStorage를 사용할 수 없습니다.');
      return {
        frozen: [],
        fridge: [],
        room: [],
      };
    }
    
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && data.frozen && data.fridge && data.room) {
      return data;
    }
  } catch (error) {
    console.warn('[Storage] 재료 데이터 로드 실패:', error);
  }
  
  return {
    frozen: [],
    fridge: [],
    room: [],
  };
}

/**
 * localStorage에 재료 데이터를 저장한다
 */
function saveIngredients(
  frozen: Ingredient[],
  fridge: Ingredient[],
  room: Ingredient[]
) {
  try {
    // 모바일 환경에서 localStorage 접근이 실패할 수 있으므로 안전하게 처리
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[Storage] localStorage를 사용할 수 없습니다.');
      return;
    }
    
    const data = { frozen, fridge, room };
    const jsonString = JSON.stringify(data);
    
    console.log('[saveIngredients] 저장 시도:', {
      key: STORAGE_KEY,
      frozenCount: frozen.length,
      fridgeCount: fridge.length,
      roomCount: room.length,
      jsonLength: jsonString.length,
      allKeysBefore: Object.keys(localStorage)
    });
    
    localStorage.setItem(STORAGE_KEY, jsonString);
    
    // 저장 확인 - 즉시 확인
    const saved = localStorage.getItem(STORAGE_KEY);
    const allKeysAfter = Object.keys(localStorage);
    
    console.log('[saveIngredients] 저장 후 확인:', {
      saved: saved ? '있음' : '없음',
      savedLength: saved?.length || 0,
      allKeysAfter: allKeysAfter,
      hasKey: allKeysAfter.includes(STORAGE_KEY),
      keyValue: saved ? saved.substring(0, 100) : null
    });
    
    if (saved) {
      console.log('[saveIngredients] 저장 성공:', {
        frozenCount: frozen.length,
        fridgeCount: fridge.length,
        roomCount: room.length,
        savedLength: saved.length
      });
      
      // 같은 탭에서 변경을 알리기 위해 CustomEvent 발생
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: STORAGE_KEY }
      }));
    } else {
      console.error('[saveIngredients] 저장 실패: localStorage.getItem이 null 반환');
      console.error('[saveIngredients] localStorage 상태:', {
        allKeys: Object.keys(localStorage),
        length: localStorage.length,
        quotaExceeded: false // 직접 확인 불가능하지만 로그에 표시
      });
    }
  } catch (error) {
    console.error('[Storage] 재료 데이터 저장 실패:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[Storage] localStorage 용량 초과!');
    }
  }
}

/**
 * 재료를 정렬 기준에 따라 정렬한다
 */
function sortIngredients(arr: Ingredient[], sort: SortType): Ingredient[] {
  if (!arr) return [];
  
  // 짐작한 기한도 D-표기로 보이므로 정렬에서 빼면 안 된다.
  // 빼 두면 `약 D-2` 재료가 `D-30` 재료보다 아래로 밀려 임박 재료를 놓친다.
  const effectiveExpiry = (i: Ingredient) => i.expiry || i.estimatedExpiry;

  if (sort === 'expiry') {
    const withExpiry = arr.filter(i => effectiveExpiry(i));
    const withoutExpiry = arr.filter(i => !effectiveExpiry(i));
    // 유통기한 있는 것들을 날짜순으로 정렬 (임박한 것부터)
    withExpiry.sort((a, b) => (effectiveExpiry(a)! > effectiveExpiry(b)! ? 1 : -1));
    // 유통기한 없는 것들은 원래 순서 유지 (재료 추가한 순)
    // 배열의 원래 인덱스를 유지하기 위해 필터링 전 인덱스를 저장
    const originalIndices = new Map<Ingredient, number>();
    arr.forEach((item, index) => {
      originalIndices.set(item, index);
    });
    // 원래 순서대로 정렬
    withoutExpiry.sort((a, b) => {
      const indexA = originalIndices.get(a) ?? 0;
      const indexB = originalIndices.get(b) ?? 0;
      return indexA - indexB;
    });
    return [...withExpiry, ...withoutExpiry];
  } else if (sort === 'purchase') {
    const withPurchase = arr.filter(i => i.purchase);
    const withoutPurchase = arr.filter(i => !i.purchase);
    withPurchase.sort((a, b) => (a.purchase! > b.purchase! ? 1 : -1));
    // 구매일 없는 재료 중 유통기한 있는 것, 없는 것 분리
    const withExpiry = withoutPurchase.filter(i => effectiveExpiry(i));
    const noDate = withoutPurchase.filter(i => !effectiveExpiry(i));
    withExpiry.sort((a, b) => (effectiveExpiry(a)! > effectiveExpiry(b)! ? 1 : -1));
    noDate.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return [...withPurchase, ...withExpiry, ...noDate];
  } else {
    // 가나다순
    return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
}

// =====================
// Toast 컴포넌트
// =====================

const Toast = ({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(34,34,34,0.9)',
      color: '#FFFFFF',
      padding: '12px 24px',
      borderRadius: 12,
      fontWeight: 400,
      fontSize: 16,
      zIndex: 'var(--z-toast)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: 320,
      width: 'max-content',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <span style={{ fontWeight: 400, color: '#FFFFFF', marginRight: 8, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>정말 삭제하시겠습니까?</span>
    <button className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap" onClick={onUndo}>아니요</button>
    <button className="inline-flex items-center justify-center bg-[#F5F5F7] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E6E6EA] shadow-none hover:bg-[#E6E6EA] transition whitespace-nowrap" onClick={onClose}>네</button>
  </div>
);

// =====================
// IngredientPill 컴포넌트
// =====================

interface IngredientPillProps {
  item: Ingredient;
  onRemove: (id: string) => void;
  onSettingsClick: (item: Ingredient) => void;
  isFirstInFridge?: boolean;
}

/**
 * 유통기한까지 남은 일수를 D-표기로. 날짜가 없으면 null.
 *
 * 사용자가 직접 넣은 유통기한(expiry)이 항상 우선이고,
 * 없을 때만 구매일로 짐작한 값(estimatedExpiry)을 쓴다.
 * 짐작한 값은 `약 D-5` 처럼 표시해서 단정하지 않는다 —
 * 추정을 확정처럼 보여주면 멀쩡한 재료를 버리게 된다.
 */
function getDdayLabel(item: Ingredient): { text: string; urgent: boolean; estimated: boolean } | null {
  const estimated = !item.expiry && !!item.estimatedExpiry;
  const raw = item.expiry || item.estimatedExpiry;
  if (!raw) return null;
  const d = new Date(String(raw).replace(/\./g, '-'));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const prefix = estimated ? '약 ' : '';
  if (days < 0) return { text: estimated ? '약 지남' : '지남', urgent: true, estimated };
  if (days === 0) return { text: `${prefix}D-day`, urgent: true, estimated };
  return { text: `${prefix}D-${days}`, urgent: days <= 3, estimated };
}

const IngredientPill: React.FC<IngredientPillProps> = ({ item, onRemove, onSettingsClick, isFirstInFridge = false }) => {
  const dday = getDdayLabel(item);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8, marginBottom: 4 }}>
      {/* 예전에는 pill 안에 동작이 3개였다 —
          이름 탭(토스트로 날짜 보여주기) / 시계 버튼(설정 팝업) / X(삭제).
          토스트는 "보여주기만" 하고 고칠 수는 없어 설정 팝업의 열화판이었고,
          시계 버튼은 pill 과 떨어져 있어 무엇인지 알기 어려웠다.
          → pill 을 누르면 바로 설정 팝업이 열리도록 합치고 시계 버튼을 없앴다. */}
      <TagPill
        style={{ fontSize: 13, cursor: 'pointer', marginRight: 0, marginBottom: 0 }}
      >
        <span
          className="truncate max-w-[100px]"
          style={{ cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('span[title="삭제"]')) {
              e.stopPropagation();
              onSettingsClick(item);
            }
          }}
          {...(isFirstInFridge ? { 'data-guide-target': 'settings-icon' } : {})}
        >
          {item.name}
        </span>

        {/* 날짜를 설정한 재료에만 D-표기를 붙인다.
            실측상 유통기한을 넣는 비율이 매우 낮아, 없는 재료에까지 자리표시를 두면
            거의 모든 pill 에 붙어 시계 아이콘과 같은 문제가 반복된다. */}
        {dday && (
          <span
            style={{
              marginLeft: 6,
              padding: '0 6px',
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              // 짐작한 기한까지 빨갛게 칠하면 확정된 사실처럼 읽히므로,
              // 추정값은 급해도 붉은색 대신 옅은 주황으로 한 단계 낮춘다
              background: dday.urgent ? (dday.estimated ? '#FFF3E0' : '#FFE7E4') : 'var(--surface-sub)',
              color: dday.urgent ? (dday.estimated ? '#9A5B00' : '#C4342B') : 'var(--ink-500)',
            }}
          >
            {dday.text}
          </span>
        )}

        <span
          style={{
            fontSize: 16,
            fontWeight: 300,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            marginLeft: 6,
            display: 'inline-block',
            width: '16px',
            height: '16px',
            textAlign: 'center',
            flexShrink: 0,
          }}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            onRemove(item.id);
          }}
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          title="삭제"
        >
          x
        </span>
      </TagPill>
    </div>
  );
};

interface ScrollablePillSectionProps {
  watchKey: number;
  children: React.ReactNode;
}

const ScrollablePillSection: React.FC<ScrollablePillSectionProps> = ({ watchKey, children }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = React.useState<'down' | 'up' | null>(null);

  const updateScrollHint = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight - el.clientHeight > 2;
    const canScrollUp = el.scrollTop > 2;
    const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    if (!hasOverflow) {
      setScrollHint(null);
      return;
    }
    setScrollHint(canScrollDown ? 'down' : (canScrollUp ? 'up' : null));
  }, []);

  React.useEffect(() => {
    updateScrollHint();
    const rafId = window.requestAnimationFrame(updateScrollHint);
    window.addEventListener('resize', updateScrollHint);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [updateScrollHint, watchKey]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        onScroll={updateScrollHint}
        style={{
          background: '#F5F5F7',
          borderRadius: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          padding: 16,
          maxHeight: '140px',
          minHeight: '140px',
          border: 'none',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className="custom-scrollbar"
      >
        {children}
      </div>
      {scrollHint && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 32,
              pointerEvents: 'none',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              background: 'linear-gradient(to bottom, rgba(245,246,248,0), rgba(245,246,248,0.92))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              ...(scrollHint === 'down' ? { bottom: 6 } : { top: 6 }),
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              width: 26,
              height: 26,
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6A6A73',
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1,
              zIndex: 2,
            }}
            aria-hidden="true"
          >
            {scrollHint === 'down' ? '∨' : '∧'}
          </div>
        </>
      )}
    </div>
  );
};

// =====================
// 메인 컴포넌트
// =====================

const MyFridge: React.FC = () => {
  console.log('[MyFridge] 컴포넌트 렌더링 시작');
  
  // 재료 카테고리 표 (유통기한 추정용). 앱 전체가 같은 CSV 를 쓰므로 유틸에서 캐시한다
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const [frozen, setFrozen] = React.useState<Ingredient[] | null>(null);
  const [fridge, setFridge] = React.useState<Ingredient[] | null>(null);
  const [room, setRoom] = React.useState<Ingredient[] | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [ingredientDict, setIngredientDict] = React.useState<{ [key: string]: string }>({});
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const toastTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalIngredient, setModalIngredient] = React.useState<string | null>(null);
  const [modalInitialData, setModalInitialData] = React.useState<{
    storageType?: 'frozen' | 'fridge' | 'room' | null;
    date?: string | null;
    dateType?: 'expiry' | 'purchase' | null;
  } | null>(null);
  const [infoToast, setInfoToast] = React.useState<{text: string} | null>(null);
  /** 자동완성 목록을 끝까지 내렸는지 — '아래로 더 있음' 표시를 감추는 데 쓴다 */
  const [dropdownAtEnd, setDropdownAtEnd] = React.useState(false);
  const [frozenSort, setFrozenSort] = React.useState<SortType>('expiry');
  const [fridgeSort, setFridgeSort] = React.useState<SortType>('expiry');
  const [roomSort, setRoomSort] = React.useState<SortType>('expiry');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [pendingIngredient, setPendingIngredient] = useState<{ ingredient: string; storageType: StorageBox; hasExpiration: boolean; date: string | null; } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  // 자동 저장: 연속 변경을 묶기 위한 타이머와, 응답 순서 역전을 막기 위한 일련번호
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSeq = React.useRef(0);
  const [hasChanges, setHasChanges] = useState(false); // 변경사항 추적
  const lastSavedDataRef = React.useRef<{frozen: Ingredient[], fridge: Ingredient[], room: Ingredient[]} | null>(null);
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const isInitialLoad = React.useRef(true); // 초기 로드 플래그
  const dbLoadAttempted = React.useRef(false); // DB 로드 시도 여부
  const dbLoadFailed = React.useRef(false); // DB 로드 실패 여부
  const dataLoadedRef = React.useRef(false); // 데이터 로드 완료 여부

  // DB에서 재료 로드 (토큰 대기 포함)
  const loadIngredientsFromDB = async (maxWaitForToken = 5000) => {
    if (!isLoggedIn || !user?.id) {
      console.log('[MyFridge] DB 로드 스킵: 로그인하지 않음', { isLoggedIn, userId: user?.id });
      return null;
    }
    
    console.log('[MyFridge] DB 로드 시작:', {
      userId: user.id,
      isLoggedIn,
      localStorageAvailable: typeof window !== 'undefined' && window.localStorage,
      sessionStorageAvailable: typeof window !== 'undefined' && window.sessionStorage
    });
    
    // 토큰이 준비될 때까지 대기 (최대 5초로 증가)
    let token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const startTime = Date.now();
    while (!token && (Date.now() - startTime) < maxWaitForToken) {
      await new Promise(resolve => setTimeout(resolve, 200));
      token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
    
    if (!token) {
      console.error('[MyFridge] DB 로드 실패: 토큰 없음 (대기 시간 초과)', {
        waitedFor: Date.now() - startTime,
        localStorageKeys: typeof window !== 'undefined' && window.localStorage ? Object.keys(localStorage) : [],
        sessionStorageKeys: typeof window !== 'undefined' && window.sessionStorage ? Object.keys(sessionStorage) : []
      });
      return null;
    }
    
    console.log('[MyFridge] 토큰 확인 완료, API 요청 시작');
    
    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const requestUrl = `${apiUrl}/api/users/${user.id}/ingredients`;
      
      console.log('[MyFridge] API 요청:', {
        url: requestUrl,
        userId: user.id,
        apiUrl: apiUrl,
        hasToken: !!token,
        tokenLength: token?.length
      });
      
      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('[MyFridge] API 응답:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const data = await response.json();
        // 백엔드는 항상 {frozen: [], fridge: [], room: []} 형식으로 반환
        const result = {
          frozen: Array.isArray(data.frozen) ? data.frozen : [],
          fridge: Array.isArray(data.fridge) ? data.fridge : [],
          room: Array.isArray(data.room) ? data.room : [],
        };
        console.log('[MyFridge] DB에서 재료 로드 성공:', {
          frozen: result.frozen.length,
          fridge: result.fridge.length,
          room: result.room.length,
          hasData: result.frozen.length > 0 || result.fridge.length > 0 || result.room.length > 0,
          rawData: data,
          userId: user?.id,
          apiUrl: apiUrl
        });
        return result;
      } else {
        const errorText = await response.text();
        console.error('[MyFridge] DB 로드 실패: HTTP', response.status, response.statusText, {
          errorText: errorText,
          userId: user?.id,
          apiUrl: apiUrl,
          requestUrl: requestUrl,
          hasToken: !!token,
          tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
        });
        if (response.status === 401) {
          console.error('[MyFridge] 인증 실패 - 토큰이 만료되었을 수 있습니다.');
        } else if (response.status === 404) {
          console.error('[MyFridge] 사용자 또는 재료를 찾을 수 없습니다.');
        } else if (response.status >= 500) {
          console.error('[MyFridge] 서버 오류 발생');
        }
        return null;
      }
    } catch (error) {
      console.error('[MyFridge] DB에서 재료 로드 실패 (네트워크 오류):', {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: user?.id,
        apiUrl: (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app'
      });
      return null;
    }
  };

  // DB에 재료 저장 (재시도 로직 포함)
  const saveIngredientsToDB = async (frozen: Ingredient[], fridge: Ingredient[], room: Ingredient[], retryCount = 0, showStatus = false) => {
    if (!isLoggedIn || !user?.id) {
      if (showStatus) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
      return false;
    }
    
    const MAX_RETRIES = 3;
    
    if (showStatus && retryCount === 0) {
      setIsSaving(true);
      setSaveStatus('saving');
    }
    
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) {
        console.error('[MyFridge] DB 저장 실패: 토큰 없음');
        if (showStatus) {
          setIsSaving(false);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
        return false;
      }
      
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const requestBody = {
        ingredients: { frozen, fridge, room },
      };
      
      console.log('[MyFridge] DB 저장 요청 시작:', {
        url: `${apiUrl}/api/users/${user.id}/ingredients`,
        userId: user.id,
        frozenCount: frozen.length,
        fridgeCount: fridge.length,
        roomCount: room.length,
        hasToken: !!token
      });
      
      const response = await fetch(`${apiUrl}/api/users/${user.id}/ingredients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('[MyFridge] DB 저장 응답:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MyFridge] DB 저장 실패 응답:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json().catch(() => null);
      console.log('[MyFridge] DB에 재료 저장 성공:', {
        frozen: frozen.length,
        fridge: fridge.length,
        room: room.length,
        responseData: responseData
      });
      
      if (showStatus) {
        setIsSaving(false);
        setSaveStatus('success');
        // 저장 완료 후 1초 후 idle로 변경 (비활성화 상태 유지)
        setTimeout(() => {
          setSaveStatus('idle');
        }, 1000);
      }
      return true;
    } catch (error) {
      console.error('[MyFridge] DB에 재료 저장 실패:', error);
      
      // 재시도 로직
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // 지수 백오프: 1초, 2초, 4초
        console.log(`[MyFridge] ${delay}ms 후 재시도 (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveIngredientsToDB(frozen, fridge, room, retryCount + 1, showStatus);
      }
      
      console.error('[MyFridge] DB 저장 최종 실패: 모든 재시도 소진');
      if (showStatus) {
        setIsSaving(false);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
      return false;
    }
  };

  // 저장 버튼 클릭 핸들러
  const handleSaveClick = async () => {
    console.log('[MyFridge] 저장 버튼 클릭:', {
      isLoggedIn,
      userId: user?.id,
      frozen: frozen?.length,
      fridge: fridge?.length,
      room: room?.length,
      hasChanges
    });
    
    if (!isLoggedIn || !user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    if (frozen === null || fridge === null || room === null) {
      console.error('[MyFridge] 저장 실패: 재료 데이터가 null');
      return;
    }
    
    // 저장 중 토스트 표시
    setInfoToast({ text: '재료 저장중...' });
    
    const success = await saveIngredientsToDB(frozen, fridge, room, 0, true);
    console.log('[MyFridge] 저장 결과:', success);
    
    if (success) {
      // 저장 성공 시 마지막 저장된 데이터 업데이트
      lastSavedDataRef.current = {
        frozen: [...frozen],
        fridge: [...fridge],
        room: [...room]
      };
      setHasChanges(false);
      
      // 저장 완료 표시
      setInfoToast({ text: '재료 저장완료' });
      setTimeout(() => setInfoToast(null), 3000);
      
      // 저장 후 DB에서 다시 로드하여 확인
      setTimeout(async () => {
        const verifyData = await loadIngredientsFromDB();
        if (verifyData) {
          console.log('[MyFridge] 저장 후 검증 - DB에서 로드한 데이터:', {
            frozen: verifyData.frozen.length,
            fridge: verifyData.fridge.length,
            room: verifyData.room.length
          });
        } else {
          console.warn('[MyFridge] 저장 후 검증 실패 - DB에서 데이터를 로드할 수 없음');
        }
      }, 1000);
    } else {
      setInfoToast({ text: '저장 실패' });
      setTimeout(() => setInfoToast(null), 3000);
      alert('저장에 실패했습니다. 브라우저 콘솔을 확인해주세요.');
    }
  };

  // 변경사항 감지
  React.useEffect(() => {
    if (isInitialLoad.current || frozen === null || fridge === null || room === null) {
      return;
    }

    // 마지막 저장된 데이터와 비교
    if (lastSavedDataRef.current === null) {
      // 아직 저장된 적이 없으면 변경사항 있음으로 표시
      setHasChanges(true);
      return;
    }

    // 데이터 비교 함수
    const compareIngredients = (a: Ingredient[], b: Ingredient[]): boolean => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
      const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));
      return sortedA.every((ing, idx) => {
        const other = sortedB[idx];
        return ing.id === other.id && 
               ing.name === other.name && 
               ing.expiry === other.expiry && 
               ing.purchase === other.purchase;
      });
    };

    const hasChanged = 
      !compareIngredients(frozen, lastSavedDataRef.current.frozen) ||
      !compareIngredients(fridge, lastSavedDataRef.current.fridge) ||
      !compareIngredients(room, lastSavedDataRef.current.room);

    setHasChanges(hasChanged);
  }, [frozen, fridge, room]);

  // 로그인 후 가이드 표시 로직
  React.useEffect(() => {
    // 로그인 상태가 변경되고, 로그인 후 가이드를 표시해야 하는 플래그가 있으면 가이드 표시
    if (isLoggedIn && user?.id) {
      const showGuideAfterLogin = localStorage.getItem('show_guide_after_login');
      const guideShown = localStorage.getItem('myfridge_guide_shown');
      
      if (showGuideAfterLogin === 'true' && !guideShown) {
        // 플래그 제거
        localStorage.removeItem('show_guide_after_login');
        
        // 약간의 지연 후 가이드 표시 (페이지 렌더링 완료 후)
        setTimeout(() => {
          markUsageGuideOpened();
          setShowGuide(true);
          setGuideStep(0);
        }, 500);
      }
    }
  }, [isLoggedIn, user?.id]);

  React.useEffect(() => {
    if (loading || showWelcomeModal || showGuide) return;
    if (!isUsageGuideDueThisVisit()) return;
    if (sessionStorage.getItem(ONBOARDING_KEYS.usageGuideStartedThisVisit) === 'true') return;

    const urlParams = new URLSearchParams(window.location.search);
    const forceShowWelcome = urlParams.get('showWelcome') === 'true';
    const welcomeModalShown = localStorage.getItem('welcome_modal_shown');

    if (forceShowWelcome || !welcomeModalShown) {
      markUsageGuideOpened();
      localStorage.setItem('welcome_modal_shown', 'true');
      const timer = setTimeout(() => setShowWelcomeModal(true), 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      markUsageGuideOpened();
      setShowGuide(true);
      setGuideStep(0);
    }, 500);

    return () => clearTimeout(timer);
  }, [loading, showWelcomeModal, showGuide]);

  // 로그인 상태 변경 시 localStorage → DB 동기화
  React.useEffect(() => {
    const syncLocalStorageToDB = async () => {
      // 비회원 → 회원 전환 시 localStorage 데이터를 DB에 저장
      if (isLoggedIn && user?.id) {
        const localData = loadIngredients();
        const hasLocalData = localData.frozen.length > 0 || localData.fridge.length > 0 || localData.room.length > 0;
        
        if (hasLocalData) {
          // DB에 데이터가 있는지 확인
          const dbData = await loadIngredientsFromDB();
          const hasDbData = dbData && (dbData.frozen.length > 0 || dbData.fridge.length > 0 || dbData.room.length > 0);
          
          // DB에 데이터가 없으면 localStorage 데이터를 DB에 저장
          if (!hasDbData) {
            console.log('[MyFridge] 비회원 → 회원 전환: localStorage 데이터를 DB에 동기화:', {
              frozen: localData.frozen.length,
              fridge: localData.fridge.length,
              room: localData.room.length
            });
            await saveIngredientsToDB(localData.frozen, localData.fridge, localData.room);
          }
        }
      }
    };
    
    syncLocalStorageToDB();
  }, [isLoggedIn, user?.id]);

  React.useEffect(() => {
    let isMounted = true; // 컴포넌트가 마운트되어 있는지 추적
    let timeoutId: NodeJS.Timeout | null = null;
    
    // 로그인 상태 변경 시 ref 초기화
    if (!isLoggedIn || !user?.id) {
      // 로그아웃 시 ref 초기화
      isInitialLoad.current = true;
      dataLoadedRef.current = false;
      dbLoadAttempted.current = false;
      dbLoadFailed.current = false;
    }
    
    const loadData = async () => {
      try {
        // 로그인한 사용자는 DB를 우선적으로 사용
        if (isLoggedIn && user?.id) {
          dbLoadAttempted.current = true; // DB 로드 시도 표시
          // DB 로드를 최대 3번 재시도
          let dbData = null;
          let retryCount = 0;
          const MAX_RETRIES = 3;
          
          while (retryCount < MAX_RETRIES && !dbData) {
            try {
              dbData = await loadIngredientsFromDB();
              if (dbData !== null) {
                // DB 데이터를 성공적으로 로드했으면 반복 종료
                dbLoadFailed.current = false; // 성공
                break;
              }
            } catch (dbError) {
              console.error(`[MyFridge] DB 로드 시도 ${retryCount + 1}/${MAX_RETRIES} 실패:`, dbError);
            }
            
            // 재시도 전 대기
            if (retryCount < MAX_RETRIES - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 지수 백오프
            }
            retryCount++;
          }
          
          if (isMounted) {
            if (dbData !== null) {
              // DB 데이터가 있으면 (빈 배열이어도) DB 데이터 사용 (우선)
              console.log('[MyFridge] DB에서 재료 로드 성공:', {
                frozen: dbData.frozen.length,
                fridge: dbData.fridge.length,
                room: dbData.room.length
              });
              dataLoadedRef.current = true; // 데이터 로드 완료 표시
              setFrozen(dbData.frozen);
              setFridge(dbData.fridge);
              setRoom(dbData.room);
              // DB 데이터를 localStorage에도 동기화 (백업용)
              saveIngredients(dbData.frozen, dbData.fridge, dbData.room);
              // 마지막 저장된 데이터로 설정 (변경사항 없음)
              lastSavedDataRef.current = {
                frozen: [...dbData.frozen],
                fridge: [...dbData.fridge],
                room: [...dbData.room]
              };
              setHasChanges(false);
              isInitialLoad.current = false;
              dbLoadFailed.current = false; // 성공
              setLoading(false);
              return;
            } else {
              // DB 로드가 완전히 실패
              dbLoadFailed.current = true;
              console.warn('[MyFridge] DB 로드 실패 - localStorage 확인');
              const localData = loadIngredients();
              const hasLocalData = localData.frozen.length > 0 || localData.fridge.length > 0 || localData.room.length > 0;
              
              if (hasLocalData) {
                // localStorage에 데이터가 있으면 DB에 동기화
                console.log('[MyFridge] localStorage 데이터를 DB에 동기화:', {
                  frozen: localData.frozen.length,
                  fridge: localData.fridge.length,
                  room: localData.room.length
                });
                dataLoadedRef.current = true; // 데이터 로드 완료 표시
                setFrozen(localData.frozen);
                setFridge(localData.fridge);
                setRoom(localData.room);
                lastSavedDataRef.current = {
                  frozen: [...localData.frozen],
                  fridge: [...localData.fridge],
                  room: [...localData.room]
                };
                setHasChanges(false);
                isInitialLoad.current = false;
                setLoading(false);
                // DB에 저장 시도
                saveIngredientsToDB(localData.frozen, localData.fridge, localData.room).catch(err => {
                  console.error('[MyFridge] DB 저장 실패:', err);
                });
                return;
              } else {
                // localStorage에도 없으면 빈 상태로 유지
                // 하지만 사용자에게 알림을 표시하거나 재시도 로직 추가
                console.error('[MyFridge] DB와 localStorage 모두 비어있음 - 빈 상태로 유지', {
                  userId: user?.id,
                  isLoggedIn,
                  dbLoadAttempted: dbLoadAttempted.current,
                  dbLoadFailed: dbLoadFailed.current,
                  warning: 'DB에서 재료를 로드할 수 없습니다. 네트워크 연결을 확인해주세요.'
                });
                dataLoadedRef.current = true; // 빈 상태라도 로드 완료 표시
                setFrozen([]);
                setFridge([]);
                setRoom([]);
                isInitialLoad.current = false;
                setLoading(false);
                // 사용자에게 알림 (선택사항)
                // setInfoToast({ text: '재료를 불러올 수 없습니다. 네트워크를 확인해주세요.' });
                return;
              }
            }
          }
        } else {
          // 비로그인 사용자는 localStorage만 사용
          const loaded = loadIngredients();
          if (isMounted) {
            dataLoadedRef.current = true; // 데이터 로드 완료 표시
            setFrozen(loaded.frozen);
            setFridge(loaded.fridge);
            setRoom(loaded.room);
            isInitialLoad.current = false;
            setLoading(false);
            return;
          }
        }
        
        // DB에도 localStorage에도 없으면 빈 상태로 시작
        if (isMounted) {
          dataLoadedRef.current = true; // 빈 상태라도 로드 완료 표시
          setFrozen([]);
          setFridge([]);
          setRoom([]);
          isInitialLoad.current = false;
          setLoading(false);
        }
      } catch (error) {
        console.error('[MyFridge] 데이터 로드 중 오류 발생:', error);
        // 에러 발생 시에도 빈 상태로 시작하여 화면이 표시되도록 함
        if (isMounted) {
          setFrozen([]);
          setFridge([]);
          setRoom([]);
          isInitialLoad.current = false;
          setLoading(false);
        }
      }
    };
    
    // 타임아웃 설정: 10초 후에는 무조건 화면 표시 (단, 데이터가 이미 로드되었으면 스킵)
    timeoutId = setTimeout(() => {
      if (isMounted && !dataLoadedRef.current && (frozen === null || fridge === null || room === null || loading)) {
        console.warn('[MyFridge] 로딩 타임아웃 - 빈 상태로 강제 표시', {
          dataLoaded: dataLoadedRef.current,
          frozen: frozen,
          fridge: fridge,
          room: room,
          loading: loading
        });
        dataLoadedRef.current = true; // 타임아웃으로 인한 로드 완료 표시
        setFrozen([]);
        setFridge([]);
        setRoom([]);
        isInitialLoad.current = false;
        setLoading(false);
      } else if (isMounted && dataLoadedRef.current) {
        console.log('[MyFridge] 타임아웃 발생했지만 데이터가 이미 로드됨 - 스킵');
      }
    }, 10000); // 5초 -> 10초로 증가
    
    loadData();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoggedIn, user?.id]);

  React.useEffect(() => {
    console.log('[MyFridge] CSV 파일 로드 시작');
    
    // CSV 파일을 localStorage에 캐싱하여 한 번만 로드
    const CSV_CACHE_KEY = 'ingredient_dict_cache';
    const CSV_CACHE_VERSION = '1.1'; // CSV 파싱 로직 개선으로 버전 업데이트
    
    const loadCachedCSV = async () => {
      try {
        // 모바일 환경에서 localStorage 접근이 실패할 수 있으므로 안전하게 처리
        if (typeof window === 'undefined' || !window.localStorage) {
          console.warn('[MyFridge] localStorage를 사용할 수 없습니다. CSV 파일을 새로 로드합니다.');
          // localStorage가 없으면 바로 CSV 파일 로드
        } else {
          // 캐시 확인
          const cached = localStorage.getItem(CSV_CACHE_KEY);
          if (cached) {
          const parsedCache = JSON.parse(cached);
          if (parsedCache.version === CSV_CACHE_VERSION && parsedCache.data) {
            console.log('[MyFridge] 캐시된 재료 사전 사용');
            initializeIngredients(parsedCache.data);
            return;
          }
        }
        }
        
        // 캐시가 없거나 버전이 다르면 새로 로드
        console.log('[MyFridge] CSV 파일 새로 로드');
        const response = await fetch('/ingredient_profile_dict_with_substitutes.csv');
        if (!response.ok) {
          throw new Error(`CSV 파일 로드 실패: ${response.status} ${response.statusText}`);
        }
        
        const csv = await response.text();
        console.log('[MyFridge] CSV 파일 로드 완료, 파싱 시작');
        
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const synonymsIdx = header.indexOf('synonyms');
        const categoryIdx = header.indexOf('대분류');
        
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
          result.push(current.trim()); // 마지막 필드
          return result;
        };
        
        const ingredients = {};
        
        lines.slice(1).forEach(line => {
          if (!line.trim()) return; // 빈 줄 스킵
          
          const values = parseCSVLine(line);
          const keyword = values[nameIdx]?.trim();
          const synonymsStr = values[synonymsIdx]?.trim();
          const category = values[categoryIdx]?.trim();
          
          if (keyword && category === '재료') {
            // keyword를 keyword로 매핑
            ingredients[keyword] = keyword;
            
            // synonyms 파싱 (쉼표로 구분, 빈 값 제거)
            if (synonymsStr) {
              const synonyms = synonymsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
              synonyms.forEach(synonym => {
                if (synonym) {
                  ingredients[synonym] = keyword;
                }
              });
            }
          }
        });
        
        console.log('[MyFridge] CSV 파싱 완료, 재료 사전 크기:', Object.keys(ingredients).length);
        
        // 캐시에 저장 (localStorage가 사용 가능한 경우에만)
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(CSV_CACHE_KEY, JSON.stringify({
              version: CSV_CACHE_VERSION,
              data: ingredients,
              timestamp: Date.now()
            }));
          } catch (storageError) {
            console.warn('[MyFridge] CSV 캐시 저장 실패:', storageError);
          }
        }
        
        initializeIngredients(ingredients);
      } catch (error) {
        console.error('[MyFridge] CSV 파일 로드 실패 - 빈 재료 사전으로 초기화 진행:', error);
        initializeIngredients({});
      }
    };
    
    const initializeIngredients = (ingredients: { [key: string]: string }) => {
      setIngredientDict(ingredients);
      
      // 재료 사전만 설정하고, 초기 재료 추가는 별도 useEffect에서 처리
      // (재료 데이터가 로드된 후에만 실행되도록)
    };
    
    loadCachedCSV();
  }, []); // CSV는 한 번만 로드
  
  // 초기 재료 추가는 별도 useEffect로 분리
  React.useEffect(() => {
    // 재료 사전이 로드되고, 재료가 비어있고, 로딩이 완료된 경우에만 초기 재료 추가
    // 로그인한 사용자는 DB 로드가 완전히 실패하고 localStorage에도 없을 때만 초기 재료 추가
    if (!loading && Object.keys(ingredientDict).length > 0) {
      const isEmpty = (!fridge || fridge.length === 0) && 
                      (!room || room.length === 0) && 
                      (!frozen || frozen.length === 0);
      
      // 로그인한 사용자는 DB 로드가 완전히 실패하고 localStorage에도 없을 때만 초기 재료 추가
      // (DB 로드가 진행 중이거나 성공했으면 초기 재료 추가 안 함)
      const shouldAddInitialIngredients = isEmpty && (
        !isLoggedIn || !user?.id || // 비회원
        (dbLoadAttempted.current && dbLoadFailed.current && loadIngredients().frozen.length === 0 && loadIngredients().fridge.length === 0 && loadIngredients().room.length === 0) // 회원이지만 DB 로드 실패하고 localStorage도 비어있음
      );
      
      if (shouldAddInitialIngredients) {
          // 초기 재료 추가 중이므로 useEffect에서 저장하지 않도록 플래그 설정
          isInitialLoad.current = true;
          
          // 기본 재료 목록 정의
          // 실온보관: 11개
          const defaultRoomIngredients = [
            '소금', '설탕', '간장', '식용유', '참기름', '후추', '올리고당', '물엿', '식초', '라면', '알룰로스'
          ];
          // 냉장보관: 17개
          const defaultFridgeIngredients = [
            '마늘', '대파', '달걀', '된장', '고추장', '고춧가루', '밀가루', '전분', '미림', '맛술', '양파', '감자', '당근', '두부', '우유', '김치', '멸치'
          ];
          // 냉동보관: 3개
          const defaultFrozenIngredients = [
            '돼지고기', '닭고기', '만두'
          ];
          
          // 재료 이름을 keyword로 변환 (synonym -> keyword)
          // 재료 사전에 없으면 원래 이름 사용
          const convertToKeyword = (name: string): string => {
            // ingredientDict 상태 사용
            // 직접 매칭 시도
            if (ingredientDict[name]) {
              return ingredientDict[name];
            }
            // 대소문자 무시하고 찾기
            const foundKey = Object.keys(ingredientDict).find(
              key => key.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (foundKey) {
              return ingredientDict[foundKey];
            }
            // 공백 제거 후 찾기
            const foundKeyNoSpace = Object.keys(ingredientDict).find(
              key => key.replace(/\s/g, '').toLowerCase() === name.replace(/\s/g, '').toLowerCase()
            );
            if (foundKeyNoSpace) {
              return ingredientDict[foundKeyNoSpace];
            }
            // 못 찾으면 원래 이름 반환
            console.warn(`[MyFridge] 재료 사전에서 "${name}"을 찾을 수 없습니다. 원래 이름 사용.`);
            return name;
          };
          
          // 실온보관 재료 추가
          const newRoom = defaultRoomIngredients.map((name, index) => ({
            id: `room-${Date.now()}-${index}`,
            name: convertToKeyword(name)
          }));
          
          /**
           * 기본 재료 중 **두 가지에만** 구매일을 넣어 둔다.
           *
           * 왜 두 개만:
           *   D-표기가 어떤 기능인지는 실제로 하나 붙어 있어야 알 수 있다.
           *   그렇다고 전부 넣으면 화면이 D-표기로 뒤덮이고, 앱을 오래 안 열면
           *   전부 `지남` 으로 바뀌어 고장난 것처럼 보인다.
           *
           * 왜 유통기한이 아니라 구매일:
           *   사용자가 직접 넣지도 않은 유통기한을 채워 두면 거짓 정보가 된다.
           *   구매일(= 앱을 처음 연 날)은 사실이고, 거기서 짐작한 값은 `약 D-30` 처럼
           *   추정임을 밝혀 표시되므로 오해가 없다.
           *
           * 왜 달걀·감자:
           *   냉장 기준 30일·21일이라 한동안 의미 있는 숫자가 보인다.
           *   우유(7일) 같은 것은 일주일 만에 `지남` 이 되어 예시로 쓰기 나쁘다.
           */
          const today = new Date();
          const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
          const SAMPLE_PURCHASE_ITEMS = ['달걀', '감자'];

          // 냉장보관 재료 추가
          const newFridge = defaultFridgeIngredients.map((name, index) => {
            const keyword = convertToKeyword(name);
            const item: Ingredient = {
              id: `fridge-${Date.now()}-${index}`,
              name: keyword
            };
            if (SAMPLE_PURCHASE_ITEMS.includes(name)) {
              item.purchase = todayStr;
            }
            return item;
          });
          
          // 냉동보관 재료 추가
          const newFrozen = defaultFrozenIngredients.map((name, index) => ({
            id: `frozen-${Date.now()}-${index}`,
            name: convertToKeyword(name)
          }));
          
          // 디버깅: 저장되는 재료 이름 확인
          console.log('[MyFridge] 초기 재료 추가:', {
            room: newRoom.map(r => r.name),
            fridge: newFridge.map(r => r.name),
            ingredientDictSample: Object.keys(ingredientDict).slice(0, 30) // 재료 사전 샘플 확인
          });
          
          // 재료 사전에서 특정 재료 찾기 테스트
          console.log('[MyFridge] 재료 사전 검색 테스트:', {
            '소금': ingredientDict['소금'],
            '설탕': ingredientDict['설탕'],
            '간장': ingredientDict['간장'],
            '식용유': ingredientDict['식용유'],
            '참기름': ingredientDict['참기름'],
            '후추': ingredientDict['후추'],
            '밥': ingredientDict['밥'],
            '양파': ingredientDict['양파'],
            '감자': ingredientDict['감자'],
            '식초': ingredientDict['식초'],
            '고춧가루': ingredientDict['고춧가루'],
            '밀가루': ingredientDict['밀가루'],
            '마늘': ingredientDict['마늘'],
            '케첩': ingredientDict['케첩'],
            '우유': ingredientDict['우유'],
            '된장': ingredientDict['된장'],
            '고추장': ingredientDict['고추장'],
            '참치캔': ingredientDict['참치캔'],
            '대파': ingredientDict['대파'],
            '청양고추': ingredientDict['청양고추'],
            '달걀': ingredientDict['달걀'],
            '계란': ingredientDict['계란']
          });
          
          setRoom(newRoom);
          setFridge(newFridge);
          setFrozen(newFrozen);
          
          // localStorage에도 저장 (즉시 저장)
          console.log('[MyFridge] 초기 재료 저장 시작:', {
            frozen: newFrozen.length,
            fridge: newFridge.length,
            room: newRoom.length
          });
          
          saveIngredients(newFrozen, newFridge, newRoom);
          // 로그인한 경우 DB에도 저장
          if (isLoggedIn && user?.id) {
            saveIngredientsToDB(newFrozen, newFridge, newRoom).then(success => {
              if (!success) {
                console.error('[MyFridge] 초기 재료 DB 저장 실패');
              }
            });
          }
          
          // 초기 재료 추가 완료 후 초기 로드 플래그 해제
          isInitialLoad.current = false;
          
          // 처음 방문한 사용자에게만 Welcome 모달 표시
          // 개발/테스트용: URL에 ?showWelcome=true 추가하면 강제로 모달 표시
          const urlParams = new URLSearchParams(window.location.search);
          const forceShowWelcome = urlParams.get('showWelcome') === 'true';
          const welcomeModalShown = localStorage.getItem('welcome_modal_shown');
          
          if (forceShowWelcome || !welcomeModalShown) {
            markUsageGuideOpened();
            if (!forceShowWelcome) {
              localStorage.setItem('welcome_modal_shown', 'true');
            }
            // 약간의 지연 후 모달 표시 (재료가 화면에 렌더링된 후)
            setTimeout(() => {
              setShowWelcomeModal(true);
            }, 500);
          }
          
          // 저장 확인 (약간의 지연 후)
          setTimeout(() => {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            console.log('[MyFridge] localStorage 저장 확인:', {
              saved: saved,
              savedKeys: saved ? Object.keys(saved) : null,
              newRoom: newRoom,
              newFridge: newFridge,
              roomCount: newRoom.length,
              fridgeCount: newFridge.length,
              savedRoomCount: saved?.room?.length || 0,
              savedFridgeCount: saved?.fridge?.length || 0,
              rawStorage: localStorage.getItem(STORAGE_KEY)?.substring(0, 100) // 처음 100자만
            });
            
            // 같은 탭에서 변경을 알리기 위해 CustomEvent 발생
            window.dispatchEvent(new CustomEvent('localStorageChange', {
              detail: { key: STORAGE_KEY }
            }));
          }, 100);
        }
    }
  }, [loading, ingredientDict, frozen, fridge, room, isLoggedIn, user?.id]);

  // URL 파라미터로 모달 강제 표시 (개발/테스트용)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceShowWelcome = urlParams.get('showWelcome') === 'true';
    
    if (forceShowWelcome && !loading) {
      // 페이지 로드 완료 후 모달 표시
      setTimeout(() => {
        markUsageGuideOpened();
        setShowWelcomeModal(true);
      }, 500);
    }
  }, [loading]);

  React.useEffect(() => {
    // 초기 로드가 완료된 후에만 저장 (초기 로드 시에는 저장하지 않음)
    // 또한 빈 배열로 덮어쓰는 것을 방지 (데이터가 실제로 있을 때만 저장)
    if (!isInitialLoad.current && frozen !== null && fridge !== null && room !== null) {
      // localStorage 는 항상 저장 (비로그인 사용자용 + 백업용)
      saveIngredients(frozen, fridge, room);

      // ⚠️ 예전에는 `hasData` 가 참일 때만 저장해서, 재료를 **전부 지우면 저장 자체를
      //    건너뛰었다.** 서버엔 예전 목록이 남아 다음 로그인 때 지운 재료가 되살아났음.
      //    빈 상태도 정상적인 상태이므로 그대로 저장한다.
      if (isLoggedIn && user?.id) {
        // 연속 변경 시 요청이 겹쳐 늦게 출발한 요청이 먼저 도착하면 옛 데이터가
        // 최신을 덮어쓸 수 있음 → 짧게 묶어서(디바운스) 마지막 상태만 보낸다.
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        const snapshot = { frozen, fridge, room };
        autoSaveTimer.current = setTimeout(() => {
          const seq = ++autoSaveSeq.current;
          setSaveStatus('saving');
          saveIngredientsToDB(snapshot.frozen, snapshot.fridge, snapshot.room, 0, false)
            .then((ok) => {
              // 더 최신 저장이 이미 시작됐으면 이 결과는 버린다 (순서 역전 방지)
              if (seq !== autoSaveSeq.current) return;
              setSaveStatus(ok ? 'success' : 'error');
              if (ok) setTimeout(() => setSaveStatus('idle'), 2000);
            })
            .catch(() => {
              if (seq !== autoSaveSeq.current) return;
              setSaveStatus('error');
            });
        }, 600);
      }
    }
  }, [frozen, fridge, room, isLoggedIn, user?.id]);

  // Modify the autocomplete logic to use the synonyms
  // ingredientDict 구조: { '동의어': 'keyword', 'keyword': 'keyword' }
  // 예: { '계란': '달걀', '달걀': '달걀' }
  const combinedFiltered = Object.entries(ingredientDict)
    .filter(([key, value]) => {
      if (!inputValue) return false;
      const inputLower = inputValue.toLowerCase();
      const keyLower = key.toLowerCase();
      const valueLower = value.toLowerCase();
      // 동의어(key)나 keyword(value)에 입력값이 포함되어 있으면 표시
      return keyLower.includes(inputLower) || valueLower.includes(inputLower);
    })
    .map(([key, value]) => value) // keyword만 반환
    .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
    .sort((a, b) => {
      if (!inputValue) return 0;
      const inputLower = inputValue.toLowerCase();
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // 입력값의 첫 글자
      const firstChar = inputValue[0];
      
      // 1순위: 정확한 매칭 (대소문자 무시)
      const aExact = aLower === inputLower;
      const bExact = bLower === inputLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // 2순위: 첫 글자로 시작하는 단어들
      const aStartsWithFirstChar = a.startsWith(firstChar);
      const bStartsWithFirstChar = b.startsWith(firstChar);
      if (aStartsWithFirstChar && !bStartsWithFirstChar) return -1;
      if (!aStartsWithFirstChar && bStartsWithFirstChar) return 1;
      
      // 3순위: 입력값으로 시작하는 단어들
      const aStartsWithInput = aLower.startsWith(inputLower);
      const bStartsWithInput = bLower.startsWith(inputLower);
      if (aStartsWithInput && !bStartsWithInput) return -1;
      if (!aStartsWithInput && bStartsWithInput) return 1;
      
      // 4순위: 길이 순으로 정렬 (짧은 것 우선)
      return a.length - b.length;
    });

  // 디버깅용: 입력값과 매칭되는 항목들 확인
  console.log('[MyFridge] 자동완성 디버깅:', {
    입력값: inputValue,
    필터링된결과: combinedFiltered,
    ingredientDict크기: Object.keys(ingredientDict).length,
    계란매핑: ingredientDict['계란'],
    달걀매핑: ingredientDict['달걀'],
    계란으로시작하는키: Object.keys(ingredientDict).filter(k => k.includes('계란')),
    달걀으로시작하는키: Object.keys(ingredientDict).filter(k => k.includes('달걀'))
  });

  // (제거됨) 예전에는 스크롤바를 강제로 보이게 하려고 드롭다운이 열릴 때
  //   scrollTop 을 3 → 0 → 2 → 0 → 1 → 0 으로 튕기고, 그걸 50ms·150ms·300ms
  //   세 번 반복 실행했다. 그래서 드롭다운이 열릴 때마다 목록이 눈에 띄게 떨렸다.
  //   스크롤바는 CSS(.custom-scrollbar)로 표시하면 되므로 이 조작은 필요 없다.

  const showToast = (message: string, deleted: DeletedInfo, duration?: number) => {
    setToast({ visible: true, message, deleted });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), duration ?? TOAST_DURATION);
  };

  const prepNoticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * "아직 준비 중인 기능" 안내.
   * `showToast` 는 '삭제 취소' 버튼이 함께 붙는 토스트라 단순 안내에는 맞지 않고,
   * `alert` 는 OS 창이라 앱 밖의 일처럼 보이고 확인을 눌러야만 사라진다.
   */
  const showPrepNotice = (text: string) => {
    setInfoToast({ text });
    if (prepNoticeTimer.current) clearTimeout(prepNoticeTimer.current);
    prepNoticeTimer.current = setTimeout(() => setInfoToast(null), 3000);
  };

  const removeTag = (box: StorageBox, tag: string) => {
    let prev: Ingredient[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    const deletedIngredient = prev.find(t => t.id === tag);
    const newTags = prev.filter(t => t.id !== tag);
    const deleted: DeletedInfo = { 
      type: 'single', 
      box, 
      tags: [tag],
      ingredients: deletedIngredient ? [deletedIngredient] : []
    };
    if (box === 'frozen') setFrozen(newTags);
    if (box === 'fridge') setFridge(newTags);
    if (box === 'room') setRoom(newTags);
    showToast('삭제됨.', deleted);
  };

  const removeAll = (box: StorageBox) => {
    let prev: Ingredient[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    const deleted: DeletedInfo = { 
      type: 'all', 
      box, 
      tags: prev.map(t => t.id),
      ingredients: [...prev] // 전체 재료 정보 저장
    };
    if (box === 'frozen') setFrozen([]);
    if (box === 'fridge') setFridge([]);
    if (box === 'room') setRoom([]);
    showToast('모두 삭제됨.', deleted, 7000);
  };

  // '네' 버튼 클릭 시 삭제 확정 (토스트만 닫기)
  const undoDelete = () => {
    setToast(null);
  };
  
  // '아니요' 버튼 클릭 시 삭제 취소 (재료 복원)
  const handleCancelDelete = () => {
    if (!toast?.deleted) {
      setToast(null);
      return;
    }
    const deleted = toast.deleted;
    if (deleted.ingredients && deleted.ingredients.length > 0) {
      // 저장된 재료 정보를 사용하여 복원
      if (deleted.box === 'frozen') {
        setFrozen(prev => deleted.type === 'all' ? deleted.ingredients! : [...(prev ?? []), ...deleted.ingredients!]);
      } else if (deleted.box === 'fridge') {
        setFridge(prev => deleted.type === 'all' ? deleted.ingredients! : [...(prev ?? []), ...deleted.ingredients!]);
      } else if (deleted.box === 'room') {
        setRoom(prev => deleted.type === 'all' ? deleted.ingredients! : [...(prev ?? []), ...deleted.ingredients!]);
      }
    }
    setToast(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (item: string) => {
    // 이미 등록된 재료인지 확인
    const allIngredients = [
      ...(frozen || []).map(i => typeof i === 'string' ? i : i.name),
      ...(fridge || []).map(i => typeof i === 'string' ? i : i.name),
      ...(room || []).map(i => typeof i === 'string' ? i : i.name)
    ];
    
    if (allIngredients.includes(item)) {
      alert('이미 존재하는 재료입니다.');
      setInputValue('');
      setShowDropdown(false);
      return;
    }
    
    // 모바일에서 입력창에 포커스가 남아 있으면 키보드가 그대로 떠서 팝업을 가린다.
    // 팝업을 열기 전에 포커스를 풀어 키보드를 내린다.
    //
    // ⚠️ 예전에는 바로 아래에서 `inputRef.current?.focus()` 를 다시 불러
    // **방금 내린 키보드를 도로 올리고 있었다.** (다음 재료를 이어서 입력하라고 넣은
    // 코드였는데, 팝업이 뜨는 흐름에서는 키보드가 팝업을 가려 버린다.)
    // 다음 입력을 위한 포커스는 팝업을 닫은 뒤에 준다.
    (document.activeElement as HTMLElement | null)?.blur?.();

    setModalIngredient(item);
    setModalOpen(true);
    setInputValue('');
    setShowDropdown(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (combinedFiltered.length > 0) {
        // 자동완성 목록에서 첫 번째 항목 선택
        handleSelect(combinedFiltered[0]);
      } else if (inputValue.trim()) {
        // 입력된 값이 사전에 있는지 확인
        const exactMatch = ingredientDict[inputValue.trim()];
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          // 사전에 없는 경우 경고 표시
          alert('사전에 등록되지 않은 재료입니다. 자동완성 목록에서 선택해주세요.');
        }
      }
    }
    if (e.key === 'Backspace' && inputValue === '' && (frozen && frozen.length > 0)) {
      setFrozen((frozen ?? []).slice(0, -1));
    }
  };

  // 재료 카테고리 표를 한 번 받아 둔다 (유통기한 추정에 필요)
  React.useEffect(() => {
    let alive = true;
    loadIngredientCategoryMap()
      .then(map => { if (alive) setCategoryMap(map); })
      .catch(() => { /* 표를 못 받으면 추정만 못 할 뿐, 나머지 기능은 그대로 동작 */ });
    return () => { alive = false; };
  }, []);

  /**
   * 이미 담겨 있는 재료의 추정 유통기한을 채운다.
   *
   * 이 기능이 생기기 전에 구매일만 넣어 둔 재료가 이미 있고, 그 재료들은
   * 저장 시점에 추정값을 계산할 기회가 없었다. 카테고리 표가 도착하면 한 번 훑어서
   * 채워 준다. 추정 기준이 바뀌었을 때 값이 갱신되도록 이미 있는 값도 다시 계산한다.
   */
  React.useEffect(() => {
    if (!Object.keys(categoryMap).length) return;

    const fill = (list: Ingredient[] | null, storage: StorageBox): Ingredient[] | null => {
      if (!list) return list;
      let changed = false;
      const next = list.map(item => {
        // 직접 넣은 유통기한이 있으면 추정하지 않는다
        if (item.expiry || !item.purchase) {
          if (item.estimatedExpiry) {
            changed = true;
            const { estimatedExpiry, ...rest } = item;
            return rest as Ingredient;
          }
          return item;
        }
        const est = estimateExpiry(item.name, storage, item.purchase, categoryMap);
        if (est === (item.estimatedExpiry ?? null)) return item;
        changed = true;
        if (!est) {
          const { estimatedExpiry, ...rest } = item;
          return rest as Ingredient;
        }
        return { ...item, estimatedExpiry: est };
      });
      return changed ? next : list;
    };

    setFrozen(prev => fill(prev, 'frozen'));
    setFridge(prev => fill(prev, 'fridge'));
    setRoom(prev => fill(prev, 'room'));
  }, [categoryMap]);

  const handleModalComplete = (data: { ingredient: string; storageType: StorageBox; hasExpiration: boolean; date: string | null; }, skipCheck: boolean = false) => {
    // 재료 사전에서 keyword로 변환 (synonym -> keyword)
    const ingredientKeyword = ingredientDict[data.ingredient] || data.ingredient;
    
    // 기존 재료를 수정하는 경우 (모달에서 재료 이름이 이미 있는 경우)
    const existingIngredient = [...(frozen || []), ...(fridge || []), ...(room || [])].find(
      ing => ing.name === ingredientKeyword
    );
    
    if (existingIngredient) {
      // 기존 재료 업데이트
      const updatedIngredient = { ...existingIngredient };
      if (data.hasExpiration && data.date) {
        updatedIngredient.expiry = data.date;
        delete updatedIngredient.purchase;
        delete updatedIngredient.estimatedExpiry;
      } else if (!data.hasExpiration && data.date) {
        updatedIngredient.purchase = data.date;
        delete updatedIngredient.expiry;
        // 구매일만 알아도 재료 종류와 보관 방법으로 기한을 짐작해 D-표기를 띄운다
        const est = estimateExpiry(ingredientKeyword, data.storageType, data.date, categoryMap);
        if (est) updatedIngredient.estimatedExpiry = est;
        else delete updatedIngredient.estimatedExpiry;
      } else {
        delete updatedIngredient.expiry;
        delete updatedIngredient.purchase;
        delete updatedIngredient.estimatedExpiry;
      }
      
      // 기존 위치에서 제거
      if (frozen?.some(ing => ing.id === existingIngredient.id)) {
        setFrozen(prev => prev?.filter(ing => ing.id !== existingIngredient.id) || null);
      }
      if (fridge?.some(ing => ing.id === existingIngredient.id)) {
        setFridge(prev => prev?.filter(ing => ing.id !== existingIngredient.id) || null);
      }
      if (room?.some(ing => ing.id === existingIngredient.id)) {
        setRoom(prev => prev?.filter(ing => ing.id !== existingIngredient.id) || null);
      }
      
      // 새 위치에 추가
      if (data.storageType === 'frozen') setFrozen(prev => prev ? [...prev, updatedIngredient] : [updatedIngredient]);
      if (data.storageType === 'fridge') setFridge(prev => prev ? [...prev, updatedIngredient] : [updatedIngredient]);
      if (data.storageType === 'room') setRoom(prev => prev ? [...prev, updatedIngredient] : [updatedIngredient]);
    } else {
      // 새 재료 추가 전에 10개 조건 체크 (skipCheck가 false일 때만)
      if (!skipCheck) {
        const currentCount = (frozen?.length || 0) + (fridge?.length || 0) + (room?.length || 0);
        const totalCount = currentCount + 1;
        
        // 재료 10개 이상 추가 시 회원가입 유도 (비회원일 때만)
        if (totalCount >= 10 && !isLoggedIn) {
          // 재료 추가 모달 닫기
          setModalOpen(false);
          setModalIngredient(null);
          // 재료 추가 전에 모달 표시
          setPendingIngredient(data);
          setShowRegisterModal(true);
          return;
        }
      }
      
      // 재료 추가
      const obj = { 
        id: `${ingredientKeyword}-${Date.now()}`,
        name: ingredientKeyword 
      } as Ingredient;
      if (data.hasExpiration && data.date) obj.expiry = data.date;
      if (!data.hasExpiration && data.date) {
        obj.purchase = data.date;
        const est = estimateExpiry(ingredientKeyword, data.storageType, data.date, categoryMap);
        if (est) obj.estimatedExpiry = est;
      }
      if (data.storageType === 'frozen') setFrozen(prev => prev ? [...prev, obj] : [obj]);
      if (data.storageType === 'fridge') setFridge(prev => prev ? [...prev, obj] : [obj]);
      if (data.storageType === 'room') setRoom(prev => prev ? [...prev, obj] : [obj]);
    }
    
    setModalOpen(false);
    setModalIngredient(null);
  };
  

  // 재료 pill 클릭 시 모달 열기
  const handleTagClick = (item: Ingredient) => {
    // 재료가 어느 보관 공간에 있는지 찾기
    let currentStorageType: 'frozen' | 'fridge' | 'room' | null = null;
    if (frozen && frozen.some(ing => ing.id === item.id)) {
      currentStorageType = 'frozen';
    } else if (fridge && fridge.some(ing => ing.id === item.id)) {
      currentStorageType = 'fridge';
    } else if (room && room.some(ing => ing.id === item.id)) {
      currentStorageType = 'room';
    }
    
    // 날짜 정보 확인 (yyyy.mm.dd 형식을 yyyy-mm-dd로 변환)
    const hasExpiry = !!item.expiry;
    const hasPurchase = !!item.purchase;
    const dateType = hasExpiry ? 'expiry' : (hasPurchase ? 'purchase' : null);
    let date = item.expiry || item.purchase || null;
    // 날짜가 yyyy.mm.dd 형식이면 yyyy-mm-dd로 변환
    if (date) {
      date = date.replace(/\./g, '-');
    }
    
    (document.activeElement as HTMLElement | null)?.blur?.();

    setModalIngredient(item.name);
    setModalInitialData({
      storageType: currentStorageType,
      date: date,
      dateType: dateType
    });
    setModalOpen(true);
  };

  const handleRemoveAll = (box: StorageBox) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      removeAll(box);
    }
  };

  // 초기 로딩 상태 체크 - 타임아웃 보호 추가
  const isLoading = frozen === null || fridge === null || room === null || loading;
  
  // 5초 이상 로딩 중이면 강제로 빈 상태로 표시
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('[MyFridge] 로딩 타임아웃 - 강제로 빈 상태 표시');
        if (frozen === null) setFrozen([]);
        if (fridge === null) setFridge([]);
        if (room === null) setRoom([]);
        setLoading(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading, frozen, fridge, room]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingIndicator fullscreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white w-full p-0 m-0 pb-24" style={{ paddingTop: 80 }}>
        {/* 타이틀+입력창 그룹 */}
        <div className="flex flex-col items-center justify-center w-full" style={{ marginBottom: 40 }}>
          <div className="flex items-center justify-between w-full max-w-[400px] px-5 mb-2" style={{ position: 'relative' }}>
            <h1 className="text-[18px] font-bold text-[#1A1A1E] text-center" style={{ flex: 1 }}>내 냉장고 재료 추가</h1>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', paddingLeft: 20, paddingRight: 20, width: '100%', boxSizing: 'border-box' }}>
          <div
            className="flex gap-2 mb-4"
            style={{
              width: '100%',
              maxWidth: 400,
              margin: '0 auto',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            {/* 버튼이 하나 늘면서 입력창이 눌려 플레이스홀더조차 잘렸다.
                (한 줄 폭 360px 에 입력 250 + 입력버튼 70 + 아이콘 40×2 + 여백 = 424px)
                입력창이 남는 폭을 다 갖도록 flex 를 바꾸고, 나머지를 조금씩 줄인다. */}
            <div style={{ position: 'relative', width: '100%', minWidth: 0, flex: '1 1 auto', overflow: 'visible', zIndex: 10 }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="재료명을 입력하세요"
                className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none"
                style={{
                  width: '100%',
                  height: 40,
                  fontFamily: 'Pretendard, sans-serif',
                }}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => { setShowDropdown(true); setDropdownAtEnd(false); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
              />
              {showDropdown && combinedFiltered.length > 0 && (
                /* 모바일은 스크롤바가 '만졌을 때만' 잠깐 나타나는 방식이라,
                   목록이 더 있다는 사실이 손을 대기 전에는 보이지 않았다.
                   (CSS 로 스크롤바를 상시 표시하려 해도 iOS/안드로이드는 OS 방식이 이긴다)
                   → 아래쪽에 흐려지는 띠를 얹어 "아래로 더 있다" 를 눈으로 알린다.
                   맨 아래까지 내리면 띠를 없애 다 봤다는 것도 알 수 있게 한다. */
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4 }}>
                <div 
                  ref={dropdownRef}
                  className="bg-white border border-gray-300 rounded-lg shadow-lg z-[10] custom-scrollbar" 
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setDropdownAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
                  }}
                  style={{ 
                    maxHeight: '96px', // 3개 항목 기준 (각 항목 약 32px: py-2 = 8px*2 + 텍스트 높이)
                    overflowY: 'scroll', // 'auto' 대신 'scroll'로 변경하여 항상 스크롤바 표시
                    overflowX: 'hidden',
                    // 바깥 래퍼가 이미 절대 배치라, 여기까지 absolute 로 두면
                    // 래퍼 높이가 0이 되어 아래쪽 '더 있음' 표시가 엉뚱한 곳에 붙는다
                    position: 'relative',
                    // 스크롤바 항상 표시 강제
                    scrollbarWidth: 'auto', // thin 대신 auto로 변경
                    scrollbarColor: '#6A6A73 #F5F5F7', // 더 진한 색상으로 변경
                    WebkitOverflowScrolling: 'touch', // 모바일 스크롤 부드럽게
                    // 스크롤 가능함을 시각적으로 표시
                    paddingRight: combinedFiltered.length > 3 ? '16px' : '0',
                    boxSizing: 'border-box'
                  }}
                >
                  {combinedFiltered.map((item) => (
                    <div
                      key={item}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      // onClick 은 입력창의 onBlur 뒤에 실행돼 순서 경합이 생긴다.
                      // onMouseDown 은 blur 보다 먼저라 선택이 확실히 잡힌다.
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                      style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        height: '32px', // 각 항목 높이 고정
                        lineHeight: '16px', // 텍스트 높이
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                {combinedFiltered.length > 3 && !dropdownAtEnd && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 1,
                      right: 1,
                      bottom: 1,
                      height: 30,
                      borderBottomLeftRadius: 8,
                      borderBottomRightRadius: 8,
                      // 흐려지는 띠까지 깔았더니 마지막 항목 글자가 씻겨 나가 읽기 어려웠다.
                      // 알약 표시만으로도 "더 있다" 는 충분히 전달되므로 띠는 걷어낸다.
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'flex-end',
                      // 가운데 두면 마지막 항목 글자를 가린다 → 오른쪽으로 붙인다
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                      paddingBottom: 5,
                      pointerEvents: 'none',
                      // 목록에 `z-[10]` 이 걸려 있어서, z-index 를 안 주면
                      // 이 표시가 목록 뒤로 깔려 화면에 보이지 않는다
                      zIndex: 11,
                    }}
                  >
                    {/* 옅은 화살표만 두니 흰 배경에 묻혀 보이지 않았다.
                        회색 알약 안에 넣어 "여기 더 있다" 가 확실히 눈에 걸리게 한다. */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        height: 20,
                        padding: '0 8px',
                        borderRadius: 9999,
                        background: 'var(--ink-700)',
                        color: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {combinedFiltered.length - 3}개 더
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9.5l6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="bg-[#FFD600] text-[#1A1A1E] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition whitespace-nowrap"
              style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 18px', fontSize: 16, marginLeft: 0, alignSelf: 'flex-start' }}
              onClick={() => combinedFiltered.length > 0 && handleSelect(combinedFiltered[0])}
              disabled={combinedFiltered.length === 0}
            >
              입력
            </button>
            {/* 준비 중인 입력 방식 두 가지.
                지금은 눌러도 안내만 뜨지만, 이런 방법이 생긴다는 것을 미리 알려 두면
                "재료를 하나씩 쳐야 하나" 하고 지레 포기하는 일이 줄어든다.
                alert 대신 토스트를 쓰는 이유: alert 는 OS 창이라 앱 밖의 일처럼 보이고
                확인을 눌러야만 사라진다. */}
            <button
              type="button"
              className="bg-[#E6E6EA] text-[#1A1A1E] font-bold rounded-2xl px-2 py-2 text-sm shadow transition whitespace-nowrap focus:outline-none"
              style={{ display: 'flex', alignItems: 'center', height: 40, width: 40, minWidth: 40, flexShrink: 0, padding: 0, marginLeft: 0, border: '1px solid #E6E6EA', justifyContent: 'center', borderRadius: 20, alignSelf: 'flex-start' }}
              onClick={() => showPrepNotice('영수증을 찍으면 재료를 자동으로 담아 주는 기능을 준비하고 있어요.')}
              title="영수증 인식(준비 중)"
              aria-label="영수증으로 재료 담기(준비 중)"
            >
              {/* 예전에는 영수증만 PNG 이미지였다. 카메라는 선으로 그린 SVG 라
                  선 굵기와 농도가 서로 달라 나란히 두니 톤이 어긋나 보였음
                  → 둘 다 같은 굵기(1.7)의 선 아이콘으로 맞춘다 */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5.5 3.4l1.6 1.3 1.6-1.3 1.6 1.3 1.6-1.3 1.6 1.3 1.6-1.3 1.6 1.3V19a1.6 1.6 0 0 1-1.6 1.6H7.1A1.6 1.6 0 0 1 5.5 19z" />
                <path d="M8.6 8.2h6.8M8.6 11.6h6.8M8.6 15h4.2" />
              </svg>
            </button>
            <button
              type="button"
              className="bg-[#E6E6EA] text-[#1A1A1E] font-bold rounded-2xl px-2 py-2 text-sm shadow transition whitespace-nowrap focus:outline-none"
              style={{ display: 'flex', alignItems: 'center', height: 40, width: 40, minWidth: 40, flexShrink: 0, padding: 0, marginLeft: 0, border: '1px solid #E6E6EA', justifyContent: 'center', borderRadius: 20, alignSelf: 'flex-start' }}
              onClick={() => showPrepNotice('재료 사진을 찍으면 알아서 인식해 담아 주는 기능을 준비하고 있어요.')}
              title="사진으로 재료 인식(준비 중)"
              aria-label="사진으로 재료 담기(준비 중)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8.2h3.1l1.5-2.2h6.8l1.5 2.2H20a1.6 1.6 0 0 1 1.6 1.6v8.4A1.6 1.6 0 0 1 20 19.8H4a1.6 1.6 0 0 1-1.6-1.6V9.8A1.6 1.6 0 0 1 4 8.2z" />
                <circle cx="12" cy="13.6" r="3.4" />
              </svg>
            </button>
          </div>
        </div>
        {/* IngredientDetailModal */}
        <IngredientDetailModal
          isOpen={modalOpen}
          onClose={() => { 
            setModalOpen(false); 
            setModalIngredient(null);
            setModalInitialData(null);
          }}
          ingredient={modalIngredient || ''}
          initialStorageType={modalInitialData?.storageType || null}
          initialDate={modalInitialData?.date || null}
          initialDateType={modalInitialData?.dateType || null}
          onComplete={handleModalComplete}
        />
        {/* 재고 관리 구역 */}
        <div style={{ maxWidth: 400, margin: '0 auto', paddingLeft: 20, paddingRight: 20, width: '100%', marginTop: 48, boxSizing: 'border-box' }}>
          <div className="flex items-center justify-between mb-2" style={{ position: 'relative', width: '100%' }}>
            <h2 className="text-[16px] font-bold text-[#1A1A1E]">내 냉장고 재고 관리</h2>
            {/* 저장 버튼을 없애고 상태 표시로 교체.
                재료가 바뀌면 자동으로 저장되므로 사용자가 누를 일이 없다.
                다만 예전 자동 저장은 실패해도 콘솔에만 찍고 끝나서 저장이 안 된 걸
                알 수 없었기 때문에(그래서 수동 저장 버튼이 생겼던 것),
                이제 상태를 눈에 보이게 하고 실패 시 다시 시도할 수 있게 한다. */}
            {isLoggedIn && user?.id && saveStatus !== 'idle' && (
              <div
                role="status"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: saveStatus === 'error' ? 'var(--danger)' : 'var(--ink-400)',
                }}
              >
                {saveStatus === 'saving' && '저장 중…'}
                {saveStatus === 'success' && '저장됨'}
                {saveStatus === 'error' && (
                  <>
                    저장하지 못했어요
                    <button
                      type="button"
                      onClick={handleSaveClick}
                      style={{
                        height: 26,
                        padding: '0 10px',
                        boxSizing: 'border-box',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--ink-900)',
                        background: 'var(--surface-sub)',
                        border: '1px solid var(--line-300)',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      다시 시도
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{height: 1, width: '100%', background: 'var(--line-200)', marginBottom: 14}} />
          <div data-guide-target="storage-areas">
          {/* 냉동보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <SectionIcon kind="frozen" /><span style={{ marginLeft: 6 }}>냉동보관</span>
              <SortDropdown value={frozenSort} onChange={setFrozenSort} className="ml-2" />
              {(frozen ?? []).length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#3A3A42] hover:bg-[#F5F5F7] active:bg-[#E6E6EA] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('frozen')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <ScrollablePillSection watchKey={(frozen ?? []).length}>
              {(frozen ?? []).length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(frozen ?? [], frozenSort).map((item) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('frozen', id)}
                  onSettingsClick={handleTagClick}
                  data-guide-target="settings-icon"
                />
              ))}
            </ScrollablePillSection>
          </div>
          {/* 냉장보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <SectionIcon kind="fridge" /><span style={{ marginLeft: 6 }}>냉장보관</span>
              <SortDropdown value={fridgeSort} onChange={setFridgeSort} className="ml-2" />
              {fridge && fridge.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#3A3A42] hover:bg-[#F5F5F7] active:bg-[#E6E6EA] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('fridge')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <ScrollablePillSection watchKey={(fridge ?? []).length}>
              {fridge && fridge.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(fridge ?? [], fridgeSort).map((item, index) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('fridge', id)}
                  onSettingsClick={handleTagClick}
                  isFirstInFridge={index === 0}
                />
              ))}
            </ScrollablePillSection>
          </div>
          {/* 실온보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <SectionIcon kind="room" /><span style={{ marginLeft: 6 }}>실온보관</span>
              <SortDropdown value={roomSort} onChange={setRoomSort} className="ml-2" />
              {room && room.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#3A3A42] hover:bg-[#F5F5F7] active:bg-[#E6E6EA] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('room')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <ScrollablePillSection watchKey={(room ?? []).length}>
              {room && room.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(room ?? [], roomSort).map((item) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('room', id)}
                  onSettingsClick={handleTagClick}
                  data-guide-target="settings-icon"
                />
              ))}
            </ScrollablePillSection>
          </div>
          </div>
          
          {/* 쿠팡 광고 - 실온 보관 영역 바로 아래 */}
          <div style={{ marginTop: 32, marginBottom: 24 }}>
            <BottomCoupangAd showCondition={true} />
          </div>
        </div>
        {/* 하단 내비게이션 */}
        <div className="w-full">
          <BottomNavBar activeTab="myfridge" />
        </div>
        {toast && toast.visible && (
          <Toast message={toast.message} onUndo={handleCancelDelete} onClose={undoDelete} />
        )}
        {infoToast && (
          <div
            style={{
              position: 'fixed',
              bottom: 100,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(34,34,34,0.9)',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: 12,
              fontWeight: 400,
              fontSize: 16,
              zIndex: 'var(--z-toast)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              // 예전에는 `nowrap` + `말줄임` 이라 안내가 통째로 잘려
              // 무슨 말인지 알 수 없었다. 안내문은 길 수 있으므로 줄바꿈을 허용한다.
              maxWidth: 'min(320px, calc(100vw - 40px))',
              lineHeight: 1.5,
              wordBreak: 'keep-all',
              textAlign: 'center',
            }}
          >
            {infoToast.text}
          </div>
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
            // 나중에/배경 닫기: 비로그인 유지하되 방금 확정하려던 재료는 로컬에 반영
            if (pendingIngredient) {
              handleModalComplete(pendingIngredient, true);
            }
            setPendingIngredient(null);
          }}
          onConfirm={() => {
            // 3초 회원가입: 재료 반영 후 로그인으로 이동
            if (pendingIngredient) {
              handleModalComplete(pendingIngredient, true);
              setPendingIngredient(null);
            }
          }}
          message="더 많은 재료를 안전히 저장하려면"
          subMessage="회원가입이 필요해요"
          dismissLabel="나중에"
          confirmLabel="3초 회원가입"
        />
        
        {/* 환영 모달 - 처음 방문한 사용자에게만 표시 */}
        <WelcomeModal
          visible={showWelcomeModal}
          onClose={() => {
            setShowWelcomeModal(false);
            // 모달 닫으면 가이드 시작
            const urlParams = new URLSearchParams(window.location.search);
            const forceShowWelcome = urlParams.get('showWelcome') === 'true';
            const guideShown = localStorage.getItem('myfridge_guide_shown');
            
            // 강제 표시 모드이거나 가이드가 아직 표시되지 않았으면 가이드 시작
            if (forceShowWelcome || !guideShown) {
              setTimeout(() => {
                markUsageGuideOpened();
                setShowGuide(true);
                setGuideStep(0);
              }, 300);
            } else {
              markUsageGuideFinished();
            }
          }}
        />
        
        {/* 사용 가이드 오버레이 */}
        <GuideOverlay
          visible={showGuide}
          currentStep={guideStep}
          onPrevious={() => setGuideStep((s) => Math.max(0, s - 1))}
          onNext={() => {
            const guideSteps = baseGuideSteps;
            
            if (guideStep < guideSteps.length - 1) {
              setGuideStep(guideStep + 1);
            } else {
              // 마지막 단계에서 '다음' 버튼을 누르면 가이드 완료 처리
              setShowGuide(false);
              localStorage.setItem('myfridge_guide_shown', 'true');
              // 내냉장고 가이드 완료 표시 - navigate 전에 설정
              localStorage.setItem('myfridge_guide_completed', 'true');
              console.log('[MyFridge] 가이드 완료 - 플래그 설정:', localStorage.getItem('myfridge_guide_completed'));
              // 내냉장고 가이드 완료 후 냉장고 요리 페이지로 이동 (URL 파라미터 추가)
              setTimeout(() => {
                console.log('[MyFridge] 냉장고 요리 페이지로 이동');
                navigate('/recipe-list?fromGuide=true');
              }, 500);
            }
          }}
          onClose={() => {
            // '설명 건너뛰기' 버튼을 누르면 가이드만 닫고 페이지 이동하지 않음
            setShowGuide(false);
            localStorage.setItem('myfridge_guide_shown', 'true');
            markUsageGuideFinished();
            console.log('[MyFridge] 가이드 건너뛰기 - 페이지 이동 없음');
          }}
          steps={baseGuideSteps}
          isLastStepConfirm={false}
          totalSteps={isLoggedIn && user?.id ? 12 : 11}
          startStepOffset={0}
        />
      </div>
      <BottomNavBar activeTab="myfridge" />
    </div>
  );
};

export default MyFridge; 