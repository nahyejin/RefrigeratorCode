import * as React from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import TagPill from '../components/TagPill';
import IngredientDetailModal from '../components/IngredientDetailModal';
import SortDropdown, { SortType } from '../components/SortDropdown';
import receiptImg from '../assets/영수증.png';
import { useState } from 'react';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'myfridge_ingredients';
const TOAST_DURATION = 10000;

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ frozen, fridge, room }));
  } catch (error) {
    console.error('[Storage] 재료 데이터 저장 실패:', error);
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
}

const IngredientPill: React.FC<IngredientPillProps> = ({ item, onRemove, onInfoClick, onSettingsClick }) => {
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
  const [frozen, setFrozen] = React.useState<Ingredient[] | null>(null);
  const [fridge, setFridge] = React.useState<Ingredient[] | null>(null);
  const [room, setRoom] = React.useState<Ingredient[] | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [ingredientDict, setIngredientDict] = React.useState<{ [key: string]: string }>({});
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const toastTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalIngredient, setModalIngredient] = React.useState<string | null>(null);
  const [infoToast, setInfoToast] = React.useState<{text: string} | null>(null);
  const [frozenSort, setFrozenSort] = React.useState<SortType>('expiry');
  const [fridgeSort, setFridgeSort] = React.useState<SortType>('expiry');
  const [roomSort, setRoomSort] = React.useState<SortType>('expiry');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loaded = loadIngredients();
    setFrozen(loaded.frozen);
    setFridge(loaded.fridge);
    setRoom(loaded.room);
    // 로컬 스토리지에서 로드하는 것은 즉시 완료되므로 로딩 종료
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
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
        
        setIngredientDict(ingredients);
        
        // 재료 사전 로드 후, 초기 진입 시 '냉장보관'에 '계란'이 없으면 추가
        const loaded = loadIngredients();
        const hasEgg = loaded.fridge && loaded.fridge.some(ing => {
          const ingName = typeof ing === 'string' ? ing : ing.name;
          // '계란' 또는 '달걀'이 있는지 확인
          return ingName === '계란' || ingName === '달걀' || 
                 ingredients[ingName] === '달걀' || ingredients[ingName] === '계란';
        });
        
        if (!hasEgg && (!loaded.fridge || loaded.fridge.length === 0)) {
          // '계란'을 keyword로 변환 (synonym -> keyword)
          const eggKeyword = ingredients['계란'] || '달걀'; // '계란'이 synonym이면 keyword인 '달걀'로 변환
          const eggId = `egg-${Date.now()}`;
          const newFridge = [{ id: eggId, name: eggKeyword }];
          setFridge(newFridge);
          // localStorage에도 저장
          saveIngredients(loaded.frozen, newFridge, loaded.room);
        }
      })
      .catch(error => {
        console.error('Error loading ingredient dictionary:', error);
      });
  }, []);

  React.useEffect(() => {
    if (frozen !== null && fridge !== null && room !== null) {
      saveIngredients(frozen, fridge, room);
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

  const handleModalComplete = (data: { ingredient: string; storageType: StorageBox; hasExpiration: boolean; date: string | null; }) => {
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
      // 새 재료 추가
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
      <div className="bg-white w-full" style={{position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, maxWidth: '100%', margin: '0 auto'}}>
        <TopNavBar />
      </div>
      <div className="bg-white w-full p-0 m-0 pb-24" style={{ marginTop: '56px' }}>
        {/* 타이틀+입력창 그룹 */}
        <div className="flex flex-col items-center justify-center w-full" style={{ marginTop: 40, marginBottom: 40 }}>
          <h1 className="text-[18px] font-bold text-[#111] text-center mb-2">내 냉장고 재료 추가</h1>
        </div>
        <div style={{ maxWidth: 360, margin: '0 auto', paddingLeft: 20, paddingRight: 20, width: '100%' }}>
          <div
            className="flex gap-2 mb-4"
            style={{
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              justifyContent: 'center',
              alignItems: 'center',
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
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[10] custom-scrollbar" 
                  style={{ 
                    maxHeight: '240px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    position: 'absolute'
                  }}
                >
                  {combinedFiltered.map((item, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelect(item)}
                      style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis'
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
              style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 18px', fontSize: 15, marginLeft: 0 }}
              onClick={() => combinedFiltered.length > 0 && handleSelect(combinedFiltered[0])}
              disabled={combinedFiltered.length === 0}
            >
              입력
            </button>
            <button
              type="button"
              className="bg-[#e5e5e5] text-[#222] font-bold rounded-2xl px-2 py-2 text-sm shadow transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#ccc] focus:border-[#ccc]"
              style={{ display: 'flex', alignItems: 'center', height: 40, minWidth: 40, padding: 0, fontSize: 15, marginLeft: 0, border: '1px solid #e5e5e5', justifyContent: 'center', borderRadius: 20 }}
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
              {sortIngredients(fridge ?? [], fridgeSort).map((item) => (
                <IngredientPill
                  key={`${item.id}-${item.name}`}
                  item={item}
                  onRemove={(id) => removeTag('fridge', id)}
                  onInfoClick={handleTagInfo}
                  onSettingsClick={handleTagClick}
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
      </div>
    </div>
  );
};

export default MyFridge; 