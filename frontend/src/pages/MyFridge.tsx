import * as React from 'react';
import BottomNavBar from '../components/BottomNavBar';
import TagPill from '../components/TagPill';
import IngredientDetailModal from '../components/IngredientDetailModal';
import SortDropdown, { SortType } from '../components/SortDropdown';
import receiptImg from '../assets/영수증.png';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RegisterPromptModal from '../components/RegisterPromptModal';
import WelcomeModal from '../components/WelcomeModal';
import GuideOverlay from '../components/GuideOverlay';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'myfridge_ingredients';
const TOAST_DURATION = 10000;

// 가이드 단계 정의
const guideSteps = [
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

// =====================
// 타입 정의
// =====================

export interface Ingredient {
  id: string;
  name: string;
  expiry?: string;
  purchase?: string;
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
  
  if (sort === 'expiry') {
    const withExpiry = arr.filter(i => i.expiry);
    const withoutExpiry = arr.filter(i => !i.expiry);
    // 유통기한 있는 것들을 날짜순으로 정렬 (임박한 것부터)
    withExpiry.sort((a, b) => (a.expiry! > b.expiry! ? 1 : -1));
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
    const withExpiry = withoutPurchase.filter(i => i.expiry);
    const noDate = withoutPurchase.filter(i => !i.expiry);
    withExpiry.sort((a, b) => (a.expiry! > b.expiry! ? 1 : -1));
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
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 12,
      fontWeight: 400,
      fontSize: 15,
      zIndex: 9999,
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
    <span style={{ fontWeight: 400, color: '#fff', marginRight: 8, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>정말 삭제하시겠습니까?</span>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onUndo}>아니요</button>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onClose}>네</button>
  </div>
);

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

// =====================
// IngredientPill 컴포넌트
// =====================

interface IngredientPillProps {
  item: Ingredient;
  onRemove: (id: string) => void;
  onInfoClick: (item: Ingredient) => void;
  onSettingsClick: (item: Ingredient) => void;
  isFirstInFridge?: boolean;
}

const IngredientPill: React.FC<IngredientPillProps> = ({ item, onRemove, onInfoClick, onSettingsClick, isFirstInFridge = false }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 8, marginBottom: 4 }}>
      <TagPill 
        style={{ fontSize: 11, cursor: 'default', marginRight: 0, marginBottom: 0 }}
      >
        <span 
          className="truncate max-w-[100px]"
          style={{ cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={(e) => {
            // X 버튼 영역이 아닐 때만 정보 표시
            const target = e.target as HTMLElement;
            if (!target.closest('span[title="삭제"]')) {
              e.stopPropagation();
              onInfoClick(item);
            }
          }}
        >
          {item.name}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 300,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            marginLeft: 4,
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
      <span
        style={{
          fontSize: 14,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={e => { e.stopPropagation(); onSettingsClick(item); }}
        title="설정"
        {...(isFirstInFridge ? { 'data-guide-target': 'settings-icon' } : {})}
      >
        ⚙︎
      </span>
    </div>
  );
};

// =====================
// 메인 컴포넌트
// =====================

const MyFridge: React.FC = () => {
  console.log('[MyFridge] 컴포넌트 렌더링 시작');
  
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
  const [infoToast, setInfoToast] = React.useState<{text: string} | null>(null);
  const [frozenSort, setFrozenSort] = React.useState<SortType>('expiry');
  const [fridgeSort, setFridgeSort] = React.useState<SortType>('expiry');
  const [roomSort, setRoomSort] = React.useState<SortType>('expiry');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [pendingIngredient, setPendingIngredient] = useState<{ ingredient: string; storageType: StorageBox; hasExpiration: boolean; date: string | null; } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const isInitialLoad = React.useRef(true); // 초기 로드 플래그

  React.useEffect(() => {
    const loaded = loadIngredients();
    const hasData = loaded.frozen.length > 0 || loaded.fridge.length > 0 || loaded.room.length > 0;
    
    // 데이터가 있으면 초기 로드 완료로 표시 (CSV 로드 후 초기 재료 추가가 필요 없음)
    if (hasData) {
      isInitialLoad.current = false;
      // 재료가 있으면 localStorage에 강제로 저장 (동기화 보장)
      console.log('[MyFridge] 기존 재료 발견 - localStorage에 저장:', {
        frozen: loaded.frozen.length,
        fridge: loaded.fridge.length,
        room: loaded.room.length
      });
      saveIngredients(loaded.frozen, loaded.fridge, loaded.room);
    }
    // 데이터가 없으면 CSV 로드 후 초기 재료 추가가 필요하므로 플래그 유지
    
    setFrozen(loaded.frozen);
    setFridge(loaded.fridge);
    setRoom(loaded.room);
    // 로컬 스토리지에서 로드하는 것은 즉시 완료되므로 로딩 종료
    setLoading(false);
  }, []);

  React.useEffect(() => {
    console.log('[MyFridge] 두 번째 useEffect 실행 - CSV 파일 로드 시작');
    
    const initializeIngredients = (ingredients: { [key: string]: string }) => {
      setIngredientDict(ingredients);
      
      // 재료 사전 로드 후, 초기 진입 시 기본 재료가 없으면 추가
      const loaded = loadIngredients();
      const isEmpty = (!loaded.fridge || loaded.fridge.length === 0) && 
                      (!loaded.room || loaded.room.length === 0) && 
                      (!loaded.frozen || loaded.frozen.length === 0);
      
      if (isEmpty) {
          // 초기 재료 추가 중이므로 useEffect에서 저장하지 않도록 플래그 설정
          isInitialLoad.current = true;
          
          // 기본 재료 목록 정의
          // 실온보관: 10개
          const defaultRoomIngredients = [
            '소금', '설탕', '간장', '식용유', '참기름', '후추', '올리고당', '물엿', '식초', '라면'
          ];
          // 냉장보관: 16개
          const defaultFridgeIngredients = [
            '마늘', '대파', '달걀', '된장', '고추장', '고춧가루', '밀가루', '전분', '미림', '맛술', '양파', '감자', '당근', '두부', '우유', '김치'
          ];
          // 냉동보관: 3개
          const defaultFrozenIngredients = [
            '돼지고기', '닭고기', '만두'
          ];
          
          // 재료 이름을 keyword로 변환 (synonym -> keyword)
          // 재료 사전에 없으면 원래 이름 사용
          const convertToKeyword = (name: string): string => {
            // 직접 매칭 시도
            if (ingredients[name]) {
              return ingredients[name];
            }
            // 대소문자 무시하고 찾기
            const foundKey = Object.keys(ingredients).find(
              key => key.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (foundKey) {
              return ingredients[foundKey];
            }
            // 공백 제거 후 찾기
            const foundKeyNoSpace = Object.keys(ingredients).find(
              key => key.replace(/\s/g, '').toLowerCase() === name.replace(/\s/g, '').toLowerCase()
            );
            if (foundKeyNoSpace) {
              return ingredients[foundKeyNoSpace];
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
          
          // 냉장보관 재료 추가
          const newFridge = defaultFridgeIngredients.map((name, index) => ({
            id: `fridge-${Date.now()}-${index}`,
            name: convertToKeyword(name)
          }));
          
          // 냉동보관 재료 추가
          const newFrozen = defaultFrozenIngredients.map((name, index) => ({
            id: `frozen-${Date.now()}-${index}`,
            name: convertToKeyword(name)
          }));
          
          // 디버깅: 저장되는 재료 이름 확인
          console.log('[MyFridge] 초기 재료 추가:', {
            room: newRoom.map(r => r.name),
            fridge: newFridge.map(r => r.name),
            ingredientDictSample: Object.keys(ingredients).slice(0, 30) // 재료 사전 샘플 확인
          });
          
          // 재료 사전에서 특정 재료 찾기 테스트
          console.log('[MyFridge] 재료 사전 검색 테스트:', {
            '소금': ingredients['소금'],
            '설탕': ingredients['설탕'],
            '간장': ingredients['간장'],
            '식용유': ingredients['식용유'],
            '참기름': ingredients['참기름'],
            '후추': ingredients['후추'],
            '밥': ingredients['밥'],
            '양파': ingredients['양파'],
            '감자': ingredients['감자'],
            '식초': ingredients['식초'],
            '고춧가루': ingredients['고춧가루'],
            '밀가루': ingredients['밀가루'],
            '마늘': ingredients['마늘'],
            '케첩': ingredients['케첩'],
            '우유': ingredients['우유'],
            '된장': ingredients['된장'],
            '고추장': ingredients['고추장'],
            '참치캔': ingredients['참치캔'],
            '대파': ingredients['대파'],
            '청양고추': ingredients['청양고추'],
            '달걀': ingredients['달걀'],
            '계란': ingredients['계란']
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
          
          // 초기 재료 추가 완료 후 초기 로드 플래그 해제
          isInitialLoad.current = false;
          
          // 처음 방문한 사용자에게만 Welcome 모달 표시
          // 개발/테스트용: URL에 ?showWelcome=true 추가하면 강제로 모달 표시
          const urlParams = new URLSearchParams(window.location.search);
          const forceShowWelcome = urlParams.get('showWelcome') === 'true';
          const welcomeModalShown = localStorage.getItem('welcome_modal_shown');
          
          if (forceShowWelcome || !welcomeModalShown) {
            // 약간의 지연 후 모달 표시 (재료가 화면에 렌더링된 후)
            setTimeout(() => {
              setShowWelcomeModal(true);
              if (!forceShowWelcome) {
                localStorage.setItem('welcome_modal_shown', 'true');
              }
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
        } else {
          // 재료가 이미 있으면 초기 로드 완료
          isInitialLoad.current = false;
        }
    };
    
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => {
        if (!res.ok) {
          throw new Error(`CSV 파일 로드 실패: ${res.status} ${res.statusText}`);
        }
        return res.text();
      })
      .then(csv => {
        console.log('[MyFridge] CSV 파일 로드 완료, 파싱 시작');
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const synonymsIdx = header.indexOf('synonyms');
        const categoryIdx = header.indexOf('대분류');
        
        const ingredients = {};
        
        lines.slice(1).forEach(line => {
          const values = line.split(',');
          const keyword = values[nameIdx]?.trim();
          const synonyms = values[synonymsIdx]?.split(',').map(s => s.trim());
          const category = values[categoryIdx]?.trim();
          
          if (keyword && category === '재료') {
            ingredients[keyword] = keyword;
            if (synonyms) {
              synonyms.forEach(synonym => {
                ingredients[synonym] = keyword;
              });
            }
          }
        });
        
        console.log('[MyFridge] CSV 파싱 완료, 재료 사전 크기:', Object.keys(ingredients).length);
        initializeIngredients(ingredients);
      })
      .catch(error => {
        console.error('[MyFridge] CSV 파일 로드 실패 - 빈 재료 사전으로 초기화 진행:', error);
        // CSV 로드 실패해도 빈 사전으로 초기화 진행 (기본 재료 이름은 그대로 사용)
        initializeIngredients({});
      });
  }, []);

  // URL 파라미터로 모달 강제 표시 (개발/테스트용)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceShowWelcome = urlParams.get('showWelcome') === 'true';
    
    if (forceShowWelcome && !loading) {
      // 페이지 로드 완료 후 모달 표시
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);
    }
  }, [loading]);

  React.useEffect(() => {
    // 초기 로드가 완료된 후에만 저장 (초기 로드 시에는 저장하지 않음)
    // 또한 빈 배열로 덮어쓰는 것을 방지 (데이터가 실제로 있을 때만 저장)
    if (!isInitialLoad.current && frozen !== null && fridge !== null && room !== null) {
      const hasData = frozen.length > 0 || fridge.length > 0 || room.length > 0;
      // 빈 배열로 저장하는 것을 방지 (데이터가 실제로 있을 때만 저장)
      if (hasData) {
        console.log('[MyFridge] useEffect에서 재료 저장:', {
          frozenCount: frozen.length,
          fridgeCount: fridge.length,
          roomCount: room.length
        });
      saveIngredients(frozen, fridge, room);
      } else {
        console.log('[MyFridge] useEffect에서 재료 저장 스킵 (빈 배열):', {
          frozenCount: frozen.length,
          fridgeCount: fridge.length,
          roomCount: room.length,
          isInitialLoad: isInitialLoad.current
        });
      }
    }
  }, [frozen, fridge, room]);

  // Modify the autocomplete logic to use the synonyms
  const combinedFiltered = Object.entries(ingredientDict)
    .filter(([key, value]) => 
      inputValue && 
      (key.includes(inputValue) || value.includes(inputValue))
    )
    .map(([key, value]) => value)
    .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
    .sort((a, b) => {
      if (!inputValue) return 0;
      
      // 입력값의 첫 글자
      const firstChar = inputValue[0];
      
      // 1순위: 정확한 매칭
      const aExact = a === inputValue;
      const bExact = b === inputValue;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // 2순위: 첫 글자로 시작하는 단어들 (가OOO 형태)
      const aStartsWithFirstChar = a.startsWith(firstChar);
      const bStartsWithFirstChar = b.startsWith(firstChar);
      if (aStartsWithFirstChar && !bStartsWithFirstChar) return -1;
      if (!aStartsWithFirstChar && bStartsWithFirstChar) return 1;
      
      // 3순위: 입력값으로 시작하는 단어들
      const aStartsWithInput = a.startsWith(inputValue);
      const bStartsWithInput = b.startsWith(inputValue);
      if (aStartsWithInput && !bStartsWithInput) return -1;
      if (!aStartsWithInput && bStartsWithInput) return 1;
      
      // 4순위: 길이 순으로 정렬 (짧은 것 우선)
      return a.length - b.length;
    });

  // 디버깅용: 입력값과 매칭되는 항목들 확인
  console.log('입력값:', inputValue);
  console.log('필터링된 결과:', combinedFiltered);
  console.log('ingredientDict:', ingredientDict);
  console.log('combinedFiltered:', combinedFiltered);
  console.log('Checking mapping for 계란:', ingredientDict['계란']);

  // 드롭다운이 열릴 때 스크롤바를 표시하기 위해 미세한 스크롤 트리거
  React.useEffect(() => {
    if (showDropdown && dropdownRef.current && combinedFiltered.length > 3) {
      // 드롭다운이 열리고 항목이 3개 이상일 때만 스크롤바 표시
      const dropdown = dropdownRef.current;
      
      // 스크롤바를 확실히 표시하기 위한 함수
      const triggerScrollbar = () => {
        if (dropdown && dropdown.scrollHeight > dropdown.clientHeight) {
          // 1. 먼저 아래로 스크롤
          dropdown.scrollTop = 3;
          // 2. 즉시 다시 위로 (사용자는 변화를 느끼지 못함)
          setTimeout(() => {
            dropdown.scrollTop = 0;
            // 3. 한 번 더 트리거
            setTimeout(() => {
              dropdown.scrollTop = 2;
              setTimeout(() => {
                dropdown.scrollTop = 0;
                // 4. 마지막으로 한 번 더
                setTimeout(() => {
                  dropdown.scrollTop = 1;
                  setTimeout(() => {
                    dropdown.scrollTop = 0;
                  }, 10);
                }, 10);
              }, 10);
            }, 10);
          }, 10);
        }
      };
      
      // DOM이 완전히 렌더링된 후 즉시 실행
      const timer1 = setTimeout(triggerScrollbar, 50);
      const timer2 = setTimeout(triggerScrollbar, 150);
      const timer3 = setTimeout(triggerScrollbar, 300);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [showDropdown, combinedFiltered.length]);

  const showToast = (message: string, deleted: DeletedInfo, duration?: number) => {
    setToast({ visible: true, message, deleted });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), duration ?? TOAST_DURATION);
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
    setModalIngredient(item);
    setModalOpen(true);
    setInputValue('');
    setShowDropdown(false);
    inputRef.current?.focus();
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
      } else if (!data.hasExpiration && data.date) {
        updatedIngredient.purchase = data.date;
        delete updatedIngredient.expiry;
      } else {
        delete updatedIngredient.expiry;
        delete updatedIngredient.purchase;
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
      if (!data.hasExpiration && data.date) obj.purchase = data.date;
      if (data.storageType === 'frozen') setFrozen(prev => prev ? [...prev, obj] : [obj]);
      if (data.storageType === 'fridge') setFridge(prev => prev ? [...prev, obj] : [obj]);
      if (data.storageType === 'room') setRoom(prev => prev ? [...prev, obj] : [obj]);
    }
    
    setModalOpen(false);
    setModalIngredient(null);
  };
  

  // 재료 pill 클릭 시 모달 열기
  const handleTagClick = (item: Ingredient) => {
    setModalIngredient(item.name);
    setModalOpen(true);
  };

  const handleTagInfo = (item: Ingredient) => {
    if (item.expiry) setInfoToast({ text: `유통기한 : ${item.expiry}` });
    else if (item.purchase) setInfoToast({ text: `구매시점 : ${item.purchase}` });
    else setInfoToast({ text: '날짜 정보가 없습니다.' });
    setTimeout(() => setInfoToast(null), 3000);
  };

  const handleRemoveAll = (box: StorageBox) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      removeAll(box);
    }
  };

  if (frozen === null || fridge === null || room === null) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white w-full p-0 m-0 pb-24" style={{ paddingTop: 92 }}>
        {/* 타이틀+입력창 그룹 */}
        <div className="flex flex-col items-center justify-center w-full" style={{ marginBottom: 40 }}>
          <div className="flex items-center justify-center w-full max-w-[360px] px-5 mb-2">
            <h1 className="text-[18px] font-bold text-[#111] text-center">내 냉장고 재료 추가</h1>
          </div>
        </div>
        <div style={{ maxWidth: 360, margin: '0 auto', paddingLeft: 20, paddingRight: 20, width: '100%' }}>
          <div
            className="flex gap-2 mb-4"
            style={{
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: 250, minWidth: 0, flex: '0 1 auto', overflow: 'visible', zIndex: 10 }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="추가할 재료명을 입력하세요"
                className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                style={{
                  width: '100%',
                  height: 40,
                  fontFamily: 'Pretendard, sans-serif',
                }}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
              />
              {showDropdown && combinedFiltered.length > 0 && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[10] autocomplete-scrollbar" 
                  style={{ 
                    maxHeight: '96px', // 3개 항목 기준 (각 항목 약 32px: py-2 = 8px*2 + 텍스트 높이)
                    overflowY: 'scroll', // 'auto' 대신 'scroll'로 변경하여 항상 스크롤바 표시
                    overflowX: 'hidden',
                    position: 'absolute',
                    // 스크롤바 항상 표시 강제
                    scrollbarWidth: 'auto', // thin 대신 auto로 변경
                    scrollbarColor: '#6b7280 #f3f4f6', // 더 진한 색상으로 변경
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
                      onClick={() => handleSelect(item)}
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
              )}
            </div>
            <button
              type="button"
              className="bg-[#FFD600] text-[#222] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition whitespace-nowrap"
              style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 18px', fontSize: 15, marginLeft: 0, alignSelf: 'flex-start' }}
              onClick={() => combinedFiltered.length > 0 && handleSelect(combinedFiltered[0])}
              disabled={combinedFiltered.length === 0}
            >
              입력
            </button>
            <button
              type="button"
              className="bg-[#e5e5e5] text-[#222] font-bold rounded-2xl px-2 py-2 text-sm shadow transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#ccc] focus:border-[#ccc]"
              style={{ display: 'flex', alignItems: 'center', height: 40, minWidth: 40, padding: 0, fontSize: 15, marginLeft: 0, border: '1px solid #e5e5e5', justifyContent: 'center', borderRadius: 20, alignSelf: 'flex-start' }}
              onClick={() => alert('영수증 인식 기능은 곧 지원될 예정입니다!')}
              title="영수증 인식(구현 예정)"
            >
              <img src={receiptImg} alt="영수증" style={{ width: 22, height: 22, objectFit: 'contain', display: 'block' }} />
            </button>
          </div>
        </div>
        {/* IngredientDetailModal */}
        <IngredientDetailModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setModalIngredient(null); }}
          ingredient={modalIngredient || ''}
          onComplete={handleModalComplete}
        />
        {/* 재고 관리 구역 */}
        <div style={{ maxWidth: 360, margin: '0 auto', paddingLeft: 16, paddingRight: 16, width: '100%', marginTop: 48 }}>
          <h2 className="text-[16px] font-bold text-[#111] mb-2">내 냉장고 재고 관리</h2>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          {/* 냉동보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">🧊</span>냉동보관
              <SortDropdown value={frozenSort} onChange={setFrozenSort} className="ml-2" />
              {(frozen ?? []).length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('frozen')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {(frozen ?? []).length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(frozen ?? [], frozenSort).map((item) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('frozen', id)}
                  onInfoClick={handleTagInfo}
                  onSettingsClick={handleTagClick}
                  data-guide-target="settings-icon"
                />
              ))}
            </div>
          </div>
          {/* 냉장보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">❄️</span>냉장보관
              <SortDropdown value={fridgeSort} onChange={setFridgeSort} className="ml-2" />
              {fridge && fridge.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('fridge')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {fridge && fridge.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(fridge ?? [], fridgeSort).map((item, index) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('fridge', id)}
                  onInfoClick={handleTagInfo}
                  onSettingsClick={handleTagClick}
                  isFirstInFridge={index === 0}
                />
              ))}
            </div>
          </div>
          {/* 실온보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">🌡️</span>실온보관
              <SortDropdown value={roomSort} onChange={setRoomSort} className="ml-2" />
              {room && room.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('room')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {room && room.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(room ?? [], roomSort).map((item) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('room', id)}
                  onInfoClick={handleTagInfo}
                  onSettingsClick={handleTagClick}
                  data-guide-target="settings-icon"
                />
              ))}
            </div>
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
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white border border-gray-300 rounded-lg px-6 py-3 text-[#404040] text-sm shadow-lg z-[9999]" style={{ fontWeight: 400 }}>
            {infoToast.text}
          </div>
        )}
        {/* Loading animation */}
        {loading && (
          <div className="loader-toast" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
            <div className="loader-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        )}
        
        {/* 회원가입 유도 모달 */}
        <RegisterPromptModal
          visible={showRegisterModal}
          onClose={() => {
            setShowRegisterModal(false);
            setPendingIngredient(null);
          }}
          onConfirm={() => {
            // 회원가입하기를 누르면 재료 추가 진행 (조건 체크 건너뛰기)
            if (pendingIngredient) {
              handleModalComplete(pendingIngredient, true);
              setPendingIngredient(null);
            }
          }}
          message="더 많은 재료를 저장하려면"
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
                setShowGuide(true);
                setGuideStep(0);
              }, 300);
            }
          }}
        />
        
        {/* 사용 가이드 오버레이 */}
        <GuideOverlay
          visible={showGuide}
          currentStep={guideStep}
          onNext={() => {
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
            console.log('[MyFridge] 가이드 건너뛰기 - 페이지 이동 없음');
          }}
          steps={guideSteps}
          isLastStepConfirm={false}
          totalSteps={9}
          startStepOffset={0}
        />
      </div>
      <BottomNavBar activeTab="myfridge" />
    </div>
  );
};

export default MyFridge; 